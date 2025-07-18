import React, { useState } from 'react';
import MaterialItem from './MaterialItem';
import MaterialSelectModal from './MaterialSelectModal';

export default function Area({ area, onUpdate, onRemove, db, isOnlyArea, finishes }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const totalSqFt = React.useMemo(() => {
        if (!area.materials || area.materials.length === 0) return 0;
        return area.materials.reduce((total, material) => {
            const materialTotal = material.variants.reduce((matTotal, variant) => {
                const widthInches = (parseFloat(variant.widthFt || 0) * 12) + parseFloat(variant.widthIn || 0);
                const lengthInches = (parseFloat(variant.lengthFt || 0) * 12) + parseFloat(variant.lengthIn || 0);
                if (widthInches === 0 || lengthInches === 0) return matTotal;
                const sqFtPerPiece = (widthInches * lengthInches) / 144;
                const quantity = parseInt(variant.quantity, 10) || 0;
                return matTotal + (sqFtPerPiece * quantity);
            }, 0);
            return total + materialTotal;
        }, 0);
    }, [area.materials]);

    const handleNameChange = (e) => {
        onUpdate(area.id, { ...area, name: e.target.value });
    };

    const addMaterialToArea = (material) => {
        const newMaterial = {
            materialId: material.id,
            name: material.name,
            category: material.category,
            unit: material.unit,
            price: material.price,
            variants: material.variants.map(v => ({ ...v, quantity: 0 }))
        };
        onUpdate(area.id, { ...area, materials: [...area.materials, newMaterial] });
    };
    
    const updateMaterialInArea = (materialId, updatedMaterial) => {
        onUpdate(area.id, {
            ...area,
            materials: area.materials.map(m => m.materialId === materialId ? updatedMaterial : m)
        });
    };
    
    const removeMaterialFromArea = (materialId) => {
        onUpdate(area.id, {
            ...area,
            materials: area.materials.filter(m => m.materialId !== materialId)
        });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-y-2 mb-4">
                <input
                    type="text"
                    value={area.name}
                    onChange={handleNameChange}
                    className="text-xl font-bold border-b-2 border-transparent focus:border-gray-300 outline-none flex-grow min-w-[100px]"
                />
                <div className="flex items-center space-x-4 ml-4">
                    {totalSqFt > 0 && (
                        <span className="text-lg font-semibold text-blue-600 whitespace-nowrap">
                            {parseFloat(totalSqFt.toFixed(2))} sq. ft.
                        </span>
                    )}
                    {!isOnlyArea && (
                        <button onClick={onRemove} className="text-red-500 hover:text-red-700 font-semibold whitespace-nowrap">
                            Remove Area
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-6 mb-4">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id={`finished-${area.id}`}
                        name="isFinished"
                        checked={area.isFinished || false}
                        onChange={(e) => onUpdate(area.id, { ...area, isFinished: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`finished-${area.id}`} className="ml-2 block text-sm text-gray-900">Finished</label>
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id={`overall-${area.id}`}
                        name="useOverallFinishes"
                        checked={area.useOverallFinishes || false}
                        onChange={(e) => onUpdate(area.id, { ...area, useOverallFinishes: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`overall-${area.id}`} className="ml-2 block text-sm text-gray-900">Use Overall Finishes</label>
                </div>
            </div>
            {!area.useOverallFinishes && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border rounded-md bg-gray-50">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Wall Texture</label>
                        <select name="wallTexture" value={area.wallTexture || ''} onChange={(e) => onUpdate(area.id, { ...area, wallTexture: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                            <option value="">-- Select --</option>
                            {(finishes.wallTextures || []).filter(f => f.name).map(f => ( <option key={f.name} value={f.name}>{f.name}</option> ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Ceiling Texture</label>
                        <select name="ceilingTexture" value={area.ceilingTexture || ''} onChange={(e) => onUpdate(area.id, { ...area, ceilingTexture: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                            <option value="">-- Select --</option>
                            {(finishes.ceilingTextures || []).filter(f => f.name).map(f => ( <option key={f.name} value={f.name}>{f.name}</option> ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Corners</label>
                        <select name="corners" value={area.corners || ''} onChange={(e) => onUpdate(area.id, { ...area, corners: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                            <option value="">-- Select --</option>
                            {(finishes.corners || []).filter(f => f.name).map(f => ( <option key={f.name} value={f.name}>{f.name}</option> ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {area.materials.map(material => (
                    <MaterialItem 
                        key={material.materialId} 
                        material={material}
                        onUpdate={updateMaterialInArea}
                        onRemove={() => removeMaterialFromArea(material.materialId)}
                    />
                ))}
            </div>

            <button onClick={() => setIsModalOpen(true)} className="mt-4 w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg">
                + Add Material
            </button>
            {isModalOpen && (
                <MaterialSelectModal
                    db={db}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={addMaterialToArea}
                    existingMaterials={area.materials}
                />
            )}
        </div>
    );
};
