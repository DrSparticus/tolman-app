import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function BidPricingSummary({ bid, laborBreakdown, totalMaterialCost, userData, db, materials, finishes }) {
    const [markups, setMarkups] = useState({ laborBurden: 0.15, salesTax: 0.0725, overhead: 0.08, profit: 0.10 });
    const [crewTypes, setCrewTypes] = useState([]);
    const [materialDependencies, setMaterialDependencies] = useState([]);
    const [debugMode, setDebugMode] = useState(false);
    const isSupervisor = userData?.role === 'supervisor';
    const isAdmin = userData?.role === 'admin';
    const hasAdvancedPricing = userData?.permissions?.bids?.advancedPricing !== false;
    
    // Load markups from database
    useEffect(() => {
        if (!db) return;
        const markupDocRef = doc(db, configPath, 'markup');
        const unsubscribe = onSnapshot(markupDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMarkups({
                    laborBurden: (parseFloat(data.laborBurden) || 15) / 100,
                    salesTax: (parseFloat(data.salesTax) || 7.25) / 100,
                    overhead: (parseFloat(data.overhead) || 8) / 100,
                    profit: (parseFloat(data.profit) || 10) / 100
                });
            }
        });
        return unsubscribe;
    }, [db]);

    // Load crew types and material dependencies
    useEffect(() => {
        if (!db) return;
        
        // Load crew types
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        const crewUnsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrewTypes(crewsData);
        });

        // Load material dependencies
        const depsDocRef = doc(db, configPath, 'materialDependencies');
        const depsUnsubscribe = onSnapshot(depsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMaterialDependencies(data.dependencies || []);
            } else {
                setMaterialDependencies([]);
            }
        });

        return () => {
            crewUnsubscribe();
            depsUnsubscribe();
        };
    }, [db]);

    // Early return if essential props are missing (after hooks)
    if (!bid || !materials || !finishes) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>
                <div className="text-gray-500">Loading pricing data...</div>
            </div>
        );
    }

    // Helper function to calculate area-specific tape rate (matching Area component logic)
    const calculateAreaTapeRate = (area) => {
        // Get hang rate from area or bid
        const hangRate = parseFloat(area.hangRate) || parseFloat(bid.finishedHangingRate) || 0;
        const baseAddition = 0.04;
        
        let taperFinishesTotal = 0;
        const wallTexture = area.useOverallFinishes ? bid?.wallTexture : area.wallTexture;
        const ceilingTexture = area.useOverallFinishes ? bid?.ceilingTexture : area.ceilingTexture;
        const corners = area.useOverallFinishes ? bid?.corners : area.corners;
        
        // Calculate taper pay from finishes
        const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
        
        if (wallTexture && finishes?.wallTextures) {
            const wt = finishes.wallTextures.find(f => f.name === wallTexture);
            if (wt && typeof wt === 'object' && wt.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(wt.pay) || 0;
            }
        }
        if (ceilingTexture && finishes?.ceilingTextures) {
            const ct = finishes.ceilingTextures.find(f => f.name === ceilingTexture);
            if (ct && typeof ct === 'object' && ct.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(ct.pay) || 0;
            }
        }
        if (corners && finishes?.corners) {
            const c = finishes.corners.find(f => f.name === corners);
            if (c && typeof c === 'object' && c.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(c.pay) || 0;
            }
        }
        
        // Add extra taper pay from materials used in this area
        let materialExtraPay = 0;
        if (area.materials && materials) {
            area.materials.forEach(areaMat => {
                const material = materials.find(m => m.id === areaMat.materialId);
                if (material && material.extraLabor) {
                    const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                    if (taperExtra) {
                        materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                    }
                }
            });
        }
        
        return hangRate + baseAddition + taperFinishesTotal + materialExtraPay;
    };

    // Calculate pricing with area-by-area logic
    const calculatePricing = () => {
        try {
            const debug = [];
            
            // Safety checks
            if (!bid || !materials || !Array.isArray(materials)) {
                debug.push('Missing required data: bid, materials, or materials is not an array');
                return {
                    stockedMaterial: 0,
                    miscMaterials: 0,
                    totalMaterialBeforeTax: 0,
                    totalMaterialWithTax: 0,
                    salesTax: 0,
                    effectiveSalesTaxRate: markups.salesTax,
                    hangLabor: 0,
                    tapeLabor: 0,
                    totalBaseLabor: 0,
                    laborBurden: 0,
                    totalLaborWithBurden: 0,
                    hardCost: 0,
                    overhead: 0,
                    breakEven: 0,
                    profit: 0,
                    finishExtraProfit: 0,
                    totalProfit: 0,
                    netQuote: 0,
                    debug: ['Error: Missing required data for calculations']
                };
            }
            
            // Find crew IDs
            const hangingCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id;
            const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
        
            debug.push(`Hanging Crew ID: ${hangingCrewId}`);
            debug.push(`Taper Crew ID: ${taperCrewId}`);

            // Initialize totals
            let totalStockedMaterial = 0;
            let totalHangLabor = 0;
            let totalTapeLabor = 0;
            let totalHangingSqFt = 0;

            debug.push('\n=== AREA-BY-AREA CALCULATIONS ===');

            // Calculate each area separately
            bid.areas?.forEach(area => {
                debug.push(`\n--- AREA: ${area.name} ---`);
                debug.push(`Area finished: ${area.isFinished}`);
                debug.push(`Use overall labor: ${area.useOverallLabor}`);
                debug.push(`Use overall finishes: ${area.useOverallFinishes}`);
                
                // Determine labor rates for this area
                const hangRate = area.useOverallLabor 
                    ? (() => {
                        // When using overall labor rates but area-specific finishes,
                        // we need to apply finish upgrades to the overall base rate
                        if (!area.useOverallFinishes) {
                            const baseRate = parseFloat(bid.finishedHangingRate) || 0;
                            
                            let hangingFinishesTotal = 0;
                            const wallTexture = area.wallTexture;
                            const ceilingTexture = area.ceilingTexture;
                            const corners = area.corners;
                            
                            // Calculate hanging pay from finishes
                            const hangingCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id;
                            
                            if (wallTexture && finishes?.wallTextures) {
                                const wt = finishes.wallTextures.find(f => f.name === wallTexture);
                                if (wt && typeof wt === 'object' && wt.crew === hangingCrewId) {
                                    hangingFinishesTotal += parseFloat(wt.pay) || 0;
                                }
                            }
                            if (ceilingTexture && finishes?.ceilingTextures) {
                                const ct = finishes.ceilingTextures.find(f => f.name === ceilingTexture);
                                if (ct && typeof ct === 'object' && ct.crew === hangingCrewId) {
                                    hangingFinishesTotal += parseFloat(ct.pay) || 0;
                                }
                            }
                            if (corners && finishes?.corners) {
                                const c = finishes.corners.find(f => f.name === corners);
                                if (c && typeof c === 'object' && c.crew === hangingCrewId) {
                                    hangingFinishesTotal += parseFloat(c.pay) || 0;
                                }
                            }
                            
                            // Add extra hanging pay from materials used in this area
                            let materialExtraPay = 0;
                            if (area.materials && materials) {
                                area.materials.forEach(areaMat => {
                                    const material = materials.find(m => m.id === areaMat.materialId);
                                    if (material && material.extraLabor) {
                                        const hangingExtra = material.extraLabor.find(extra => extra.crewType === hangingCrewId);
                                        if (hangingExtra) {
                                            materialExtraPay += parseFloat(hangingExtra.extraPay) || 0;
                                        }
                                    }
                                });
                            }
                            
                            const adjustedRate = baseRate + hangingFinishesTotal + materialExtraPay;
                            debug.push(`  Overall hanging labor with area finishes calculation:`);
                            debug.push(`    Base overall hang rate: $${baseRate}`);
                            debug.push(`    Area finish upgrades: $${hangingFinishesTotal}`);
                            debug.push(`    Material extra pay: $${materialExtraPay}`);
                            debug.push(`    Adjusted rate: $${adjustedRate.toFixed(3)}`);
                            return adjustedRate;
                        } else {
                            // Using both overall labor and overall finishes
                            return parseFloat(bid.finishedHangingRate) || 0;
                        }
                    })()
                    : (parseFloat(area.hangRate) || parseFloat(bid.finishedHangingRate) || 0);
                
                const finishedTapeRate = area.useOverallLabor 
                    ? (() => {
                        // When using overall labor rates but area-specific finishes,
                        // we need to apply finish upgrades to the overall base rate
                        if (!area.useOverallFinishes) {
                            // Calculate finish upgrades for this area's finishes
                            const baseRate = parseFloat(bid.finishedTapeRate) || 0;
                            
                            let taperFinishesTotal = 0;
                            const wallTexture = area.wallTexture;
                            const ceilingTexture = area.ceilingTexture;
                            const corners = area.corners;
                            
                            // Calculate taper pay from finishes
                            const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                            
                            if (wallTexture && finishes?.wallTextures) {
                                const wt = finishes.wallTextures.find(f => f.name === wallTexture);
                                if (wt && typeof wt === 'object' && wt.crew === taperCrewId) {
                                    taperFinishesTotal += parseFloat(wt.pay) || 0;
                                }
                            }
                            if (ceilingTexture && finishes?.ceilingTextures) {
                                const ct = finishes.ceilingTextures.find(f => f.name === ceilingTexture);
                                if (ct && typeof ct === 'object' && ct.crew === taperCrewId) {
                                    taperFinishesTotal += parseFloat(ct.pay) || 0;
                                }
                            }
                            if (corners && finishes?.corners) {
                                const c = finishes.corners.find(f => f.name === corners);
                                if (c && typeof c === 'object' && c.crew === taperCrewId) {
                                    taperFinishesTotal += parseFloat(c.pay) || 0;
                                }
                            }
                            
                            // Add extra taper pay from materials used in this area
                            let materialExtraPay = 0;
                            if (area.materials && materials) {
                                area.materials.forEach(areaMat => {
                                    const material = materials.find(m => m.id === areaMat.materialId);
                                    if (material && material.extraLabor) {
                                        const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                                        if (taperExtra) {
                                            materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                                        }
                                    }
                                });
                            }
                            
                            const adjustedRate = baseRate + taperFinishesTotal + materialExtraPay;
                            debug.push(`  Overall labor with area finishes calculation:`);
                            debug.push(`    Base overall tape rate: $${baseRate}`);
                            debug.push(`    Area finish upgrades: $${taperFinishesTotal}`);
                            debug.push(`    Material extra pay: $${materialExtraPay}`);
                            debug.push(`    Adjusted rate: $${adjustedRate.toFixed(3)}`);
                            return adjustedRate;
                        } else {
                            // Using both overall labor and overall finishes
                            return parseFloat(bid.finishedTapeRate) || 0;
                        }
                    })()
                    : (area.autoTapeRate ? (() => {
                        const calculatedRate = calculateAreaTapeRate(area);
                        debug.push(`  Auto tape rate calculation:`);
                        debug.push(`    Base hang rate: $${parseFloat(area.hangRate) || parseFloat(bid.finishedHangingRate) || 0}`);
                        debug.push(`    Base addition: $0.04`);
                        debug.push(`    Calculated rate: $${calculatedRate.toFixed(3)}`);
                        return calculatedRate;
                    })() : (parseFloat(area.tapeRate) || parseFloat(bid.finishedTapeRate) || 0));
                
                const unfinishedTapeRate = area.useOverallLabor
                    ? (parseFloat(bid.unfinishedTapeRate || bid.unfinishedTapingRate) || 0)
                    : (parseFloat(area.unfinishedTapeRate) || parseFloat(bid.unfinishedTapeRate || bid.unfinishedTapingRate) || 0);

                debug.push(`Hang rate: $${hangRate}/sq ft`);
                debug.push(`Finished tape rate: $${finishedTapeRate}/sq ft`);
                debug.push(`Unfinished tape rate: $${unfinishedTapeRate}/sq ft`);

                // Determine finishes for this area
                const wallTexture = area.useOverallFinishes ? bid.wallTexture : (area.wallTexture || bid.wallTexture);
                const ceilingTexture = area.useOverallFinishes ? bid.ceilingTexture : (area.ceilingTexture || bid.ceilingTexture);
                const corners = area.useOverallFinishes ? bid.corners : (area.corners || bid.corners);

                debug.push(`Wall texture: ${wallTexture}`);
                debug.push(`Ceiling texture: ${ceilingTexture}`);
                debug.push(`Corners: ${corners}`);

                // Calculate area square footage and material costs
                let areaSqFt = 0;
                let areaStockedMaterial = 0;
                
                area.materials?.forEach(areaMat => {
                    const material = materials?.find(m => m.id === areaMat.materialId);
                    if (!material) return;

                    // Calculate total square footage from variants
                    let materialSqFt = 0;
                    if (areaMat.variants && areaMat.variants.length > 0) {
                        materialSqFt = areaMat.variants.reduce((total, variant) => {
                            const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                            const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                            if (widthInches === 0 || lengthInches === 0) return total;
                            const sqFtPerPiece = (widthInches * lengthInches) / 144;
                            const quantity = parseInt(variant.quantity, 10) || 0;
                            return total + (sqFtPerPiece * quantity);
                        }, 0);
                    }

                    if (materialSqFt > 0) {
                        const materialCost = materialSqFt * (parseFloat(material.price) || 0);
                        areaStockedMaterial += materialCost;
                        
                        debug.push(`  ${material.name}: ${materialSqFt.toFixed(2)} sq ft @ $${material.price} = $${materialCost.toFixed(2)}`);

                        // Track square footage for labor calculations (only for drywall board)
                        if (material.category === 'drywall-board' || material.category === '2nd-layer-board') {
                            areaSqFt += materialSqFt;
                        }
                    }
                });

                debug.push(`Area total sq ft: ${areaSqFt}`);
                debug.push(`Area material cost: $${areaStockedMaterial.toFixed(2)}`);

                // Calculate area labor
                let areaHangLabor = areaSqFt * hangRate;
                let areaTapeLabor = 0;

                // Apply appropriate tape rate based on area finish type
                if (area.isFinished) {
                    areaTapeLabor = areaSqFt * finishedTapeRate;
                } else {
                    areaTapeLabor = areaSqFt * unfinishedTapeRate;
                }

                debug.push(`Base hang labor: ${areaSqFt} @ $${hangRate} = $${areaHangLabor.toFixed(2)}`);
                debug.push(`Base tape labor: ${areaSqFt} @ $${area.isFinished ? finishedTapeRate : unfinishedTapeRate} = $${areaTapeLabor.toFixed(2)}`);

                // Add finish upgrades for this area (only if using finished and area has finishes)
                if (area.isFinished) {
                    debug.push(`\n--- AREA FINISH UPGRADES ---`);
                    
                    const areaFinishes = { wallTexture, ceilingTexture, corners };
                    
                    Object.entries(areaFinishes).forEach(([finishType, finishName]) => {
                        if (!finishName) return;
                        
                        const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                              finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
                        
                        if (finishes[finishCategory]) {
                            const finish = finishes[finishCategory].find(f => f.name === finishName);
                            if (finish && typeof finish === 'object') {
                                // Check if the crew for this finish is a hanging crew
                                if (finish.crew === hangingCrewId) {
                                    const finishPayRate = parseFloat(finish.pay) || 0;
                                    const finishUpgrade = areaSqFt * finishPayRate;
                                    areaHangLabor += finishUpgrade;
                                    
                                    debug.push(`${finishType}: ${finish.name} @ $${finishPayRate}/sq ft = $${finishUpgrade.toFixed(2)}`);
                                }
                            }
                        }
                    });
                }

                // Add extra pay from materials for this area
                area.materials?.forEach(areaMat => {
                    const material = materials?.find(m => m.id === areaMat.materialId);
                    if (!material?.extraLabor) return;

                    let materialSqFt = 0;
                    if (areaMat.variants && areaMat.variants.length > 0) {
                        materialSqFt = areaMat.variants.reduce((total, variant) => {
                            const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                            const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                            if (widthInches === 0 || lengthInches === 0) return total;
                            const sqFtPerPiece = (widthInches * lengthInches) / 144;
                            const quantity = parseInt(variant.quantity, 10) || 0;
                            return total + (sqFtPerPiece * quantity);
                        }, 0);
                    }

                    material.extraLabor.forEach(extra => {
                        if (materialSqFt > 0) {
                            const extraPay = materialSqFt * (parseFloat(extra.extraPay) || 0);
                            if (extra.crewType === hangingCrewId) {
                                areaHangLabor += extraPay;
                                debug.push(`  ${material.name} hang extra: ${materialSqFt.toFixed(2)} sq ft @ $${extra.extraPay} = $${extraPay.toFixed(2)}`);
                            } else if (extra.crewType === taperCrewId) {
                                areaTapeLabor += extraPay;
                                debug.push(`  ${material.name} tape extra: ${materialSqFt.toFixed(2)} sq ft @ $${extra.extraPay} = $${extraPay.toFixed(2)}`);
                            }
                        }
                    });
                });

                debug.push(`Final area hang labor: $${areaHangLabor.toFixed(2)}`);
                debug.push(`Final area tape labor: $${areaTapeLabor.toFixed(2)}`);

                // Add to totals
                totalStockedMaterial += areaStockedMaterial;
                totalHangLabor += areaHangLabor;
                totalTapeLabor += areaTapeLabor;
                totalHangingSqFt += areaSqFt;
            });

            // Calculate miscellaneous finishes labor cost
            debug.push('\n=== MISCELLANEOUS FINISHES ===');
            if (finishes?.miscellaneous && finishes.miscellaneous.length > 0) {
                finishes.miscellaneous.forEach(miscItem => {
                    const fieldName = `misc_${miscItem.name.toLowerCase().replace(/\s+/g, '_')}`;
                    const quantity = parseInt(bid[fieldName] || 0, 10);
                    
                    if (quantity > 0 && miscItem.pay) {
                        const miscCost = quantity * (parseFloat(miscItem.pay) || 0);
                        
                        // Determine which crew type this misc item belongs to
                        if (miscItem.crew === hangingCrewId) {
                            totalHangLabor += miscCost;
                            debug.push(`  ${miscItem.name} (Hanging): ${quantity} @ $${miscItem.pay} = $${miscCost.toFixed(2)}`);
                        } else if (miscItem.crew === taperCrewId) {
                            totalTapeLabor += miscCost;
                            debug.push(`  ${miscItem.name} (Taping): ${quantity} @ $${miscItem.pay} = $${miscCost.toFixed(2)}`);
                        } else {
                            // If no specific crew type, add to hanging by default
                            totalHangLabor += miscCost;
                            debug.push(`  ${miscItem.name} (Default to Hanging): ${quantity} @ $${miscItem.pay} = $${miscCost.toFixed(2)}`);
                        }
                    }
                });
            } else {
                debug.push('  No miscellaneous finishes configured');
            }

            // Add material dependencies (calculated bid-wide)
            let miscMaterials = 0;
            debug.push('\n=== MATERIAL DEPENDENCIES ===');
            debug.push(`Total dependencies loaded: ${materialDependencies.length}`);
            debug.push(`Using total hanging sq ft: ${totalHangingSqFt}`);
            
            materialDependencies.forEach(dep => {
                debug.push(`\nProcessing dependency: ${dep.materialName || 'Unknown'}`);
                
                // Find the dependent material by name
                const dependentMaterial = materials?.find(m => 
                    m.name === dep.materialName || 
                    m.name.toLowerCase().includes(dep.materialName.toLowerCase()) ||
                    dep.materialName.toLowerCase().includes(m.name.toLowerCase())
                );
                
                if (!dependentMaterial) {
                    debug.push(`  ERROR: Dependent material not found for name: ${dep.materialName}`);
                    return;
                }

                // Calculate quantity using the formula
                let depQuantity = 0;
                
                try {
                    // Set up variables for formula evaluation using bid-wide totals
                    const totalSqFt = totalHangingSqFt;
                    const finishedSqFtForFormula = totalHangingSqFt; // For now, assume all hanging is finished for dependencies
                    const secondLayerSqFt = 0;
                    const furringLinearFt = 0;
                    
                    // Replace variables in formula
                    let calculatedFormula = dep.formula
                        .replace(/totalSqFt/g, totalSqFt)
                        .replace(/finishedSqFt/g, finishedSqFtForFormula)
                        .replace(/secondLayerSqFt/g, secondLayerSqFt)
                        .replace(/furringLinearFt/g, furringLinearFt);
                    
                    // Safely evaluate the formula
                    const safeEvaluateFormula = (formula) => {
                        const sanitizedFormula = formula.replace(/[^0-9+\-*/().\s]/g, '');
                        if (sanitizedFormula !== formula) {
                            throw new Error('Formula contains invalid characters');
                        }
                        // eslint-disable-next-line no-new-func
                        return Function(`"use strict"; return (${sanitizedFormula})`)();
                    };
                    
                    depQuantity = safeEvaluateFormula(calculatedFormula);
                    
                    if (dep.roundUp && depQuantity > 0) {
                        const decimalPlaces = dep.roundToDecimalPlaces || 0;
                        if (decimalPlaces === 0) {
                            depQuantity = Math.ceil(depQuantity);
                        } else {
                            const multiplier = Math.pow(10, decimalPlaces);
                            depQuantity = Math.ceil(depQuantity * multiplier) / multiplier;
                        }
                    }
                    
                } catch (error) {
                    debug.push(`  ERROR evaluating formula: ${error.message}`);
                    return;
                }
                
                if (depQuantity > 0) {
                    const depCost = depQuantity * (parseFloat(dependentMaterial.price) || 0);
                    
                    // Route to Stocked or Misc Materials based on isStocked flag
                    if (dep.isStocked) {
                        totalStockedMaterial += depCost;
                        debug.push(`  ${dependentMaterial.name} (Stocked): ${depQuantity} @ $${dependentMaterial.price} = $${depCost.toFixed(2)} -> Stocked Material`);
                    } else {
                        miscMaterials += depCost;
                        debug.push(`  ${dependentMaterial.name} (Misc): ${depQuantity} @ $${dependentMaterial.price} = $${depCost.toFixed(2)} -> Misc Materials`);
                    }
                }
            });

            // Calculate final totals
            debug.push('\n=== FINAL CALCULATIONS ===');
            debug.push(`Total Stocked Material: $${totalStockedMaterial.toFixed(2)}`);
            debug.push(`Total Misc Materials: $${miscMaterials.toFixed(2)}`);
            debug.push(`Total Hang Labor: $${totalHangLabor.toFixed(2)}`);
            debug.push(`Total Tape Labor: $${totalTapeLabor.toFixed(2)}`);

            // Material totals and tax calculation (bid-wide)
            const totalMaterialBeforeTax = totalStockedMaterial + miscMaterials;
            const effectiveSalesTaxRate = bid.salesTaxRate || markups.salesTax;
            const totalMaterialWithTax = totalMaterialBeforeTax * (1 + effectiveSalesTaxRate);
            const salesTax = totalMaterialWithTax - totalMaterialBeforeTax;

            // Labor calculations
            const totalBaseLabor = totalHangLabor + totalTapeLabor;
            const laborBurden = totalBaseLabor * markups.laborBurden;
            const totalLaborWithBurden = totalBaseLabor + laborBurden;

            // Hard cost and final calculations
            const hardCost = totalMaterialWithTax + totalLaborWithBurden;
            const overhead = hardCost * markups.overhead;
            const breakEven = hardCost + overhead;
            const profit = breakEven * markups.profit;

            // No additional finish extra profit - already included in area calculations
            const finishExtraProfit = 0;
            const totalProfit = profit + finishExtraProfit;
            const netQuote = breakEven + totalProfit;

            debug.push(`Hard Cost: $${hardCost.toFixed(2)}`);
            debug.push(`Overhead (${(markups.overhead * 100).toFixed(1)}%): $${overhead.toFixed(2)}`);
            debug.push(`Break Even: $${breakEven.toFixed(2)}`);
            debug.push(`Base Profit (${(markups.profit * 100).toFixed(1)}%): $${profit.toFixed(2)}`);
            debug.push(`Finish Extra Profit: $${finishExtraProfit.toFixed(2)} (included in area labor)`);
            debug.push(`Total Profit: $${totalProfit.toFixed(2)}`);
            debug.push(`Net Quote: $${netQuote.toFixed(2)}`);

            return {
                stockedMaterial: totalStockedMaterial,
                miscMaterials: miscMaterials,
                totalMaterialBeforeTax: totalMaterialBeforeTax,
                totalMaterialWithTax: totalMaterialWithTax,
                salesTax: salesTax,
                effectiveSalesTaxRate: effectiveSalesTaxRate,
                hangLabor: totalHangLabor,
                tapeLabor: totalTapeLabor,
                totalBaseLabor: totalBaseLabor,
                laborBurden: laborBurden,
                totalLaborWithBurden: totalLaborWithBurden,
                hardCost: hardCost,
                overhead: overhead,
                breakEven: breakEven,
                profit: profit,
                finishExtraProfit: finishExtraProfit,
                totalProfit: totalProfit,
                netQuote: netQuote,
                debug: debugMode ? debug : []
            };

        } catch (error) {
            console.error('Error in calculatePricing:', error);
            return {
                stockedMaterial: 0,
                miscMaterials: 0,
                totalMaterialBeforeTax: 0,
                totalMaterialWithTax: 0,
                salesTax: 0,
                effectiveSalesTaxRate: markups.salesTax,
                hangLabor: 0,
                tapeLabor: 0,
                totalBaseLabor: 0,
                laborBurden: 0,
                totalLaborWithBurden: 0,
                hardCost: 0,
                overhead: 0,
                breakEven: 0,
                profit: 0,
                finishExtraProfit: 0,
                totalProfit: 0,
                netQuote: 0,
                debug: [`Error: ${error.message}`]
            };
        }
    };

    const pricing = calculatePricing();

    // Safety check for pricing calculation
    if (!pricing) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>
                <div className="text-red-600">Error loading pricing data</div>
            </div>
        );
    }

    if (isSupervisor) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Hang Labor:</span>
                        <span>${pricing.hangLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tape Labor:</span>
                        <span>${pricing.tapeLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Net Quote:</span>
                        <span>${pricing.netQuote.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Pricing Summary</h3>
                {hasAdvancedPricing && (
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                        {debugMode ? 'Hide Debug' : 'Show Debug'}
                    </button>
                )}
            </div>
            
            {hasAdvancedPricing && debugMode && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs font-mono max-h-60 overflow-y-auto">
                    <h4 className="font-bold mb-2">Debug Information:</h4>
                    {pricing.debug.map((line, index) => (
                        <div key={index} className="whitespace-pre-wrap">{line}</div>
                    ))}
                </div>
            )}
            
            {hasAdvancedPricing ? (
                // Advanced View - Full Breakdown
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Stocked Material:</span>
                        <span>${pricing.stockedMaterial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Misc Materials:</span>
                        <span>${pricing.miscMaterials.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sales Tax {isAdmin || !bid.coordinates ? `(${(pricing.effectiveSalesTaxRate * 100).toFixed(3)}%${bid.salesTaxRate ? ' - Location Based' : ''})` : ''}:</span>
                        <span>${pricing.salesTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-2">
                        <span>Total Material:</span>
                        <span>${pricing.totalMaterialWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Hang Labor:</span>
                        <span>${pricing.hangLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tape Labor:</span>
                        <span>${pricing.tapeLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Labor Burden ({(markups.laborBurden * 100).toFixed(1)}%):</span>
                        <span>${pricing.laborBurden.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                        <span>Total Labor:</span>
                        <span>${pricing.totalLaborWithBurden.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-2">
                        <span>Hard Cost:</span>
                        <span>${pricing.hardCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Overhead ({(markups.overhead * 100).toFixed(1)}%):</span>
                        <span>${pricing.overhead.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <span>Break Even:</span>
                        <span>${pricing.breakEven.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Base Profit ({(markups.profit * 100).toFixed(1)}%):</span>
                        <span>${pricing.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {pricing.finishExtraProfit > 0 && (
                        <div className="flex justify-between">
                            <span>Finish Extra Profit:</span>
                            <span>${pricing.finishExtraProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-medium">
                        <span>Total Profit:</span>
                        <span>${pricing.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-base">
                        <span>Net Quote:</span>
                        <span>${pricing.netQuote.toLocaleString()}</span>
                    </div>
                </div>
            ) : (
                // Basic View - Key Totals Only
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between font-medium">
                        <span>Total Hang Labor:</span>
                        <span>${pricing.hangLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                        <span>Total Tape Labor:</span>
                        <span>${pricing.tapeLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-lg text-green-600">
                        <span>Bid Total:</span>
                        <span>${pricing.netQuote.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
