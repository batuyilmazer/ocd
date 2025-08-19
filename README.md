# YouTube Downloader

A production-ready, Dockerized application for downloading YouTube videos with a modern React Native Web interface.

## Features

- 🎥 **YouTube Video Download**: Supports YouTube watch URLs, shorts, and youtu.be links
- 📱 **Modern UI**: Built with React Native Web for a responsive, mobile-friendly interface
- 📋 **Clipboard Integration**: Automatically reads YouTube URLs from clipboard
- 🔄 **Real-time Progress**: Live download progress tracking with status polling
- 🚀 **Production Ready**: Dockerized with Nginx reverse proxy and FastAPI backend
- 🛡️ **Security**: Clean, simple configuration with proper proxy handling
- 📁 **File Management**: Automatic file storage and download links
- 🧵 **Thread-based Downloads**: Background processing with progress tracking
- 🎬 **MP4 Output**: Automatic conversion to MP4 format using ffmpeg

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend     │    │     Nginx       │    │   FastAPI       │
│  (React Native │◄──►│  (Reverse Proxy)│◄──►│   Backend)      │
│     Web)       │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
    Static Files            API Proxy              yt-dlp + ffmpeg
                                                      File Storage
                                                      /data/<job_id>.mp4
```

## Services

### Frontend (Port 80)
- **React Native Web** application served by Nginx
- **SPA fallback** routing for all paths
- **Static file caching** with proper headers
- **Clipboard integration** for automatic URL detection
- **Real-time status updates** with polling

### Backend (Port 8000)
- **FastAPI** with async support and comprehensive error handling
- **yt-dlp** for YouTube video downloading with progress hooks
- **ffmpeg** for video processing and MP4 conversion
- **Thread-based background processing** for non-blocking downloads
- **Job management** with in-memory storage and thread-safe operations
- **Static file serving** via `/files` endpoint
- **Comprehensive logging** and error reporting

## Quick Start

### Prerequisites
- Docker and Docker Compose
- At least 2GB RAM available
- Internet connection for video downloads

### 1. Clone and Build
```bash
# Make build script executable
chmod +x build.sh

# Build and start all services
./build.sh
```

### 2. Access the Application
Open your browser and navigate to: **http://localhost**

### 3. Download a Video
1. Copy a YouTube URL to your clipboard
2. The app will automatically detect and paste it
3. Click "İndir" to start the download
4. Monitor progress in real-time
5. Click "Dosyayı İndir" when complete

## API Endpoints

### Core Endpoints
- `POST /api/download` - Start a new download job
- `GET /api/status/{job_id}` - Get job status and progress
- `GET /api/jobs` - List all download jobs
- `DELETE /api/jobs/{job_id}` - Delete a job and its file
- `GET /health` - Health check with system status

### File Access
- `GET /files/{filename}` - Download completed video files
- Files are served via FastAPI StaticFiles for direct access

### Response Models

#### Download Request
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

#### Download Response
```json
{
  "job_id": "uuid-string",
  "status": "queued",
  "message": "Download job created and started"
}
```

#### Status Response
```json
{
  "job_id": "uuid-string",
  "status": "downloading|completed|failed|queued",
  "progress": 45.2,
  "filename": "uuid-string.mp4",
  "error": null
}
```

## Technical Implementation

### Backend Features
- **Thread-based Downloads**: Uses Python threading for non-blocking operations
- **Progress Tracking**: Real-time progress updates via yt-dlp hooks
- **MP4 Conversion**: Automatic format conversion using ffmpeg
- **Thread Safety**: Lock-protected job operations
- **Error Handling**: Comprehensive error catching and reporting
- **File Management**: Automatic cleanup and organization

### Download Process
1. **URL Validation**: Regex-based YouTube URL validation
2. **Job Creation**: Unique UUID-based job identification
3. **Background Processing**: Thread-based download execution
4. **Progress Monitoring**: Real-time progress via yt-dlp hooks
5. **Format Conversion**: Automatic MP4 conversion with ffmpeg
6. **File Storage**: Organized storage under `/data/<job_id>.mp4`

### Nginx Configuration
- **SPA Serving**: Serves React Native Web app from `/usr/share/nginx/html`
- **SPA Fallback**: All routes fall back to `index.html` for client-side routing
- **API Proxy**: Proxies `/api/*` requests to FastAPI backend
- **File Proxy**: Proxies `/files/*` requests for downloads
- **Static Caching**: Proper caching headers for static assets
- **Gzip Compression**: Automatic compression for better performance

## Manual Commands

### Build and Start
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Stop and Cleanup
```bash
# Stop services
docker-compose down

# Remove volumes and containers
docker-compose down -v --remove-orphans

# Rebuild and restart
docker-compose up --build -d
```

### Testing
```bash
# Test backend API
python3 test_backend.py

# Test individual endpoints
curl http://localhost:8000/health
curl http://localhost/api/health
```

## Configuration

### Environment Variables
- `PYTHONUNBUFFERED=1`: Ensures Python output is not buffered

### Volume Mounts
- `./data:/data`: Shared storage for downloaded videos

### Network
- Custom bridge network for service communication
- Frontend accessible on port 80
- Backend internal on port 8000

### Service Names
- **API Service**: `youtube-downloader-api`
- **Nginx Service**: `youtube-downloader-nginx`

## Production Considerations

### Monitoring
- Health checks for both services
- Structured logging with comprehensive error reporting
- Resource usage monitoring
- Job status tracking

### Scaling
- Backend can be scaled horizontally
- Redis/database for job persistence (future enhancement)
- Load balancer for multiple backend instances

### File Management
- Automatic MP4 conversion for compatibility
- Organized file naming with job IDs
- Direct file access via `/files` endpoint
- Automatic cleanup on job deletion

## Troubleshooting

### Common Issues

**Service won't start**
```bash
# Check logs
docker-compose logs

# Verify Docker resources
docker system df
```

**Download fails**
```bash
# Check backend logs
docker-compose logs api

# Verify YouTube URL format
# Check available disk space
# Ensure ffmpeg is available
```

**Frontend not accessible**
```bash
# Check nginx logs
docker-compose logs nginx

# Verify port 80 is not in use
netstat -tulpn | grep :80
```

**File download issues**
```bash
# Check file permissions in data directory
ls -la data/

# Verify backend file serving
curl -I http://localhost:8000/files/test.mp4
```

### Logs and Debugging
```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f api
docker-compose logs -f nginx

# Check container status
docker-compose ps

# Execute commands in container
docker-compose exec api bash
docker-compose exec nginx bash

# Test backend directly
python3 test_backend.py
```

## Development

### Local Development
```bash
# Backend development
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend development
cd frontend
npm install
npm start
```

### API Testing
```bash
# Interactive API docs
http://localhost:8000/docs

# Test with curl
curl -X POST "http://localhost:8000/api/download" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs with `docker-compose logs`
3. Test backend with `python3 test_backend.py`
4. Open an issue on GitHub
