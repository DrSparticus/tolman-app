import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { PlusIcon, DeleteIcon } from '../Icons';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const LaborConfig = ({ db }) => {
    const [crewTypes, setCrewTypes] = useState([]);
    const [newCrewName, setNewCrewName] = useState('');

    const defaultCrews = [
        { name: 'Hanger', rates: { hang: 0 } },
        { name: 'Taper', rates: { finishedTape: 0, unfinishedTape: 0 } },
        { name: 'Firetaper', rates: {} },
        { name: 'Framer', rates: {} },
        { name: 'Ceiling Framer', rates: {} },
        { name: 'Patcher', rates: {} }
    ];

    useEffect(() => {
        if (!db) return;
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');

        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            if (snapshot.empty) {
                // Pre-populate with default crews and their rates
                const batchPromises = defaultCrews.map(crew => 
                    addDoc(crewCollectionRef, crew)
                );
                Promise.all(batchPromises).catch(err => console.error("Error pre-populating crews:", err));
            } else {
                const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCrewTypes(crewsData);
            }
        });

        return unsubscribe;
    }, [db]);

    const handleAddCrew = async (e) => {
        e.preventDefault();
        if (!newCrewName.trim() || crewTypes.some(c => c.name.toLowerCase() === newCrewName.trim().toLowerCase())) {
            alert("Invalid or duplicate crew name.");
            return;
        }
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        await addDoc(crewCollectionRef, { 
            name: newCrewName.trim(), 
            rates: {} 
        });
        setNewCrewName('');
    };

    const handleDeleteCrew = async (crewId) => {
        if (window.confirm("Are you sure you want to delete this crew type?")) {
            const crewDocRef = doc(db, configPath, 'labor', 'crewTypes', crewId);
            await deleteDoc(crewDocRef);
        }
    };

    const handleRateChange = (crewId, rateType, value) => {
        const updatedCrews = crewTypes.map(crew => {
            if (crew.id === crewId) {
                return {
                    ...crew,
                    rates: {
                        ...crew.rates,
                        [rateType]: value
                    }
                };
            }
            return crew;
        });
        setCrewTypes(updatedCrews);
    };

    const handleSaveRate = async (crewId, rateType, value) => {
        const crewDocRef = doc(db, configPath, 'labor', 'crewTypes', crewId);
        const crew = crewTypes.find(c => c.id === crewId);
        const updatedRates = {
            ...crew.rates,
            [rateType]: parseFloat(value) || 0
        };
        await setDoc(crewDocRef, { rates: updatedRates }, { merge: true });
    };

    const renderRateInputs = (crew) => {
        const rateInputs = [];
        
        if (crew.name.toLowerCase().includes('hang')) {
            rateInputs.push(
                <div key="hang" className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700 min-w-[80px]">Hang Rate:</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-500 text-sm">$</span>
                        <input
                            type="number"
                            step="0.001"
                            value={crew.rates?.hang || ''}
                            onChange={(e) => handleRateChange(crew.id, 'hang', e.target.value)}
                            onBlur={(e) => handleSaveRate(crew.id, 'hang', e.target.value)}
                            className="pl-6 pr-2 py-1 w-24 border-gray-300 rounded-md text-sm"
                            placeholder="0.000"
                        />
                    </div>
                </div>
            );
        }
        
        if (crew.name.toLowerCase().includes('tap')) {
            rateInputs.push(
                <div key="finishedTape" className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700 min-w-[80px]">Finished:</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-500 text-sm">$</span>
                        <input
                            type="number"
                            step="0.001"
                            value={crew.rates?.finishedTape || ''}
                            onChange={(e) => handleRateChange(crew.id, 'finishedTape', e.target.value)}
                            onBlur={(e) => handleSaveRate(crew.id, 'finishedTape', e.target.value)}
                            className="pl-6 pr-2 py-1 w-24 border-gray-300 rounded-md text-sm"
                            placeholder="0.000"
                        />
                    </div>
                </div>,
                <div key="unfinishedTape" className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700 min-w-[80px]">Unfinished:</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-500 text-sm">$</span>
                        <input
                            type="number"
                            step="0.001"
                            value={crew.rates?.unfinishedTape || ''}
                            onChange={(e) => handleRateChange(crew.id, 'unfinishedTape', e.target.value)}
                            onBlur={(e) => handleSaveRate(crew.id, 'unfinishedTape', e.target.value)}
                            className="pl-6 pr-2 py-1 w-24 border-gray-300 rounded-md text-sm"
                            placeholder="0.000"
                        />
                    </div>
                </div>
            );
        }
        
        return rateInputs;
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Labor Crew Types & Rates</h2>
            
            <form onSubmit={handleAddCrew} className="flex items-center space-x-4 mb-6">
                <input
                    type="text"
                    value={newCrewName}
                    onChange={(e) => setNewCrewName(e.target.value)}
                    placeholder="Enter new crew type name"
                    className="flex-grow border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                    type="submit"
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Crew
                </button>
            </form>

            <div className="space-y-4">
                {crewTypes.sort((a, b) => a.name.localeCompare(b.name)).map(crew => (
                    <div key={crew.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-gray-800">{crew.name}</h3>
                            <button
                                onClick={() => handleDeleteCrew(crew.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Delete crew type"
                            >
                                <DeleteIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                            {renderRateInputs(crew)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LaborConfig;