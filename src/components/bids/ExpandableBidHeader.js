import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronDownIcon } from '../../Icons';
import { useLocationServices } from '../LocationServices';
import { useBidRates } from '../../hooks/useBidRates';
import { BidFormFields } from './BidFormFields';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function ExpandableBidHeader({ bid, handleInputChange, supervisors, finishes, db, userData, materials, crewTypes }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [headerConfig, setHeaderConfig] = useState({
        visibleFields: ['projectName', 'contractor', 'address', 'supervisor'],
        layout: 'grid-4',
        customFields: []
    });

    // Use custom hooks for location services and rate calculations
    const locationServices = useLocationServices(db, handleInputChange);
    const rateCalculations = useBidRates(db, bid, finishes, handleInputChange, materials, crewTypes);

    // Load header configuration from admin config
    useEffect(() => {
        if (!db) return;
        const configDocRef = doc(db, configPath, 'bidHeaderConfig');
        const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setHeaderConfig(prevConfig => ({ ...prevConfig, ...docSnap.data() }));
            }
        });
        return unsubscribe;
    }, [db]);

    // Auto-recalculate tape rate when finishes change
    useEffect(() => {
        if (bid.autoTapeRate) {
            const newRate = rateCalculations.calculateFinishedTapeRate();
            // Only update if the rate actually changed to prevent unnecessary re-renders
            if (newRate !== bid.finishedTapeRate) {
                handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
            }
        }
    }, [bid.wallTexture, bid.ceilingTexture, bid.corners, bid.autoTapeRate, bid.finishedHangingRate, bid.areas, bid.finishedTapeRate, rateCalculations, handleInputChange]);

    const getLayoutClass = useCallback(() => {
        switch (headerConfig.layout) {
            case 'grid-2': return 'grid-cols-1 md:grid-cols-2';
            case 'grid-3': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            case 'grid-4': return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
            default: return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
        }
    }, [headerConfig.layout]);

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
                    {/* Use BidFormFields as a proper React component */}
                    <BidFormFields 
                        bid={bid}
                        handleInputChange={handleInputChange}
                        supervisors={supervisors}
                        finishes={finishes}
                        locationSettings={locationServices.locationSettings}
                        locationServices={locationServices}
                        rateCalculations={rateCalculations}
                        headerConfig={headerConfig}
                        getLayoutClass={getLayoutClass}
                    />
                </div>
            )}
        </div>
    );
}
