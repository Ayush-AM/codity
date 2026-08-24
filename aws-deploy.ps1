# Codity AWS ECR Build & Deployment Helper Script
param(
    [string]$Region = "ap-south-1",
    [string]$AccountId = ""
)

$ErrorActionPreference = "Continue"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " 🚀 Codity AWS ECR Build & Push Tool" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check AWS Auth
Write-Host "`n[1/5] Checking AWS CLI authentication..." -ForegroundColor Yellow
try {
    $callerId = aws sts get-caller-identity --output json | ConvertFrom-Json
    if (-not $AccountId) {
        $AccountId = $callerId.Account
    }
    Write-Host "Authenticated as AWS Account: $AccountId (Arn: $($callerId.Arn))" -ForegroundColor Green
} catch {
    Write-Error "AWS Authentication failed. Please run 'aws configure' with valid AWS credentials first."
    exit 1
}

# 2. Create ECR Repositories
Write-Host "`n[2/5] Creating/Verifying ECR Repositories in $Region..." -ForegroundColor Yellow
aws ecr create-repository --repository-name codity-backend --region $Region 2>$null
aws ecr create-repository --repository-name codity-frontend --region $Region 2>$null
Write-Host "ECR Repositories ready." -ForegroundColor Green

# 3. Authenticate Docker to ECR
Write-Host "`n[3/5] Authenticating Docker to AWS ECR..." -ForegroundColor Yellow
$ecrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com"
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrUri
Write-Host "Successfully authenticated to ECR ($ecrUri)." -ForegroundColor Green

# 4. Build & Push Backend Image
Write-Host "`n[4/5] Building & Pushing Backend Image..." -ForegroundColor Yellow
docker build -t codity-backend:latest .
docker tag codity-backend:latest "$ecrUri/codity-backend:latest"
docker push "$ecrUri/codity-backend:latest"
Write-Host "Backend container image successfully pushed to $ecrUri/codity-backend:latest" -ForegroundColor Green

# 5. Build & Push Frontend Image
Write-Host "`n[5/5] Building & Pushing Frontend Image..." -ForegroundColor Yellow
docker build -t codity-frontend:latest ./frontend
docker tag codity-frontend:latest "$ecrUri/codity-frontend:latest"
docker push "$ecrUri/codity-frontend:latest"
Write-Host "Frontend container image successfully pushed to $ecrUri/codity-frontend:latest" -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " 🎉 AWS ECR Build & Push Complete!" -ForegroundColor Cyan
Write-Host " Image 1: $ecrUri/codity-backend:latest" -ForegroundColor Green
Write-Host " Image 2: $ecrUri/codity-frontend:latest" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
