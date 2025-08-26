// Fix missing user database record
const admin = require('firebase-admin');
const path = require('path');

const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(stagingKeyPath)),
  projectId: 'tolmantest'
});

const db = admin.firestore(app);

async function fixMissingUser() {
  console.log('🔧 Fixing Missing User Database Record');
  console.log('=====================================');
  
  try {
    const missingUserId = 'ZZJ7LafNqYfUTPwQUlXSVUZOsk23';
    const email = 'brett@tolmandrywall.com';
    
    console.log(`👤 Adding database record for user: ${missingUserId}`);
    console.log(`📧 Email: ${email}`);
    
    // Add the missing user record with admin role
    await db.collection('artifacts/tolmantest/users').doc(missingUserId).set({
      email: email,
      role: 'admin',
      name: 'Brett Tolman',
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'system_fix'
    });
    
    console.log('✅ User database record created successfully!');
    
    // Verify the fix
    const userDoc = await db.collection('artifacts/tolmantest/users').doc(missingUserId).get();
    if (userDoc.exists) {
      console.log('✅ Verification: User record exists');
      console.log('📋 User data:', userDoc.data());
    } else {
      console.log('❌ Verification failed: User record not found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing user record:', error);
  }
  
  await app.delete();
}

fixMissingUser();
