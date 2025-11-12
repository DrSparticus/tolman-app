# Debug IAM Permissions for GitHub Actions Service Account

Run these commands to see exactly what the service account has:

```bash
# Check all project-level IAM roles
gcloud projects get-iam-policy tolmantest \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --format="table(bindings.role)"

# Check service account permissions on tolmantest@appspot.gserviceaccount.com
gcloud iam service-accounts get-iam-policy tolmantest@appspot.gserviceaccount.com \
  --project=tolmantest

# Test if the GitHub Actions service account can actually act as the App Engine service account
gcloud iam service-accounts get-iam-policy tolmantest@appspot.gserviceaccount.com \
  --project=tolmantest \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-action-1022143786@tolmantest.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

Copy the output here so we can see exactly what's configured.
