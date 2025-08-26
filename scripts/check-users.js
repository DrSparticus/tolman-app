// Check user data setup in staging database
const admin = require('firebase-admin');
const path = require('path');

const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(stagingKeyPath)),
  projectId: 'tolmantest'
});

const db = admin.firestore(app);

async function checkUserSetup() {
  console.log('🔍 Checking User Data Setup in Staging');
  console.log('=====================================');
  
  try {
    // Check users collection
    console.log('👥 Users in database:');
    const usersSnapshot = await db.collection('artifacts/tolmantest/users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`📊 Found ${usersSnapshot.size} users:`);
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      console.log(`   👤 ${doc.id}: ${userData.email || 'No email'} (${userData.role || 'No role'})`);
    });
    
    // Check roles collection
    console.log('\n🛡️  Roles in database:');
    const rolesSnapshot = await db.collection('artifacts/tolmantest/roles').get();
    
    rolesSnapshot.docs.forEach(doc => {
      const roleData = doc.data();
      console.log(`   🔑 ${doc.id}: ${roleData.name || 'Unnamed role'}`);
    });
    
    // Check authentication users
    console.log('\n🔐 Authentication users:');
    try {
      const authUsers = await admin.auth(app).listUsers();
      console.log(`📊 Found ${authUsers.users.length} auth users:`);
      
      authUsers.users.forEach(user => {
        console.log(`   🆔 ${user.uid}: ${user.email || 'No email'}`);
        
        // Check if this user exists in database
        const dbUser = usersSnapshot.docs.find(doc => doc.id === user.uid);
        if (dbUser) {
          console.log(`      ✅ Has database record with role: ${dbUser.data().role}`);
        } else {
          console.log(`      ❌ Missing database record!`);
        }
      });
      
    } catch (error) {
      console.error('❌ Could not list auth users:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking user setup:', error);
  }
  
  await app.delete();
}

checkUserSetup();
