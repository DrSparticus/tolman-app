# GitHub Deployment Setup Guide

## 🌟 Overview
This setup provides automated deployments with proper environment separation:

- **main** branch → Production (https://tolman-app.web.app)
- **staging** branch → Staging (https://tolmantest.web.app)
- **Pull Requests** → Staging previews

## 🔧 Setup Steps

### 1. Create GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

#### Firebase Token
```bash
# Generate token locally
firebase login:ci
```
Add the token as `FIREBASE_TOKEN`

#### Production Environment Secrets
- `PROD_FIREBASE_API_KEY`
- `PROD_FIREBASE_AUTH_DOMAIN` 
- `PROD_FIREBASE_DATABASE_URL`
- `PROD_FIREBASE_STORAGE_BUCKET`
- `PROD_FIREBASE_MESSAGING_SENDER_ID`
- `PROD_FIREBASE_APP_ID`
- `PROD_FIREBASE_MEASUREMENT_ID`

#### Staging Environment Secrets
- `STAGING_FIREBASE_API_KEY` = `AIzaSyC6vZf9Rh3Nq-Q7TPfXrRyFWULXPTPCaAc`
- `STAGING_FIREBASE_AUTH_DOMAIN` = `tolmantest.firebaseapp.com`
- `STAGING_FIREBASE_DATABASE_URL` = `https://tolman-app-staging-default-rtdb.firebaseio.com`
- `STAGING_FIREBASE_STORAGE_BUCKET` = `tolmantest.firebasestorage.app`
- `STAGING_FIREBASE_MESSAGING_SENDER_ID` = `581734760374`
- `STAGING_FIREBASE_APP_ID` = `1:581734760374:web:f6aadfea326a3010630b17`
- `STAGING_FIREBASE_MEASUREMENT_ID` = `G-YG3NFN1Y0H`

#### Shared Secrets
- `GOOGLE_MAPS_API_KEY` = `AIzaSyBHKf4pYyuFViNZBzHC1A5n0kcoBRGuaQ0`

### 2. Branch Strategy

#### Create staging branch:
```bash
git checkout -b staging
git push -u origin staging
```

#### Protect main branch:
1. Go to Settings → Branches
2. Add protection rule for `main`
3. Require pull request reviews
4. Require status checks (quality-checks workflow)

### 3. Workflow Triggers

- **Production**: Deploys when code is pushed to `main`
- **Staging**: Deploys when:
  - Code is pushed to `staging` or `develop`
  - Pull request is opened against `main`
- **Quality Checks**: Run on all pushes and pull requests

### 4. Development Workflow

```bash
# Feature development
git checkout -b feature/new-feature
# ... make changes ...
git push origin feature/new-feature

# Create PR to staging for testing
# Create PR from staging to main for production
```

## 🚀 Benefits

1. **Automatic Deployments**: No manual Firebase CLI issues
2. **Environment Separation**: Clean separation of staging/production
3. **Preview Deployments**: Every PR gets a staging preview
4. **Quality Gates**: Tests and lints run before deployment
5. **Branch Protection**: Can't deploy broken code to production
6. **Audit Trail**: All deployments tracked in GitHub

## 🔄 Migration Steps

1. Set up GitHub secrets
2. Create staging branch
3. Commit these workflow files
4. Test by creating a PR from staging to main
5. Merge to main to deploy to production

## 📱 Notifications

The workflows will:
- ✅ Comment on PRs with staging URLs
- ❌ Fail if tests/builds fail
- 📧 Email you on deployment failures
- 🔍 Show deployment status in GitHub
