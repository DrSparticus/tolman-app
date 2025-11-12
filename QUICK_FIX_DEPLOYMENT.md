# Quick Fix for SignWell Deployment Errors

## Problem 1: Secret Manager Permission Denied ✅ FIXED

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

### Step 2: Grant Permissions to Cloud Functions Service Account

The Cloud Functions service account needs access to read this secret.

**Service Account Email:** `tolmantest@appspot.gserviceaccount.com`

**Option A - Using gcloud CLI (fastest):**
```bash
gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
  --member="serviceAccount:tolmantest@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=tolmantest
```

**Option B - Using Cloud Console:**
1. Go to Secret Manager: https://console.cloud.google.com/security/secret-manager?project=tolmantest
2. Click on **SIGNWELL_API_KEY**
3. Click **"PERMISSIONS"** tab
4. Click **"GRANT ACCESS"**
5. New principal: `tolmantest@appspot.gserviceaccount.com`
6. Role: **"Secret Manager Secret Accessor"**
7. Click **"SAVE"**

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
