#!/bin/bash
exec > /var/log/user-data.log 2>&1
set -ex

# AWS region configuration (IAM role or environment variables should provide credentials)
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

# Update system & Install Docker & Git
dnf update -y
dnf install -y docker git unzip
systemctl enable --now docker
usermod -aG docker ec2-user

# Install Docker Compose plugin
mkdir -p /usr/libexec/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# Install AWS CLI v2 if missing
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
fi

# Clone application repository
cd /home/ec2-user
rm -rf codity
git clone https://github.com/Ayush-AM/codity.git
cd codity

# Create production .env file
cat << 'EOF' > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CodityProductionPassword2026!
POSTGRES_DB=scheduler_db
DATABASE_URL=postgresql://postgres:CodityProductionPassword2026!@postgres:5432/scheduler_db
REDIS_PASSWORD=CodityRedisPassword2026!
REDIS_URL=redis://:CodityRedisPassword2026!@redis:6379/0
JWT_SECRET_KEY=e83a72f9104bc8d74529a105b63cf4a910e5274092b67812937401265819ef99
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
DOCKER_REGISTRY=206690614418.dkr.ecr.ap-south-1.amazonaws.com
IMAGE_TAG=latest
APP_ENV=production
DEBUG=false
CORS_ORIGINS=*
EOF

# Authenticate Docker to AWS ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 206690614418.dkr.ecr.ap-south-1.amazonaws.com

# Pull images & Launch production stack
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

chown -R ec2-user:ec2-user /home/ec2-user/codity
echo "CODITY DEPLOYMENT SUCCESSFUL"
