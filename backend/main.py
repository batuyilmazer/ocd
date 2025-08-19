import os
import uuid
import threading
import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, validator
import re
from typing import Optional
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube Downloader API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directory
DATA_DIR = Path("/data")
DATA_DIR.mkdir(exist_ok=True)

# Mount static files for serving downloads
app.mount("/files", StaticFiles(directory=str(DATA_DIR)), name="files")

# In-memory job storage with thread safety
jobs = {}
jobs_lock = threading.Lock()

class DownloadRequest(BaseModel):
    url: str
    
    @validator('url')
    def validate_youtube_url(cls, v):
        # YouTube URL patterns
        patterns = [
            r'https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
            r'https?://(?:www\.)?youtube\.com/shorts/[\w-]+',
            r'https?://youtu\.be/[\w-]+',
            r'https?://(?:www\.)?youtube\.com/embed/[\w-]+'
        ]
        
        if not any(re.match(pattern, v) for pattern in patterns):
            raise ValueError('Invalid YouTube URL format. Supported formats: youtube.com/watch, youtube.com/shorts, youtu.be, youtube.com/embed')
        return v

class DownloadResponse(BaseModel):
    job_id: str
    status: str
    message: str

class StatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[float] = None
    filename: Optional[str] = None
    error: Optional[str] = None

def download_video(url: str, job_id: str):
    try:
        with jobs_lock:
            jobs[job_id]["status"] = "downloading"
            jobs[job_id]["progress"] = 0.0
        
        def progress_hook(d):
            try:
                if d['status'] == 'downloading':
                    if 'total_bytes' in d and d['total_bytes']:
                        progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                        with jobs_lock:
                            jobs[job_id]["progress"] = min(progress, 99.9)
                    elif 'total_bytes_estimate' in d and d['total_bytes_estimate']:
                        progress = (d['downloaded_bytes'] / d['total_bytes_estimate']) * 100
                        with jobs_lock:
                            jobs[job_id]["progress"] = min(progress, 99.9)
            except Exception as e:
                logger.error(f"Error updating progress for job {job_id}: {e}")
        
        # First, extract info to check available formats
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                logger.info(f"Video info extracted for job {job_id}: {info.get('title', 'Unknown')}")
                
                # Check if video formats are available
                formats = info.get('formats', [])
                video_formats = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none']
                
                if not video_formats:
                    with jobs_lock:
                        jobs[job_id]["status"] = "failed"
                        jobs[job_id]["error"] = "No video formats available for this URL"
                    return
                    
            except Exception as e:
                logger.error(f"Error extracting video info for job {job_id}: {e}")
                with jobs_lock:
                    jobs[job_id]["status"] = "failed"
                    jobs[job_id]["error"] = f"Could not extract video info: {str(e)}"
                return
        
        # Download with better format selection
        ydl_opts = {
            'format': 'best[ext=mp4]/best[ext=webm]/best[ext=mkv]/best',
            'outtmpl': str(DATA_DIR / f'{job_id}.%(ext)s'),
            'progress_hooks': [progress_hook],
            'merge_output_format': 'mp4',
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }],
            'writethumbnail': False,
            'writesubtitles': False,
            'writeautomaticsub': False,
            'ignoreerrors': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
            # Look for downloaded files
            downloaded_file = None
            for ext in ['mp4', 'webm', 'mkv', 'm4a', 'mp3']:
                potential_file = DATA_DIR / f'{job_id}.{ext}'
                if potential_file.exists():
                    downloaded_file = potential_file
                    break
            
            if downloaded_file:
                # Ensure it's MP4
                if downloaded_file.suffix != '.mp4':
                    mp4_file = DATA_DIR / f'{job_id}.mp4'
                    try:
                        import subprocess
                        subprocess.run([
                            'ffmpeg', '-i', str(downloaded_file), 
                            '-c:v', 'copy', '-c:a', 'copy', 
                            str(mp4_file), '-y'
                        ], capture_output=True, text=True, timeout=300, check=True)
                        
                        if mp4_file.exists() and mp4_file.stat().st_size > 0:
                            downloaded_file.unlink()  # Remove original file
                            downloaded_file = mp4_file
                        else:
                            raise Exception("FFmpeg conversion failed or produced empty file")
                    except subprocess.CalledProcessError as e:
                        logger.error(f"FFmpeg conversion failed for job {job_id}: {e}")
                        # Keep original file if conversion fails
                        pass
                    except Exception as e:
                        logger.error(f"FFmpeg error for job {job_id}: {e}")
                        # Keep original file if conversion fails
                        pass
                
                with jobs_lock:
                    jobs[job_id]["status"] = "completed"
                    jobs[job_id]["progress"] = 100.0
                    jobs[job_id]["filename"] = downloaded_file.name
                    logger.info(f"Download completed successfully for job {job_id}: {downloaded_file.name}")
            else:
                with jobs_lock:
                    jobs[job_id]["status"] = "failed"
                    jobs[job_id]["error"] = "Download completed but no video file found. This might be due to video restrictions or format issues."
                    logger.error(f"Download completed but file not found for job {job_id}")
                    
    except yt_dlp.DownloadError as e:
        error_msg = f"YouTube download error: {str(e)}"
        logger.error(f"yt-dlp error for job {job_id}: {e}")
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = error_msg
    except Exception as e:
        error_msg = f"Unexpected error during download: {str(e)}"
        logger.error(f"Unexpected error for job {job_id}: {e}")
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = error_msg

