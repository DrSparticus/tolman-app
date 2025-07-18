import React, { useState, useEffect } from 'react';

export default function BidMaterials({ bid, materials, onMaterialsChange }) {
    const [bidMaterials, setBidMaterials] = useState(bid.materials || []);
    const [dependentMaterials, setDependentMaterials] = useState([]);

    // Calculate dependent materials when primary materials change
    useEffect(() => {
        calculateDependentMaterials();
    }, [bidMaterials]);

    const calculateDependentMaterials = () => {
        const calculated = [];
        
        bidMaterials.forEach(material => {
            const materialData = materials.find(m => m.id === material.materialId);
            if (materialData && materialData.category) {
                // Check global dependencies
                const globalDeps = getGlobalDependencies(materialData.category);
                globalDeps.forEach(dep => {
                    if (!materialData.overrideDependencies) {
                        const quantity = calculateDependentQuantity(material.quantity, dep.ratio);
                        calculated.push({
                            materialId: dep.dependentMaterialId,
                            quantity: quantity,
                            source: 'dependency',
                            parentMaterialId: material.materialId
                        });
                    }
                });

                // Check material-specific dependencies
                if (materialData.dependencies) {
                    materialData.dependencies.forEach(dep => {
                        const quantity = calculateDependentQuantity(material.quantity, dep.ratio);
                        calculated.push({
                            materialId: dep.dependentMaterialId,
                            quantity: quantity,
                            source: 'dependency',
                            parentMaterialId: material.materialId
                        });
                    });
                }
            }
        });

        setDependentMaterials(calculated);
    };

    const calculateDependentQuantity = (primaryQuantity, ratio) => {
        return Math.ceil(primaryQuantity / ratio);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Materials</h3>
            
            {/* Primary Materials */}
            <div className="mb-6">
                <h4 className="text-md font-medium mb-2">Primary Materials</h4>
                {bidMaterials.map((material, index) => (
                    <MaterialRow
                        key={index}
                        material={material}
                        materials={materials}
                        onUpdate={(updatedMaterial) => updateMaterial(index, updatedMaterial)}
                        onRemove={() => removeMaterial(index)}
                    />
                ))}
            </div>

            {/* Dependent Materials */}
            {dependentMaterials.length > 0 && (
                <div className="mb-6">
                    <h4 className="text-md font-medium mb-2 text-blue-600">Dependent Materials (Auto-calculated)</h4>
                    {dependentMaterials.map((material, index) => (
                        <DependentMaterialRow
                            key={index}
                            material={material}
                            materials={materials}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}