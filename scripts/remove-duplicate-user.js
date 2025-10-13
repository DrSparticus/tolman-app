// Remove duplicate user database record
const admin = require('firebase-admin');
const path = require('path');

const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(stagingKeyPath)),
  projectId: 'tolmantest'
});

const db = admin.firestore(app);

async function removeDuplicateUser() {
  console.log('🧹 Removing Duplicate User Database Record');
  console.log('==========================================');
  
  try {
    // The user to remove (older account)
    const duplicateUserId = 'gTN1XHfZcxe3MjoIkjHeb6PFLXm2';
    // The user to keep (current active account)
    const activeUserId = 'ZZJ7LafNqYfUTPwQUlXSVUZOsk23';
    
    console.log(`🗑️  Removing duplicate database record: ${duplicateUserId}`);
    console.log(`✅ Keeping active account: ${activeUserId}`);
    console.log('');
    
    // First, let's verify both records exist
    const duplicateDoc = await db.collection('artifacts/tolmantest/users').doc(duplicateUserId).get();
    const activeDoc = await db.collection('artifacts/tolmantest/users').doc(activeUserId).get();
    
    if (!duplicateDoc.exists) {
      console.log('❌ Duplicate user record not found. Nothing to remove.');
      return;
    }
    
    if (!activeDoc.exists) {
      console.log('❌ Active user record not found. Cannot proceed.');
      return;
    }
    
    console.log('📋 Current records:');
    console.log(`   Duplicate: ${JSON.stringify(duplicateDoc.data(), null, 2)}`);
    console.log(`   Active: ${JSON.stringify(activeDoc.data(), null, 2)}`);
    console.log('');
    
    // Remove the duplicate database record (NOT the auth record)
    await db.collection('artifacts/tolmantest/users').doc(duplicateUserId).delete();
    
    console.log('✅ Duplicate database record removed successfully!');
    console.log('');
    console.log('🔍 Verification - Remaining brett@tolmandrywall.com accounts:');
    
    // Verify the fix
    const usersSnapshot = await db.collection('artifacts/tolmantest/users').get();
    const brettUsers = [];
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.email === 'brett@tolmandrywall.com') {
        brettUsers.push({ id: doc.id, ...userData });
      }
    });
    
    console.log(`📊 Found ${brettUsers.length} brett@tolmandrywall.com database records:`);
    brettUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.id}: ${user.firstName} ${user.lastName} (${user.role})`);
    });
    
    if (brettUsers.length === 1) {
      console.log('');
      console.log('🎉 Success! Duplicate resolved. You should now see:');
      console.log('   - Only one "Brett Stott" entry in the users list');
      console.log('   - No duplicate "Admin" options in role dropdowns');
      console.log('');
      console.log('⚠️  Note: Both authentication accounts still exist (this is normal)');
      console.log('   - The system will use whichever one you\'re logged in with');
      console.log('   - Only one has a database record now (the active one)');
    }
    
  } catch (error) {
    console.error('❌ Error removing duplicate user:', error);
  }
  
  await app.delete();
}

removeDuplicateUser();