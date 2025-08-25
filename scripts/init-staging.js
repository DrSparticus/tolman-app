// Initialize staging database with basic structure
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// You'll need to download the service account key for tolmantest
// and place it in this directory as 'tolmantest-service-account.json'

const app = initializeApp({
  credential: cert('./tolmantest-service-account.json'),
  projectId: 'tolmantest'
});

const db = getFirestore(app);

async function initializeStaging() {
  console.log('🚀 Initializing staging database...');
  
  try {
    // 1. Create basic roles
    const roles = [
      {
        id: 'admin',
        name: 'Admin',
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
      {
        id: 'supervisor',
        name: 'Supervisor', 
        permissions: {
          home: { view: true },
          projects: { view: true, edit: true },
          schedule: { view: true, edit: true }
        }
      }
    ];

    for (const role of roles) {
      await db.collection('artifacts/tolmantest/roles').doc(role.id).set({
        name: role.name,
        permissions: role.permissions
      });
      console.log(`✅ Created role: ${role.name}`);
    }

    // 2. Create basic markup configuration
    await db.collection('artifacts/tolmantest/config').doc('markup').set({
      laborBurden: 15,
      salesTax: 7.25,
      overhead: 8,
      profit: 10
    });
    console.log('✅ Created markup configuration');

    // 3. Create basic crew types
    const crewTypes = [
      { name: 'Hanger', rates: { hang: 0.85 } },
      { name: 'Taper', rates: { finishedTape: 1.20, unfinishedTape: 0.90 } }
    ];

    for (const crew of crewTypes) {
      await db.collection('artifacts/tolmantest/config/labor/crewTypes').add(crew);
      console.log(`✅ Created crew type: ${crew.name}`);
    }

    // 4. Create basic finishes
    await db.collection('artifacts/tolmantest/config').doc('finishes').set({
      wallTextures: [
        { name: 'Orange Peel', pay: 0.05, crew: '', charge: 0.08 },
        { name: 'Knockdown', pay: 0.07, crew: '', charge: 0.10 }
      ],
      ceilingTextures: [
        { name: 'Orange Peel', pay: 0.05, crew: '', charge: 0.08 },
        { name: 'Popcorn', pay: 0.12, crew: '', charge: 0.15 }
      ],
      corners: [
        { name: 'Rounded', pay: 0.03, crew: '', charge: 0.05 }
      ],
      miscellaneous: []
    });
    console.log('✅ Created finishes configuration');

    console.log('🎉 Staging database initialized successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Create your admin user account by logging in');
    console.log('2. Add materials data');
    console.log('3. Configure crew IDs in finishes');

  } catch (error) {
    console.error('❌ Error initializing staging:', error);
  }

  process.exit(0);
}

initializeStaging();
