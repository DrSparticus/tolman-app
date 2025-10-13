// Check duplicate users with detailed information
const admin = require('firebase-admin');
const path = require('path');

const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(stagingKeyPath)),
  projectId: 'tolmantest'
});

const db = admin.firestore(app);

async function checkDuplicateUsers() {
  console.log('🔍 Checking Duplicate User Records');
  console.log('==================================');
  
  try {
    // Get detailed user information for brett@tolmandrywall.com
    const usersSnapshot = await db.collection('artifacts/tolmantest/users').get();
    
    console.log('👤 All brett@tolmandrywall.com accounts:');
    console.log('');
    
    const brettUsers = [];
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.email === 'brett@tolmandrywall.com') {
        brettUsers.push({ id: doc.id, ...userData });
      }
    });
    
    brettUsers.forEach((user, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  🆔 User ID: ${user.id}`);
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  👤 Name: ${user.name || 'N/A'}`);
      console.log(`  👤 First Name: ${user.firstName || 'N/A'}`);
      console.log(`  👤 Last Name: ${user.lastName || 'N/A'}`);
      console.log(`  🛡️  Role: ${user.role}`);
      console.log(`  📅 Created: ${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString() : 'N/A'}`);
      console.log(`  🔧 Added By: ${user.addedBy || 'N/A'}`);
      console.log(`  ✅ Active: ${user.active !== false}`);
      console.log('');
    });
    
    // Get auth user details
    console.log('🔐 Firebase Authentication records:');
    console.log('');
    
    for (const user of brettUsers) {
      try {
        const authUser = await admin.auth(app).getUser(user.id);
        console.log(`Auth record for ${user.id}:`);
        console.log(`  📧 Email: ${authUser.email}`);
        console.log(`  👤 Display Name: ${authUser.displayName || 'N/A'}`);
        console.log(`  ✅ Email Verified: ${authUser.emailVerified}`);
        console.log(`  🕐 Last Sign In: ${authUser.metadata.lastSignInTime || 'Never'}`);
        console.log(`  🕐 Created: ${authUser.metadata.creationTime}`);
        console.log(`  🔗 Provider: ${authUser.providerData.map(p => p.providerId).join(', ')}`);
        console.log('');
      } catch (error) {
        console.log(`❌ Could not get auth record for ${user.id}: ${error.message}`);
        console.log('');
      }
    }
    
    // Recommendation
    console.log('💡 Recommendations:');
    console.log('==================');
    
    if (brettUsers.length > 1) {
      console.log('⚠️  You have duplicate user accounts. Here\'s what to do:');
      console.log('');
      console.log('1. Check which account you\'re currently logged in with');
      console.log('2. Keep the account that matches your current session');
      console.log('3. Remove the duplicate database record (but keep the auth record)');
      console.log('');
      console.log('To identify your current account:');
      console.log('- Log into the app and check the console for your user ID');
      console.log('- Or check the JWT token in browser dev tools');
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
  
  await app.delete();
}

checkDuplicateUsers();