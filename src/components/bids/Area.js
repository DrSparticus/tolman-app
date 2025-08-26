import React, { useState, useCallback, useEffect } from 'react';
import MaterialSelectModal from './MaterialSelectModal';

// Component for inputs that defer updates until blur to prevent cursor jumping
const DeferredInput = React.memo(({ value, onBlur, ...inputProps }) => {
    const [localValue, setLocalValue] = useState(value || '');
    
    // Update local value when prop value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);
    
    const handleLocalChange = (e) => {
        setLocalValue(e.target.value);
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

export default function Area({ area, onUpdate, onRemove, db, isOnlyArea, finishes, bid, crewTypes, materials }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Handle name change
    const handleNameChange = (e) => {
        onUpdate({ ...area, name: e.target.value });
    };

    // Handle vault heights change
    const handleVaultHeightsChange = (e) => {
        onUpdate({ ...area, vaultHeights: e.target.value });
    };

    // Handle overall labor checkbox
    const handleUseOverallLaborChange = (checked) => {
        const updates = { ...area, useOverallLabor: checked };
        
        // If unchecking "Use Overall Labor Rates", fill in the current bid header hang rate
        if (!checked && bid?.finishedHangingRate) {
            updates.hangRate = bid.finishedHangingRate;
        }
        
        onUpdate(updates);
    };

    // Calculate total square feet for this area
    const totalSqFt = React.useMemo(() => {
        if (!area.materials || area.materials.length === 0) return 0;
        return area.materials.reduce((total, material) => {
            if (!material.variants) return total;
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

    // Calculate area tape rate
    const calculateAreaTapeRate = useCallback(() => {
        if (!area.useOverallLabor && !area.autoTapeRate) {
            return area.tapeRate;
        }
        
        // Get hang rate from Hanger crew or bid/area
        let hangRate = 0;
        if (area.useOverallLabor) {
            hangRate = parseFloat(bid?.finishedHangingRate) || 0;
            // If no bid rate, try to get from Hanger crew
            if (!hangRate) {
                const hangerCrew = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'));
                hangRate = parseFloat(hangerCrew?.rates?.hang) || 0;
            }
        } else {
            hangRate = parseFloat(area.hangRate) || 0;
        }
        
        const baseAddition = 0.04;
        
        let taperFinishesTotal = 0;
        const wallTexture = area.useOverallFinishes ? bid?.wallTexture : area.wallTexture;
        const ceilingTexture = area.useOverallFinishes ? bid?.ceilingTexture : area.ceilingTexture;
        const corners = area.useOverallFinishes ? bid?.corners : area.corners;
        
        // Calculate taper pay from finishes
        if (wallTexture && finishes?.wallTextures) {
            const wt = finishes.wallTextures.find(f => f.name === wallTexture);
            if (wt && typeof wt === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (wt.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(wt.pay) || 0;
                }
            }
        }
        if (ceilingTexture && finishes?.ceilingTextures) {
            const ct = finishes.ceilingTextures.find(f => f.name === ceilingTexture);
            if (ct && typeof ct === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (ct.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(ct.pay) || 0;
                }
            }
        }
        if (corners && finishes?.corners) {
            const c = finishes.corners.find(f => f.name === corners);
            if (c && typeof c === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (c.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(c.pay) || 0;
                }
            }
        }
        
        // Add extra taper pay from materials used in this area
        let materialExtraPay = 0;
        if (area.materials && crewTypes && materials) {
            const taperCrewId = crewTypes.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
            area.materials.forEach(areaMat => {
                const material = materials.find(m => m.id === areaMat.materialId);
                if (material && material.extraLabor) {
                    const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                    if (taperExtra) {
                        materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                    }
                }
            });
        }
        
        return (hangRate + baseAddition + taperFinishesTotal + materialExtraPay).toFixed(3);
    }, [area, bid, finishes, crewTypes, materials]);

    // Add material to area
    const addMaterialToArea = (newMaterial) => {
        const updatedMaterials = [...(area.materials || []), newMaterial];
        onUpdate({ ...area, materials: updatedMaterials });
    };

    // Remove material from area
    const removeMaterial = (index) => {
        const updatedMaterials = area.materials.filter((_, i) => i !== index);
        onUpdate({ ...area, materials: updatedMaterials });
    };

    const updateVariantQuantity = (materialIndex, variantId, newQuantity) => {
        const updatedMaterials = [...area.materials];
        const material = updatedMaterials[materialIndex];
        
        // Ensure variants array exists
        if (!material.variants) {
            material.variants = [];
        }
        
        // Find existing variant or create new one
        const existingVariantIndex = material.variants.findIndex(v => v.id === variantId);
        
        if (existingVariantIndex >= 0) {
            // Update existing variant
            material.variants[existingVariantIndex] = {
                ...material.variants[existingVariantIndex],
                quantity: newQuantity
            };
        } else {
            // Add new variant with quantity
            const fullMaterial = materials?.find(m => m.id === material.materialId);
            const materialVariant = fullMaterial?.variants?.find(v => v.id === variantId);
            
            if (materialVariant) {
                material.variants.push({
                    ...materialVariant,
                    quantity: newQuantity
                });
            }
        }
        
        // Remove variants with 0 quantity to keep data clean
        material.variants = material.variants.filter(v => (v.quantity || 0) > 0);
        
        onUpdate({ ...area, materials: updatedMaterials });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-y-2 mb-4">
                <div className="flex flex-col flex-grow min-w-[100px]">
                    <DeferredInput
                        type="text"
                        value={area.name || ''}
                        onBlur={handleNameChange}
                        className="text-xl font-bold border-2 border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors mb-2"
                        placeholder="Enter area name..."
                    />
                    <DeferredInput
                        type="text"
                        value={area.vaultHeights || ''}
                        onBlur={handleVaultHeightsChange}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:border-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors"
                        placeholder="Vault heights (e.g., 9', 10', 12')..."
                    />
                </div>
                <div className="flex items-center space-x-4 ml-4">
                    {totalSqFt > 0 && (
                        <span className="text-lg font-semibold text-blue-600 whitespace-nowrap">
                            {parseFloat(totalSqFt.toFixed(2))} sq. ft.
                        </span>
                    )}
                    {!isOnlyArea && (
                        <button 
                            onClick={onRemove} 
                            className="text-red-500 hover:text-red-700 font-semibold whitespace-nowrap"
                        >
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
                        checked={area.isFinished || false}
                        onChange={(e) => onUpdate({ ...area, isFinished: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`finished-${area.id}`} className="ml-2 block text-sm text-gray-900">
                        Finished
                    </label>
                </div>

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id={`overall-finishes-${area.id}`}
                        checked={area.useOverallFinishes || false}
                        onChange={(e) => onUpdate({ ...area, useOverallFinishes: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`overall-finishes-${area.id}`} className="ml-2 block text-sm text-gray-900">
                        Use Overall Finishes
                    </label>
                </div>

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id={`useOverallLabor-${area.id}`}
                        checked={area.useOverallLabor ?? true}
                        onChange={(e) => handleUseOverallLaborChange(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`useOverallLabor-${area.id}`} className="ml-2 text-sm font-medium text-gray-700">
                        Use Overall Labor Rates
                    </label>
                </div>
            </div>

            {/* Finishes Section */}
            {!area.useOverallFinishes && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border rounded-md bg-gray-50">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Wall Texture</label>
                        <select 
                            value={area.wallTexture || ''} 
                            onChange={(e) => onUpdate({ ...area, wallTexture: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Select --</option>
                            {(finishes?.wallTextures || []).map(f => (
                                <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Ceiling Texture</label>
                        <select 
                            value={area.ceilingTexture || ''} 
                            onChange={(e) => onUpdate({ ...area, ceilingTexture: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Select --</option>
                            {(finishes?.ceilingTextures || []).filter(f => f.name).map(f => (
                                <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Corners</label>
                        <select 
                            value={area.corners || ''} 
                            onChange={(e) => onUpdate({ ...area, corners: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Select --</option>
                            {(finishes?.corners || []).filter(f => f.name).map(f => (
                                <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Labor Override Section */}
            {!area.useOverallLabor && (
                <div className="space-y-4 pt-4 border-t border-gray-200 mb-4">
                    <h4 className="font-medium text-gray-700">Area-Specific Labor Rates</h4>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hang Rate</label>
                        <DeferredInput
                            type="number"
                            step="0.01"
                            value={area.hangRate || ''}
                            onBlur={(e) => onUpdate({ ...area, hangRate: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3"
                        />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Finished Tape Rate</label>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={area.autoTapeRate ?? true}
                                    onChange={(e) => onUpdate({ ...area, autoTapeRate: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <label className="ml-2 text-sm font-medium text-gray-700">Auto</label>
                            </div>
                        </div>
                        <DeferredInput
                            type="number"
                            step="0.01"
                            value={area.autoTapeRate ? calculateAreaTapeRate() : (area.tapeRate || '')}
                            onBlur={(e) => onUpdate({ ...area, tapeRate: e.target.value })}
                            disabled={area.autoTapeRate}
                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 disabled:bg-gray-100"
                        />
                    </div>
                </div>
            )}

            {/* Materials Section */}
            <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Materials</h4>
                {area.materials?.map((areaMaterial, materialIndex) => {
                    const material = materials?.find(m => m.id === areaMaterial.materialId);
                    if (!material) return null;

                    // Ensure we have all variants from the material with quantities
                    const materialVariants = material.variants || [];
                    const areaVariants = areaMaterial.variants || [];
                    
                    // Merge material variants with area quantities
                    const displayVariants = materialVariants.map(materialVariant => {
                        const existingVariant = areaVariants.find(av => av.id === materialVariant.id);
                        return {
                            ...materialVariant,
                            quantity: existingVariant?.quantity || 0
                        };
                    });

                    return (
                        <div key={materialIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="font-medium text-gray-800">{material.name}</h5>
                                <button
                                    onClick={() => removeMaterial(materialIndex)}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                >
                                    Remove
                                </button>
                            </div>

                            {/* Size Variants with Counters */}
                            <div className="space-y-2">
                                {displayVariants.map((variant) => {
                                    // Format dimensions without showing zeros
                                    const formatDimension = (ft, inch) => {
                                        const parts = [];
                                        if (ft && parseFloat(ft) > 0) parts.push(`${ft}'`);
                                        if (inch && parseFloat(inch) > 0) parts.push(`${inch}"`);
                                        return parts.join('');
                                    };

                                    const widthDisplay = formatDimension(variant.widthFt, variant.widthIn);
                                    const lengthDisplay = formatDimension(variant.lengthFt, variant.lengthIn);
                                    
                                    // Only show if we have at least one dimension
                                    if (!widthDisplay && !lengthDisplay) return null;
                                    
                                    const sizeDisplay = widthDisplay && lengthDisplay 
                                        ? `${widthDisplay} × ${lengthDisplay}`
                                        : widthDisplay || lengthDisplay;

                                    return (
                                        <div key={variant.id} className="flex items-center justify-between bg-white p-3 rounded border">
                                            <div className="flex-1">
                                                <div className="font-medium text-sm text-gray-800">{sizeDisplay}</div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2 ml-4">
                                                <button
                                                    type="button"
                                                    onClick={() => updateVariantQuantity(materialIndex, variant.id, Math.max(0, (variant.quantity || 0) - 1))}
                                                    className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center font-bold text-lg"
                                                >
                                                    −
                                                </button>
                                                
                                                <DeferredInput
                                                    type="number"
                                                    min="0"
                                                    value={variant.quantity || 0}
                                                    onBlur={(e) => updateVariantQuantity(materialIndex, variant.id, Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm font-medium"
                                                />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => updateVariantQuantity(materialIndex, variant.id, (variant.quantity || 0) + 1)}
                                                    className="w-8 h-8 bg-green-100 hover:bg-green-200 text-green-600 rounded-full flex items-center justify-center font-bold text-lg"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button 
                onClick={() => setIsModalOpen(true)} 
                className="mt-4 w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg"
            >
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
}
