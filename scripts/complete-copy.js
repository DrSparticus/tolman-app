// Complete database copy from production to staging
const admin = require('firebase-admin');
const path = require('path');

console.log('🔄 Complete Database Copy: Production → Staging');
console.log('===============================================');
console.log('Copying artifacts/tolman-app → artifacts/tolmantest');
console.log('');

const prodKeyPath = path.join(__dirname, 'tolman-app-service-account.json');
const stagingKeyPath = path.join(__dirname, 'tolmantest-service-account.json');

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

async function copyCollection(sourcePath, targetPath, level = 0) {
  const indent = '  '.repeat(level);
  console.log(`${indent}📁 Copying: ${sourcePath} → ${targetPath}`);
  
  try {
    const snapshot = await prodDb.collection(sourcePath).get();
    
    if (snapshot.empty) {
      console.log(`${indent}   ⚠️  Empty collection`);
      return 0;
    }

    // Copy documents in batches of 500 (Firestore limit)
    const batchSize = 500;
    let totalCopied = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = stagingDb.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      for (const doc of batchDocs) {
        const targetRef = stagingDb.collection(targetPath).doc(doc.id);
        batch.set(targetRef, doc.data());
      }
      
      await batch.commit();
      totalCopied += batchDocs.length;
    }

    console.log(`${indent}   ✅ Copied ${totalCopied} documents`);

    // Copy subcollections for each document
    for (const doc of snapshot.docs) {
      const subcollections = await doc.ref.listCollections();
      
      for (const subcollection of subcollections) {
        const sourceSubPath = `${sourcePath}/${doc.id}/${subcollection.id}`;
        const targetSubPath = `${targetPath}/${doc.id}/${subcollection.id}`;
        
        await copyCollection(sourceSubPath, targetSubPath, level + 1);
      }
    }
    
    return totalCopied;

  } catch (error) {
    console.error(`${indent}   ❌ Error: ${error.message}`);
    return 0;
  }
}

async function copyMainDocument() {
  console.log('📄 Copying main document...');
  
  try {
    const sourceDoc = await prodDb.doc('artifacts/tolman-app').get();
    
    if (sourceDoc.exists) {
      await stagingDb.doc('artifacts/tolmantest').set(sourceDoc.data());
      console.log('   ✅ Main document copied');
      return true;
    } else {
      console.log('   ⚠️  Main document does not exist');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error copying main document:', error.message);
    return false;
  }
}

async function copyCompleteDatabase() {
  try {
    let totalCopied = 0;
    
    // First, copy the main document
    await copyMainDocument();
    
    // Get all subcollections from production artifacts/tolman-app
    console.log('\n🔍 Scanning production subcollections...');
    const prodDoc = await prodDb.doc('artifacts/tolman-app').get();
    
    if (!prodDoc.exists) {
      console.log('❌ Production document artifacts/tolman-app does not exist');
      return;
    }
    
    const subcollections = await prodDoc.ref.listCollections();
    console.log(`📁 Found subcollections: ${subcollections.map(sub => sub.id).join(', ')}`);
    
    // Copy each subcollection
    for (const subcollection of subcollections) {
      const sourcePath = `artifacts/tolman-app/${subcollection.id}`;
      const targetPath = `artifacts/tolmantest/${subcollection.id}`;
      
      const copied = await copyCollection(sourcePath, targetPath);
      totalCopied += copied;
    }
    
    console.log(`\n🎉 Copy completed! Total documents: ${totalCopied}`);
    
    // Verify staging database
    console.log('\n📋 Verifying staging database...');
    const stagingDoc = await stagingDb.doc('artifacts/tolmantest').get();
    
    if (stagingDoc.exists) {
      const stagingSubcollections = await stagingDoc.ref.listCollections();
      console.log(`✅ Staging subcollections: ${stagingSubcollections.map(sub => sub.id).join(', ')}`);
      
      for (const subcollection of stagingSubcollections) {
        const snapshot = await subcollection.get();
        console.log(`   📂 ${subcollection.id}: ${snapshot.size} documents`);
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

async function main() {
  try {
    await copyCompleteDatabase();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prodApp.delete();
    await stagingApp.delete();
    console.log('\n✅ Database copy process completed!');
    process.exit(0);
  }
}

main();
