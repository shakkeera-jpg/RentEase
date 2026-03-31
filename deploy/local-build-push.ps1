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
$localImage = "${EcrRepo}:${ImageTag}"
$remoteImage = "${AwsAccountId}.dkr.ecr.${AwsRegion}.amazonaws.com/${EcrRepo}:${ImageTag}"
docker build -t $localImage $DockerfilePath

Write-Host "Tagging + pushing to ECR..."
docker tag $localImage $remoteImage
docker push $remoteImage

Write-Host "Done."
