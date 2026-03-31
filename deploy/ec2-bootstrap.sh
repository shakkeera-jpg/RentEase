#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-north-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-677060981954}"
RELEASE_NAME="${RELEASE_NAME:-rentease}"
NAMESPACE="${NAMESPACE:-default}"
CHART_PATH="${CHART_PATH:-/home/ubuntu/RentEase/helm/rentease}"
VALUES_FILE="${VALUES_FILE:-/home/ubuntu/RentEase/deploy/values-ec2.yaml}"
INSTALL_HELM="${INSTALL_HELM:-true}"

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

if [ "$INSTALL_HELM" = "true" ] && ! command -v helm >/dev/null 2>&1; then
  echo "Installing Helm..."
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "Deploying Helm chart..."
helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" -n "$NAMESPACE" -f "$VALUES_FILE" --create-namespace

echo "Waiting for web deployment..."
sudo k3s kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE_NAME}-rentease-web"

echo "Running migrations..."
sudo k3s kubectl -n "$NAMESPACE" exec deploy/"${RELEASE_NAME}-rentease-web" -- python manage.py migrate --noinput

echo "Services:"
sudo k3s kubectl -n "$NAMESPACE" get svc
