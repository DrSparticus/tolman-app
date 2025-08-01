import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function BidPricingSummary({ bid, laborBreakdown, totalMaterialCost, userData, db, materials, finishes }) {
    const [markups, setMarkups] = useState({ laborBurden: 0.15, salesTax: 0.0725, overhead: 0.08, profit: 0.10 });
    const [crewTypes, setCrewTypes] = useState([]);
    const [materialDependencies, setMaterialDependencies] = useState([]);
    const [debugMode, setDebugMode] = useState(false);
    const isSupervisor = userData?.role === 'supervisor';
    
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
        console.log('BidPricingSummary: Missing props', { bid: !!bid, materials: !!materials, finishes: !!finishes });
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>
                <div className="text-gray-500">Loading pricing data...</div>
            </div>
        );
    }

    // Calculate pricing according to Excel spreadsheet logic
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

        // H135: Stocked Material - All user-counted materials + Taper dependencies
        let stockedMaterial = 0;
        let miscMaterials = 0; // H136: Misc Materials - Hanger dependencies
        let finishedSqFt = 0;
        let unfinishedSqFt = 0;
        let hangingSqFt = 0;

        debug.push('\n=== MATERIAL CALCULATIONS ===');

        bid.areas?.forEach(area => {
            debug.push(`\nArea: ${area.name} (${area.isFinished ? 'Finished' : 'Unfinished'})`);
            
            area.materials?.forEach(areaMat => {
                const material = materials?.find(m => m.id === areaMat.materialId);
                if (!material) return;

                // Calculate total square footage from variants
                let totalSqFt = 0;
                if (areaMat.variants && areaMat.variants.length > 0) {
                    totalSqFt = areaMat.variants.reduce((total, variant) => {
                        const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                        const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                        if (widthInches === 0 || lengthInches === 0) return total;
                        const sqFtPerPiece = (widthInches * lengthInches) / 144;
                        const quantity = parseInt(variant.quantity, 10) || 0;
                        return total + (sqFtPerPiece * quantity);
                    }, 0);
                } else {
                    // Fallback to direct quantity if no variants (shouldn't happen in normal operation)
                    totalSqFt = parseFloat(areaMat.quantity) || 0;
                }

                if (totalSqFt > 0) {
                    const materialCost = totalSqFt * (parseFloat(material.price) || 0);
                    stockedMaterial += materialCost;
                    
                    debug.push(`  ${material.name}: ${totalSqFt.toFixed(2)} sq ft @ $${material.price} = $${materialCost.toFixed(2)}`);

                    // Track square footage for labor calculations
                    if (material.category === 'drywall-board' || material.category === '2nd-layer-board') {
                        hangingSqFt += totalSqFt;
                        
                        if (areaMat.laborType === 'finished' || area.isFinished) {
                            finishedSqFt += totalSqFt;
                        } else {
                            unfinishedSqFt += totalSqFt;
                        }
                    }
                }
            });
        });

        debug.push(`\nUser Materials Total: $${stockedMaterial.toFixed(2)}`);
        debug.push(`Finished Sq Ft: ${finishedSqFt}`);
        debug.push(`Unfinished Sq Ft: ${unfinishedSqFt}`);
        debug.push(`Total Hanging Sq Ft: ${hangingSqFt}`);

        // Add material dependencies
        debug.push('\n=== MATERIAL DEPENDENCIES ===');
        debug.push(`Total dependencies loaded: ${materialDependencies.length}`);
        
        materialDependencies.forEach(dep => {
            debug.push(`\nProcessing dependency: ${dep.materialName || 'Unknown'}`);
            debug.push(`  Formula: ${dep.formula}`);
            debug.push(`  Is Stocked: ${dep.isStocked}`);
            debug.push(`  Applies To: ${JSON.stringify(dep.appliesTo)}`);
            debug.push(`  Finished Only: ${dep.finishedOnly}`);
            
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
            debug.push(`  Found material: ${dependentMaterial.name} @ $${dependentMaterial.price}`);

            // Calculate quantity using the formula
            let depQuantity = 0;
            
            try {
                // Set up variables for formula evaluation
                const totalSqFt = hangingSqFt;
                const finishedSqFtForFormula = finishedSqFt;
                const secondLayerSqFt = 0; // Could be calculated if needed
                const furringLinearFt = 0; // Could be calculated if needed
                
                debug.push(`  Formula variables: totalSqFt=${totalSqFt}, finishedSqFt=${finishedSqFtForFormula}`);
                
                // Replace variables in formula
                let calculatedFormula = dep.formula
                    .replace(/totalSqFt/g, totalSqFt)
                    .replace(/finishedSqFt/g, finishedSqFtForFormula)
                    .replace(/secondLayerSqFt/g, secondLayerSqFt)
                    .replace(/furringLinearFt/g, furringLinearFt);
                
                debug.push(`  Evaluated formula: ${calculatedFormula}`);
                
                // Safely evaluate the formula
                depQuantity = Function(`"use strict"; return (${calculatedFormula})`)();
                
                if (dep.roundUp && depQuantity > 0) {
                    const decimalPlaces = dep.roundToDecimalPlaces || 0;
                    if (decimalPlaces === 0) {
                        depQuantity = Math.ceil(depQuantity);
                    } else {
                        const multiplier = Math.pow(10, decimalPlaces);
                        depQuantity = Math.ceil(depQuantity * multiplier) / multiplier;
                    }
                }
                
                debug.push(`  Raw calculated quantity: ${Function(`"use strict"; return (${calculatedFormula})`)()}`);
                debug.push(`  Round up: ${dep.roundUp}, Decimal places: ${dep.roundToDecimalPlaces || 0}, Final quantity: ${depQuantity}`);
                
            } catch (error) {
                debug.push(`  ERROR evaluating formula: ${error.message}`);
                return;
            }

            if (depQuantity > 0) {
                const depCost = depQuantity * (parseFloat(dependentMaterial.price) || 0);
                
                debug.push(`  Cost calculation: ${depQuantity} * $${dependentMaterial.price} = $${depCost.toFixed(2)}`);
                
                // Apply finished-only filter
                if (dep.finishedOnly && finishedSqFt === 0) {
                    debug.push(`  Skipping: Finished-only dependency but no finished square footage`);
                    return;
                }
                
                // Route to Stocked or Misc Materials based on isStocked flag
                if (dep.isStocked) {
                    stockedMaterial += depCost;
                    debug.push(`  ${dependentMaterial.name} (Stocked): ${depQuantity} @ $${dependentMaterial.price} = $${depCost.toFixed(2)} -> Stocked Material`);
                } else {
                    miscMaterials += depCost;
                    debug.push(`  ${dependentMaterial.name} (Misc): ${depQuantity} @ $${dependentMaterial.price} = $${depCost.toFixed(2)} -> Misc Materials`);
                }
            } else {
                debug.push(`  No quantity calculated - skipping`);
            }
        });

        // H135 + H136: Total Material before tax
        const totalMaterialBeforeTax = stockedMaterial + miscMaterials;
        
        // Use location-specific sales tax rate if available, otherwise use markup config
        const effectiveSalesTaxRate = bid.salesTaxRate || markups.salesTax;
        
        // Apply sales tax to materials
        const totalMaterialWithTax = totalMaterialBeforeTax * (1 + effectiveSalesTaxRate);

        debug.push(`\nStocked Material (H135): $${stockedMaterial.toFixed(2)}`);
        debug.push(`Misc Materials (H136): $${miscMaterials.toFixed(2)}`);
        debug.push(`Total Material Before Tax: $${totalMaterialBeforeTax.toFixed(2)}`);
        debug.push(`Sales Tax Rate: ${(effectiveSalesTaxRate * 100).toFixed(3)}% ${bid.salesTaxRate ? '(location-based)' : '(default)'}`);
        debug.push(`Sales Tax Amount: $${(totalMaterialWithTax - totalMaterialBeforeTax).toFixed(2)}`);
        debug.push(`Total Material With Tax: $${totalMaterialWithTax.toFixed(2)}`);

        // H138: Hang Labor
        debug.push('\n=== LABOR CALCULATIONS ===');
        
        const hangRate = parseFloat(bid.finishedHangingRate) || 0;
        let hangLabor = hangingSqFt * hangRate;
        
        debug.push(`Hang Rate: $${hangRate}/sq ft`);
        debug.push(`Hanging Sq Ft: ${hangingSqFt}`);
        debug.push(`Base Hang Labor: $${hangLabor.toFixed(2)}`);

        // Add finish upgrades to hang labor (hidden from UI, applied to backend calculation)
        debug.push('\n=== HANG FINISH UPGRADES ===');
        let hangFinishUpgrades = 0;
        
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && typeof finish === 'object') {
                    // Check if the crew for this finish is a hanging crew
                    const hangingCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id;
                    if (finish.crew === hangingCrewId) {
                        const finishPayRate = parseFloat(finish.pay) || 0;
                        
                        // All hang finish upgrades apply only to finished areas
                        const applicableSqFt = finishedSqFt;
                        
                        const finishUpgrade = applicableSqFt * finishPayRate;
                        hangFinishUpgrades += finishUpgrade;
                        hangLabor += finishUpgrade;
                        
                        debug.push(`${finishType}: ${finish.name}`);
                        debug.push(`  Pay rate: $${finishPayRate}/sq ft`);
                        debug.push(`  Applied to: ${applicableSqFt} sq ft (finished only)`);
                        debug.push(`  Upgrade amount: $${finishUpgrade.toFixed(2)}`);
                    }
                }
            }
        });
        
        debug.push(`Total Hang Finish Upgrades: $${hangFinishUpgrades.toFixed(2)}`);
        debug.push(`Hang Labor with Finish Upgrades: $${hangLabor.toFixed(2)}`);

        // Add extra pay from materials
        bid.areas?.forEach(area => {
            area.materials?.forEach(areaMat => {
                const material = materials?.find(m => m.id === areaMat.materialId);
                if (!material?.extraLabor) return;

                // Calculate total square footage from variants
                let totalSqFt = 0;
                if (areaMat.variants && areaMat.variants.length > 0) {
                    totalSqFt = areaMat.variants.reduce((total, variant) => {
                        const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                        const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                        if (widthInches === 0 || lengthInches === 0) return total;
                        const sqFtPerPiece = (widthInches * lengthInches) / 144;
                        const quantity = parseInt(variant.quantity, 10) || 0;
                        return total + (sqFtPerPiece * quantity);
                    }, 0);
                }

                material.extraLabor.forEach(extra => {
                    if (extra.crewType === hangingCrewId && totalSqFt > 0) {
                        const extraPay = totalSqFt * (parseFloat(extra.extraPay) || 0);
                        hangLabor += extraPay;
                        debug.push(`  ${material.name} extra pay: ${totalSqFt.toFixed(2)} sq ft @ $${extra.extraPay} = $${extraPay.toFixed(2)}`);
                    }
                });
            });
        });

        // H139: Tape Labor (Finished + Unfinished rates)
        debug.push('\n=== TAPE RATE DEBUG ===');
        debug.push(`Bid object keys containing 'tape': ${Object.keys(bid).filter(key => key.toLowerCase().includes('tape')).join(', ')}`);
        debug.push(`bid.finishedTapeRate: ${bid.finishedTapeRate}`);
        debug.push(`bid.unfinishedTapeRate: ${bid.unfinishedTapeRate}`);
        debug.push(`bid.unfinishedTapingRate: ${bid.unfinishedTapingRate}`);
        
        const finishedTapeRate = parseFloat(bid.finishedTapeRate) || 0;
        const unfinishedTapeRate = parseFloat(bid.unfinishedTapeRate || bid.unfinishedTapingRate) || 0;
        
        let tapeLabor = (finishedSqFt * finishedTapeRate) + (unfinishedSqFt * unfinishedTapeRate);
        
        debug.push(`\nFinished Tape Rate: $${finishedTapeRate}/sq ft`);
        debug.push(`Unfinished Tape Rate: $${unfinishedTapeRate}/sq ft`);
        debug.push(`Finished Tape Labor: ${finishedSqFt} @ $${finishedTapeRate} = $${(finishedSqFt * finishedTapeRate).toFixed(2)}`);
        debug.push(`Unfinished Tape Labor: ${unfinishedSqFt} @ $${unfinishedTapeRate} = $${(unfinishedSqFt * unfinishedTapeRate).toFixed(2)}`);
        debug.push(`Base Tape Labor: $${tapeLabor.toFixed(2)}`);

        // Add taper extra pay
        bid.areas?.forEach(area => {
            area.materials?.forEach(areaMat => {
                const material = materials?.find(m => m.id === areaMat.materialId);
                if (!material?.extraLabor) return;

                // Calculate total square footage from variants
                let totalSqFt = 0;
                if (areaMat.variants && areaMat.variants.length > 0) {
                    totalSqFt = areaMat.variants.reduce((total, variant) => {
                        const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                        const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                        if (widthInches === 0 || lengthInches === 0) return total;
                        const sqFtPerPiece = (widthInches * lengthInches) / 144;
                        const quantity = parseInt(variant.quantity, 10) || 0;
                        return total + (sqFtPerPiece * quantity);
                    }, 0);
                }

                material.extraLabor.forEach(extra => {
                    if (extra.crewType === taperCrewId && totalSqFt > 0) {
                        const extraPay = totalSqFt * (parseFloat(extra.extraPay) || 0);
                        tapeLabor += extraPay;
                        debug.push(`  ${material.name} taper extra pay: ${totalSqFt.toFixed(2)} sq ft @ $${extra.extraPay} = $${extraPay.toFixed(2)}`);
                    }
                });
            });
        });

        const totalBaseLabor = hangLabor + tapeLabor;
        const laborBurden = totalBaseLabor * markups.laborBurden;
        const totalLaborWithBurden = totalBaseLabor + laborBurden;

        debug.push(`\nTotal Hang Labor: $${hangLabor.toFixed(2)}`);
        debug.push(`Total Tape Labor: $${tapeLabor.toFixed(2)}`);
        debug.push(`Total Base Labor: $${totalBaseLabor.toFixed(2)}`);
        debug.push(`Labor Burden (${(markups.laborBurden * 100).toFixed(2)}%): $${laborBurden.toFixed(2)}`);
        debug.push(`Total Labor With Burden: $${totalLaborWithBurden.toFixed(2)}`);

        // Hard Cost = Materials + Labor
        const hardCost = totalMaterialWithTax + totalLaborWithBurden;
        
        // Overhead applied to Hard Cost
        const overhead = hardCost * markups.overhead;
        
        // Break Even = Hard Cost + Overhead
        const breakEven = hardCost + overhead;
        
        // Profit applied to Break Even
        const profit = breakEven * markups.profit;
        
        // Calculate extra profit from finishes (similar to G151:K159 in spreadsheet)
        let finishExtraProfit = 0;
        
        debug.push('\n=== FINISH EXTRA PROFIT ===');
        
        // Calculate for each finish type
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && typeof finish === 'object') {
                    const chargeRate = parseFloat(finish.charge) || 0;
                    const payRate = parseFloat(finish.pay) || 0;
                    
                    // Apply markups to the pay rate before calculating extra profit
                    const payWithBurden = payRate * (1 + markups.laborBurden);
                    const payWithOverhead = payWithBurden * (1 + markups.overhead);
                    const payWithAllMarkups = payWithOverhead * (1 + markups.profit);
                    
                    const extraProfitPerSqFt = chargeRate - payWithAllMarkups; // What we charge minus what we pay (with markups)
                    
                    if (extraProfitPerSqFt > 0) {
                        // Apply to appropriate square footage based on finish type
                        let applicableSqFt = 0;
                        
                        if (finishType === 'wallTexture' || finishType === 'ceilingTexture') {
                            // Wall and ceiling textures typically apply to finished areas
                            applicableSqFt = finishedSqFt;
                        } else if (finishType === 'corners') {
                            // Corners might apply to all hanging square footage
                            applicableSqFt = hangingSqFt;
                        }
                        
                        const finishProfit = applicableSqFt * extraProfitPerSqFt;
                        finishExtraProfit += finishProfit;
                        
                        debug.push(`${finishType}: ${finish.name}`);
                        debug.push(`  Charge: $${chargeRate}/sq ft, Base Pay: $${payRate}/sq ft`);
                        debug.push(`  Pay with burden (${(markups.laborBurden * 100).toFixed(1)}%): $${payWithBurden.toFixed(3)}/sq ft`);
                        debug.push(`  Pay with overhead (${(markups.overhead * 100).toFixed(1)}%): $${payWithOverhead.toFixed(3)}/sq ft`);
                        debug.push(`  Pay with all markups (${(markups.profit * 100).toFixed(1)}%): $${payWithAllMarkups.toFixed(3)}/sq ft`);
                        debug.push(`  Extra profit: $${extraProfitPerSqFt.toFixed(6)}/sq ft`);
                        debug.push(`  Applied to: ${applicableSqFt} sq ft`);
                        debug.push(`  Total extra profit: $${finishProfit.toFixed(2)}`);
                    }
                }
            }
        });
        
        debug.push(`Total Finish Extra Profit: $${finishExtraProfit.toFixed(2)}`);
        
        // Round up to nearest $5
        const netQuote = Math.ceil((breakEven + profit + finishExtraProfit) / 5) * 5;

        debug.push('\n=== FINAL CALCULATIONS ===');
        debug.push(`Hard Cost (Materials + Labor): $${hardCost.toFixed(2)}`);
        debug.push(`Overhead (${(markups.overhead * 100).toFixed(2)}%): $${overhead.toFixed(2)}`);
        debug.push(`Break Even: $${breakEven.toFixed(2)}`);
        debug.push(`Base Profit (${(markups.profit * 100).toFixed(2)}%): $${profit.toFixed(2)}`);
        debug.push(`Finish Extra Profit: $${finishExtraProfit.toFixed(2)}`);
        debug.push(`Total Profit: $${(profit + finishExtraProfit).toFixed(2)}`);
        debug.push(`Net Quote (rounded to $5): $${netQuote.toFixed(2)}`);

        return {
            stockedMaterial,
            miscMaterials,
            totalMaterialBeforeTax,
            totalMaterialWithTax,
            salesTax: totalMaterialWithTax - totalMaterialBeforeTax,
            effectiveSalesTaxRate,
            hangLabor,
            tapeLabor,
            totalBaseLabor,
            laborBurden,
            totalLaborWithBurden,
            hardCost,
            overhead,
            breakEven,
            profit,
            finishExtraProfit,
            totalProfit: profit + finishExtraProfit,
            netQuote,
            debug
        };
        } catch (error) {
            console.error('Error in pricing calculation:', error);
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
                debug: [`Error in calculation: ${error.message}`]
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
                <h3 className="text-lg font-semibold">Pricing Breakdown</h3>
                <button 
                    onClick={() => setDebugMode(!debugMode)}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                    {debugMode ? 'Hide Debug' : 'Show Debug'}
                </button>
            </div>
            
            {debugMode && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs font-mono max-h-60 overflow-y-auto">
                    <h4 className="font-bold mb-2">Debug Information:</h4>
                    {pricing.debug.map((line, index) => (
                        <div key={index} className="whitespace-pre-wrap">{line}</div>
                    ))}
                </div>
            )}
            
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Stocked Material (H135):</span>
                    <span>${pricing.stockedMaterial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>Misc Materials (H136):</span>
                    <span>${pricing.miscMaterials.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>Sales Tax ({(pricing.effectiveSalesTaxRate * 100).toFixed(3)}%{bid.salesTaxRate ? ' - Location Based' : ''}):</span>
                    <span>${pricing.salesTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total Material:</span>
                    <span>${pricing.totalMaterialWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>Hang Labor (H138):</span>
                    <span>${pricing.hangLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tape Labor (H139):</span>
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
        </div>
    );
}