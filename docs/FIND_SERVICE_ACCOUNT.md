# Finding Your GitHub Actions Service Account Email

## Step-by-Step Guide

### 1. Go to GitHub Secrets
Navigate to: https://github.com/DrSparticus/tolman-app/settings/secrets/actions

### 2. Find FIREBASE_SERVICE_ACCOUNT_STAGING
Look for the secret named `FIREBASE_SERVICE_ACCOUNT_STAGING`

### 3. Copy the Service Account Email
You can't view the full secret in GitHub, but you need to find the `client_email` from that JSON.

**Option A - If you have the JSON:**
Look for this line in the JSON:
```json
{
  "type": "service_account",
  "project_id": "tolmantest",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com",  <-- THIS ONE
  "client_id": "...",
  ...
}
```

**Option B - Find it in Google Cloud Console:**
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tolmantest
2. Look for a service account with a name like "firebase-adminsdk-xxxxx"
3. Copy the email address

### 4. Add Permission to the Secret

Once you have the email (something like `firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com`):

1. Go to Secret Manager: https://console.cloud.google.com/security/secret-manager?project=tolmantest
2. Click on **SIGNWELL_API_KEY**
3. Click **"PERMISSIONS"** tab
4. Click **"GRANT ACCESS"**
5. New principal: Paste the service account email you just found
6. Role: Select **"Secret Manager Secret Accessor"**
7. Click **"SAVE"**

### 5. Verify Permissions

After adding, you should see TWO service accounts with access:
- ✅ `tolmantest@appspot.gserviceaccount.com` (Cloud Functions runtime)
- ✅ `firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com` (GitHub Actions)

### 6. Trigger Deployment

Push any change to the staging branch to trigger a new deployment:

```bash
# Make a small change
git commit --allow-empty -m "Trigger deployment after fixing permissions"
git push origin staging
```

Or use the GitHub Actions UI to manually trigger the workflow.

---

## Quick Reference Commands

If you know your GitHub Actions service account email, run:

```bash
# Replace YOUR-SERVICE-ACCOUNT-EMAIL with the actual email
gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
  --member="serviceAccount:YOUR-SERVICE-ACCOUNT-EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=tolmantest

# Example:
# gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
#   --member="serviceAccount:firebase-adminsdk-abc123@tolmantest.iam.gserviceaccount.com" \
#   --role="roles/secretmanager.secretAccessor" \
#   --project=tolmantest
```

---

## What This Fixes

**Why do we need two service accounts?**

1. **Cloud Functions Runtime** (`tolmantest@appspot.gserviceaccount.com`)
   - Needs access to read the secret when the function executes
   - Uses: `defineSecret('SIGNWELL_API_KEY')` in the code
   
2. **GitHub Actions Deployment** (`firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com`)
   - Needs access to validate the secret exists during deployment
   - Firebase CLI checks if secrets are accessible before deploying

Both need the "Secret Manager Secret Accessor" role on the SIGNWELL_API_KEY secret.
