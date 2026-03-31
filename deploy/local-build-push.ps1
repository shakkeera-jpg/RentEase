param(
  [string]$AwsRegion = "eu-north-1",
  [string]$AwsAccountId = "677060981954",
  [string]$EcrRepo = "rentease-app",
  [string]$ImageTag = "latest",
  [string]$DockerfilePath = "RentEase",
  [string]$Profile = ""
)

$profileArg = @()
if ($Profile -ne "") {
  $profileArg = @("--profile", $Profile)
}

Write-Host "Ensuring ECR repo exists: $EcrRepo"
aws @profileArg ecr describe-repositories --repository-names $EcrRepo --region $AwsRegion | Out-Null
if ($LASTEXITCODE -ne 0) {
  aws @profileArg ecr create-repository --repository-name $EcrRepo --region $AwsRegion | Out-Null
}

Write-Host "Logging in to ECR..."
aws @profileArg ecr get-login-password --region $AwsRegion `
  | docker login --username AWS --password-stdin `
  "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com"

Write-Host "Building image..."
docker build -t "$EcrRepo:$ImageTag" $DockerfilePath

Write-Host "Tagging + pushing to ECR..."
docker tag "$EcrRepo:$ImageTag" "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com/$EcrRepo:$ImageTag"
docker push "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com/$EcrRepo:$ImageTag"

Write-Host "Done."
