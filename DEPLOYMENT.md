# OCD Project Deployment Guide

This guide will help you set up a CI/CD pipeline to automatically deploy your OCD project to a Ubuntu VM on DigitalOcean whenever you push code to the main branch.

## Prerequisites

- A GitHub repository with your OCD project
- A Ubuntu VM on DigitalOcean (Ubuntu 20.04 LTS or later recommended)
- SSH access to your VM
- Docker and Docker Compose installed on your VM

## Quick Start

### 1. Prepare Your Ubuntu VM

SSH into your Ubuntu VM and run the setup script:

```bash
# Download the setup script
wget https://raw.githubusercontent.com/your-username/ocd/main/scripts/setup-ubuntu-vm.sh

# Make it executable
chmod +x setup-ubuntu-vm.sh

# Run as root
sudo ./setup-ubuntu-vm.sh
```

**Important**: Edit the script first and change `GITHUB_REPO="your-username/ocd"` to your actual GitHub repository.

### 2. Configure SSH Keys

Copy your SSH public key to the deploy user:

```bash
# From your local machine
ssh-copy-id deploy@YOUR_VM_IP

# Or manually copy the key
ssh deploy@YOUR_VM_IP
mkdir -p ~/.ssh
# Paste your public key into ~/.ssh/authorized_keys
```

### 3. Configure GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

- `SSH_PRIVATE_KEY`: Your private SSH key (the content of your `~/.ssh/id_rsa` file)
- `HOST_IP`: Your Ubuntu VM's IP address
- `SSH_USER`: `deploy`

### 4. Test the Deployment

Push a change to your main branch, or manually trigger the workflow from the Actions tab.

## Manual Deployment

If you want to deploy manually on your VM:

```bash
# SSH into your VM
ssh deploy@YOUR_VM_IP

# Navigate to project directory
cd /opt/ocd

# Run deployment script
./scripts/deploy.sh
```

## Monitoring and Maintenance

### Check Service Status

```bash
# Check running containers
ocd-status

# Check service health
ocd-health

# View logs
docker-compose logs -f
```

### Update Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
cd /opt/ocd
docker-compose pull
docker-compose up -d
```

### Backup and Restore

```bash
# Backup current configuration
cp docker-compose.yml /opt/ocd-backups/

# Restore from backup
cp /opt/ocd-backups/docker-compose.yml.backup.TIMESTAMP docker-compose.yml
```

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Verify your SSH key is correctly added to the deploy user
   - Check firewall settings (SSH port 22 should be open)
   - Ensure the deploy user has sudo privileges

2. **Docker Build Failed**
   - Check available disk space: `df -h`
   - Verify Docker is running: `sudo systemctl status docker`
   - Check Docker logs: `sudo journalctl -u docker`

3. **Services Not Starting**
   - Check container logs: `docker-compose logs`
   - Verify port availability: `netstat -tlnp`
   - Check resource usage: `htop`

4. **GitHub Actions Workflow Fails**
   - Verify all secrets are correctly set
   - Check the Actions tab for detailed error logs
   - Ensure the main branch exists and has code

### Logs and Debugging

```bash
# View deployment logs
tail -f /var/log/ocd-deploy.log

# View system logs
sudo journalctl -f

# Check Docker system info
docker system df
docker info
```

## Security Considerations

- The deploy user has sudo privileges - consider restricting this in production
- Firewall is configured to only allow necessary ports (22, 80, 443, 8000)
- fail2ban is enabled to protect against brute force attacks
- Docker containers run as non-root users where possible
- Regular security updates are applied

## Performance Optimization

- Docker images are built with `--no-cache` for clean builds
- Old Docker images are automatically cleaned up
- Log rotation is configured to prevent disk space issues
- Health checks ensure services are responding correctly

## Scaling Considerations

For production deployments, consider:

- Using a reverse proxy (nginx) for load balancing
- Implementing database persistence
- Setting up monitoring and alerting
- Using Docker Swarm or Kubernetes for orchestration
- Implementing blue-green deployments

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in `/var/log/ocd-deploy.log`
3. Check GitHub Actions logs for CI/CD issues
4. Verify all prerequisites are met

## File Structure

```
ocd/
├── .github/workflows/deploy.yml    # GitHub Actions workflow
├── scripts/
│   ├── deploy.sh                   # Deployment script
│   ├── setup-ubuntu-vm.sh         # VM setup script
│   └── ocd-deploy.service         # Systemd service file
├── backend/                        # Backend application
├── frontend/                       # Frontend application
├── docker-compose.yml             # Docker orchestration
└── DEPLOYMENT.md                  # This file
```

## License

This deployment setup is provided as-is. Modify according to your specific needs and security requirements.
