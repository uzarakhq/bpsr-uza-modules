# Build script with automatic certificate loading
# This script sets up the environment variables and runs the build

Write-Host "Setting up code signing environment..." -ForegroundColor Cyan

$certFile = Join-Path $PSScriptRoot "certificate.pfx"
$passwordFile = Join-Path $PSScriptRoot "certificate-password.txt"

# Check if certificate exists
if (-not (Test-Path $certFile)) {
    Write-Host "ERROR: certificate.pfx not found!" -ForegroundColor Red
    Write-Host "Please run create-certificate.ps1 first to generate a certificate." -ForegroundColor Yellow
    exit 1
}

# Check if password file exists
if (-not (Test-Path $passwordFile)) {
    Write-Host "ERROR: certificate-password.txt not found!" -ForegroundColor Red
    Write-Host "Please run create-certificate.ps1 first to generate a certificate." -ForegroundColor Yellow
    exit 1
}

# Set environment variables (electron-builder uses CSC_LINK and CSC_KEY_PASSWORD)
$env:CSC_LINK = $certFile
$password = (Get-Content $passwordFile -Raw).Trim()
$env:CSC_KEY_PASSWORD = $password

Write-Host "Certificate file: $certFile" -ForegroundColor Green
Write-Host "Code signing enabled!" -ForegroundColor Green
Write-Host "`nBuilding application..." -ForegroundColor Cyan

# Run the build
npm run build

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

