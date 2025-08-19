#!/bin/bash

# YouTube Downloader Build Script
set -e

echo "🚀 Building YouTube Downloader..."

# Create data directory if it doesn't exist
mkdir -p data

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🔄 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
if docker-compose ps | grep -q "healthy"; then
    echo "✅ All services are healthy!"
else
    echo "⚠️  Some services may not be ready yet. Check with: docker-compose ps"
fi

echo "🌐 Application is running at: http://localhost"
echo "📁 Downloaded files will be stored in: ./data"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Rebuild: docker-compose up --build -d"
echo "  Clean up: docker-compose down -v --remove-orphans"
echo ""
echo "🔧 Service names:"
echo "  - API: youtube-downloader-api"
echo "  - Nginx: youtube-downloader-nginx"
