import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { ChevronDownIcon } from '../../Icons';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function ExpandableBidHeader({ bid, handleInputChange, supervisors, finishes, db, userData, materials, crewTypes }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [headerConfig, setHeaderConfig] = useState({
        visibleFields: ['projectName', 'contractor', 'address', 'supervisor'],
        layout: 'grid-4',
        customFields: []
    });
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

    // Load header config
    useEffect(() => {
        if (!db) return;
        const configDocRef = doc(db, configPath, 'bidHeaderConfig');
        const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setHeaderConfig(docSnap.data());
            }
        });
        return unsubscribe;
    }, [db]);

    // Add this useEffect to recalculate when finishes change:
    useEffect(() => {
        if (bid.autoTapeRate) {
            const newRate = calculateFinishedTapeRate();
            handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
        }
    }, [bid.wallTexture, bid.ceilingTexture, bid.corners, bid.autoTapeRate, bid.finishedHangingRate, bid.areas]);

    // Update the calculateFinishedTapeRate function:
    const calculateFinishedTapeRate = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        const baseAddition = 0.04;
        
        let taperFinishesTotal = 0;
        
        // Calculate finish extra pay for taper
        if (bid.wallTexture && finishes.wallTextures) {
            const wallTexture = finishes.wallTextures.find(f => f.name === bid.wallTexture);
            if (wallTexture && wallTexture.involvesTaper) {
                taperFinishesTotal += parseFloat(wallTexture.payRate) || 0;
            }
        }
        
        if (bid.ceilingTexture && finishes.ceilingTextures) {
            const ceilingTexture = finishes.ceilingTextures.find(f => f.name === bid.ceilingTexture);
            if (ceilingTexture && ceilingTexture.involvesTaper) {
                taperFinishesTotal += parseFloat(ceilingTexture.payRate) || 0;
            }
        }
        
        if (bid.corners && finishes.corners) {
            const corners = finishes.corners.find(f => f.name === bid.corners);
            if (corners && corners.involvesTaper) {
                taperFinishesTotal += parseFloat(corners.payRate) || 0;
            }
        }
        
        // Add material extra pay for taper crew
        let materialExtraPay = 0;
        if (bid.areas) {
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

    // Show breakdown in the input placeholder
    const getFinishedTapeRateBreakdown = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        const baseAddition = 0.04;
        let finishesTotal = 0;
        let materialTotal = 0;

        // Calculate finishes total
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && finish.involvesTaper) {
                    finishesTotal += parseFloat(finish.payRate) || 0;
                }
            }
        });

        // Calculate material extra pay
        if (bid.areas) {
            bid.areas.forEach(area => {
                if (area.materials) {
                    area.materials.forEach(areaMat => {
                        const material = materials?.find(m => m.id === areaMat.materialId);
                        if (material && material.extraLabor) {
                            const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                            const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                            if (taperExtra) {
                                materialTotal += parseFloat(taperExtra.extraPay) || 0;
                            }
                        }
                    });
                }
            });
        }

        return `${hangRate} + 0.04 + ${finishesTotal.toFixed(3)} (finishes) + ${materialTotal.toFixed(3)} (materials)`;
    };

    const renderField = (fieldName) => {
        switch (fieldName) {
            case 'projectName':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Project Name</label>
                        <input
                            type="text"
                            name="projectName"
                            value={bid.projectName || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
            case 'contractor':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Contractor</label>
                        <input
                            type="text"
                            name="contractor"
                            value={bid.contractor || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
            case 'address':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <input
                            type="text"
                            name="address"
                            value={bid.address || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
            case 'supervisor':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Supervisor</label>
                        <select
                            name="supervisor"
                            value={bid.supervisor || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Select a Supervisor --</option>
                            {supervisors.map(sup => (
                                <option key={sup.id} value={sup.id}>
                                    {sup.firstName} {sup.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                );
            default:
                return null;
        }
    };

    const getLayoutClass = () => {
        switch (headerConfig.layout) {
            case 'grid-2': return 'grid-cols-1 md:grid-cols-2';
            case 'grid-3': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            case 'grid-4': return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
            default: return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg mb-6">
            <div 
                className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-lg font-semibold">Bid Information</h2>
                <ChevronDownIcon className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
            
            {isExpanded && (
                <div className="p-6">
                    <div className={`grid ${getLayoutClass()} gap-6`}>
                        {headerConfig.visibleFields.map(field => renderField(field))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4 mt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Hang Rate</label>
                            <input
                                type="number"
                                step="0.001"
                                name="finishedHangingRate"
                                value={bid.finishedHangingRate ?? ''}
                                placeholder={defaultRates.hangRate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">Finished Tape Rate</label>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={bid.autoTapeRate ?? true}
                                        onChange={(e) => {
                                            const isAuto = e.target.checked;
                                            handleInputChange({
                                                target: { name: 'autoTapeRate', type: 'checkbox', checked: isAuto }
                                            });
                                            if (isAuto) {
                                                const newRate = calculateFinishedTapeRate();
                                                handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
                                            }
                                        }}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label className="ml-2 text-sm font-medium text-gray-700">Auto</label>
                                </div>
                            </div>
                            <input
                                type="number"
                                step="0.001"
                                name="finishedTapeRate"
                                value={bid.autoTapeRate ? calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                                onChange={bid.autoTapeRate ? undefined : handleInputChange}
                                disabled={bid.autoTapeRate}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                title={bid.autoTapeRate ? getFinishedTapeRateBreakdown() : ''}
                            />
                            {bid.autoTapeRate && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {getFinishedTapeRateBreakdown()}
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                            <input
                                type="number"
                                step="0.001"
                                name="unfinishedTapingRate"
                                value={bid.unfinishedTapingRate ?? ''}
                                placeholder={defaultRates.unfinishedTapeRate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 mt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Wall Texture</label>
                            <select
                                name="wallTexture"
                                value={bid.wallTexture || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.wallTextures || []).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ceiling Texture</label>
                            <select
                                name="ceilingTexture"
                                value={bid.ceilingTexture || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.ceilingTextures || []).filter(f => f.name).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Corners</label>
                            <select
                                name="corners"
                                value={bid.corners || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.corners || []).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {bid.status === 'bid' && (
                        <div className="pt-4 mt-4 border-t">
                            <label className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                            <p className="text-xs text-gray-500 mb-1">Setting this date will convert the bid into a project and assign a new job number.</p>
                            <input
                                type="date"
                                name="materialStockDate"
                                value={bid.materialStockDate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}