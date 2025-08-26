# Database Copy Guide: tolman-app → tolmantest

## ✅ Step 1: Authentication Users (COMPLETED)
We've already copied all authentication users using Firebase CLI:
- ✅ Exported 8 users from production
- ✅ Imported into staging

## 📋 Step 2: Manual Firestore Copy Options

### Option A: Service Account Method (Recommended)
1. **Download Service Account Keys:**
   - Production: https://console.firebase.google.com/project/tolman-app/settings/serviceaccounts/adminsdk
   - Staging: https://console.firebase.google.com/project/tolmantest/settings/serviceaccounts/adminsdk
   - Save as `tolman-app-service-account.json` and `tolmantest-service-account.json`

2. **Run the copy script:**
   ```bash
   node scripts/copy-database.js
   ```

### Option B: Manual Firebase Console Copy
1. **Open both Firebase consoles:**
   - Production: https://console.firebase.google.com/project/tolman-app/firestore
   - Staging: https://console.firebase.google.com/project/tolmantest/firestore

2. **Copy each collection manually:**
   - Export data from production Firestore
   - Import into staging Firestore
   - Repeat for all collections

### Option C: Firebase CLI Export/Import (Recommended if available)
```bash
# Switch to production
firebase use default

# Export Firestore data (if available in your Firebase CLI version)
firebase firestore:export ./firestore-backup

# Switch to staging  
firebase use tolmantest

# Import the data
firebase firestore:import ./firestore-backup
```

## 📊 What needs to be copied:
Based on your app structure, you likely have these collections:
- `artifacts` (main data collection)
  - `tolman-app/roles` → copy to `tolmantest/roles`
  - `tolman-app/config` → copy to `tolmantest/config`
  - `tolman-app/users` → copy to `tolmantest/users`
  - `tolman-app/bids` → copy to `tolmantest/bids`
  - `tolman-app/customers` → copy to `tolmantest/customers`
  - `tolman-app/materials` → copy to `tolmantest/materials`
  - `tolman-app/projects` → copy to `tolmantest/projects`
  - `tolman-app/suppliers` → copy to `tolmantest/suppliers`

## 🚀 Quick Start (Easiest)
1. Download the two service account JSON files
2. Place them in your project root
3. Run: `node scripts/copy-database.js`

The script will:
- ✅ Copy all collections and subcollections
- ✅ Preserve document IDs and structure
- ✅ Show progress and results
- ✅ Handle errors gracefully

## 🔧 Alternative: Using our initialization script
If the full copy is too complex, you can:
1. Use the basic initialization we created earlier
2. Manually copy just the critical user and role data
3. Let users rebuild their data in staging

Your authentication users are already copied, so you're halfway done!
