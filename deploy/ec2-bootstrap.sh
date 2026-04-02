#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-north-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-677060981954}"
RELEASE_NAME="${RELEASE_NAME:-rentease}"
NAMESPACE="${NAMESPACE:-default}"
INSTALL_HELM="${INSTALL_HELM:-true}"
APP_SECRET_NAME="${APP_SECRET_NAME:-rentease-secret}"
IMAGE_TAG="${IMAGE_TAG:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -z "${CHART_PATH:-}" ]; then
  if [ -d "${ROOT_DIR}/helm/rentease" ]; then
    CHART_PATH="${ROOT_DIR}/helm/rentease"
  elif [ -d "${ROOT_DIR}/RentEase/helm/rentease" ]; then
    CHART_PATH="${ROOT_DIR}/RentEase/helm/rentease"
  else
    CHART_PATH="${ROOT_DIR}/helm/rentease"
  fi
fi

if [ -z "${VALUES_FILE:-}" ]; then
  VALUES_FILE="${ROOT_DIR}/deploy/values-ec2.yaml"
fi

if [ -z "${ENV_FILE:-}" ]; then
  if [ -f "${ROOT_DIR}/RentEase/.env" ]; then
    ENV_FILE="${ROOT_DIR}/RentEase/.env"
  elif [ -f "${ROOT_DIR}/.env" ]; then
    ENV_FILE="${ROOT_DIR}/.env"
  else
    ENV_FILE="${ROOT_DIR}/RentEase/.env"
  fi
fi

echo "Installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates awscli

if ! command -v k3s >/dev/null 2>&1; then
  echo "Installing K3s..."
  curl -sfL https://get.k3s.io | sh -
fi

echo "K3s nodes:"
sudo k3s kubectl get nodes

echo "Creating/updating ECR pull secret..."
sudo k3s kubectl create secret docker-registry ecr-secret \
  --docker-server="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" \
  --docker-username=AWS \
  --docker-password="$(aws ecr get-login-password --region "$AWS_REGION")" \
  -n "$NAMESPACE" --dry-run=client -o yaml | sudo k3s kubectl apply -f -

if [ -f "$ENV_FILE" ]; then
  echo "Creating/updating app secret from $ENV_FILE..."
  sudo k3s kubectl create secret generic "$APP_SECRET_NAME" \
    --from-env-file="$ENV_FILE" \
    -n "$NAMESPACE" --dry-run=client -o yaml | sudo k3s kubectl apply -f -
else
  echo "Warning: $ENV_FILE not found. App secret not updated."
fi

if [ "$INSTALL_HELM" = "true" ] && ! command -v helm >/dev/null 2>&1; then
  echo "Installing Helm..."
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "Deploying Helm chart..."
HELM_EXTRA_SET=()
if [ -n "$IMAGE_TAG" ]; then
  HELM_EXTRA_SET+=(
    --set "web.image.tag=${IMAGE_TAG}"
    --set "celeryWorker.image.tag=${IMAGE_TAG}"
    --set "celeryBeat.image.tag=${IMAGE_TAG}"
  )
fi

helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" -n "$NAMESPACE" -f "$VALUES_FILE" --create-namespace "${HELM_EXTRA_SET[@]}"

echo "Restarting deployments to pull latest images and refresh config..."
sudo k3s kubectl -n "$NAMESPACE" rollout restart deploy/"${RELEASE_NAME}-rentease-web"
sudo k3s kubectl -n "$NAMESPACE" rollout restart deploy/"${RELEASE_NAME}-rentease-nginx"

echo "Waiting for web deployment..."
sudo k3s kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE_NAME}-rentease-web"

echo "Running migrations..."
sudo k3s kubectl -n "$NAMESPACE" exec deploy/"${RELEASE_NAME}-rentease-web" -- python manage.py migrate --noinput

echo "Collecting static files..."
sudo k3s kubectl -n "$NAMESPACE" exec deploy/"${RELEASE_NAME}-rentease-web" -- python manage.py collectstatic --noinput

echo "Services:"
sudo k3s kubectl -n "$NAMESPACE" get svc
