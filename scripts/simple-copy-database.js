// Simplified database copy using Firebase Admin SDK with application default credentials
const admin = require('firebase-admin');

console.log('🚀 Simple Firebase Database Copy Tool');
console.log('=====================================');
console.log('This script copies Firestore data from tolman-app to tolmantest');
console.log('');

// Initialize Firebase Admin with default credentials
// Make sure you have firebase CLI logged in with an account that has access to both projects

let prodApp, stagingApp;

try {
  // Initialize production app
  prodApp = admin.initializeApp({
    projectId: 'tolman-app'
  }, 'production');

  // Initialize staging app  
  stagingApp = admin.initializeApp({
    projectId: 'tolmantest'
  }, 'staging');

  console.log('✅ Firebase apps initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase apps:', error.message);
  console.log('Make sure you are logged in with: firebase login');
  process.exit(1);
}

const prodDb = admin.firestore(prodApp);
const stagingDb = admin.firestore(stagingApp);

async function copyDocument(docPath, sourceDb, targetDb) {
  try {
    const doc = await sourceDb.doc(docPath).get();
    if (doc.exists) {
      await targetDb.doc(docPath).set(doc.data());
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error copying document ${docPath}:`, error.message);
    return false;
  }
}

async function copyCollection(collectionPath, sourceDb, targetDb, level = 0) {
  const indent = '  '.repeat(level);
  console.log(`${indent}📁 Copying collection: ${collectionPath}`);
  
  try {
    const snapshot = await sourceDb.collection(collectionPath).get();
    
    if (snapshot.empty) {
      console.log(`${indent}   ⚠️  Collection is empty`);
      return 0;
    }

    let copiedCount = 0;
    
    // Copy documents in batches
    const batch = targetDb.batch();
    const promises = [];
    
    for (const doc of snapshot.docs) {
      const targetRef = targetDb.collection(collectionPath).doc(doc.id);
      batch.set(targetRef, doc.data());
      copiedCount++;
      
      // Also check for subcollections
      const subcollections = await doc.ref.listCollections();
      for (const subcollection of subcollections) {
        const subPath = `${collectionPath}/${doc.id}/${subcollection.id}`;
        promises.push(copyCollection(subPath, sourceDb, targetDb, level + 1));
      }
    }

    await batch.commit();
    console.log(`${indent}   ✅ Copied ${copiedCount} documents`);
    
    // Wait for subcollections to complete
    await Promise.all(promises);
    
    return copiedCount;

  } catch (error) {
    console.error(`${indent}   ❌ Error copying ${collectionPath}:`, error.message);
    return 0;
  }
}

async function copyAllCollections() {
  console.log('\n🔄 Starting database copy...\n');
  
  try {
    const collections = await prodDb.listCollections();
    let totalCopied = 0;
    
    for (const collection of collections) {
      const copied = await copyCollection(collection.id, prodDb, stagingDb);
      totalCopied += copied;
    }
    
    console.log(`\n🎉 Copy completed! Total documents copied: ${totalCopied}`);
    
    // Show what's in staging now
    console.log('\n📋 Staging database contents:');
    const stagingCollections = await stagingDb.listCollections();
    for (const collection of stagingCollections) {
      const snapshot = await collection.get();
      console.log(`   📁 ${collection.id}: ${snapshot.size} documents`);
    }

  } catch (error) {
    console.error('\n❌ Error during copy:', error);
  }
}

// Main execution
async function main() {
  try {
    await copyAllCollections();
    console.log('\n✅ Database copy process completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    if (prodApp) await prodApp.delete();
    if (stagingApp) await stagingApp.delete();
    process.exit(0);
  }
}

// Check if required packages are installed
try {
  require.resolve('firebase-admin');
  main();
} catch (error) {
  console.error('❌ firebase-admin package not found');
  console.log('Install it with: npm install firebase-admin');
  process.exit(1);
}
