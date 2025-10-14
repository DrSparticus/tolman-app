import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { PlusIcon, DeleteIcon } from '../Icons';

// Component for inputs that defer updates until blur to prevent cursor jumping
const DeferredInput = React.memo(({ value, onBlur, onChange, ...inputProps }) => {
    const [localValue, setLocalValue] = useState(value || '');
    
    // Update local value when prop value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);
    
    const handleLocalChange = (e) => {
        setLocalValue(e.target.value);
        // Call onChange if provided (for special cases)
        if (onChange) {
            onChange(e);
        }
    };
    
    const handleBlur = (e) => {
        onBlur(e);
    };
    
    return (
        <input
            {...inputProps}
            value={localValue}
            onChange={handleLocalChange}
            onBlur={handleBlur}
        />
    );
});

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const FinishesConfig = ({ db }) => {
    const [finishes, setFinishes] = useState({ 
        wallTextures: [], 
        ceilingTextures: [], 
        corners: [], 
        windowWrap: [],
        miscellaneous: [] 
    });
    const [crewTypes, setCrewTypes] = useState([]);
    const [expandedFinish, setExpandedFinish] = useState(null);
    const [newFinish, setNewFinish] = useState({ type: 'wallTextures', value: '' });
    const [localNewFinishValue, setLocalNewFinishValue] = useState('');
    const [localValues, setLocalValues] = useState({});
    const [changedFinishes, setChangedFinishes] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [ignoreNextUpdate, setIgnoreNextUpdate] = useState(false);

    useEffect(() => {
        if (!db) return;
        const finishesDocRef = doc(db, configPath, 'finishes');
        const unsubscribe = onSnapshot(finishesDocRef, (docSnap) => {
            // Skip update if we just saved and are expecting this update
            if (ignoreNextUpdate) {
                setIgnoreNextUpdate(false);
                return;
            }
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFinishes({
                    wallTextures: data.wallTextures || [],
                    ceilingTextures: data.ceilingTextures || [],
                    corners: data.corners || [],
                    windowWrap: data.windowWrap || [],
                    miscellaneous: data.miscellaneous || []
                });
            } else {
                setDoc(finishesDocRef, { 
                    wallTextures: [], 
                    ceilingTextures: [], 
                    corners: [], 
                    windowWrap: [],
                    miscellaneous: [] 
                });
            }
        });
        return unsubscribe;
    }, [db, ignoreNextUpdate]);

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
        const finishValue = localNewFinishValue.trim() || newFinish.value.trim();
        if (!finishValue) return;

        const currentFinishes = finishes[newFinish.type] || [];
        if (currentFinishes.some(f => (typeof f === 'object' ? f.name : f).toLowerCase() === finishValue.toLowerCase())) {
            alert('This finish already exists.');
            return;
        }

        const newFinishItem = {
            name: finishValue,
            pay: 0,
            crew: '',
            charge: 0,
            description: '', // New field for tooltip/description
        };

        const updatedFinishes = {
            ...finishes,
            [newFinish.type]: [...currentFinishes, newFinishItem]
        };

        await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
        setNewFinish({ ...newFinish, value: '' });
        setLocalNewFinishValue('');
    };

    const handleNewFinishNameChange = (e) => {
        setLocalNewFinishValue(e.target.value);
    };

    const handleNewFinishNameBlur = (e) => {
        setNewFinish({ ...newFinish, value: e.target.value });
        setLocalNewFinishValue('');
    };

    const handleDeleteFinish = async (type, valueToDelete) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].filter(f => (typeof f === 'object' ? f.name : f) !== valueToDelete)
        };
        await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
    };

    const handleFinishDetailChange = useCallback((e) => {
        const { name, value } = e.target;
        const [type, finishName, field] = name.split('|');
        
        const key = `${type}_${finishName}_${field}`;
        setLocalValues(prev => ({ ...prev, [key]: value }));
        
        // Mark this finish as changed
        const finishKey = `${type}-${finishName}`;
        setChangedFinishes(prev => new Set([...prev, finishKey]));
    }, []);

    const handleSaveFinish = async (type, name) => {
        setIsSaving(true);
        const finishKey = `${type}-${name}`;
        
        try {
            // Get all local values for this finish
            const finishLocalValues = {};
            Object.keys(localValues).forEach(key => {
                if (key.startsWith(`${type}_${name}_`)) {
                    const field = key.split('_').pop();
                    finishLocalValues[field] = localValues[key];
                }
            });

            const updatedFinishes = {
                ...finishes,
                [type]: finishes[type].map(item => {
                    const itemName = typeof item === 'object' ? item.name : item;
                    if (itemName === name) {
                        const baseObj = typeof item === 'object'
                            ? item
                            : { name: item, pay: 0, crew: '', charge: 0, description: '' };
                        
                        return { ...baseObj, ...finishLocalValues };
                    }
                    return item;
                })
            };
            
            // Set flag to ignore the next Firestore update to prevent re-render
            setIgnoreNextUpdate(true);
            
            await setDoc(doc(db, configPath, 'finishes'), updatedFinishes);
            
            // Update local state immediately to prevent flickering
            setFinishes(updatedFinishes);
            
            // Clear local values for this finish
            setLocalValues(prev => {
                const newLocal = { ...prev };
                Object.keys(newLocal).forEach(key => {
                    if (key.startsWith(`${type}_${name}_`)) {
                        delete newLocal[key];
                    }
                });
                return newLocal;
            });
            
            // Remove from changed finishes
            setChangedFinishes(prev => {
                const newSet = new Set(prev);
                newSet.delete(finishKey);
                return newSet;
            });
            
        } catch (error) {
            console.error('Error saving finish:', error);
            alert('Error saving changes. Please try again.');
            setIgnoreNextUpdate(false); // Reset flag on error
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardChanges = (type, name) => {
        const finishKey = `${type}-${name}`;
        
        // Clear local values for this finish
        setLocalValues(prev => {
            const newLocal = { ...prev };
            Object.keys(newLocal).forEach(key => {
                if (key.startsWith(`${type}_${name}_`)) {
                    delete newLocal[key];
                }
            });
            return newLocal;
        });
        
        // Remove from changed finishes
        setChangedFinishes(prev => {
            const newSet = new Set(prev);
            newSet.delete(finishKey);
            return newSet;
        });
    };

    const getFieldValue = useCallback((type, name, field) => {
        const key = `${type}_${name}_${field}`;
        if (localValues.hasOwnProperty(key)) {
            return localValues[key];
        }
        
        const finish = finishes[type]?.find(f => {
            const itemName = typeof f === 'object' ? f.name : f;
            return itemName === name;
        });
        
        if (typeof finish === 'object') {
            return finish[field] || '';
        }
        return '';
    }, [localValues, finishes]);

    const handleAddPayout = async (type, name) => {
        const updatedFinishes = {
            ...finishes,
            [type]: finishes[type].map(item => {
                const itemName = typeof item === 'object' ? item.name : item;
                if (itemName === name) {
                    const baseObj = typeof item === 'object' 
                        ? item 
                        : { name: item, pay: 0, crew: '', charge: 0, description: '' };
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
            windowWrap: 'Window Wrap',
            miscellaneous: 'Miscellaneous'
        };
        return titles[type] || type;
    };

    const FinishItem = React.memo(({ finish, type }) => {
        const finishName = typeof finish === 'object' ? finish.name : finish;
        const isExpanded = expandedFinish === `${type}-${finishName}`;
        const finishKey = `${type}-${finishName}`;
        const hasChanges = changedFinishes.has(finishKey);
        
        return (
            <div className="border border-gray-200 rounded-lg mb-2">
                <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedFinish(isExpanded ? null : `${type}-${finishName}`)}
                >
                    <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-800">{finishName}</span>
                        {hasChanges && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                                Unsaved changes
                            </span>
                        )}
                    </div>
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
                                <DeferredInput
                                    type="number"
                                    step="0.01"
                                    name={`${type}|${finishName}|pay`}
                                    value={getFieldValue(type, finishName, 'pay')}
                                    onBlur={handleFinishDetailChange}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Crew</label>
                                <select
                                    name={`${type}|${finishName}|crew`}
                                    value={getFieldValue(type, finishName, 'crew')}
                                    onChange={handleFinishDetailChange}
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
                                <DeferredInput
                                    type="number"
                                    step="0.01"
                                    name={`${type}|${finishName}|charge`}
                                    value={getFieldValue(type, finishName, 'charge')}
                                    onBlur={handleFinishDetailChange}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Description field for misc finishes */}
                        {type === 'miscellaneous' && (
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Description/Tooltip</label>
                                <DeferredInput
                                    type="text"
                                    name={`${type}|${finishName}|description`}
                                    value={getFieldValue(type, finishName, 'description')}
                                    onBlur={handleFinishDetailChange}
                                    placeholder="Enter description for tooltip (optional)"
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {/* Second payout option */}
                        {(typeof finish === 'object' && finish.pay2 !== undefined) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Secondary Pay Rate</label>
                                    <DeferredInput
                                        type="number"
                                        step="0.01"
                                        name={`${type}|${finishName}|pay2`}
                                        value={getFieldValue(type, finishName, 'pay2')}
                                        onBlur={handleFinishDetailChange}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Secondary Crew</label>
                                    <select
                                        name={`${type}|${finishName}|crew2`}
                                        value={getFieldValue(type, finishName, 'crew2')}
                                        onChange={handleFinishDetailChange}
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

                        {/* Save/Discard buttons */}
                        {hasChanges && (
                            <div className="flex items-center justify-end space-x-2 pt-3 border-t mt-3">
                                <button
                                    onClick={() => handleDiscardChanges(type, finishName)}
                                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                                    disabled={isSaving}
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={() => handleSaveFinish(type, finishName)}
                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }, (prevProps, nextProps) => {
        // Only re-render if the finish data has actually changed
        return prevProps.finish === nextProps.finish && prevProps.type === nextProps.type;
    });

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
                            <option value="windowWrap">Window Wrap</option>
                            <option value="miscellaneous">Miscellaneous</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish Name</label>
                        <input
                            type="text"
                            value={localNewFinishValue || newFinish.value}
                            onChange={handleNewFinishNameChange}
                            onBlur={handleNewFinishNameBlur}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                {Object.keys(finishes).map(type => (
                    <div key={type} className="bg-gray-50 p-4 rounded-lg">
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
