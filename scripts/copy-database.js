// Database copy script from tolman-app (production) to tolmantest (staging)
const admin = require('firebase-admin');
const fs = require('fs');

// You'll need to get service account keys for both projects
// Download them from:
// Production: https://console.firebase.google.com/project/tolman-app/settings/serviceaccounts/adminsdk
// Staging: https://console.firebase.google.com/project/tolmantest/settings/serviceaccounts/adminsdk

console.log('🚀 Firebase Database Copy Tool');
console.log('===============================');

const path = require('path');

// Check if service account files exist
const prodKeyPath = path.join(__dirname, 'tolman-app-service-account.json');
const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

if (!fs.existsSync(prodKeyPath)) {
  console.log('❌ Production service account key not found!');
  console.log(`Please download it from: https://console.firebase.google.com/project/tolman-app/settings/serviceaccounts/adminsdk`);
  console.log(`Save it as: ${prodKeyPath}`);
  process.exit(1);
}

if (!fs.existsSync(stagingKeyPath)) {
  console.log('❌ Staging service account key not found!');
  console.log(`Please download it from: https://console.firebase.google.com/project/tolmantest/settings/serviceaccounts/adminsdk`);
  console.log(`Save it as: ${stagingKeyPath}`);
  process.exit(1);
}

// Initialize Firebase Admin for both projects
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(require(prodKeyPath)),
  projectId: 'tolman-app'
}, 'production');

const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(require(stagingKeyPath)),
  projectId: 'tolmantest'
}, 'staging');

const prodDb = admin.firestore(prodApp);
const stagingDb = admin.firestore(stagingApp);

async function copyCollection(collectionPath, sourceDb, targetDb) {
  console.log(`\n📁 Copying collection: ${collectionPath}`);
  
  try {
    const snapshot = await sourceDb.collection(collectionPath).get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  Collection ${collectionPath} is empty`);
      return;
    }

    const batch = targetDb.batch();
    let docCount = 0;

    for (const doc of snapshot.docs) {
      const targetRef = targetDb.collection(collectionPath).doc(doc.id);
      batch.set(targetRef, doc.data());
      docCount++;
    }

    await batch.commit();
    console.log(`   ✅ Copied ${docCount} documents`);

  } catch (error) {
    console.error(`   ❌ Error copying ${collectionPath}:`, error.message);
  }
}

async function copySubcollections(docPath, sourceDb, targetDb) {
  try {
    const docRef = sourceDb.doc(docPath);
    const subcollections = await docRef.listCollections();
    
    for (const subcollection of subcollections) {
      const subcollectionPath = `${docPath}/${subcollection.id}`;
      await copyCollection(subcollectionPath, sourceDb, targetDb);
      
      // Recursively copy any sub-subcollections
      const subSnapshot = await subcollection.get();
      for (const subDoc of subSnapshot.docs) {
        await copySubcollections(`${subcollectionPath}/${subDoc.id}`, sourceDb, targetDb);
      }
    }
  } catch (error) {
    console.error(`Error copying subcollections for ${docPath}:`, error.message);
  }
}

async function copyCompleteDatabase() {
  console.log('\n🔄 Starting complete database copy...');
  
  try {
    // Get all top-level collections from production
    const collections = await prodDb.listCollections();
    
    for (const collection of collections) {
      await copyCollection(collection.id, prodDb, stagingDb);
      
      // Copy subcollections for each document in this collection
      const snapshot = await collection.get();
      for (const doc of snapshot.docs) {
        await copySubcollections(`${collection.id}/${doc.id}`, prodDb, stagingDb);
      }
    }
    
    console.log('\n🎉 Database copy completed successfully!');
    console.log('\n📋 What was copied:');
    
    // List what was copied
    const stagingCollections = await stagingDb.listCollections();
    for (const collection of stagingCollections) {
      const snapshot = await collection.get();
      console.log(`   📁 ${collection.id}: ${snapshot.size} documents`);
    }

  } catch (error) {
    console.error('\n❌ Error during database copy:', error);
  }
}

async function copyAuthUsers() {
  console.log('\n👥 Copying authentication users...');
  console.log('⚠️  Note: This requires using Firebase CLI auth:export and auth:import');
  console.log('Run these commands after the database copy:');
  console.log('1. firebase use tolman-app');
  console.log('2. firebase auth:export users-backup.json');
  console.log('3. firebase use tolmantest');
  console.log('4. firebase auth:import users-backup.json');
}

// Main execution
async function main() {
  try {
    await copyCompleteDatabase();
    await copyAuthUsers();
    
    console.log('\n✅ Copy process completed!');
    console.log('Your staging database should now have all the data from production.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    // Clean up
    await prodApp.delete();
    await stagingApp.delete();
    process.exit(0);
  }
}

main();
