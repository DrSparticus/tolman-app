// List all collections in the production database
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const prodKeyPath = path.join(__dirname, 'tolman-app-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(prodKeyPath)),
  projectId: 'tolman-app'
});

const db = admin.firestore(app);

async function listAllCollections() {
  console.log('🔍 Scanning production database for collections...');
  console.log('===============================================');
  
  try {
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('❌ No collections found in the database');
      return;
    }
    
    console.log(`📁 Found ${collections.length} top-level collections:`);
    console.log('');
    
    for (const collection of collections) {
      console.log(`📂 Collection: ${collection.id}`);
      
      try {
        const snapshot = await collection.get();
        console.log(`   📄 Documents: ${snapshot.size}`);
        
        // Show first few document IDs
        if (snapshot.size > 0) {
          const docIds = snapshot.docs.slice(0, 5).map(doc => doc.id);
          console.log(`   📝 Sample docs: ${docIds.join(', ')}${snapshot.size > 5 ? '...' : ''}`);
          
          // Check for subcollections in each document
          for (const doc of snapshot.docs.slice(0, 3)) { // Check first 3 docs
            const subcollections = await doc.ref.listCollections();
            if (subcollections.length > 0) {
              console.log(`   📁 ${doc.id} subcollections: ${subcollections.map(sub => sub.id).join(', ')}`);
              
              // If this is tolman-app document, show its subcollections in detail
              if (doc.id === 'tolman-app') {
                for (const subcol of subcollections) {
                  const subSnapshot = await subcol.get();
                  console.log(`      └─ ${subcol.id}: ${subSnapshot.size} documents`);
                }
              }
            }
          }
        }
        console.log('');
        
      } catch (error) {
        console.log(`   ❌ Error reading collection: ${error.message}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error listing collections:', error);
  }
  
  await app.delete();
}

listAllCollections();
