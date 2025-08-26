// Deep scan of the database structure
const admin = require('firebase-admin');
const path = require('path');

const prodKeyPath = path.join(__dirname, 'tolman-app-service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(prodKeyPath)),
  projectId: 'tolman-app'
});

const db = admin.firestore(app);

async function deepScan() {
  console.log('🔬 Deep scanning production database...');
  console.log('=====================================');
  
  try {
    // Try to access the specific path you mentioned
    console.log('🎯 Checking artifacts/tolman-app path specifically...');
    
    const tolmanAppDoc = await db.doc('artifacts/tolman-app').get();
    console.log(`📄 artifacts/tolman-app exists: ${tolmanAppDoc.exists}`);
    
    if (tolmanAppDoc.exists) {
      console.log('📊 Document data keys:', Object.keys(tolmanAppDoc.data() || {}));
      
      // Check subcollections
      const subcollections = await tolmanAppDoc.ref.listCollections();
      console.log(`📁 Subcollections: ${subcollections.map(sub => sub.id).join(', ')}`);
      
      for (const subcol of subcollections) {
        const subSnapshot = await subcol.get();
        console.log(`   └─ ${subcol.id}: ${subSnapshot.size} documents`);
        
        if (subSnapshot.size > 0) {
          const sampleDoc = subSnapshot.docs[0];
          console.log(`      Sample doc ID: ${sampleDoc.id}`);
          console.log(`      Sample data keys: ${Object.keys(sampleDoc.data() || {}).join(', ')}`);
        }
      }
    }
    
    // Also try alternative paths
    console.log('\n🔍 Checking alternative structures...');
    
    // Check if data is directly in artifacts collection
    const artifactsSnapshot = await db.collection('artifacts').get();
    console.log(`📂 artifacts collection: ${artifactsSnapshot.size} documents`);
    
    if (artifactsSnapshot.size > 0) {
      artifactsSnapshot.docs.forEach(doc => {
        console.log(`   📄 Document: ${doc.id}`);
      });
    }
    
    // Check all top-level collections
    const allCollections = await db.listCollections();
    console.log(`\n📁 All top-level collections: ${allCollections.map(c => c.id).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error during deep scan:', error);
  }
  
  await app.delete();
}

deepScan();
