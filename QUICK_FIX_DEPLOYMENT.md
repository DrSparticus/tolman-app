# Quick Fix for SignWell Deployment Errors

## ⚠️ Current Issues

### Issue 1: Cloud Functions Deployment Permission ❌
**Error:** Missing permissions required for functions deploy. You must have permission iam.serviceAccounts.ActAs

**GitHub Actions service account:** `github-action-1022143786@tolmantest.iam.gserviceaccount.com`

**Root Cause:** The GitHub Actions service account needs **Cloud Functions Admin** role to deploy functions.

**Quick Fix:** Run this command:
```bash
gcloud projects add-iam-policy-binding tolmantest \
  --member="serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.admin"
```

**Or via Console:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tolmantest
2. Find: `github-action-1022143786@tolmantest.iam.gserviceaccount.com`
3. Click edit (pencil icon)
4. Add role: **"Cloud Functions Admin"**
5. Save

### Issue 2: Secret Manager Access ✅ (Should be fixed)
- Cloud Functions runtime has access
- GitHub Actions has Secret Manager Secret Accessor role

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

### Step 2: Grant Permissions to GitHub Actions Service Account

**Your GitHub Actions service account:** `github-action-1022143786@tolmantest.iam.gserviceaccount.com`

This service account needs TWO roles to deploy Cloud Functions with secrets:

#### Step 2A: Service Account User Role (for deploying functions)

**IMPORTANT:** The Service Account User role must be granted **on the target service account** (`tolmantest@appspot.gserviceaccount.com`), not just at the project level.

**Using gcloud CLI (CORRECT METHOD):**
```bash
# Grant permission to act as the Cloud Functions service account
gcloud iam service-accounts add-iam-policy-binding tolmantest@appspot.gserviceaccount.com \
  --member="serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=tolmantest
```

**Using Cloud Console (CORRECT METHOD):**
1. Go to **Service Accounts** page: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tolmantest
2. Click on **`tolmantest@appspot.gserviceaccount.com`** (the App Engine default service account)
3. Click the **"PERMISSIONS"** tab at the top
4. Click **"GRANT ACCESS"**
5. New principal: `github-action-1022143786@tolmantest.iam.gserviceaccount.com`
6. Role: **"Service Account User"** (search for "Service Account User")
7. Click **"SAVE"**

**Why this is different:**
- ❌ Project-level IAM role: Allows acting as ANY service account in the project
- ✅ Service account-level permission: Specifically allows acting as `tolmantest@appspot.gserviceaccount.com`
- GitHub Actions needs the service account-level permission for security

#### Step 2B: Secret Manager Access (for reading SIGNWELL_API_KEY)

**Using gcloud CLI:**
```bash
gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
  --member="serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=tolmantest
```

**Using Cloud Console (can do while editing IAM from 2A):**
While you have the service account edit dialog open:
1. Click **"ADD ANOTHER ROLE"** again
2. Search for **"Secret Manager Secret Accessor"**
3. Click **"SAVE"**

**OR** add it directly on the secret (alternative method):
1. Go to: https://console.cloud.google.com/security/secret-manager?project=tolmantest
2. Click on **SIGNWELL_API_KEY**
3. Click **"PERMISSIONS"** tab
4. Click **"GRANT ACCESS"**
5. Principal: `github-action-1022143786@tolmantest.iam.gserviceaccount.com`
6. Role: **"Secret Manager Secret Accessor"**
7. Click **"SAVE"**

### Step 3: Verify Permissions

**Check IAM roles for GitHub Actions service account:**
```bash
# Should show Service Account User and Secret Manager Secret Accessor
gcloud projects get-iam-policy tolmantest \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com"
```

**Check Secret Manager permissions:**
```bash
gcloud secrets get-iam-policy SIGNWELL_API_KEY --project=tolmantest
```

You should see:
- `github-action-1022143786@tolmantest.iam.gserviceaccount.com` with Secret Manager Secret Accessor
- `tolmantest@appspot.gserviceaccount.com` with Secret Manager Secret Accessor

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

Once you've completed Steps 2A and 2B above, trigger a new deployment:

**Option 1 - Push to trigger GitHub Actions:**
```bash
git commit --allow-empty -m "Trigger deployment after fixing permissions"
git push origin staging
```

**Option 2 - Manual deployment:**
```bash
firebase deploy --only functions --project=tolmantest --force
```

**To verify the secret is accessible:**
```bash
# This should show the secret value
gcloud secrets versions access latest --secret=SIGNWELL_API_KEY --project=tolmantest
```

---

## Verification Checklist

- [x] Secret created in Secret Manager
- [x] Cloud Functions service account has Secret Manager access (`tolmantest@appspot.gserviceaccount.com`)
- [ ] GitHub Actions service account has "Service Account User" role
- [ ] GitHub Actions service account has "Secret Manager Secret Accessor" role  
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
