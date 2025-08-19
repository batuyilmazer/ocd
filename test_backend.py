#!/usr/bin/env python3
"""
Simple test script for the YouTube Downloader backend API
Run this after starting the backend service
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_health():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Status: {data.get('status')}")
            print(f"   Active jobs: {data.get('active_jobs')}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_download_start():
    """Test starting a download job"""
    print("\n🔍 Testing download start...")
    
    # Test with invalid URL first
    print("   Testing invalid URL...")
    try:
        response = requests.post(f"{BASE_URL}/api/download", 
                               json={"url": "https://invalid-url.com"})
        print(f"   Invalid URL response: {response.status_code}")
        if response.status_code == 422:
            print("   ✅ Properly rejected invalid URL")
        else:
            print("   ❌ Should have rejected invalid URL")
    except Exception as e:
        print(f"   ❌ Error testing invalid URL: {e}")
    
    # Test with valid YouTube URL
    print("   Testing valid YouTube URL...")
    try:
        response = requests.post(f"{BASE_URL}/api/download", 
                               json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
        print(f"   Valid URL response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            job_id = data.get('job_id')
            print(f"   ✅ Download job created: {job_id}")
            return job_id
        else:
            print(f"   ❌ Failed to create download job: {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Error testing valid URL: {e}")
        return None

def test_job_status(job_id):
    """Test getting job status"""
    if not job_id:
        return
    
    print(f"\n🔍 Testing job status for {job_id}...")
    try:
        response = requests.get(f"{BASE_URL}/api/status/{job_id}")
        print(f"   Status response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Job status: {data.get('status')}")
            print(f"   Progress: {data.get('progress')}%")
            return data.get('status')
        else:
            print(f"   ❌ Failed to get job status: {response.text}")
    except Exception as e:
        print(f"   ❌ Error getting job status: {e}")

def test_list_jobs():
    """Test listing all jobs"""
    print("\n🔍 Testing job listing...")
    try:
        response = requests.get(f"{BASE_URL}/api/jobs")
        print(f"   List jobs response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Total jobs: {data.get('total')}")
            jobs = data.get('jobs', [])
            for job in jobs:
                print(f"     - {job.get('job_id')[:8]}...: {job.get('status')}")
        else:
            print(f"   ❌ Failed to list jobs: {response.text}")
    except Exception as e:
        print(f"   ❌ Error listing jobs: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting YouTube Downloader Backend Tests")
    print("=" * 50)
    
    # Test health endpoint
    if not test_health():
        print("❌ Backend is not healthy. Make sure it's running.")
        return
    
    # Test download start
    job_id = test_download_start()
    
    # Test job listing
    test_list_jobs()
    
    # Test job status if we have a job
    if job_id:
        test_job_status(job_id)
        
        # Wait a bit and check status again
        print(f"\n⏳ Waiting 5 seconds to check progress...")
        time.sleep(5)
        test_job_status(job_id)
    
    print("\n" + "=" * 50)
    print("✅ Tests completed!")

if __name__ == "__main__":
    main()
