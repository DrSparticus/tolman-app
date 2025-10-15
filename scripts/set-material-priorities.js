// Script to set initial material sorting priorities
// Run this script to set the priority values mentioned by the user

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./tolman-app-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tolmantest'
});

const db = admin.firestore();
const materialsPath = 'artifacts/tolmantest/public/data/materials';

async function setMaterialPriorities() {
  try {
    // Priority mappings based on user request
    const priorityMap = {
      '1/2" Regular': 1,
      '5/8" Type X': 1,
      '1/2" Regular - 54"': 2,
      '5/8" Type X - 54"': 2
    };

    console.log('🔍 Fetching all materials...');
    const materialsSnapshot = await db.collection(materialsPath).get();
    const materials = materialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📋 Found ${materials.length} materials`);

    for (const [materialName, priority] of Object.entries(priorityMap)) {
      // Find material by name (case-insensitive, flexible matching)
      const material = materials.find(m => 
        m.name && m.name.toLowerCase().includes(materialName.toLowerCase().replace(/["']/g, ''))
      );

      if (material) {
        console.log(`✅ Setting priority ${priority} for "${material.name}"`);
        await db.collection(materialsPath).doc(material.id).update({
          sortingPriority: priority
        });
      } else {
        console.log(`⚠️  Material not found: "${materialName}"`);
        // List similar materials to help with matching
        const similar = materials.filter(m => 
          m.name && (
            m.name.toLowerCase().includes('regular') || 
            m.name.toLowerCase().includes('type x') ||
            m.name.toLowerCase().includes('1/2') ||
            m.name.toLowerCase().includes('5/8')
          )
        ).map(m => m.name);
        if (similar.length > 0) {
          console.log(`   Similar materials found: ${similar.join(', ')}`);
        }
      }
    }

    // Set default priority for materials that don't have one
    console.log('\n🔧 Setting default priority (99) for materials without priority...');
    let defaultCount = 0;
    for (const material of materials) {
      if (!material.sortingPriority) {
        await db.collection(materialsPath).doc(material.id).update({
          sortingPriority: 99
        });
        defaultCount++;
      }
    }
    console.log(`📝 Set default priority for ${defaultCount} materials`);

    console.log('\n🎉 Material priorities updated successfully!');
    console.log('\nPriority Summary:');
    console.log('Priority 1: 1/2" Regular, 5/8" Type X');
    console.log('Priority 2: 1/2" Regular - 54", 5/8" Type X - 54"');
    console.log('Priority 99: All other materials (default)');

  } catch (error) {
    console.error('❌ Error updating material priorities:', error);
  } finally {
    process.exit();
  }
}

setMaterialPriorities();