// Simple staging initialization script using Firebase CLI
const { spawn } = require('child_process');

function runFirebaseCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('firebase', [command, ...args], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function initializeStaging() {
  console.log('🚀 Initializing staging database...');
  
  try {
    // Create basic collections using Firebase CLI
    
    // Create admin role
    const adminRole = {
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
    };

    // Create supervisor role  
    const supervisorRole = {
      name: 'Supervisor',
      permissions: {
        home: { view: true },
        projects: { view: true, edit: true },
        schedule: { view: true, edit: true }
      }
    };

    // Create markup config
    const markupConfig = {
      laborBurden: 15,
      salesTax: 7.25,
      overhead: 8,
      profit: 10
    };

    // Create finishes config
    const finishesConfig = {
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
    };

    console.log('📄 Configuration created. Now you need to manually add these to your staging database:');
    console.log('');
    console.log('1. Go to https://console.firebase.google.com/project/tolmantest/firestore');
    console.log('2. Create the following documents:');
    console.log('');
    console.log('Collection: artifacts/tolmantest/roles');
    console.log('Document ID: admin');
    console.log('Data:', JSON.stringify(adminRole, null, 2));
    console.log('');
    console.log('Document ID: supervisor');
    console.log('Data:', JSON.stringify(supervisorRole, null, 2));
    console.log('');
    console.log('Collection: artifacts/tolmantest/config');
    console.log('Document ID: markup');
    console.log('Data:', JSON.stringify(markupConfig, null, 2));
    console.log('');
    console.log('Document ID: finishes');
    console.log('Data:', JSON.stringify(finishesConfig, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

initializeStaging();
