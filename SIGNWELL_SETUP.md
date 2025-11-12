# SignWell E-Signature Integration Setup

## Overview
The Tolman app now uses SignWell API for professional e-signature workflow on patch jobs that exceed the configured threshold amount ($1,000 by default).

## Features Implemented
- ✅ User signature capture in profile page
- ✅ "Review and Send for Signature" button for jobs over threshold
- ✅ SignWell API integration with positioned signature fields
- ✅ Webhook handler for document completion
- ✅ Automatic job status update and patch locking
- ✅ Signed PDF storage and download
- ✅ Admin debugging tooltip for PDF changes
- ✅ Permanent lock after SignWell signature (even admins can't edit)

## Workflow

### 1. User Flow
1. User creates/edits a patch job with total >= $1,000
2. Clicks "Review and Send for Signature" button
3. If no signature on file, draws signature (saved to profile)
4. Reviews PDF and enters contractor email
5. Clicks "Send for Signature"
6. SignWell sends email to contractor with signing link

### 2. Contractor Flow
1. Receives email from SignWell
2. Clicks link to review patch work order
3. Signs document electronically
4. Document automatically returns to Tolman app

### 3. Completion Flow
1. Webhook receives completion notification
2. Downloads signed PDF from SignWell
3. Uploads to Firebase Storage
4. Updates patch job:
   - Status → "Done"
   - `patchesLocked` → true
   - `signwellStatus` → "completed"
   - Adds `signedPdfUrl`
5. Green banner appears with "View Signed PDF" button

## Required Configuration

### Step 1: Create Secret in Google Cloud Secret Manager

**CRITICAL**: The secret must be created in Google Cloud Secret Manager AND permissions granted to the service account.

1. **Create the secret in Google Cloud Console**:
   ```bash
   # Using gcloud CLI (recommended)
   echo -n "YWNjZXNzOjIxMTc2MzQxMTBlZjY3NDlmODU0ZTlhY2NhMjBhYzhm" | gcloud secrets create SIGNWELL_API_KEY --data-file=- --project=tolmantest
   ```
   
   Or via Console:
   - Go to: https://console.cloud.google.com/security/secret-manager?project=tolmantest
   - Click "CREATE SECRET"
   - Name: `SIGNWELL_API_KEY`
   - Secret value: `YWNjZXNzOjIxMTc2MzQxMTBlZjY3NDlmODU0ZTlhY2NhMjBhYzhm`
   - Click "CREATE SECRET"

2. **Grant Cloud Functions access to the secret**:
   ```bash
   # Find your Cloud Functions service account email
   # Format: PROJECT_ID@appspot.gserviceaccount.com
   # For tolmantest: tolmantest@appspot.gserviceaccount.com
   
   # Grant Secret Manager Secret Accessor role
   gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
     --member="serviceAccount:tolmantest@appspot.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=tolmantest
   ```
   
   Or via Console:
   - Open the SIGNWELL_API_KEY secret
   - Click "PERMISSIONS" tab
   - Click "GRANT ACCESS"
   - Add principal: `tolmantest@appspot.gserviceaccount.com`
   - Role: "Secret Manager Secret Accessor"
   - Click "SAVE"

### Step 2: GitHub Secret Setup (for CI/CD)

The GitHub Actions workflow also needs the API key to write to the Functions environment file.

1. Go to: https://github.com/DrSparticus/tolman-app/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SIGNWELL_API_KEY`
4. Value: `YWNjZXNzOjIxMTc2MzQxMTBlZjY3NDlmODU0ZTlhY2NhMjBhYzhm`
5. Click "Add secret"

### Step 3: Deploy Cloud Functions

Once both secrets are configured:

```bash
# Deploy Cloud Functions (automatically picks up secret from Secret Manager)
firebase deploy --only functions --project tolmantest

# Or use the npm script
cd functions
npm install  # Ensure dependencies are installed
cd ..
firebase deploy --only functions --project tolmantest
```

## SignWell Integration Details

### API Endpoint
- Base URL: `https://www.signwell.com/api/v1`
- Authentication: API key via `X-Api-Key` header
- Test mode: Disabled (production signatures)

### Signature Field Positioning
Document has 6 signature fields (3 per signer):

**Job Manager (Contractor) - Left Side:**
- Signature: x=30, y=520, width=240, height=40
- Print Name: x=292, y=520, width=120, height=40
- Date: x=482, y=520, width=90, height=40

**Tolman Construction - Right Side (Pre-filled):**
- Signature: x=633, y=520, width=240, height=40
- Print Name: x=895, y=520, width=120, height=40
- Date: x=1085, y=520, width=90, height=40

### Firestore Schema Updates
New fields added to patch jobs:
```javascript
{
  signwellDocumentId: string,        // SignWell document ID
  signwellStatus: 'pending' | 'completed',
  signwellSentAt: timestamp,
  signwellCompletedAt: timestamp,
  signedPdfUrl: string,              // Firebase Storage URL
  sentBy: string,                    // Email of sender
  patchesLocked: boolean             // true after SignWell completion
}
```

New field added to user profiles:
```javascript
{
  signature: string                  // Base64 PNG signature image
}
```

### Cloud Functions

#### `sendPatchJobForSignature`
- Type: `httpsCallable`
- Purpose: Creates SignWell document with signature fields
- Parameters:
  - `pdfUrl`: URL to patch job PDF
  - `patchJobId`: Firestore document ID
  - `contractorEmail`: Recipient email
  - `contractorName`: Recipient name
  - `userEmail`: Sender email
  - `userName`: Sender name
  - `userSignature`: Base64 signature image
- Returns: `{ success: boolean, documentId: string }`

#### `signwellWebhook`
- Type: `httpsCallable` (should be configured as HTTP endpoint in SignWell)
- Purpose: Handles document completion events
- Webhook URL: `https://us-central1-tolman-app-staging.cloudfunctions.net/signwellWebhook`
- Events handled: `document_completed`
- Actions:
  1. Downloads signed PDF
  2. Uploads to Firebase Storage
  3. Updates patch job status
  4. Locks patches permanently

### SignWell Service Module (`functions/signwell.js`)
- `createDocumentWithFields()`: Creates document with positioned fields
- `getDocumentStatus()`: Polls document status
- `downloadCompletedDocument()`: Downloads signed PDF
- Uses Firebase Functions v2 secrets: `defineSecret('SIGNWELL_API_KEY')`

## Frontend Components Modified

### Profile Page (`src/pages/ProfilePage.js`)
- Added SignatureCanvas component (600x200px)
- Save/Update/Remove signature buttons
- Signature stored as base64 PNG in Firestore

### Patch Job Page (`src/pages/PatchJobPage.js`)
- New button: "Review and Send for Signature"
- User signature modal (first-time users)
- Review and send modal with PDF preview
- SignWell signed indicator banner
- PDF change debugging tooltip (admin only)
- Lock logic updated to check `signwellStatus === 'completed'`

## Testing Checklist

- [ ] Configure SIGNWELL_API_KEY secret in GitHub
- [ ] Deploy Cloud Functions to staging
- [ ] Test user signature creation in profile
- [ ] Create patch job over $1,000
- [ ] Test "Review and Send" button
- [ ] Verify PDF preview in modal
- [ ] Send test document to contractor email
- [ ] Verify contractor receives SignWell email
- [ ] Test signature flow as contractor
- [ ] Verify webhook receives completion
- [ ] Check signed PDF appears in patch job
- [ ] Verify patches are locked (try editing)
- [ ] Test admin debugging tooltip on PDF change
- [ ] Verify no PDF generation after SignWell signature

## Dependencies Added

### Frontend (`package.json`)
- `react-signature-canvas`: ^1.1.0-alpha.2 (5 packages)

### Backend (`functions/package.json`)
- `axios`: ^1.6.2

## Build Info
- Build size: 246.19 kB gzipped (increased 438 B from signature library)
- Compilation: Successful with no errors
- Commit: `f95a8be`

## Support & Troubleshooting

### Common Issues

**1. "Permission 'secretmanager.versions.get' denied" error**
- **Cause**: Service account doesn't have access to Secret Manager
- **Fix**: Grant the Cloud Functions service account access to the secret:
  ```bash
  gcloud secrets add-iam-policy-binding SIGNWELL_API_KEY \
    --member="serviceAccount:tolmantest@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=tolmantest
  ```
- **Verify**: Check permissions in Cloud Console → Secret Manager → SIGNWELL_API_KEY → Permissions tab

**2. "Missing: axios@... from lock file" error**
- **Cause**: package-lock.json is out of sync with package.json
- **Fix**: Regenerate the lock file:
  ```bash
  cd functions
  npm install
  cd ..
  git add functions/package-lock.json
  git commit -m "Update functions package-lock.json"
  git push
  ```

**3. "SignWell API key not configured" error**
- Ensure secret is created in Google Cloud Secret Manager
- Verify service account has Secret Manager Secret Accessor role
- Redeploy Cloud Functions after configuring secret

**4. Webhook not receiving completion events**
- Configure webhook URL in SignWell dashboard
- Verify function is deployed and accessible
- Check Cloud Functions logs for errors

**5. Signature fields not appearing correctly**
- Verify PDF dimensions match Letter size (612x792 points)
- Check signature field coordinates in `signwell.js`
- Test with SignWell test mode first

**6. Patches not locking after signature**
- Check `signwellStatus` field in Firestore
- Verify webhook successfully updated patch job
- Check Cloud Functions logs for webhook execution

### SignWell API Documentation
- Docs: https://www.signwell.com/api/docs
- Dashboard: https://www.signwell.com/dashboard
- Support: support@signwell.com

## Next Steps
1. ✅ Configure SIGNWELL_API_KEY secret in GitHub
2. Deploy to staging and test complete flow
3. Configure SignWell webhook URL (if needed)
4. Test with real contractor email
5. Monitor Cloud Functions logs
6. Deploy to production after testing
