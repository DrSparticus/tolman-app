import React, { useState, useEffect } from 'react';
import { DeleteIcon } from '../Icons';

const MaterialModal = ({ isOpen, onClose, onSave, material, crewTypes }) => {
    const emptyVariant = {
        id: crypto.randomUUID(),
        widthFt: '',
        widthIn: '',
        lengthFt: '',
        lengthIn: '',
    };
    
    const initialFormData = {
        name: '',
        category: 'drywall-board',
        unit: 'each',
        price: '',
        laborFormula: 'none',
        laborCost: '',
        variants: [emptyVariant]
    };

    const [formData, setFormData] = useState(initialFormData);
    const [extraLabor, setExtraLabor] = useState(material?.extraLabor || []);

    useEffect(() => {
        if (material) {
            setFormData({
                id: material.id,
                name: material.name || '',
                category: material.category || 'drywall-board',
                unit: material.unit || 'each',
                price: material.price || '',
                laborFormula: material.laborFormula || 'none',
                laborCost: material.laborCost || '',
                variants: material.variants?.length ? material.variants : [emptyVariant],
            });
            setExtraLabor(material.extraLabor || []);
        } else {
            setFormData(initialFormData);
            setExtraLabor([]);
        }
    }, [material, isOpen]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleVariantChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
        }));
    };

    const addVariant = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { ...emptyVariant, id: crypto.randomUUID() }]
        }));
    };

    const removeVariant = (id) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter(v => v.id !== id)
        }));
    };

    const updateExtraLabor = (index, field, value) => {
        setExtraLabor(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const addExtraLabor = () => {
        setExtraLabor(prev => [...prev, { crewType: '', extraPay: '' }]);
    };

    const removeExtraLabor = (index) => {
        setExtraLabor(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const materialData = {
            ...formData,
            variants: formData.variants,
            extraLabor: extraLabor
        };
        onSave(materialData);
    };

    const renderSizeSection = () => {
        if (formData.type === 'Container') {
            return (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold pb-2 border-b text-gray-700">Container Information</h3>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Units per Container</label>
                            <input
                                type="number"
                                value={formData.unitsPerContainer || ''}
                                onChange={(e) => setFormData({...formData, unitsPerContainer: e.target.value})}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                placeholder="e.g., 50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Unit Description</label>
                            <input
                                type="text"
                                value={formData.unitDescription || ''}
                                onChange={(e) => setFormData({...formData, unitDescription: e.target.value})}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                                placeholder="e.g., sheets, tubes, etc."
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (formData.type === 'Each') {
            return (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold pb-2 border-b text-gray-700">Item Description</h3>
                    <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                            rows="3"
                            placeholder="Describe this item..."
                        />
                    </div>
                </div>
            );
        }

        // For other types, show the existing variants system
        return (
            <div className="mb-4">
                <h3 className="text-lg font-semibold pb-2 border-b text-gray-700">Available Sizes</h3>
                {formData.variants.map((variant) => (
                     <div key={variant.id} className="p-4 border rounded-lg space-y-4 relative">
                        {formData.variants.length > 1 && ( <button type="button" onClick={() => removeVariant(variant.id)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"> <DeleteIcon /> </button> )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Width</label>
                                <div className="flex items-center space-x-2">
                                    <input name="widthFt" type="number" value={variant.widthFt} onChange={(e) => handleVariantChange(variant.id, 'widthFt', e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" placeholder="ft" />
                                    <input name="widthIn" type="number" value={variant.widthIn} onChange={(e) => handleVariantChange(variant.id, 'widthIn', e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" placeholder="in" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Length</label>
                                <div className="flex items-center space-x-2">
                                    <input name="lengthFt" type="number" value={variant.lengthFt} onChange={(e) => handleVariantChange(variant.id, 'lengthFt', e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" placeholder="ft" />
                                    <input name="lengthIn" type="number" value={variant.lengthIn} onChange={(e) => handleVariantChange(variant.id, 'lengthIn', e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" placeholder="in" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={addVariant} className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg"> Add Another Size </button>
            </div>
        );
    };

    const isEditing = !!material && !!material.id;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 flex-shrink-0">{material ? 'Edit Material' : 'Add New Material'}</h2>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                                Material Name
                            </label>
                            <input id="name" name="name" type="text" value={formData.name} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required />
                        </div>
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="category">
                                Category
                            </label>
                            <select id="category" name="category" value={formData.category} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" >
                                <option value="2nd-layer-board">2nd Layer Board</option>
                                <option value="drywall-board">Drywall Board</option>
                                <option value="framing">Framing</option>
                                <option value="misc-hanging">Misc Hanging</option>
                                <option value="taping">Taping</option>
                                <option value="ceilings">Ceilings</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="unit">Base Unit</label>
                                <select id="unit" name="unit" value={formData.unit} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700">
                                    <option value="sq-ft">Square Feet</option>
                                    <option value="ln-ft">Linear Feet</option>
                                    <option value="each">Each</option>
                                    <option value="container">Container</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">Base Price</label>
                                <input id="price" name="price" type="number" step="0.001" value={formData.price} onChange={handleFormChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" required />
                            </div>
                        </div>

                        {renderSizeSection()}

                        {isEditing && (
    <div className="space-y-4">
        <h4 className="text-lg font-semibold">Extra Labor</h4>
        {extraLabor?.map((extra, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 p-3 border rounded">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Crew Type</label>
                    <select
                        value={extra.crewType || ''}
                        onChange={(e) => updateExtraLabor(index, 'crewType', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    >
                        <option value="">Select Crew Type</option>
                        {crewTypes?.map(crew => (
                            <option key={crew.id} value={crew.id}>{crew.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Extra Pay</label>
                    <input
                        type="number"
                        step="0.01"
                        value={extra.extraPay || ''}
                        onChange={(e) => updateExtraLabor(index, 'extraPay', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        onClick={() => removeExtraLabor(index)}
                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Remove
                    </button>
                </div>
            </div>
        ))}
        
        <button
            onClick={addExtraLabor}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
            Add Extra Labor
        </button>
    </div>
)}

                    </div>
                </form>
                <div className="flex-shrink-0 flex items-center justify-end space-x-2 mt-6 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg"> Cancel </button>
                    <button type="button" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"> Save Material </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialModal;