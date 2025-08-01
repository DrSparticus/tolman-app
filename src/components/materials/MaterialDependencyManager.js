import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function MaterialDependencyManager({ db, materials }) {
    const [dependencies, setDependencies] = useState([]);
    const [isEditing, setIsEditing] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    // Memoize filtered materials to prevent unnecessary re-renders
    const dependencyMaterials = useMemo(() => 
        materials.filter(m => m.category === 'misc-hanging' || m.category === 'taping'),
        [materials]
    );

    useEffect(() => {
        if (!db) return;
        const dependenciesDocRef = doc(db, configPath, 'materialDependencies');
        const unsubscribe = onSnapshot(dependenciesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setDependencies(docSnap.data().dependencies || []);
            } else {
                // Create default dependencies from your spreadsheet
                const defaultDependencies = [
                    {
                        id: 'screws',
                        materialName: 'Screws',
                        coverage: 9000,
                        secondLayerCoverage: 9000,
                        furringCoverage: 800,
                        appliesTo: ['drywall-board', '2nd-layer-board'],
                        isStocked: false, // Misc Materials (hanging materials)
                        formula: '((totalSqFt + secondLayerSqFt) / 9000) + ((furringLinearFt / 12) / 800)',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'osi-glue',
                        materialName: 'OSI Glue',
                        coverage: 375,
                        appliesTo: ['drywall-board'],
                        isStocked: false, // Misc Materials (hanging materials)
                        formula: 'totalSqFt / 375',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'staples',
                        materialName: 'Staples',
                        coverage: 6000, // 9000 / 1.5
                        appliesTo: ['drywall-board'],
                        isStocked: false, // Misc Materials (hanging materials)
                        formula: '(totalSqFt / 9000) * 1.5',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'nc-corner',
                        materialName: 'NC Corner',
                        coverage: 12, // 9000 / 750
                        appliesTo: ['drywall-board'],
                        isStocked: false, // Misc Materials (hanging materials)
                        formula: '(totalSqFt / 9000) * 750',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'tape-500',
                        materialName: '500\' Tape',
                        coverage: 1750,
                        appliesTo: ['drywall-board'],
                        isStocked: true, // Stocked Material (taping materials)
                        finishedOnly: false,
                        formula: 'totalSqFt / 1750',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'taping-mud',
                        materialName: 'Taping Mud',
                        coverage: 1000,
                        appliesTo: ['drywall-board'],
                        isStocked: true, // Stocked Material (taping materials)
                        finishedOnly: false,
                        formula: 'totalSqFt / 1000',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    },
                    {
                        id: 'topping-mud',
                        materialName: 'Topping Mud',
                        coverage: 250, // 1000 / 4
                        appliesTo: ['drywall-board'],
                        isStocked: true, // Stocked Material (taping materials)
                        finishedOnly: true,
                        formula: 'finishedSqFt / 1000 * 4',
                        roundUp: true,
                        roundToDecimalPlaces: 0 // Round to whole numbers
                    }
                ];
                setDependencies(defaultDependencies);
                setDoc(dependenciesDocRef, { dependencies: defaultDependencies });
            }
        });
        return unsubscribe;
    }, [db]);

    const saveDependencies = async () => {
        if (!db) return;
        const dependenciesDocRef = doc(db, configPath, 'materialDependencies');
        await setDoc(dependenciesDocRef, { dependencies });
    };

    const addDependency = () => {
        const newDep = {
            id: Date.now().toString(),
            materialName: '',
            coverage: 1000,
            appliesTo: ['drywall-board'],
            isStocked: false, // Default to Misc Materials
            finishedOnly: false,
            formula: 'totalSqFt / 1000',
            roundUp: true,
            roundToDecimalPlaces: 0
        };
        setDependencies([...dependencies, newDep]);
        setIsEditing(newDep.id);
        setShowAddForm(false);
    };

    const updateDependency = useCallback((id, field, value) => {
        setDependencies(deps => deps.map(dep => 
            dep.id === id ? { ...dep, [field]: value } : dep
        ));
    }, []);

    const removeDependency = useCallback((id) => {
        setDependencies(deps => deps.filter(dep => dep.id !== id));
    }, []);

    const generateFormula = (dep) => {
        let formula = '';
        
        if (dep.appliesTo.includes('drywall-board')) {
            if (dep.finishedOnly) {
                formula = `finishedSqFt / ${dep.coverage}`;
            } else {
                formula = `totalSqFt / ${dep.coverage}`;
            }
        }
        
        if (dep.appliesTo.includes('2nd-layer-board')) {
            if (formula) formula += ' + ';
            formula += `secondLayerSqFt / ${dep.coverage}`;
        }
        
        if (dep.appliesTo.includes('furring')) {
            if (formula) formula += ' + ';
            formula += `furringLinearFt / ${dep.coverage}`;
        }
        
        return formula;
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Material Dependencies</h3>
                <div className="space-x-2">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Add Dependency
                    </button>
                    <button
                        onClick={saveDependencies}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {dependencies.map(dep => (
                    <div key={dep.id} className="border rounded-lg p-4">
                        {isEditing === dep.id ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Material Name</label>
                                    <select
                                        value={dep.materialName}
                                        onChange={(e) => updateDependency(dep.id, 'materialName', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                    >
                                        <option value="">Select Material</option>
                                        {dependencyMaterials
                                            .map(material => (
                                                <option key={material.id} value={material.name}>
                                                    {material.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Coverage (sq ft per unit)</label>
                                    <input
                                        type="number"
                                        value={dep.coverage}
                                        onChange={(e) => updateDependency(dep.id, 'coverage', parseFloat(e.target.value))}
                                        className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Applies To</label>
                                    <div className="mt-1 space-y-2">
                                        {['drywall-board', '2nd-layer-board', 'furring'].map(category => (
                                            <label key={category} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={dep.appliesTo.includes(category)}
                                                    onChange={(e) => {
                                                        const newAppliesTo = e.target.checked
                                                            ? [...dep.appliesTo, category]
                                                            : dep.appliesTo.filter(c => c !== category);
                                                        updateDependency(dep.id, 'appliesTo', newAppliesTo);
                                                        updateDependency(dep.id, 'formula', generateFormula({ ...dep, appliesTo: newAppliesTo }));
                                                    }}
                                                    className="mr-2"
                                                />
                                                {category.replace('-', ' ')}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Stocked Material</label>
                                    <div className="mt-1">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={dep.isStocked || false}
                                                onChange={(e) => {
                                                    updateDependency(dep.id, 'isStocked', e.target.checked);
                                                }}
                                                className="mr-2"
                                            />
                                            Include in Stocked Material calculation (unchecked = Misc Materials)
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={dep.finishedOnly}
                                            onChange={(e) => {
                                                updateDependency(dep.id, 'finishedOnly', e.target.checked);
                                                updateDependency(dep.id, 'formula', generateFormula({ ...dep, finishedOnly: e.target.checked }));
                                            }}
                                            className="mr-2"
                                        />
                                        Finished Areas Only
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={dep.roundUp}
                                            onChange={(e) => updateDependency(dep.id, 'roundUp', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Round Up
                                    </label>
                                </div>

                                {dep.roundUp && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Round to Decimal Places</label>
                                        <select
                                            value={dep.roundToDecimalPlaces || 0}
                                            onChange={(e) => updateDependency(dep.id, 'roundToDecimalPlaces', parseInt(e.target.value))}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value={0}>Whole number (0 decimals)</option>
                                            <option value={1}>1 decimal place (0.1)</option>
                                            <option value={2}>2 decimal places (0.01)</option>
                                            <option value={3}>3 decimal places (0.001)</option>
                                        </select>
                                    </div>
                                )}

                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700">Generated Formula</label>
                                    <input
                                        type="text"
                                        value={dep.formula}
                                        onChange={(e) => updateDependency(dep.id, 'formula', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-gray-50"
                                    />
                                </div>

                                <div className="col-span-full flex space-x-2">
                                    <button
                                        onClick={() => setIsEditing(null)}
                                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={() => removeDependency(dep.id)}
                                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-medium">{dep.materialName}</h4>
                                    <p className="text-sm text-gray-600">
                                        Coverage: {dep.coverage} sq ft per unit | 
                                        Applies to: {dep.appliesTo.join(', ')} | 
                                        {dep.finishedOnly ? 'Finished only' : 'All areas'}
                                    </p>
                                    <p className="text-xs text-gray-500">{dep.formula}</p>
                                </div>
                                <button
                                    onClick={() => setIsEditing(dep.id)}
                                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {showAddForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-lg font-semibold mb-4">Add New Dependency</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            This will create a new material dependency rule. You can edit all details after adding.
                        </p>
                        <div className="flex space-x-2">
                            <button
                                onClick={addDependency}
                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}