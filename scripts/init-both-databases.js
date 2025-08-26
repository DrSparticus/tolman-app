// Initialize both production and staging databases with proper structure
const admin = require('firebase-admin');
const path = require('path');

console.log('🚀 Initialize Production & Staging Databases');
console.log('===========================================');

// Initialize both Firebase apps
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

// Base configuration data
const initData = {
  roles: {
    admin: {
      name: "Admin",
      permissions: {
        home: { view: true },
        bids: { view: true, create: true, edit: true, delete: true, advancedPricing: true, convertToProject: true },
        customers: { view: true, create: true, edit: true, delete: true },
        suppliers: { view: true, create: true, edit: true, delete: true },
        materials: { view: true, create: true, edit: true, delete: true, pricing: true },
        projects: { view: true, edit: true, schedule: true, complete: true },
        changeOrders: { view: true, create: true, approve: true },
        schedule: { view: true, edit: true, assign: true },
        users: { view: true, create: true, edit: true, delete: true, roles: true },
        administration: { view: true, finishes: true, labor: true, markup: true, roles: true }
      }
    },
    supervisor: {
      name: "Supervisor",
      permissions: {
        home: { view: true },
        projects: { view: true, edit: true },
        schedule: { view: true, edit: true }
      }
    }
  },
  config: {
    markup: {
      laborBurden: 15,
      salesTax: 7.25,
      overhead: 8,
      profit: 10
    },
    finishes: {
      wallTextures: [
        { name: "Orange Peel", pay: 0.05, crew: "", charge: 0.08 },
        { name: "Knockdown", pay: 0.07, crew: "", charge: 0.10 }
      ],
      ceilingTextures: [
        { name: "Orange Peel", pay: 0.05, crew: "", charge: 0.08 },
        { name: "Popcorn", pay: 0.12, crew: "", charge: 0.15 }
      ],
      corners: [
        { name: "Rounded", pay: 0.03, crew: "", charge: 0.05 }
      ],
      miscellaneous: []
    },
    labor: {
      crewTypes: {
        crew1: {
          name: "Hanger",
          rates: { hang: 0.85 }
        },
        crew2: {
          name: "Taper", 
          rates: { finishedTape: 1.20, unfinishedTape: 0.90 }
        }
      }
    }
  }
};

async function initializeDatabase(db, projectId) {
  console.log(`\n📋 Initializing ${projectId} database...`);
  
  const projectPath = `artifacts/${projectId}`;
  
  try {
    // Initialize roles
    console.log(`   📁 Creating roles collection...`);
    for (const [roleId, roleData] of Object.entries(initData.roles)) {
      await db.collection(`${projectPath}/roles`).doc(roleId).set(roleData);
      console.log(`     ✅ Created role: ${roleData.name}`);
    }
    
    // Initialize config
    console.log(`   📁 Creating config collection...`);
    for (const [configId, configData] of Object.entries(initData.config)) {
      await db.collection(`${projectPath}/config`).doc(configId).set(configData);
      console.log(`     ✅ Created config: ${configId}`);
    }
    
    // Create the main project document to establish the structure
    await db.doc(projectPath).set({
      initialized: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0'
    });
    
    console.log(`   ✅ ${projectId} database initialized successfully!`);
    
  } catch (error) {
    console.error(`   ❌ Error initializing ${projectId}:`, error);
  }
}

async function copyFromProdToStaging() {
  console.log(`\n🔄 Copying from production to staging...`);
  
  try {
    const prodPath = 'artifacts/tolman-app';
    const stagingPath = 'artifacts/tolmantest';
    
    // Get all subcollections from production
    const prodDoc = await prodDb.doc(prodPath).get();
    if (!prodDoc.exists) {
      console.log('⚠️  Production not initialized, skipping copy');
      return;
    }
    
    const subcollections = await prodDoc.ref.listCollections();
    
    for (const subcollection of subcollections) {
      console.log(`   📁 Copying ${subcollection.id}...`);
      
      const snapshot = await subcollection.get();
      const batch = stagingDb.batch();
      
      for (const doc of snapshot.docs) {
        const targetRef = stagingDb.collection(`${stagingPath}/${subcollection.id}`).doc(doc.id);
        batch.set(targetRef, doc.data());
      }
      
      await batch.commit();
      console.log(`     ✅ Copied ${snapshot.size} documents`);
    }
    
    // Copy the main document
    if (prodDoc.exists) {
      await stagingDb.doc(stagingPath).set(prodDoc.data());
      console.log(`   ✅ Copied main project document`);
    }
    
  } catch (error) {
    console.error('❌ Error copying to staging:', error);
  }
}

async function main() {
  try {
    console.log('🎯 Choose an option:');
    console.log('1. Initialize production only');
    console.log('2. Initialize staging only'); 
    console.log('3. Initialize both production and staging');
    console.log('4. Copy production to staging (if production exists)');
    
    // For now, let's do option 3 - initialize both
    console.log('\n🚀 Initializing both databases...');
    
    await initializeDatabase(prodDb, 'tolman-app');
    await initializeDatabase(stagingDb, 'tolmantest');
    
    console.log('\n🎉 Both databases initialized successfully!');
    console.log('\n📋 What was created:');
    console.log('Production (tolman-app):');
    console.log('  └─ artifacts/tolman-app/roles (admin, supervisor)');
    console.log('  └─ artifacts/tolman-app/config (markup, finishes, labor)');
    console.log('');
    console.log('Staging (tolmantest):');
    console.log('  └─ artifacts/tolmantest/roles (admin, supervisor)');
    console.log('  └─ artifacts/tolmantest/config (markup, finishes, labor)');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prodApp.delete();
    await stagingApp.delete();
    process.exit(0);
  }
}

main();
