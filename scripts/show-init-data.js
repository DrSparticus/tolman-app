const fs = require('fs');

// Generate the initialization data in a format that can be easily copied to Firebase Console
function generateInitData() {
  const data = {
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

  console.log('🚀 Firebase Staging Database Initialization');
  console.log('===========================================');
  console.log('');
  console.log('Follow these steps to initialize your staging database:');
  console.log('');
  console.log('1. Open Firebase Console: https://console.firebase.google.com/project/tolmantest/firestore');
  console.log('2. Click "Start collection" if no collections exist');
  console.log('3. Create the following structure:');
  console.log('');
  
  console.log('📁 Collection: artifacts');
  console.log('   📄 Document: tolmantest');
  console.log('   📁 Subcollection: roles');
  console.log('');
  
  // Output roles
  Object.entries(data.roles).forEach(([roleId, roleData]) => {
    console.log(`   📄 Document: ${roleId}`);
    console.log('   📋 Data (copy this JSON):');
    console.log(JSON.stringify(roleData, null, 2));
    console.log('');
  });
  
  console.log('   📁 Subcollection: config');
  console.log('');
  
  // Output config
  Object.entries(data.config).forEach(([configId, configData]) => {
    console.log(`   📄 Document: ${configId}`);
    console.log('   📋 Data (copy this JSON):');
    console.log(JSON.stringify(configData, null, 2));
    console.log('');
  });

  console.log('4. After creating the database structure, you need to add your user to the admin role:');
  console.log('   📁 Collection: artifacts/tolmantest/users');
  console.log('   📄 Document: [YOUR_USER_ID] (find this in Authentication tab)');
  console.log('   📋 Data:');
  console.log(JSON.stringify({
    role: "admin",
    email: "[YOUR_EMAIL]",
    name: "[YOUR_NAME]",
    active: true
  }, null, 2));
  console.log('');
  console.log('✅ After completing these steps, your staging app should work properly!');
}

generateInitData();
