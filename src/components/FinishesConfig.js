import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { PlusIcon, DeleteIcon } from '../Icons';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const FinishesConfig = ({ db }) => {
    const [finishes, setFinishes] = useState({ wallTextures: [], ceilingTextures: [], corners: [] });
    const [crewTypes, setCrewTypes] = useState([]);
    const [newFinish, setNewFinish] = useState({ type: 'wallTextures', value: '' });

    useEffect(() => {
        if (!db) return;
        const finishesDocRef = doc(db, configPath, 'finishes');
        const unsubscribe = onSnapshot(finishesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setFinishes(docSnap.data());
            } else {
                // If the document doesn't exist, create it with default empty arrays
                setDoc(finishesDocRef, { wallTextures: [], ceilingTextures: [], corners: [] });
            }
        });
        return unsubscribe;
    }, [db]);

    useEffect(() => {
        if (!db) return;
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrewTypes(crewsData);
        });
        return unsubscribe;
    }, [db]);

    const handleAddFinish = async (e) => {
        e.preventDefault();
        if (!newFinish.value.trim()) return;

        const currentFinishes = finishes[newFinish.type] || [];
        if (currentFinishes.some(f => (typeof f === 'object' ? f.name : f).toLowerCase() === newFinish.value.trim().toLowerCase())) {
            alert('This finish already exists.');
            return;
        }

        const updatedFinishes = {
            ...finishes,
            [newFinish.type]: [...currentFinishes, {
                name: newFinish.value.trim(),
                pay: 0, crew: '',
                charge: 0,
            }]
        };

        await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
        setNewFinish({ ...newFinish, value: '' });
    };

    const handleDeleteFinish = async (type, valueToDelete) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].filter(f => (typeof f === 'object' ? f.name : f) !== valueToDelete)
        };
        await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
    };

    const handleFinishDetailChange = (type, name, field, value) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].map(item => {
                const itemName = typeof item === 'object' ? item.name : item;
                if (itemName === name) {
                    // If it's a string, upgrade it to an object on first edit
                    const baseObj = typeof item === 'object'
                        ? item
                        : { name: item, pay: 0, crew: '', charge: 0 };
                    
                    return { ...baseObj, [field]: String(value) };
                }
                return item;
            })
        };
        setFinishes(updatedFinishes);
    };


    const handleFinishDetailBlur = async (type) => {
        await setDoc(doc(db, configPath, 'finishes'), { [type]: finishes[type] }, { merge: true });
    };

    const handleAddPayout2 = async (type, name) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].map(item => {
                const itemName = typeof item === 'object' ? item.name : item;
                if (itemName === name) {
                    const baseObj = typeof item === 'object' 
                        ? item 
                        : { name: item, pay: 0, crew: '', charge: 0 };
                    return { ...baseObj, pay2: 0, crew2: '' };
                }
                return item;
            })
        };
        setFinishes(updatedFinishes);
        await setDoc(doc(db, configPath, 'finishes'), { [type]: updatedFinishes[type] }, { merge: true });
    };

    const handleRemovePayout2 = async (type, name) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].map(item => {
                const itemName = typeof item === 'object' ? item.name : item;
                if (itemName === name) {
                    const { pay2, crew2, ...rest } = item;
                    return rest;
                }
                return item;
            })
        };
        setFinishes(updatedFinishes);
        await setDoc(doc(db, configPath, 'finishes'), { [type]: updatedFinishes[type] }, { merge: true });
    };

    const renderFinishSection = (title, type, items) => (
        <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-600 mb-3">{title}</h3>
            <ul className="space-y-2">
                {(items || []).map(item => {
                    const isObject = typeof item === 'object' && item !== null;
                    const name = isObject ? item.name : item;
                    const hasPayout2 = isObject && (item.pay2 !== undefined || item.crew2 !== undefined);
                    if (!name) return null;

                    return (
                        <li key={name} className="p-4 rounded-md bg-gray-50 border">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{name}</span>
                                <button onClick={() => handleDeleteFinish(type, name)} className="text-red-600 hover:text-red-800">
                                    <DeleteIcon />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                {/* Payout 1 */}
                                <div className="p-2 border rounded-md bg-white">
                                    <label className="text-xs font-semibold text-gray-500">Payout 1</label>
                                    <div className="mt-1 space-y-2">
                                        <div><label className="text-xs text-gray-500">Pay</label><input type="number" step="0.01" value={isObject ? item.pay || '' : ''} onChange={(e) => handleFinishDetailChange(type, name, 'pay', e.target.value)} onBlur={() => handleFinishDetailBlur(type)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-1" /></div>
                                        <div><label className="text-xs text-gray-500">Crew</label><select value={isObject ? item.crew || '' : ''} onChange={(e) => handleFinishDetailChange(type, name, 'crew', e.target.value)} onBlur={() => handleFinishDetailBlur(type)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-1"><option value="">--</option>{crewTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}</select></div>
                                    </div>
                                </div>
                                {hasPayout2 ? (
                                    <div className="p-2 border rounded-md bg-white relative">
                                        <label className="text-xs font-semibold text-gray-500">Payout 2</label>
                                        <button type="button" onClick={() => handleRemovePayout2(type, name)} className="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 rounded-full">
                                            <DeleteIcon />
                                        </button>
                                        <div className="mt-1 space-y-2">
                                            <div><label className="text-xs text-gray-500">Pay</label><input type="number" step="0.01" value={isObject ? item.pay2 || '' : ''} onChange={(e) => handleFinishDetailChange(type, name, 'pay2', e.target.value)} onBlur={() => handleFinishDetailBlur(type)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-1" /></div>
                                            <div><label className="text-xs text-gray-500">Crew</label><select value={isObject ? item.crew2 || '' : ''} onChange={(e) => handleFinishDetailChange(type, name, 'crew2', e.target.value)} onBlur={() => handleFinishDetailBlur(type)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-1"><option value="">--</option>{crewTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}</select></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-2 border rounded-md bg-white flex items-center justify-center">
                                        <button type="button" onClick={() => handleAddPayout2(type, name)} className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1 px-3 rounded-md text-xs">
                                            <PlusIcon className="h-4 w-4" />
                                            <span className="ml-1">Add Payout</span>
                                        </button>
                                    </div>
                                )}
                                {/* Charge */}
                                <div className="p-2 border rounded-md bg-white flex flex-col justify-center">
                                    <label className="text-xs font-semibold text-gray-500">Total Charge</label>
                                    <div className="mt-1">
                                        <input type="number" step="0.01" value={isObject ? item.charge || '' : ''} onChange={(e) => handleFinishDetailChange(type, name, 'charge', e.target.value)} onBlur={() => handleFinishDetailBlur(type)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-1" />
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Finishes Configuration</h2>
            <form onSubmit={handleAddFinish} className="flex items-center space-x-4 mb-6">
                <input type="text" value={newFinish.value} onChange={(e) => setNewFinish({ ...newFinish, value: e.target.value })} placeholder="Enter new finish name" className="flex-grow mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                <select value={newFinish.type} onChange={(e) => setNewFinish({ ...newFinish, type: e.target.value })} className="mt-1 block border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                    <option value="wallTextures">Wall Texture</option>
                    <option value="ceilingTextures">Ceiling Texture</option>
                    <option value="corners">Corners</option>
                </select>
                <button type="submit" className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">
                    <PlusIcon />
                    <span className="ml-2">Add</span>
                </button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderFinishSection('Wall Textures', 'wallTextures', finishes.wallTextures)}
                {renderFinishSection('Ceiling Textures', 'ceilingTextures', finishes.ceilingTextures)}
                {renderFinishSection('Corners', 'corners', finishes.corners)}
            </div>
            <div className="mt-6">
               <button onClick={() => handleSaveFinishes(db, finishes)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </div>
    );
};

const handleSaveFinishes = async (db, finishes) => {
    console.log("Saving finishes...", finishes); // For debugging
    await setDoc(doc(db, configPath, 'finishes'), finishes);
};

export default FinishesConfig;