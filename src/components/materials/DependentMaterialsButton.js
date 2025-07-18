import React, { useState } from 'react';

export default function DependentMaterialsButton({ dependencies, onSave }) {
    const [showModal, setShowModal] = useState(false);
    const [localDependencies, setLocalDependencies] = useState(dependencies || []);

    const addDependency = () => {
        setLocalDependencies([...localDependencies, {
            id: Date.now(),
            categoryName: '',
            dependentMaterialId: '',
            ratio: '',
            unit: 'per'
        }]);
    };

    const updateDependency = (index, field, value) => {
        const updated = [...localDependencies];
        updated[index][field] = value;
        setLocalDependencies(updated);
    };

    const removeDependency = (index) => {
        setLocalDependencies(localDependencies.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave(localDependencies);
        setShowModal(false);
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                Dependent Materials
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-3/4 max-w-4xl">
                        <h2 className="text-xl font-bold mb-4">Dependent Materials Configuration</h2>
                        
                        <div className="space-y-4">
                            {localDependencies.map((dep, index) => (
                                <div key={dep.id} className="grid grid-cols-5 gap-4 items-center border p-4 rounded">
                                    <div>
                                        <label className="block text-sm font-medium">Category</label>
                                        <input
                                            type="text"
                                            value={dep.categoryName}
                                            onChange={(e) => updateDependency(index, 'categoryName', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                            placeholder="e.g., Drywall Board"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Dependent Material</label>
                                        <select
                                            value={dep.dependentMaterialId}
                                            onChange={(e) => updateDependency(index, 'dependentMaterialId', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                        >
                                            <option value="">Select Material</option>
                                            {/* Populate with available materials */}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Ratio</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={dep.ratio}
                                            onChange={(e) => updateDependency(index, 'ratio', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                            placeholder="1750"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Unit</label>
                                        <select
                                            value={dep.unit}
                                            onChange={(e) => updateDependency(index, 'unit', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                        >
                                            <option value="per">per</option>
                                            <option value="every">every</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => removeDependency(index)}
                                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex justify-between">
                            <button
                                onClick={addDependency}
                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Add Dependency
                            </button>
                            <div className="space-x-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}