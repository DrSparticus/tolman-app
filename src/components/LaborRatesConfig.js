import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const LaborRateInput = ({ label, name, value, onChange, onBlur }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
                type="number"
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                onBlur={onBlur}
                className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
                step="0.01"
            />
        </div>
    </div>
);

const LaborRatesConfig = ({ db }) => {
    const initialRates = { finishedHanging: '0', finishedTaping: '0', unfinishedHanging: '0', unfinishedTaping: '0' };
    const [rates, setRates] = useState(initialRates);

    useEffect(() => {
        if (!db) return;
        const ratesDocRef = doc(db, configPath, 'laborRates');
        const unsubscribe = onSnapshot(ratesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Create a new rates object starting with the initial defaults
                const newRates = { ...initialRates };
                // Loop through the keys in initialRates to ensure all rates are accounted for
                for (const key in newRates) {
                    // If a rate exists in Firestore and is not null/undefined, use it. Otherwise, the default from initialRates is used.
                    if (data.hasOwnProperty(key) && data[key] != null) {
                        newRates[key] = String(data[key]);
                    }
                }
                setRates(newRates);
            } else {
                const numericInitialRates = {};
                for(const key in initialRates) {
                    numericInitialRates[key] = parseFloat(initialRates[key]);
                }
                setDoc(ratesDocRef, numericInitialRates);
            }
        });
        return unsubscribe;
    }, [db]);

    const handleRateChange = (e) => {
        const { name, value } = e.target;
        setRates(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveRates = async () => {
        const ratesToSave = {};
        for (const key in rates) {
            ratesToSave[key] = parseFloat(rates[key]);
        }
        const ratesDocRef = doc(db, configPath, 'laborRates');
        await setDoc(ratesDocRef, ratesToSave);
    };
  
    const handleSaveRate = async (e) => {
        const { name, value } = e.target;
        const ratesToSave = { ...rates, [name]: parseFloat(value) };
        const ratesDocRef = doc(db, configPath, 'laborRates');
    console.warn('Implement handleSaveRate');
  }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Default Residential Labor Rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <LaborRateInput label="Hang Rate" name="finishedHanging" value={rates.finishedHanging} onChange={handleRateChange} onBlur={handleSaveRate} />
                <LaborRateInput label="Finished Tape" name="finishedTaping" value={rates.finishedTaping} onChange={handleRateChange} onBlur={handleRateChange} />
                <LaborRateInput label="Unfinished Tape" name="unfinishedTaping" value={rates.unfinishedTaping} onChange={handleRateChange} onBlur={handleRateChange} />
            </div>
            <div className="mt-6">
                <button onClick={handleSaveRates} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </div>
    );
};

export default LaborRatesConfig;