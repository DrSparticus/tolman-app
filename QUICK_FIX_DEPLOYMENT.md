# Quick Fix for SignWell Deployment Errors

## ⚠️ Current Issue

**Error:** Permission 'secretmanager.versions.get' denied

**Root Cause:** The GitHub Actions service account doesn't have permission to validate the secret during deployment.

**What's Happening:**
- ✅ Secret is created in Secret Manager
- ✅ Cloud Functions runtime service account has access (`tolmantest@appspot.gserviceaccount.com`)
- ❌ GitHub Actions deployment service account doesn't have access yet

**Quick Fix:** Add your GitHub Actions service account to the secret's permissions (see Step 2 below).

---

## Problem 1: Secret Manager Permission Denied ✅ PARTIALLY FIXED

**Error Message:**
```
Permission 'secretmanager.versions.get' denied for resource 'projects/tolmantest/secrets/SIGNWELL_API_KEY/versions/latest'
```

**Root Cause:** The Cloud Functions service account doesn't have permission to read the secret from Secret Manager.

**Solution - Follow these steps:**

### Step 1: Create the Secret in Google Cloud Secret Manager

Open Google Cloud Console and run:
```bash
# Create the secret
echo -n "YWNjZXNzOjIxMTc2MzQxMTBlZjY3NDlmODU0ZTlhY2NhMjBhYzhm" | gcloud secrets create SIGNWELL_API_KEY --data-file=- --project=tolmantest
```

**OR** via Console:
1. Go to: https://console.cloud.google.com/security/secret-manager?project=tolmantest
2. Click **"CREATE SECRET"**
3. Name: `SIGNWELL_API_KEY`
4. Secret value: `YWNjZXNzOjIxMTc2MzQxMTBlZjY3NDlmODU0ZTlhY2NhMjBhYzhm`
5. Click **"CREATE SECRET"**

### Step 2: Grant Permissions to Service Accounts

**You need to grant permissions to TWO service accounts:**

1. **Cloud Functions Runtime** - `tolmantest@appspot.gserviceaccount.com` ✅ (Already done - shown in your screenshot)
2. **GitHub Actions Deployment** - The service account used in your `FIREBASE_SERVICE_ACCOUNT_STAGING` secret

**Find your GitHub Actions service account:**
- It's the email address from the JSON in your `FIREBASE_SERVICE_ACCOUNT_STAGING` GitHub secret
- Look for the `client_email` field in that JSON
- It will look something like: `firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com`

**Option A - Using gcloud CLI:**
```bash
# For Cloud Functions runtime (already done based on screenshot)
gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
  --member="serviceAccount:tolmantest@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=tolmantest

# For GitHub Actions service account (REPLACE with your actual service account email)
gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
  --member="serviceAccount:YOUR-GITHUB-ACTIONS-SERVICE-ACCOUNT@tolmantest.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=tolmantest
```

**Option B - Using Cloud Console (RECOMMENDED):**
1. Go to Secret Manager: https://console.cloud.google.com/security/secret-manager?project=tolmantest
2. Click on **SIGNWELL_API_KEY**
3. Click **"PERMISSIONS"** tab
4. Click **"GRANT ACCESS"** (you'll do this twice)
5. **First grant:**
   - Principal: `tolmantest@appspot.gserviceaccount.com` ✅ (already done)
   - Role: "Secret Manager Secret Accessor"
6. **Second grant:**
   - Principal: Your GitHub Actions service account email (find it in your GitHub secret `FIREBASE_SERVICE_ACCOUNT_STAGING`)
   - Role: "Secret Manager Secret Accessor"
7. Click **"SAVE"**

**How to find your GitHub Actions service account email:**
1. Go to: https://github.com/DrSparticus/tolman-app/settings/secrets/actions
2. Look at your `FIREBASE_SERVICE_ACCOUNT_STAGING` secret
3. The JSON contains a `client_email` field - that's the email you need
4. It will be something like: `firebase-adminsdk-xxxxx@tolmantest.iam.gserviceaccount.com`

### Step 3: Verify Permission

```bash
# Check if permission was granted
gcloud secrets get-iam-policy SIGNWELL_API_KEY --project=tolmantest
```

You should see the service account listed with the `secretAccessor` role.

---

## Problem 2: Package Lock Out of Sync ✅ FIXED

**Error Message:**
```
Missing: axios@1.13.2 from lock file
```

**Root Cause:** The `functions/package-lock.json` was out of sync with `functions/package.json`.

**Solution:** Already fixed! The package-lock.json has been regenerated and pushed to staging.

---

## Next Steps

Once you've completed Steps 1-3 above, the GitHub Actions deployment should work automatically on the next push.

**To manually deploy right now:**
```bash
firebase deploy --only functions --project=tolmantest
```

**To verify the secret is accessible:**
```bash
# This should show the secret exists and you have access
gcloud secrets versions access latest --secret=SIGNWELL_API_KEY --project=tolmantest
```

---

## Verification Checklist

- [ ] Secret created in Secret Manager
- [ ] Service account has Secret Manager Secret Accessor role
- [ ] GitHub Actions deployment succeeds
- [ ] Cloud Functions deploy without errors
- [ ] Test creating a patch job over $1,000
- [ ] Test "Review and Send for Signature" button
- [ ] Verify SignWell email is sent

---

## Need Help?

See full documentation in `SIGNWELL_SETUP.md` for:
- Complete workflow explanation
- Testing procedures
- Troubleshooting guide
- SignWell webhook configuration
