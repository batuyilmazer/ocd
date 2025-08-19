#!/bin/bash

# Setup script for Ubuntu VM to prepare for OCD project deployment
# This script should be run on your Ubuntu VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/ocd"
DEPLOY_USER="deploy"
GITHUB_REPO="your-username/ocd"  # Change this to your actual GitHub repo

echo -e "${BLUE}Setting up Ubuntu VM for OCD project deployment...${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
apt install -y \
    curl \
    git \
    docker.io \
    docker-compose \
    ufw \
    fail2ban \
    nginx \
    certbot \
    python3-certbot-nginx \
    htop \
    unzip \
    wget

# Start and enable Docker
echo -e "${YELLOW}Starting and enabling Docker...${NC}"
systemctl start docker
systemctl enable docker

# Create deploy user
echo -e "${YELLOW}Creating deploy user...${NC}"
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
else
    echo -e "${YELLOW}User $DEPLOY_USER already exists${NC}"
fi

# Create project directory
echo -e "${YELLOW}Creating project directory...${NC}"
mkdir -p "$PROJECT_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"

# Switch to deploy user for git operations
echo -e "${YELLOW}Setting up Git repository...${NC}"
sudo -u "$DEPLOY_USER" bash << EOF
    cd "$PROJECT_DIR"
    
    # Initialize git if not already done
    if [ ! -d ".git" ]; then
        git init
        git remote add origin "https://github.com/$GITHUB_REPO.git"
    fi
    
    # Pull the latest code
    git pull origin main || echo "Repository might be empty or not accessible yet"
EOF

# Create log directory
mkdir -p /var/log/ocd
chown "$DEPLOY_USER:$DEPLOY_USER" /var/log/ocd

# Setup firewall
echo -e "${YELLOW}Setting up firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 8000

# Setup fail2ban
echo -e "${YELLOW}Setting up fail2ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban

# Create backup directory
mkdir -p /opt/ocd-backups
chown "$DEPLOY_USER:$DEPLOY_USER" /opt/ocd-backups

# Setup log rotation
echo -e "${YELLOW}Setting up log rotation...${NC}"
cat > /etc/logrotate.d/ocd << EOF
/var/log/ocd/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
}
EOF

# Create environment file template
echo -e "${YELLOW}Creating environment configuration...${NC}"
cat > "$PROJECT_DIR/.env.template" << EOF
# OCD Project Environment Variables
# Copy this file to .env and fill in your values

# Backend Configuration
PYTHONUNBUFFERED=1

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000

# Data Directory
DATA_DIR=/opt/ocd/data
EOF

chown "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR/.env.template"

# Setup monitoring script
echo -e "${YELLOW}Setting up monitoring script...${NC}"
cat > /usr/local/bin/ocd-status << EOF
#!/bin/bash
echo "=== OCD Project Status ==="
echo "Docker status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Service logs (last 20 lines):"
docker-compose -f $PROJECT_DIR/docker-compose.yml logs --tail=20
EOF

chmod +x /usr/local/bin/ocd-status

# Create a simple health check endpoint
echo -e "${YELLOW}Setting up health check endpoint...${NC}"
cat > /usr/local/bin/ocd-health << EOF
#!/bin/bash
# Check if services are responding
if curl -f http://localhost:8000/health >/dev/null 2>&1; then
    echo "✓ Backend API is healthy"
else
    echo "✗ Backend API is not responding"
fi

if curl -f http://localhost/health >/dev/null 2>&1; then
    echo "✓ Frontend is healthy"
else
    echo "✗ Frontend is not responding"
fi
EOF

chmod +x /usr/local/bin/ocd-health

# Setup automatic cleanup cron job
echo -e "${YELLOW}Setting up automatic cleanup...${NC}"
cat > /etc/cron.daily/ocd-cleanup << EOF
#!/bin/bash
# Clean up old Docker images and containers
docker system prune -f
# Clean up old log files
find /var/log/ocd -name "*.log.*" -mtime +7 -delete
EOF

chmod +x /etc/cron.daily/ocd-cleanup

echo -e "${GREEN}Ubuntu VM setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Copy your SSH public key to the deploy user:"
echo "   ssh-copy-id $DEPLOY_USER@$(hostname -I | awk '{print $1}')"
echo ""
echo "2. Configure GitHub repository secrets:"
echo "   - SSH_PRIVATE_KEY: Your private SSH key"
echo "   - HOST_IP: $(hostname -I | awk '{print $1}')"
echo "   - SSH_USER: $DEPLOY_USER"
echo ""
echo "3. Test the deployment:"
echo "   sudo -u $DEPLOY_USER $PROJECT_DIR/scripts/deploy.sh"
echo ""
echo "4. Check service status:"
echo "   ocd-status"
echo "   ocd-health"
