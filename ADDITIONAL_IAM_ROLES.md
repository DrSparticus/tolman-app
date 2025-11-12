# Additional IAM Roles Required for GitHub Actions Deployment

## Problem
GitHub Actions service account (`github-action-1022143786@tolmantest.iam.gserviceaccount.com`) needs permissions to deploy Cloud Functions directly.

## Solution: Grant Cloud Functions Admin Role

The GitHub Actions service account needs the **Cloud Functions Admin** role to deploy functions.

### Using gcloud CLI:
```bash
# Grant Cloud Functions Admin role to GitHub Actions service account
gcloud projects add-iam-policy-binding tolmantest \
  --member="serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.admin"
```

### Using Cloud Console:
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tolmantest
2. Find the row: `github-action-1022143786@tolmantest.iam.gserviceaccount.com`
3. Click the **pencil/edit icon**
4. Click **"ADD ANOTHER ROLE"**
5. Search for and select **"Cloud Functions Admin"**
6. Click **"SAVE"**

## Summary of Required Roles

The `github-action-1022143786@tolmantest.iam.gserviceaccount.com` service account needs these project-level roles:

1. ✅ **Firebase Admin SDK Administrator Service Agent** (already has)
2. ✅ **Secret Manager Secret Accessor** (already has)
3. ✅ **Service Account User** (already has)
4. ❌ **Cloud Functions Admin** (needs to be added)

Once you add the Cloud Functions Admin role, the deployment should succeed!
