#!/bin/bash
# Deploy to staging script

echo "Setting up staging environment..."
# Copy staging environment file to .env.local for the build
cp .env.staging .env.local

echo "Building application for staging..."
npm run build

echo "Deploying to staging (tolmantest)..."
# Switch to staging project context
firebase use tolmantest

# Deploy using the staging config
firebase deploy --only hosting --config firebase.staging.json

# Switch back to default project
firebase use default

# Clean up the temporary .env.local file
rm -f .env.local

echo "Staging deployment complete!"
