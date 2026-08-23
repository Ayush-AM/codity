# ☁️ Universal Cloud Deployment Guide — Codity

This guide provides step-by-step production deployment instructions for hosting **Codity** across any major cloud infrastructure provider:
* **AWS** (ECS Fargate / EKS Kubernetes)
* **Google Cloud Platform** (Cloud Run / GKE)
* **Microsoft Azure** (Container Apps / AKS)
* **DigitalOcean** (App Platform / Kubernetes)
* **1-Click PaaS** (Railway / Render / Fly.io)

---

## 1. Cloud-Native Production Architecture

Codity is built to adhere strictly to **12-Factor App methodology**. Every service runs as an immutable Docker container configured purely via environment variables.

### Recommended Production Storage Options
Instead of running PostgreSQL and Redis inside containers in enterprise production, we recommend using managed cloud database services for auto-backups and high availability:

| Service | AWS | GCP | Azure | DigitalOcean |
| :--- | :--- | :--- | :--- | :--- |
| **Relational Database** | AWS Aurora / RDS PostgreSQL | GCP Cloud SQL PostgreSQL | Azure Database for PostgreSQL | DigitalOcean Managed PostgreSQL |
| **In-Memory Cache** | AWS ElastiCache for Redis | GCP MemoryStore for Redis | Azure Cache for Redis | DigitalOcean Managed Redis |

---

## 2. Deployment Options

### Option A: AWS (Amazon Web Services)

#### Using AWS ECS (Elastic Container Service with Fargate)
1. **Push Container Images to AWS ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   
   # Build & Tag API & Frontend
   docker build -t codity-api .
   docker tag codity-api:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/codity-api:latest
   docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/codity-api:latest
   
   docker build -t codity-frontend ./frontend
   docker tag codity-frontend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/codity-frontend:latest
   docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/codity-frontend:latest
   ```

2. **Launch ECS Task Definitions**:
   * **`codity-api`**: 2 task replicas behind an Application Load Balancer (ALB).
   * **`codity-worker`**: Auto-scaling Fargate tasks (Scale: 4-20 tasks based on CPU/Queue depth).
   * **`codity-leader`**: 1 task replica (Leader process).
   * **`codity-reaper`**: 1 task replica (Heartbeat Reaper process).
   * **`codity-frontend`**: 2 task replicas behind ALB.

---

### Option B: Google Cloud Platform (GCP)

#### Using GCP Cloud Run
1. **Build and Push to Artifact Registry**:
   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   
   docker build -t us-central1-docker.pkg.dev/PROJECT_ID/codity/api:latest .
   docker push us-central1-docker.pkg.dev/PROJECT_ID/codity/api:latest
   
   docker build -t us-central1-docker.pkg.dev/PROJECT_ID/codity/frontend:latest ./frontend
   docker push us-central1-docker.pkg.dev/PROJECT_ID/codity/frontend:latest
   ```

2. **Deploy Control Plane & Workers**:
   ```bash
   # Deploy API Service
   gcloud run deploy codity-api \
     --image us-central1-docker.pkg.dev/PROJECT_ID/codity/api:latest \
     --set-env-vars DATABASE_URL=postgresql+psycopg2://...,REDIS_URL=redis://... \
     --port 8000 --allow-unauthenticated
   
   # Deploy Workers as Cloud Run Jobs / Services
   gcloud run jobs create codity-worker \
     --image us-central1-docker.pkg.dev/PROJECT_ID/codity/api:latest \
     --command python,-m,app.workers.main_worker
   ```

---

### Option C: Kubernetes (AWS EKS, GCP GKE, Azure AKS, DigitalOcean K8s)

We provide a complete, single-file Kubernetes deployment manifest in [`k8s/codity-all-in-one.yaml`](file:///c:/Ayush/Desktop/codity/k8s/codity-all-in-one.yaml).

1. **Apply the Kubernetes Manifest**:
   ```bash
   kubectl apply -f k8s/codity-all-in-one.yaml
   ```

2. **Check Cluster Status**:
   ```bash
   kubectl get pods -n codity
   kubectl get svc -n codity
   ```

3. **Auto-scaling Workers with KEDA (Optional)**:
   Scale workers based on PostgreSQL queue depth dynamically:
   ```bash
   kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.12.0/keda-2.12.0.yaml
   ```

---

### Option D: 1-Click Platform PaaS (Railway / Render / Fly.io)

#### Railway / Render
1. Connect your GitHub repository to Railway or Render.
2. Select **Docker Compose** or add services individually using the provided Dockerfiles:
   * **Service 1 (`api`)**: Dockerfile (Root), Command: `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"`
   * **Service 2 (`worker`)**: Dockerfile (Root), Command: `python -m app.workers.main_worker`
   * **Service 3 (`leader`)**: Dockerfile (Root), Command: `python -m app.workers.scheduler --interval 10`
   * **Service 4 (`reaper`)**: Dockerfile (Root), Command: `python -m app.workers.reaper --interval 30`
   * **Service 5 (`frontend`)**: `frontend/Dockerfile`
3. Attach Managed PostgreSQL and Redis plugins.
4. Set Environment Variables:
   * `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   * `REDIS_URL` = `${{Redis.REDIS_URL}}`
   * `JWT_SECRET_KEY` = `<your-secret-key>`

---

### Option E: Single Cloud VPS (AWS EC2 / DigitalOcean Droplet / Hetzner)

For cost-effective deployment on a single cloud VPS:

1. **Install Docker & Docker Compose on the VPS**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Clone Project & Configure Environment**:
   ```bash
   git clone https://github.com/your-username/codity.git
   cd codity
   cp .env.example .env
   ```

3. **Edit `.env` for Production Secrets**:
   ```bash
   nano .env
   # Update JWT_SECRET_KEY, POSTGRES_PASSWORD, CORS_ORIGINS
   ```

4. **Launch Production Cluster**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

5. **Scale Workers**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --scale worker=4
   ```

---

## 3. Environment Variables Reference

| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy Connection URL | `postgresql+psycopg2://user:pass@cloud-db-host:5432/scheduler_db` |
| `REDIS_URL` | Redis Cache Connection URL | `redis://:pass@cloud-redis-host:6379/0` |
| `JWT_SECRET_KEY` | Secret Key for JWT Token Generation | Long random string (e.g. `openssl rand -hex 32`) |
| `CORS_ORIGINS` | Allowed Frontend Origins | `https://dashboard.yourcompany.com` |
| `APP_ENV` | Application Mode | `production` |
| `DEBUG` | Enable Verbose Debug Logging | `false` |
| `POLL_INTERVAL_SECONDS` | Worker Queue Polling Frequency | `2` |
| `HEARTBEAT_INTERVAL_SECONDS` | Worker Heartbeat Emission Frequency | `5` |
| `SCHEDULER_INTERVAL_SECONDS` | Leader Cron Sweep Frequency | `10` |
| `REAPER_INTERVAL_SECONDS` | Stale Worker Sweeper Frequency | `30` |
| `STALE_WORKER_THRESHOLD_SECONDS` | Max Inactivity Before Worker Marked Dead | `15` |
