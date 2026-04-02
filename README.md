# RentEase

**Project Intro (Short Description)**
RentEase is a rental marketplace platform that connects asset owners with renters. It ships with a Django REST backend, a React/Vite frontend, and a FastAPI AI service for assistant support and trust scoring.

**Long Description**
RentEase is designed to streamline asset rentals end-to-end. Owners can list items with categories, pricing, and availability; renters can search, request bookings, and complete payments. The platform supports user verification, in-app chat, notifications, and trust scoring. A dedicated AI service powers assistant responses and behavior-based trust scoring using embeddings and a vector database.

**Key Features**
- Asset listings with categories, pricing, availability, and reviews
- Booking workflow with owner approval, status tracking, and settlements
- Payments via Razorpay, including deposits and commissions
- User profiles with verification documents and status tracking
- In-app chat with unread counts and optional location sharing
- Notifications stored in the database and optionally pushed to AWS SQS
- AI assistant responses powered by Groq plus RAG via Qdrant
- Trust-score calculation based on transaction behavior

**Architecture Overview**
- `rentease-frontend`: React 19 + Vite UI (Tailwind, Redux, Zustand)
- `RentEase`: Django REST API + Celery workers + PostgreSQL + Redis
- `ai-service`: FastAPI for embeddings, trust scoring, and assistant chat
- `nginx`: API gateway in local Docker Compose
- `qdrant`: Vector store used by the AI service

**System Design**
Primary services and responsibilities
- Frontend: UI, auth flows, payments initiation, and API consumption
- Backend (Django): core domain logic, bookings, payments, chat, notifications
- AI Service (FastAPI): embeddings, RAG, trust scoring, assistant replies
- Data stores: PostgreSQL for transactional data, Redis for cache and Celery broker, Qdrant for vectors
- Infra: Docker/Compose for local, Helm/K8s for production-style deployments

Data flow (high level)
- Users interact with the React UI, which calls Django REST endpoints
- Django stores core data in PostgreSQL and sends async tasks to Celery via Redis
- Chat and notifications are persisted in the DB; optional SQS publishing is supported
- The AI service is called by Django for assistant replies and trust scoring
- Qdrant stores and searches embeddings for AI context

**System Design Diagram**
```text
[Browser]
   |
   v
[React/Vite Frontend]
   |
   v
[Nginx API Gateway] ---> [Django REST API] ---> [PostgreSQL]
         |                         |
         |                         ---> [Redis] ---> [Celery Worker/Beat]
         |
         ---> [AI Service (FastAPI)] ---> [Qdrant Vector DB]
```

**Kubernetes Architecture (K8s / K3s)**
```text
[Ingress Controller]
   |
   v
[Frontend Service] ---> [Frontend Pods]
   |
   v
[Backend Service]  ---> [Django Pods]
   |
   +--> [Celery Worker Pods]
   |
   +--> [Celery Beat Pods]
   |
   +--> [AI Service Pods]
   |
   +--> [Qdrant Service/Pods]
   |
   +--> [PostgreSQL Service/Pods]
   |
   +--> [Redis Service/Pods]
```

**Tech Stack**
Frontend
- React, Vite, Tailwind CSS, Redux Toolkit, Zustand, React Router, Firebase, Axios

Backend
- Django, Django REST Framework, SimpleJWT, Celery, Redis, PostgreSQL
- drf-yasg (Swagger), Razorpay, boto3 (SQS), django-storages, Whitenoise, Gunicorn

AI Service
- FastAPI, Uvicorn, sentence-transformers, Qdrant, PyTorch, Transformers

Infra
- Docker, Docker Compose, Nginx, Helm/K8s (see `deploy/` and `RentEase/helm/`)

**Unit Testing**
- Tests use `pytest` with Django configured for an in-memory SQLite database
- Command: `pytest` (run inside `RentEase`)

**Celery and Celery Beat**
- Celery runs background tasks for async workflows
- Celery Beat schedules periodic jobs using the Django database scheduler
- Services are defined in `RentEase/docker-compose.yml`

**Django Channels (Real-time WebSockets)**
- Not currently enabled in this codebase
- If needed, add Django Channels + a channel layer (Redis) for real-time updates

**Microservice vs Monolithic**
- RentEase is a hybrid architecture
- The Django app is a modular monolith for core business logic
- The AI service is a separate microservice for embeddings and assistant replies
- This separation keeps AI dependencies isolated while keeping the core domain cohesive

**Docker and Docker Compose**
- Docker images are used for backend, AI service, and infra dependencies
- Docker Compose orchestrates local services: PostgreSQL, Redis, Django, Celery, AI service, Qdrant, and Nginx

**Qdrant Cloud (Hosted Vector DB)**
By default the AI service connects to the local Qdrant container (`qdrant:6333`). To use Qdrant Cloud instead:
1. Set `QDRANT_URL` to your cluster HTTPS endpoint in `RentEase/.env`.
2. Set `QDRANT_API_KEY` to your Qdrant Cloud API key in `RentEase/.env`.
3. Optional: stop or comment out the `qdrant` service in `RentEase/docker-compose.yml` if you don't need a local instance.

