This folder contains a full, copy-paste deployment flow for AWS EC2 + K3s + ECR.
It assumes your backend + AI run in a single Docker image built from `RentEase/Dockerfile`.

Prereqs (one-time):
1) Create an AWS account (https://aws.amazon.com).
2) Create an IAM user with:
   - AmazonEC2FullAccess
   - AmazonECRFullAccess
3) Install AWS CLI on your local machine and run `aws configure`.
4) Create an EC2 instance (Ubuntu 22.04, t2.micro/t3.micro) and open inbound:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)
   - 30000-32767 (NodePort range)

Step-by-step:
1) Local: Build + push image to ECR
   - Edit and run: `deploy/local-build-push.ps1`

2) EC2: Install K3s + deploy via Helm
   - SSH to EC2
   - Copy this repo to EC2 (git clone or scp)
   - Edit `deploy/values-ec2.yaml` with your real values
   - Ensure backend env vars exist at `RentEase/.env` (or set `ENV_FILE` to a custom path)
   - Run: `bash deploy/ec2-bootstrap.sh`

3) Open the app:
   - Run `sudo k3s kubectl get svc`
   - Find the NodePort for `rentease-rentease-nginx`
   - Open: http://EC2_PUBLIC_IP:NODEPORT

Notes:
- `deploy/ec2-bootstrap.sh` now creates/updates the app secret (`APP_SECRET_NAME`, default: `rentease-secret`)
  from the env file (`ENV_FILE`, default: `RentEase/.env`) so Razorpay keys are injected automatically.
- If you want Celery, set `celeryWorker.replicaCount` and `celeryBeat.replicaCount` to 1.
- If you want Qdrant, set `qdrant.enabled: true`.
- For free tier stability, disable local sentence-transformers and use Gemini/Groq.
