import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { PlusIcon, DeleteIcon } from '../Icons';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const LaborCrewConfig = ({ db }) => {
    const [crewTypes, setCrewTypes] = useState([]);
    const [newCrewName, setNewCrewName] = useState('');

    const defaultCrews = ['Hanger', 'Taper', 'Firetaper', 'Framer', 'Ceiling Framer', 'Patcher'];

    useEffect(() => {
        if (!db) return;
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');

        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            if (snapshot.empty) {
                // Pre-populate if the collection is empty
                const batchPromises = defaultCrews.map(name => 
                    addDoc(crewCollectionRef, { name, rate: 0 })
                );
                Promise.all(batchPromises).catch(err => console.error("Error pre-populating crews:", err));
            } else {
                const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCrewTypes(crewsData);
            }
        });

        return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    const handleAddCrew = async (e) => {
        e.preventDefault();
        if (!newCrewName.trim() || crewTypes.some(c => c.name.toLowerCase() === newCrewName.trim().toLowerCase())) {
            alert("Invalid or duplicate crew name.");
            return;
        }
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        await addDoc(crewCollectionRef, { name: newCrewName.trim(), rate: 0 });
        setNewCrewName('');
    };

    const handleDeleteCrew = async (crewId) => {
        const crewDocRef = doc(db, configPath, 'labor', 'crewTypes', crewId);
        await deleteDoc(crewDocRef);
    };

    const handleRateChange = (id, value) => {
        const updatedCrews = crewTypes.map(crew =>
            crew.id === id ? { ...crew, rate: value } : crew
        );
        setCrewTypes(updatedCrews);
    };

    const handleSaveCrewTypes = async () => {
        const batch = [];
        for (const crew of crewTypes) {
            const crewDocRef = doc(db, configPath, 'labor', 'crewTypes', crew.id);
            batch.push(setDoc(crewDocRef, { rate: parseFloat(crew.rate) }, { merge: true }));
        }
        await Promise.all(batch);
    };
    
    const handleSaveRate = async (e, crewId) => {
      console.warn('Implement handleSaveRate');
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Labor Crew Types & Rates</h2>
            <form onSubmit={handleAddCrew} className="flex items-center space-x-4 mb-6">
                <input type="text" value={newCrewName} onChange={(e) => setNewCrewName(e.target.value)} placeholder="Enter new crew type name" className="flex-grow mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
               <button type="submit" className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">
                    <PlusIcon />
                    <span className="ml-2">Add Crew</span>
                </button>
           </form>
           <div className="space-y-2">
                {crewTypes.sort((a, b) => a.name.localeCompare(b.name)).map(crew => (
                    <div key={crew.id} className="flex items-center justify-between py-2 px-4 rounded-md bg-gray-50 hover:bg-gray-100">
                        <span className="font-medium text-gray-800">{crew.name}</span>
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                <input type="number" value={crew.rate} onChange={(e) => handleRateChange(crew.id, e.target.value)} onBlur={(e) => handleSaveRate(e, crew.id)} className="pl-7 pr-2 py-1 w-28 border-gray-300 rounded-md" />
                           </div>
                           <button onClick={() => handleDeleteCrew(crew.id)} className="text-red-600 hover:text-red-800">
                               <DeleteIcon />
                           </button>
                       </div>
                   </div>
               ))}
           </div>
           <div className="mt-6">
               <button onClick={handleSaveCrewTypes} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
           </div>
       </div>
   );
};

export default LaborCrewConfig;