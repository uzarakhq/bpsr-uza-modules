# Code Signing Certificate Setup

This guide explains how to set up self-signed code signing for your Electron app.

## ⚠️ Important Notes

**Self-signed certificates will still trigger Windows SmartScreen warnings!** They are mainly useful for:
- Testing the signing process
- Internal distribution where users trust you
- Development builds

For production/public distribution, you'll need a certificate from a trusted Certificate Authority (DigiCert, Sectigo, etc.).

## Quick Setup

### Step 1: Create the Certificate

1. **Open PowerShell as Administrator** (Right-click → Run as Administrator)

2. **Run the certificate creation script:**
   ```powershell
   .\create-certificate.ps1
   ```

   This will create:
   - `certificate.pfx` - The certificate file
   - `certificate-password.txt` - The password (keep this secure!)

### Step 2: Set Environment Variables

You need to set environment variables before building. You can do this in several ways:

#### Option A: PowerShell (per session)
```powershell
$env:CSC_LINK = "$PWD\certificate.pfx"
$env:CSC_KEY_PASSWORD = Get-Content certificate-password.txt -Raw
```

#### Option B: Command Prompt (per session)
```cmd
set CSC_LINK=%CD%\certificate.pfx
set CSC_KEY_PASSWORD=<paste password from certificate-password.txt>
```

#### Option C: Create a build script (recommended)

Use the provided `build-signed.ps1` script:
```powershell
.\build-signed.ps1
```

Or create your own:
```powershell
$env:CSC_LINK = "$PWD\certificate.pfx"
$env:CSC_KEY_PASSWORD = Get-Content certificate-password.txt -Raw

npm run build
```

Then run:
```powershell
.\build-signed.ps1
```

#### Option D: Set system environment variables (persistent)

1. Open System Properties → Environment Variables
2. Add:
   - `CSC_LINK` = `C:\path\to\your\project\certificate.pfx`
   - `CSC_KEY_PASSWORD` = `<your-password>`

**Note:** This is less secure as the password is stored in system environment variables.

### Step 3: Build Your App

```bash
npm run build
```

The app will be automatically signed during the build process.

## Verify Signing

After building, you can verify the signature:

```powershell
Get-AuthenticodeSignature "dist\BPSR Uza Modules-0.2.1-Setup.exe"
```

You should see:
- `Status: Valid` (or `Valid but not trusted` for self-signed)
- `SignerCertificate` information

## Troubleshooting

### "Certificate file not found"
- Make sure `certificate.pfx` is in the project root directory
- Verify the path in `CSC_LINK` environment variable

### "Invalid password"
- Make sure `CSC_KEY_PASSWORD` matches the password in `certificate-password.txt`
- Remove any trailing newlines or spaces (use `-Raw` flag when reading file)

### "Access denied" when running script
- Run PowerShell as Administrator

### Build succeeds but file isn't signed
- Check that environment variables are set in the same terminal session as the build
- Verify electron-builder version supports code signing (v24.13.3+)

## Security Best Practices

1. **Never commit certificate files to git** (already in .gitignore)
2. **Keep the password secure** - treat it like any sensitive credential
3. **Use environment variables** instead of hardcoding paths/passwords
4. **For production**, invest in a trusted certificate authority certificate

## Alternative: Using a Real Certificate

If you purchase a certificate from DigiCert, Sectigo, etc.:

1. Export the certificate to `.pfx` format
2. Set environment variables as shown above
3. The rest of the process is the same!

## Removing Signing

To temporarily disable signing, simply don't set the environment variables. electron-builder will skip signing if the variables are not set.

