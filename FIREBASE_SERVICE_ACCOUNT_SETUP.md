# Firebase Service Account Setup

This guide explains how to set up Firebase Service Accounts for long-lasting authentication instead of short-lived CI tokens.

## Benefits of Service Accounts

- **No expiration** - Service accounts don't expire like CI tokens (which last ~30 days)
- **Better security** - Project-specific permissions
- **Easier maintenance** - No manual token renewal required

## Setup Steps

### 1. Create Service Accounts

#### For Production (tolman-app):
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select **tolman-app** project
3. Go to Project Settings → Service Accounts
4. Click **"Generate new private key"**
5. Download the JSON file (save as `tolman-app-service-account.json`)

#### For Staging (tolmantest):
1. Switch to **tolmantest** project in Firebase Console
2. Go to Project Settings → Service Accounts  
3. Click **"Generate new private key"**
4. Download the JSON file (save as `tolmantest-service-account.json`)

### 2. Add to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Add these new secrets:

#### FIREBASE_SERVICE_ACCOUNT_PRODUCTION
- Click **"New repository secret"**
- Name: `FIREBASE_SERVICE_ACCOUNT_PRODUCTION`
- Value: Paste the **entire contents** of `tolman-app-service-account.json`

#### FIREBASE_SERVICE_ACCOUNT_STAGING  
- Click **"New repository secret"**
- Name: `FIREBASE_SERVICE_ACCOUNT_STAGING`
- Value: Paste the **entire contents** of `tolmantest-service-account.json`

### 3. Verify Setup

After adding the secrets, the GitHub Actions workflows will automatically use the service accounts instead of tokens.

- ✅ **Staging deploys** will use `FIREBASE_SERVICE_ACCOUNT_STAGING`
- ✅ **Production deploys** will use `FIREBASE_SERVICE_ACCOUNT_PRODUCTION`

### 4. Optional: Remove Old Token

Once service accounts are working, you can remove the old `FIREBASE_TOKEN` secret from GitHub.

## Security Notes

- **Keep service account files secure** - Never commit them to your repository
- **Limit permissions** - Service accounts only have Firebase Hosting permissions by default
- **Rotate if compromised** - Generate new keys if security is ever compromised

## Troubleshooting

If you get authentication errors:
1. Verify the JSON content is complete and valid
2. Check that the service account has Firebase Hosting permissions
3. Ensure you're using the correct project ID in the deploy commands

## Local Development

For local Firebase CLI usage, you can still use:
```bash
firebase login
```

This guide only affects automated deployments via GitHub Actions.
