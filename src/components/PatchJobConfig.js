import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PatchJobConfig = ({ db }) => {
    const [patchJobConfig, setPatchJobConfig] = useState({
        hourlyRate: 50.00,
        minimumTotalCharge: 150.00,
        signatureThreshold: 500.00
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config/patchJobSettings`;

    useEffect(() => {
        const loadConfig = async () => {
            if (!db) return;
            
            try {
                const configRef = doc(db, configPath);
                const configSnap = await getDoc(configRef);
                
                if (configSnap.exists()) {
                    setPatchJobConfig(prev => ({ ...prev, ...configSnap.data() }));
                }
            } catch (error) {
                console.error('Error loading patch job config:', error);
            }
        };

        loadConfig();
    }, [db, configPath]);

    const handleSave = async () => {
        setIsSaving(true);
        
        try {
            const configRef = doc(db, configPath);
            await setDoc(configRef, {
                ...patchJobConfig,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            setIsEditing(false);
            alert('Patch job configuration saved successfully!');
        } catch (error) {
            console.error('Error saving patch job config:', error);
            alert('Error saving configuration. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        // Reset to original values by reloading
        window.location.reload();
    };

    const handleInputChange = (field, value) => {
        setPatchJobConfig(prev => ({
            ...prev,
            [field]: parseFloat(value) || 0
        }));
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Patch Job Configuration</h2>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Edit
                    </button>
                ) : (
                    <div className="flex space-x-2">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Patch Hours Rate ($/hour)
                    </label>
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            value={patchJobConfig.hourlyRate}
                            onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="50.00"
                        />
                    ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-800">
                            ${patchJobConfig.hourlyRate.toFixed(2)}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        Dollar value per hour for hour-based patches
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Total Charge ($)
                    </label>
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            value={patchJobConfig.minimumTotalCharge}
                            onChange={(e) => handleInputChange('minimumTotalCharge', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="150.00"
                        />
                    ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-800">
                            ${patchJobConfig.minimumTotalCharge.toFixed(2)}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        Minimum charge amount regardless of patch count
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Signature Required Threshold ($)
                    </label>
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            value={patchJobConfig.signatureThreshold}
                            onChange={(e) => handleInputChange('signatureThreshold', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="500.00"
                        />
                    ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-800">
                            ${patchJobConfig.signatureThreshold.toFixed(2)}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        Total amount requiring contractor signature
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PatchJobConfig;