@app.post("/api/download", response_model=DownloadResponse)
async def start_download(request: DownloadRequest):
    """Start a new download job"""
    try:
        job_id = str(uuid.uuid4())
        
        # Initialize job
        with jobs_lock:
            jobs[job_id] = {
                "status": "queued",
                "progress": 0.0,
                "filename": None,
                "error": None
            }
        
        # Start download in background thread
        download_thread = threading.Thread(
            target=download_video, 
            args=(request.url, job_id),
            daemon=True
        )
        download_thread.start()
        
        logger.info(f"Started download job {job_id} for URL: {request.url}")
        
        return DownloadResponse(
            job_id=job_id,
            status="queued",
            message="Download job created and started"
        )
        
    except Exception as e:
        logger.error(f"Error creating download job: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create download job: {str(e)}"
        )

@app.get("/api/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """Get the status of a download job"""
    try:
        with jobs_lock:
            if job_id not in jobs:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Job {job_id} not found"
                )
            
            job = jobs[job_id]
            
        return StatusResponse(
            job_id=job_id,
            status=job["status"],
            progress=job["progress"],
            filename=job["filename"],
            error=job["error"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status for job {job_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get job status: {str(e)}"
        )

@app.get("/api/jobs")
async def list_jobs():
    """List all download jobs"""
    try:
        with jobs_lock:
            job_list = [
                {
                    "job_id": job_id,
                    "status": job["status"],
                    "progress": job["progress"],
                    "filename": job["filename"],
                    "error": job["error"]
                }
                for job_id, job in jobs.items()
            ]
        
        return {"jobs": job_list, "total": len(job_list)}
        
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to list jobs: {str(e)}"
        )

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a download job and its associated file"""
    try:
        with jobs_lock:
            if job_id not in jobs:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Job {job_id} not found"
                )
            
            job = jobs[job_id]
            
            # Delete associated file if it exists
            if job["filename"]:
                file_path = DATA_DIR / job["filename"]
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Deleted file for job {job_id}: {job['filename']}")
            
            # Remove job from memory
            del jobs[job_id]
            
        return {"message": f"Job {job_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to delete job: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check if data directory is writable
        test_file = DATA_DIR / ".health_check"
        test_file.touch()
        test_file.unlink()
        
        return {
            "status": "healthy",
            "data_directory": str(DATA_DIR),
            "data_directory_writable": True,
            "active_jobs": len([j for j in jobs.values() if j["status"] in ["queued", "downloading"]])
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503, 
            detail=f"Service unhealthy: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
