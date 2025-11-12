# Fix Cloud Functions Storage Permission Error

## Problem
Cloud Functions are failing with "save-to-storage" error when trying to write PDFs to Firebase Storage.

## Root Cause
The Cloud Functions default service account (`tolmantest@appspot.gserviceaccount.com`) doesn't have permission to write to the Firebase Storage bucket.

## Solution: Grant Storage Object Admin Role

### Option 1: Using Google Cloud Console (Recommended)

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tolmantest

2. Find the service account:
   - Look for: `tolmantest@appspot.gserviceaccount.com`
   - Or: `App Engine default service account`

3. Click the **pencil/edit icon** next to that service account

4. Click **"ADD ANOTHER ROLE"**

5. Search for and select: **"Storage Object Admin"**
   - This role allows reading, writing, and deleting objects in Storage buckets

6. Click **"SAVE"**

### Option 2: Using gcloud CLI

If you have gcloud installed and configured:

```bash
gcloud projects add-iam-policy-binding tolmantest \
  --member="serviceAccount:tolmantest@appspot.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## Verification

After granting the permission:

1. Wait 1-2 minutes for permissions to propagate
2. Try generating a PDF from the Patch Job page again
3. The "Review and Send for Signature" should now work without the save-to-storage error

## Additional Notes

- The service account email format is: `{PROJECT_ID}@appspot.gserviceaccount.com`
- For tolmantest project, it's: `tolmantest@appspot.gserviceaccount.com`
- This is the default service account used by Cloud Functions
- Storage Object Admin role is appropriate as it allows the function to:
  - Create PDF files in Storage
  - Read them for generating download URLs
  - Delete old/outdated files if needed
