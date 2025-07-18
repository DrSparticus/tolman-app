import React from 'react';

const MaterialSizer = ({ material, updateMaterial, updateSizeOption, removeSizeOption, addSizeOption }) => {
    const renderSizeOptions = () => {
        switch (material.type) {
            case 'Container':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Container Sizing</label>
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="number"
                                placeholder="Quantity per container"
                                value={material.sizing?.containerSize || ''}
                                onChange={(e) => updateMaterial('sizing', {...material.sizing, containerSize: e.target.value})}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                            />
                            <input
                                type="text"
                                placeholder="Unit (sheets, rolls, etc.)"
                                value={material.sizing?.unit || ''}
                                onChange={(e) => updateMaterial('sizing', {...material.sizing, unit: e.target.value})}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                            />
                        </div>
                    </div>
                );

            case 'Each':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Unit: Each</label>
                        <p className="text-sm text-gray-500">No size options for "Each" type materials</p>
                    </div>
                );

            case 'Linear Feet':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Linear Feet Sizes</label>
                        {material.sizes?.map((size, index) => (
                            <div key={index} className="grid grid-cols-3 gap-2 mt-2">
                                <input
                                    type="text"
                                    placeholder="Size name"
                                    value={size.name || ''}
                                    onChange={(e) => updateSizeOption(index, 'name', e.target.value)}
                                    className="block w-full border border-gray-300 rounded-md py-2 px-3"
                                />
                                <input
                                    type="number"
                                    placeholder="Length"
                                    value={size.length || ''}
                                    onChange={(e) => updateSizeOption(index, 'length', e.target.value)}
                                    className="block w-full border border-gray-300 rounded-md py-2 px-3"
                                />
                                <button
                                    onClick={() => removeSizeOption(index)}
                                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => addSizeOption()}
                            className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Add Size
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div>
            {renderSizeOptions()}
        </div>
    );
};

export default MaterialSizer;