import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const LocationConfig = ({ db }) => {
    const [locationSettings, setLocationSettings] = useState({
        reverseGeocodeAccuracy: 50, // meters
        enableAutoAddressFill: true,
        enableLocationServices: true
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!db) return;
        
        const locationConfigRef = doc(db, configPath, 'locationSettings');
        const unsubscribe = onSnapshot(locationConfigRef, (docSnap) => {
            if (docSnap.exists()) {
                setLocationSettings(prevSettings => ({ ...prevSettings, ...docSnap.data() }));
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, [db]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const locationConfigRef = doc(db, configPath, 'locationSettings');
            await setDoc(locationConfigRef, locationSettings, { merge: true });
        } catch (error) {
            console.error('Error saving location settings:', error);
            alert('Error saving location settings. Please try again.');
        }
        setIsSaving(false);
    };

    const handleInputChange = (field, value) => {
        setLocationSettings(prev => ({
            ...prev,
            [field]: value
        }));
        // Auto-save the changes
        saveLocationSettings(field, value);
    };

    const saveLocationSettings = async (field, value) => {
        try {
            const locationConfigRef = doc(db, configPath, 'locationSettings');
            await setDoc(locationConfigRef, { [field]: value }, { merge: true });
        } catch (error) {
            console.error('Error saving location settings:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Location Services Configuration</h2>
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Location Services Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <label htmlFor="reverseGeocodeAccuracy" className="block text-sm font-medium text-gray-700 mb-2">
                        Address Search Radius (meters)
                    </label>
                    <input
                        id="reverseGeocodeAccuracy"
                        name="reverseGeocodeAccuracy"
                        type="number"
                        min="10"
                        max="500"
                        step="10"
                        value={locationSettings.reverseGeocodeAccuracy}
                        onChange={(e) => handleInputChange('reverseGeocodeAccuracy', parseInt(e.target.value))}
                        autoComplete="off"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Search radius for finding the nearest full address (reserved for future features)
                    </p>
                </div>

                <div>
                    <label htmlFor="enableAutoAddressFill" className="flex items-center space-x-2">
                        <input
                            id="enableAutoAddressFill"
                            name="enableAutoAddressFill"
                            type="checkbox"
                            checked={locationSettings.enableAutoAddressFill}
                            onChange={(e) => handleInputChange('enableAutoAddressFill', e.target.checked)}
                            autoComplete="off"
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Enable Auto Address Fill
                        </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                        Automatically fill address field when GPS location is used
                    </p>
                </div>

                <div>
                    <label htmlFor="enableLocationServices" className="flex items-center space-x-2">
                        <input
                            id="enableLocationServices"
                            name="enableLocationServices"
                            type="checkbox"
                            checked={locationSettings.enableLocationServices}
                            onChange={(e) => handleInputChange('enableLocationServices', e.target.checked)}
                            autoComplete="off"
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Enable Location Services
                        </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                        Show GPS and Map buttons in bid forms
                    </p>
                </div>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Address Lookup Behavior:</h3>
                <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>GPS Address Fill:</strong> Always finds the nearest complete street address</div>
                    <div><strong>Priority Order:</strong> Street number + name → Street name → Building/place name</div>
                    <div><strong>Format:</strong> "1234 Main St, Springfield, IL" (no country included)</div>
                    <div><strong>Fallback:</strong> If no street address found, uses city/administrative area</div>
                </div>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg shadow-md"
                >
                    {isSaving ? 'Saving...' : 'Save Location Settings'}
                </button>
            </div>
        </div>
    );
};

export default LocationConfig;
