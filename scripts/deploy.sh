#!/bin/bash

# Deployment script for OCD project
# This script should be run on the Ubuntu VM

set -e

# Configuration
PROJECT_DIR="/opt/ocd"
BACKUP_DIR="/opt/ocd-backups"
LOG_FILE="/var/log/ocd-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}$1${NC}"
    log "$1"
}

# Warning message
warning() {
    echo -e "${YELLOW}$1${NC}"
    log "$1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error_exit "This script should not be run as root"
fi

# Create log file if it doesn't exist
touch "$LOG_FILE"

log "Starting deployment process..."

# Check if project directory exists
if [[ ! -d "$PROJECT_DIR" ]]; then
    error_exit "Project directory $PROJECT_DIR does not exist"
fi

# Navigate to project directory
cd "$PROJECT_DIR" || error_exit "Failed to navigate to project directory"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup current docker-compose.yml if it exists
if [[ -f "docker-compose.yml" ]]; then
    cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Pull latest changes from git
log "Pulling latest changes from git..."
git pull origin main || error_exit "Failed to pull from git"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    error_exit "docker-compose is not installed"
fi

# Check if docker is running
if ! docker info &> /dev/null; then
    error_exit "Docker is not running"
fi

# Stop existing containers
log "Stopping existing containers..."
docker-compose down || warning "Failed to stop containers (they might not be running)"

# Build new images
log "Building new Docker images..."
docker-compose build --no-cache || error_exit "Failed to build Docker images"

# Start new containers
log "Starting new containers..."
docker-compose up -d || error_exit "Failed to start containers"

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 30

# Check service health
log "Checking service health..."
if docker-compose ps | grep -q "unhealthy"; then
    warning "Some services are unhealthy. Check logs with: docker-compose logs"
else
    success "All services are healthy!"
fi

# Clean up old images
log "Cleaning up old Docker images..."
docker system prune -f

# Show running containers
log "Current running containers:"
docker-compose ps

success "Deployment completed successfully!"
log "Deployment completed successfully!"
