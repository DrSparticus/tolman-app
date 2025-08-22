// firebase-data-copy.js
const admin = require('firebase-admin');

// Initialize production Firebase
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey-prod.json')),
  databaseURL: 'https://tolman-app-default-rtdb.firebaseio.com'
}, 'production');

// Initialize staging Firebase  
const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey-staging.json')),
  databaseURL: 'https://tolman-app-staging-default-rtdb.firebaseio.com'
}, 'staging');

const prodDb = prodApp.firestore();
const stagingDb = stagingApp.firestore();

async function copyData() {
  console.log('Starting data copy...');
  
  try {
    // Get all collections from production
    const collections = await prodDb.listCollections();
    
    for (const collection of collections) {
      console.log(`Copying collection: ${collection.id}`);
      
      const snapshot = await collection.get();
      const batch = stagingDb.batch();
      
      snapshot.docs.forEach(doc => {
        const stagingRef = stagingDb.collection(collection.id).doc(doc.id);
        batch.set(stagingRef, doc.data());
      });
      
      await batch.commit();
      console.log(`✅ Copied ${snapshot.size} documents from ${collection.id}`);
    }
    
    console.log('✅ Data copy completed successfully!');
  } catch (error) {
    console.error('❌ Error copying data:', error);
  }
}

// Run the copy
copyData();
