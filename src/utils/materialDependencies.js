import { doc, getDoc } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

// Remove static dependencies - use only dynamic ones
export const loadDynamicDependencies = async (db) => {
  try {
    const dependenciesDocRef = doc(db, configPath, 'materialDependencies');
    const docSnap = await getDoc(dependenciesDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const dynamicDeps = {};
      
      data.dependencies?.forEach(dep => {
        dynamicDeps[dep.materialName] = {
          formula: dep.formula,
          roundUp: dep.roundUp,
          appliesTo: dep.laborTypes,
          condition: dep.finishedOnly ? 'finishedOnly' : null,
          supervisorSpecific: dep.supervisorFormulas || {}
        };
      });
      
      return dynamicDeps;
    }
  } catch (error) {
    console.error('Error loading dynamic dependencies:', error);
  }
  
  return {}; // Return empty object instead of static fallback
};

export const calculateDependentQuantity = (formula, variables, supervisorId = null, supervisorFormulas = {}) => {
  // Use supervisor-specific formula if available
  const actualFormula = supervisorFormulas[supervisorId] || formula;
  
  let calculatedFormula = actualFormula;
  Object.keys(variables).forEach(key => {
    calculatedFormula = calculatedFormula.replace(new RegExp(key, 'g'), variables[key]);
  });
  
  try {
    const result = Function(`"use strict"; return (${calculatedFormula})`)();
    return result;
  } catch (error) {
    console.error('Error calculating dependency:', error);
    return 0;
  }
};