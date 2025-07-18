import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const MarkupInput = ({ label, name, value, onChange, onBlur }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <input
                type="number"
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                onBlur={onBlur}
                className="block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
            </div>
        </div>
    </div>
);

const MarkupConfig = ({ db }) => {
    const initialMarkups = { laborBurden: '0', salesTax: '0', overhead: '0', profit: '0' };
    const [markups, setMarkups] = useState(initialMarkups);

    useEffect(() => {
        if (!db) return;
        const markupDocRef = doc(db, configPath, 'markup');
        const unsubscribe = onSnapshot(markupDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const stringData = { ...initialMarkups };
                for (const key in initialMarkups) {
                    if (data.hasOwnProperty(key)) {
                        stringData[key] = String(data[key]);
                    }
                }
                setMarkups(stringData);
            } else {
                const numericInitialMarkups = {};
                for(const key in initialMarkups) numericInitialMarkups[key] = parseFloat(initialMarkups[key]);
                setDoc(markupDocRef, numericInitialMarkups);
            }
        });
        return unsubscribe;
    }, [db]);

    const handleMarkupChange = (e) => {
        const { name, value } = e.target;
        setMarkups(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveMarkups = async () => {
       const markupsToSave = {};
       for (const key in markups) {
           markupsToSave[key] = parseFloat(markups[key]);
       }
       const markupDocRef = doc(db, configPath, 'markup');
       await setDoc(markupDocRef, markupsToSave);
   };
   
    const handleSaveMarkup = async (e) => {
        const { name, value } = e.target;
        const markupsToSave = { ...markups, [name]: parseFloat(value) };
        const markupDocRef = doc(db, configPath, 'markup');
      console.warn('Implement handleSaveMarkup');
    }
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Markup Percentages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MarkupInput label="Labor Burden" name="laborBurden" value={markups.laborBurden} onChange={handleMarkupChange} onBlur={handleSaveMarkup} />
                <MarkupInput label="Sales Tax" name="salesTax" value={markups.salesTax} onChange={handleMarkupChange} onBlur={handleSaveMarkup} />
                <MarkupInput label="Overhead" name="overhead" value={markups.overhead} onChange={handleMarkupChange} onBlur={handleSaveMarkup} />
                <MarkupInput label="Profit" name="profit" value={markups.profit} onChange={handleMarkupChange} onBlur={handleSaveMarkup} />
            </div>
            <div className="mt-6">
                <button onClick={handleSaveMarkups} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </div>
    );
};

export default MarkupConfig;