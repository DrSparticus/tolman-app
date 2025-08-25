# Deploy to staging script for PowerShell

Write-Host "Setting up staging environment..." -ForegroundColor Green
# Copy staging environment file to .env.local for the build
Copy-Item ".env.staging" ".env.local" -Force

Write-Host "Building application for staging..." -ForegroundColor Green
npm run build

Write-Host "Deploying to staging (tolmantest)..." -ForegroundColor Green
# Switch to staging project context
firebase use tolmantest

# Deploy using the staging config
firebase deploy --only hosting --config firebase.staging.json

# Switch back to default project
firebase use default

# Clean up the temporary .env.local file
Remove-Item ".env.local" -Force -ErrorAction SilentlyContinue

Write-Host "Staging deployment complete!" -ForegroundColor Green
