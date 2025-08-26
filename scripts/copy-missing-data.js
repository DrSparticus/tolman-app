// Copy missing materials, customers, and suppliers data
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log('🚀 Copying Missing Data Collections');
console.log('====================================');

// Initialize Firebase Admin for both projects
const prodKeyPath = path.join(__dirname, 'tolman-app-service-account.json');
const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

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

async function copySpecificCollection(collectionRef, targetCollectionRef, name) {
  console.log(`\n📁 Copying ${name}...`);
  
  try {
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  ${name} collection is empty`);
      return;
    }

    const batch = stagingDb.batch();
    let docCount = 0;

    for (const doc of snapshot.docs) {
      const targetRef = targetCollectionRef.doc(doc.id);
      batch.set(targetRef, doc.data());
      docCount++;
    }

    await batch.commit();
    console.log(`   ✅ Copied ${docCount} ${name} documents`);

  } catch (error) {
    console.error(`   ❌ Error copying ${name}:`, error.message);
  }
}

async function copyMissingData() {
  try {
    // Define the paths for the missing collections
    const collections = [
      {
        name: 'Materials',
        source: prodDb.collection('artifacts').doc('tolman-app').collection('public').doc('data').collection('materials'),
        target: stagingDb.collection('artifacts').doc('tolmantest').collection('public').doc('data').collection('materials')
      },
      {
        name: 'Customers', 
        source: prodDb.collection('artifacts').doc('tolman-app').collection('config').doc('customers').collection('customerList'),
        target: stagingDb.collection('artifacts').doc('tolmantest').collection('config').doc('customers').collection('customerList')
      },
      {
        name: 'Suppliers',
        source: prodDb.collection('artifacts').doc('tolman-app').collection('config').doc('suppliers').collection('supplierList'),
        target: stagingDb.collection('artifacts').doc('tolmantest').collection('config').doc('suppliers').collection('supplierList')
      }
    ];

    for (const collection of collections) {
      await copySpecificCollection(collection.source, collection.target, collection.name);
    }
    
    console.log('\n🎉 Missing data copy completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during copy:', error);
  }
}

// Main execution
async function main() {
  try {
    await copyMissingData();
    console.log('\n✅ All missing data has been copied to staging!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prodApp.delete();
    await stagingApp.delete();
    process.exit(0);
  }
}

main();
