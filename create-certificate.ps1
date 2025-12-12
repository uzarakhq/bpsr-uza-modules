# PowerShell script to create a self-signed code signing certificate
# Run this script as Administrator

param(
    [string]$CertName = "BPSR Uza Modules Code Signing",
    [string]$CertFile = "certificate.pfx",
    [string]$Password = $null
)

Write-Host "Creating self-signed code signing certificate..." -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Generate random password if not provided
if (-not $Password) {
    $Password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "Generated random password (saved to certificate-password.txt)" -ForegroundColor Yellow
}

# Create certificate
try {
    Write-Host "Generating certificate..." -ForegroundColor Green
    
    # Create certificate with extended key usage for code signing
    # Try with NotAfter parameter first (PowerShell 5.1+), fallback if not supported
    $certParams = @{
        Type = 'CodeSigningCert'
        Subject = "CN=$CertName"
        KeyUsage = 'DigitalSignature'
        KeyAlgorithm = 'RSA'
        KeyLength = 2048
        CertStoreLocation = 'Cert:\CurrentUser\My'
        HashAlgorithm = 'SHA256'
    }
    
    # Try to add NotAfter parameter (extended validity)
    try {
        $certParams['NotAfter'] = (Get-Date).AddYears(3)
        $cert = New-SelfSignedCertificate @certParams -ErrorAction Stop
        Write-Host "Certificate created with 3-year validity" -ForegroundColor Green
    } catch {
        # Fallback without NotAfter (uses default 1 year validity)
        Write-Host "Note: Using default certificate validity period (1 year)" -ForegroundColor Yellow
        Write-Host "  Some PowerShell versions don't support extended validity periods" -ForegroundColor Gray
        $certParams.Remove('NotAfter')
        $cert = New-SelfSignedCertificate @certParams
    }
    
    $thumbprint = $cert.Thumbprint
    Write-Host "Certificate created successfully!" -ForegroundColor Green
    Write-Host "  Thumbprint: $thumbprint" -ForegroundColor Gray
    Write-Host "  Subject: $($cert.Subject)" -ForegroundColor Gray
    Write-Host "  Valid until: $($cert.NotAfter)" -ForegroundColor Gray
    
    # Export to PFX
    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
    Export-PfxCertificate `
        -Cert $cert `
        -FilePath $CertFile `
        -Password $securePassword `
        | Out-Null
    
    Write-Host "`nCertificate exported to: $CertFile" -ForegroundColor Green
    
    # Save password to file (for reference, you'll need it in package.json or env vars)
    $Password | Out-File -FilePath "certificate-password.txt" -Encoding UTF8 -NoNewline
    Write-Host "Password saved to: certificate-password.txt" -ForegroundColor Yellow
    Write-Host "`nIMPORTANT: Keep these files secure and add them to .gitignore!" -ForegroundColor Red
    
    # Instructions
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Add certificate.pfx and certificate-password.txt to .gitignore" -ForegroundColor White
    Write-Host "2. Update package.json with signing configuration" -ForegroundColor White
    Write-Host "3. Set environment variables or update package.json with certificate path" -ForegroundColor White
    
} catch {
    Write-Host "ERROR: Failed to create certificate: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

