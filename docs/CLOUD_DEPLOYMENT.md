# Codity — Universal Cloud Deployment Manual

This guide provides complete, production-grade instructions for deploying the **Codity Distributed Job Scheduler Platform** across major cloud providers, container orchestrators, and PaaS hosting platforms.

---

## 🏗️ Architecture Overview for Cloud Infrastructure

Codity consists of 5 logical components when deployed in cloud environments:
1. **Frontend SPA**: React 18 dashboard static bundle served via Nginx or CDN.
2. **API Control Plane**: FastAPI REST server handling HTTP requests and enqueuing jobs.
3. **Worker Pool**: Scalable background workers consuming jobs via PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.
4. **Leader Scheduler & Reaper**: Single-instance leader process (`pg_try_advisory_lock`) handling cron/delayed scheduling and dead worker liveness sweeping.
5. **Data Tier**: Managed PostgreSQL 16 (Relational Store) and Managed Redis 7 (Idempotency Cache).

---

## 1. Amazon Web Services (AWS)

### Option A: AWS Elastic Container Service (ECS Fargate)
1. **Provision Data Stores**: Create an Amazon RDS PostgreSQL 16 instance and an ElastiCache Redis cluster in your VPC.
2. **Push Docker Images to ECR**:
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com
   docker tag codity-backend:latest <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/codity-backend:latest
   docker push <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/codity-backend:latest
   ```
3. **Create Fargate Task Definitions**:
   - **API Task**: Entrypoint `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Desired count: 2+ behind an ALB.
   - **Worker Task**: Command `python -m app.workers.worker`. Desired count: 2–10 (auto-scaled on CPU/queue metrics).
   - **Scheduler Leader Task**: Command `python -m app.workers.scheduler`. Desired count: 1 (Advisory lock ensures safety even if scaled).
   - **Reaper Task**: Command `python -m app.workers.reaper`. Desired count: 1.

### Option B: AWS Elastic Kubernetes Service (EKS)
Apply the unified manifest:
```bash
kubectl apply -f k8s/codity-all-in-one.yaml
```

---

## 2. Google Cloud Platform (GCP)

### Option A: Cloud Run (Serverless Containers)
1. **Provision Cloud SQL & MemoryStore**:
   - Cloud SQL PostgreSQL 16 instance with Public/Private IP.
   - MemoryStore Redis instance.
2. **Build and Deploy via Artifact Registry**:
   ```bash
   gcloud auth configure-docker asia-south1-docker.pkg.dev
   docker tag codity-backend:latest asia-south1-docker.pkg.dev/$PROJECT_ID/codity/backend:latest
   docker push asia-south1-docker.pkg.dev/$PROJECT_ID/codity/backend:latest

   # Deploy API Server
   gcloud run deploy codity-api \
     --image asia-south1-docker.pkg.dev/$PROJECT_ID/codity/backend:latest \
     --set-env-vars DATABASE_URL=$DB_URL,REDIS_URL=$REDIS_URL \
     --port 8000 \
     --allow-unauthenticated
   ```
3. **Worker & Leader Jobs on Cloud Run Jobs / GKE**:
   - Cloud Run Jobs or continuous compute instances for workers and schedulers.

### Option B: Google Kubernetes Engine (GKE)
```bash
gcloud container clusters get-credentials codity-cluster --zone asia-south1-a
kubectl apply -f k8s/codity-all-in-one.yaml
```

---

## 3. Microsoft Azure

### Option A: Azure App Service & Container Apps
1. **Provision Managed Services**:
   - Azure Database for PostgreSQL Flexible Server.
   - Azure Cache for Redis.
2. **Deploy Container App Environment**:
   ```bash
   az containerapp create \
     --name codity-api \
     --resource-group codity-rg \
     --environment codity-env \
     --image <registry>.azurecr.io/codity-backend:latest \
     --target-port 8000 \
     --ingress external
   ```

---

## 4. DigitalOcean & Linode

### DigitalOcean App Platform
1. Connect your GitHub Repository (`https://github.com/Ayush-AM/codity`).
2. Add components:
   - **Database**: Managed PostgreSQL (v16).
   - **Redis**: Managed Redis (v7).
   - **Web Service (`api`)**: Dockerfile build, HTTP port 8000.
   - **Worker (`worker`)**: Command `python -m app.workers.worker`.
   - **Worker (`scheduler`)**: Command `python -m app.workers.scheduler`.
   - **Static Site (`frontend`)**: Build command `npm run build`, output directory `dist`.

---

## 5. Kubernetes (Production Standard)

Codity comes pre-packaged with a battle-tested, single-manifest Kubernetes deployment spec located at [`k8s/codity-all-in-one.yaml`](../k8s/codity-all-in-one.yaml).

To deploy to any standard Kubernetes cluster (Minikube, EKS, GKE, AKS, MicroK8s):

```bash
# 1. Apply All Resources (Pods, Services, PVCs, ConfigMaps)
kubectl apply -f k8s/codity-all-in-one.yaml

# 2. Verify Cluster Health
kubectl get pods -l app=codity

# 3. Port Forward for Local Access
kubectl port-forward svc/codity-frontend-service 5173:80
kubectl port-forward svc/codity-api-service 8000:8000
```

---

## 6. Modern PaaS Platforms (Railway, Render, Fly.io)

### Railway.app
1. Click **New Project** -> **Deploy from GitHub repo**.
2. Provision a **Postgres** and **Redis** database plugin.
3. Deploy 3 service targets from the repo:
   - `API`: Default command (starts FastAPI).
   - `Worker`: Override start command -> `python -m app.workers.worker`.
   - `Scheduler`: Override start command -> `python -m app.workers.scheduler`.

### Render.com
1. Create **PostgreSQL** and **Redis** services.
2. Create **Web Service** for Backend (`Dockerfile`, Port 8000).
3. Create **Background Worker** for Worker (`Command: python -m app.workers.worker`).
4. Create **Static Site** for Frontend (`Build: npm run build`, `Publish: dist`).

### Fly.io
```bash
fly launch --name codity-api
fly postgres create --name codity-db
fly redis create --name codity-redis
fly deploy
```

---

## ⚙️ Core Environment Variables Reference

Ensure all cloud environments configure these mandatory parameters:

| Variable | Type | Example / Default | Description |
| :--- | :--- | :--- | :--- |
| `POSTGRES_SERVER` | String | `localhost` / `rds.amazonaws.com` | PostgreSQL Host address |
| `POSTGRES_PORT` | Integer | `5432` | PostgreSQL Port |
| `POSTGRES_USER` | String | `codity_user` | Database user |
| `POSTGRES_PASSWORD` | String | `codity_password` | Database password |
| `POSTGRES_DB` | String | `codity_db` | Relational database name |
| `REDIS_HOST` | String | `localhost` / `redis.cache.windows.net` | Redis host address |
| `REDIS_PORT` | Integer | `6379` | Redis port |
| `SECRET_KEY` | String | `<random-32-byte-key>` | JWT signing key |
| `GOOGLE_CLIENT_ID` | String | `<id>.apps.googleusercontent.com` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | String | `<secret>` | Google OAuth Client Secret |
| `OAUTH_REDIRECT_URI` | String | `http://3.7.73.152.sslip.io:8000/api/v1/auth/oauth/callback/google` | SSO Redirect URI |
| `CORS_ORIGINS` | String | `http://localhost:5173,http://3.7.73.152.sslip.io` | Allowed CORS Origins |
