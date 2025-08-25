import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { PlusIcon, DeleteIcon } from '../Icons';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const FinishesConfig = ({ db }) => {
    const [finishes, setFinishes] = useState({ 
        wallTextures: [], 
        ceilingTextures: [], 
        corners: [], 
        miscellaneous: [] 
    });
    const [crewTypes, setCrewTypes] = useState([]);
    const [expandedFinish, setExpandedFinish] = useState(null);
    const [newFinish, setNewFinish] = useState({ type: 'wallTextures', value: '' });

    useEffect(() => {
        if (!db) return;
        const finishesDocRef = doc(db, configPath, 'finishes');
        const unsubscribe = onSnapshot(finishesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFinishes({
                    wallTextures: data.wallTextures || [],
                    ceilingTextures: data.ceilingTextures || [],
                    corners: data.corners || [],
                    miscellaneous: data.miscellaneous || []
                });
            } else {
                setDoc(finishesDocRef, { 
                    wallTextures: [], 
                    ceilingTextures: [], 
                    corners: [], 
                    miscellaneous: [] 
                });
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

        const newFinishItem = {
            name: newFinish.value.trim(),
            pay: 0,
            crew: '',
            charge: 0,
        };

        const updatedFinishes = {
            ...finishes,
            [newFinish.type]: [...currentFinishes, newFinishItem]
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

    const handleAddPayout = async (type, name) => {
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
        await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
    };

    const getCategoryTitle = (type) => {
        const titles = {
            wallTextures: 'Wall Textures',
            ceilingTextures: 'Ceiling Textures',
            corners: 'Corners',
            miscellaneous: 'Miscellaneous'
        };
        return titles[type] || type;
    };

    const FinishItem = ({ finish, type }) => {
        const finishName = typeof finish === 'object' ? finish.name : finish;
        const isExpanded = expandedFinish === `${type}-${finishName}`;
        
        return (
            <div className="border border-gray-200 rounded-lg mb-2">
                <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedFinish(isExpanded ? null : `${type}-${finishName}`)}
                >
                    <span className="font-medium text-gray-800">{finishName}</span>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFinish(type, finishName);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                        >
                            <DeleteIcon />
                        </button>
                        <svg
                            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                
                {isExpanded && (
                    <div className="p-3 border-t bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Pay Rate</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={typeof finish === 'object' ? (finish.pay || '') : ''}
                                    onChange={(e) => handleFinishDetailChange(type, finishName, 'pay', e.target.value)}
                                    onBlur={() => handleFinishDetailBlur(type)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Crew</label>
                                <select
                                    value={typeof finish === 'object' ? (finish.crew || '') : ''}
                                    onChange={(e) => handleFinishDetailChange(type, finishName, 'crew', e.target.value)}
                                    onBlur={() => handleFinishDetailBlur(type)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Select Crew</option>
                                    {crewTypes.map(crew => (
                                        <option key={crew.id} value={crew.id}>{crew.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Charge Rate</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={typeof finish === 'object' ? (finish.charge || '') : ''}
                                    onChange={(e) => handleFinishDetailChange(type, finishName, 'charge', e.target.value)}
                                    onBlur={() => handleFinishDetailBlur(type)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Second payout option */}
                        {(typeof finish === 'object' && finish.pay2 !== undefined) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Secondary Pay Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={finish.pay2 || ''}
                                        onChange={(e) => handleFinishDetailChange(type, finishName, 'pay2', e.target.value)}
                                        onBlur={() => handleFinishDetailBlur(type)}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Secondary Crew</label>
                                    <select
                                        value={finish.crew2 || ''}
                                        onChange={(e) => handleFinishDetailChange(type, finishName, 'crew2', e.target.value)}
                                        onBlur={() => handleFinishDetailBlur(type)}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Select Crew</option>
                                        {crewTypes.map(crew => (
                                            <option key={crew.id} value={crew.id}>{crew.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-3 border-t">
                                <button
                                    onClick={() => handleAddPayout(type, finishName)}
                                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                                >
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    Add Secondary Payout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Finishes Configuration</h2>
            
            {/* Add new finish form */}
            <form onSubmit={handleAddFinish} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            value={newFinish.type}
                            onChange={(e) => setNewFinish({ ...newFinish, type: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="wallTextures">Wall Textures</option>
                            <option value="ceilingTextures">Ceiling Textures</option>
                            <option value="corners">Corners</option>
                            <option value="miscellaneous">Miscellaneous</option>
                        </select>
                    </div>
                    <div className="flex-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish Name</label>
                        <input
                            type="text"
                            value={newFinish.value}
                            onChange={(e) => setNewFinish({ ...newFinish, value: e.target.value })}
                            placeholder="Enter finish name"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-shrink-0 pt-6">
                        <button
                            type="submit"
                            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
                        >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Add
                        </button>
                    </div>
                </div>
            </form>

            {/* Finish categories */}
            <div className="space-y-6">
                {Object.keys(finishes).map(type => (
                    <div key={type}>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">{getCategoryTitle(type)}</h3>
                        <div className="space-y-2">
                            {finishes[type].map((finish, index) => (
                                <FinishItem key={index} finish={finish} type={type} />
                            ))}
                            {finishes[type].length === 0 && (
                                <p className="text-gray-500 text-sm italic">No {getCategoryTitle(type).toLowerCase()} configured yet.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinishesConfig;
