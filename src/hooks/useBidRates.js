import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

// Custom hook for bid rate calculations
export const useBidRates = (db, bid, finishes, handleInputChange, materials, crewTypes) => {
    const [defaultRates, setDefaultRates] = useState({});

    // Load default rates from admin config
    useEffect(() => {
        if (!db) return;
        
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            const crews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Extract rates from crew types
            const rates = {};
            crews.forEach(crew => {
                if (crew.name.toLowerCase().includes('hang') && crew.rates?.hang) {
                    rates.hangRate = crew.rates.hang;
                }
                if (crew.name.toLowerCase().includes('tap')) {
                    if (crew.rates?.finishedTape) rates.finishedTapeRate = crew.rates.finishedTape;
                    if (crew.rates?.unfinishedTape) rates.unfinishedTapeRate = crew.rates.unfinishedTape;
                }
            });
            
            setDefaultRates(rates);
            
            // Auto-populate rates if they're empty
            if (!bid.finishedHangingRate && rates.hangRate) {
                handleInputChange({ target: { name: 'finishedHangingRate', value: rates.hangRate } });
            }
            if (!bid.unfinishedTapingRate && rates.unfinishedTapeRate) {
                handleInputChange({ target: { name: 'unfinishedTapingRate', value: rates.unfinishedTapeRate } });
            }
        });
        
        return unsubscribe;
    }, [db, bid.finishedHangingRate, bid.unfinishedTapingRate, handleInputChange]);

    const calculateFinishedTapeRate = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        const baseAddition = 0.04;
        
        let taperFinishesTotal = 0;
        
        // Calculate finish extra pay for taper
        if (bid.wallTexture && finishes.wallTextures) {
            const wallTexture = finishes.wallTextures.find(f => f.name === bid.wallTexture);
            if (wallTexture && typeof wallTexture === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (wallTexture.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(wallTexture.pay) || 0;
                }
            }
        }
        
        if (bid.ceilingTexture && finishes.ceilingTextures) {
            const ceilingTexture = finishes.ceilingTextures.find(f => f.name === bid.ceilingTexture);
            if (ceilingTexture && typeof ceilingTexture === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (ceilingTexture.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(ceilingTexture.pay) || 0;
                }
            }
        }
        
        if (bid.corners && finishes.corners) {
            const corners = finishes.corners.find(f => f.name === bid.corners);
            if (corners && typeof corners === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (corners.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(corners.pay) || 0;
                }
            }
        }
        
        // Add material extra pay for taper crew
        let materialExtraPay = 0;
        if (bid.areas && materials && crewTypes) {
            bid.areas.forEach(area => {
                if (area.materials) {
                    area.materials.forEach(areaMat => {
                        const material = materials?.find(m => m.id === areaMat.materialId);
                        if (material && material.extraLabor) {
                            const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                            const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                            if (taperExtra) {
                                materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                            }
                        }
                    });
                }
            });
        }
        
        const totalRate = hangRate + baseAddition + taperFinishesTotal + materialExtraPay;
        return totalRate.toFixed(3);
    };

    const getFinishedTapeRateBreakdown = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        let finishesTotal = 0;

        // Calculate finishes total for taper crew
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && typeof finish === 'object') {
                    // Check if the crew for this finish is a taper crew
                    const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                    if (finish.crew === taperCrewId) {
                        finishesTotal += parseFloat(finish.pay) || 0;
                    }
                }
            }
        });

        return `${hangRate} + 0.04 + ${finishesTotal.toFixed(3)} (finishes)`;
    };

    const getHangRateUpgrades = () => {
        let finishUpgrades = 0;
        const finishNames = [];

        // Calculate finishes that apply to hanging crew
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
                        const payRate = parseFloat(finish.pay) || 0;
                        finishUpgrades += payRate;
                        finishNames.push(`${finishName}: +$${payRate.toFixed(3)}`);
                    }
                }
            }
        });

        if (finishUpgrades > 0) {
            return `Finish upgrades: ${finishNames.join(', ')}`;
        }
        return '';
    };

    return {
        defaultRates,
        calculateFinishedTapeRate,
        getFinishedTapeRateBreakdown,
        getHangRateUpgrades
    };
};

export default useBidRates;