**Kubernetes (K8s / K3s)**
- Helm chart: `RentEase/helm/rentease`
- K3s deployment flow is documented in `deploy/README.md`

**AWS Services**
- S3: Optional media storage via `django-storages`
- SQS: Optional notification publishing (see `NOTIFICATION_QUEUE_URL`)
- EC2/ECR/K3s: Deployment flow in `deploy/README.md`
- Lambda: Not currently used; could be added for event-driven tasks

**Repo Structure**
- `RentEase/` Django backend, Docker Compose, Nginx, Helm chart
- `rentease-frontend/` React/Vite frontend
- `ai-service/` FastAPI AI service
- `deploy/` AWS EC2 + K3s + ECR deployment script

**Local Development**

Docker Compose (recommended for backend + AI + infra)
1. `cd RentEase`
2. Create `.env` based on `RentEase/.env.example`
3. `docker compose up --build`

Frontend (separate terminal)
1. `cd rentease-frontend`
2. `npm install`
3. `npm run dev`

Manual (no Docker)
Backend
1. `cd RentEase`
2. `python -m venv .venv`
3. `.venv\Scripts\Activate.ps1`
4. `pip install -r requirements.txt`
5. `python manage.py migrate`
6. `python manage.py runserver`

AI Service
1. `cd ai-service`
2. `python -m venv .venv`
3. `.venv\Scripts\Activate.ps1`
4. `pip install -r requirements.txt`
5. `uvicorn main:app --reload --port 8001`

Frontend
1. `cd rentease-frontend`
2. `npm install`
3. `npm run dev`

Note: update `VITE_API_BASE_URL` to point at your backend server.

**Environment Variables**

Backend (`RentEase/.env`, template in `RentEase/.env.example`)
```
# Django
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=
GOOGLE_CLIENT_ID=change-me

# Postgres
POSTGRES_DB=rentease_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=change-me
EMAIL_HOST_PASSWORD=change-me

# Payments
RAZORPAY_KEY_ID=change-me
RAZORPAY_KEY_SECRET=change-me

# Redis / Celery
CELERY_BROKER_URL=redis://redis:6379/0
REDIS_CACHE_URL=redis://redis:6379/1

# AI service
AI_SERVICE_URL=http://ai_service:8000
AI_SERVICE_TIMEOUT_SECONDS=30

# Groq / Grok
GROQ_API_KEY=change-me
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROK_API_KEY=
GROK_MODEL=
GROK_API_URL=

# Storage / Notifications
AWS_STORAGE_BUCKET_NAME=change-me
AWS_S3_REGION_NAME=change-me
AWS_ACCESS_KEY_ID=change-me
AWS_SECRET_ACCESS_KEY=change-me
AWS_S3_FILE_OVERWRITE=False
AWS_QUERYSTRING_AUTH=True
AWS_REGION=change-me
NOTIFICATION_QUEUE_URL=change-me

# App settings
PLATFORM_COMMISSION=0.10
OWNER_APPROVAL_TIMEOUT_HOURS=24
CACHE_KEY_PREFIX=rentease
SERVE_MEDIA=False
SWAGGER_DEFAULT_URL=
```

Frontend (`rentease-frontend/.env`, template in `rentease-frontend/.env.example`)
```
VITE_API_BASE_URL=http://127.0.0.1/api/
VITE_GOOGLE_CLIENT_ID=change-me
VITE_FIREBASE_API_KEY=change-me
VITE_FIREBASE_AUTH_DOMAIN=change-me
VITE_FIREBASE_PROJECT_ID=change-me
VITE_FIREBASE_STORAGE_BUCKET=change-me
VITE_FIREBASE_MESSAGING_SENDER_ID=change-me
VITE_FIREBASE_APP_ID=change-me
VITE_FIREBASE_VAPID_KEY=change-me
VITE_RAZORPAY_KEY_ID=change-me
```

**API Docs**
- Swagger UI: `/swagger/`
- OpenAPI JSON/YAML: `/swagger.json` or `/swagger.yaml`
- Redoc: `/redoc/`

**Testing**
Backend tests use pytest with SQLite in-memory DB
- `cd RentEase`
- `pytest`

**Deployment**
- `deploy/README.md` has a complete AWS EC2 + K3s + ECR flow
- Helm chart lives in `RentEase/helm/rentease`

**Project Report (Summary)**
Goals
- Build a full-stack rental marketplace with verification, bookings, and payments
- Provide reliable async processing and AI-powered assistance

Non-functional focus
- Maintainability through modular apps and clear service boundaries
- Scalability via async tasks and isolated AI service
- Security through env-based secrets and minimal data exposure

Current status
- Core marketplace and AI features are implemented
- Deployment paths included for Docker and K8s/K3s
- Optional AWS integrations for media and notifications

**Security Notes**
- Do not commit real secrets to Git. Use `.env` files locally and secret managers in production.
