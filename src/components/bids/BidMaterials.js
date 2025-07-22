import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { loadDynamicDependencies, calculateDependentQuantity } from '../../utils/materialDependencies';

export default function BidMaterials({ bid, materials, onMaterialsChange, crewTypes }) {
    const [bidMaterials, setBidMaterials] = useState(bid.materials || []);
    const [dependentMaterials, setDependentMaterials] = useState([]);
    const [materialTotals, setMaterialTotals] = useState({});
    const [laborBreakdown, setLaborBreakdown] = useState({});
    const [dependencies, setDependencies] = useState({});

    // Load dependencies once
    useEffect(() => {
        const loadDeps = async () => {
            const deps = await loadDynamicDependencies();
            setDependencies(deps);
        };
        loadDeps();
    }, []);

    // Memoize crew IDs to prevent unnecessary recalculations
    const crewIds = useMemo(() => ({
        hanging: crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id,
        taper: crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id
    }), [crewTypes]);

    // Memoize material totals calculation
    const materialTotalsCalc = useMemo(() => {
        let totalSqFt = 0;
        let finishedSqFt = 0;
        let unfinishedSqFt = 0;
        let secondLayerSqFt = 0;
        let furringLinearFt = 0;

        bidMaterials.forEach(bidMat => {
            const material = materials.find(m => m.id === bidMat.materialId);
            if (material) {
                const sqFt = parseFloat(bidMat.quantity) || 0;
                
                if (material.category === 'drywall-board') {
                    totalSqFt += sqFt;
                    if (bidMat.laborType === 'finished') {
                        finishedSqFt += sqFt;
                    } else {
                        unfinishedSqFt += sqFt;
                    }
                } else if (material.category === '2nd-layer-board') {
                    secondLayerSqFt += sqFt;
                    totalSqFt += sqFt;
                } else if (material.name && material.name.includes('RC1 Furring')) {
                    furringLinearFt += sqFt;
                }
            }
        });

        return {
            totalSqFt,
            finishedSqFt,
            unfinishedSqFt,
            secondLayerSqFt,
            furringLinearFt
        };
    }, [bidMaterials, materials]);

    // Memoize labor breakdown calculation
    const laborBreakdownCalc = useMemo(() => {
        let hangingLabor = 0;
        let tapingLabor = 0;
        let hangingSqFt = 0;
        let tapingSqFt = 0;

        bidMaterials.forEach(bidMat => {
            const material = materials.find(m => m.id === bidMat.materialId);
            if (material) {
                const sqFt = parseFloat(bidMat.quantity) || 0;
                const hangRate = parseFloat(bid.finishedHangingRate) || 0;
                const tapeRate = parseFloat(bid.finishedTapeRate) || 0;

                if (material.category === 'drywall-board' || material.category === '2nd-layer-board') {
                    hangingLabor += sqFt * hangRate;
                    hangingSqFt += sqFt;
                    
                    if (bidMat.laborType === 'finished') {
                        tapingLabor += sqFt * tapeRate;
                        tapingSqFt += sqFt;
                    }
                }

                if (material.extraLabor) {
                    material.extraLabor.forEach(extra => {
                        if (extra.crewType === crewIds.hanging) {
                            hangingLabor += sqFt * (parseFloat(extra.extraPay) || 0);
                        } else if (extra.crewType === crewIds.taper) {
                            tapingLabor += sqFt * (parseFloat(extra.extraPay) || 0);
                        }
                    });
                }
            }
        });

        return {
            hanging: { labor: hangingLabor, sqFt: hangingSqFt, crewId: crewIds.hanging },
            taping: { labor: tapingLabor, sqFt: tapingSqFt, crewId: crewIds.taper }
        };
    }, [bidMaterials, materials, bid.finishedHangingRate, bid.finishedTapeRate, crewIds]);

    // Calculate dependent materials
    const dependentMaterialsCalc = useMemo(() => {
        const deps = [];
        const variables = {
            totalSqFt: materialTotalsCalc.totalSqFt,
            finishedSqFt: materialTotalsCalc.finishedSqFt,
            unfinishedSqFt: materialTotalsCalc.unfinishedSqFt,
            secondLayerSqFt: materialTotalsCalc.secondLayerSqFt,
            furringLinearFt: materialTotalsCalc.furringLinearFt
        };

        Object.keys(dependencies).forEach(depMaterialName => {
            const dependency = dependencies[depMaterialName];
            const quantity = calculateDependentQuantity(dependency.formula, variables);
            
            if (quantity > 0) {
                const depMaterial = materials.find(m => m.name === depMaterialName);
                if (depMaterial) {
                    deps.push({
                        materialId: depMaterial.id,
                        materialName: depMaterialName,
                        quantity: dependency.roundUp ? Math.ceil(quantity) : quantity,
                        source: 'dependency',
                        appliesTo: dependency.appliesTo,
                        condition: dependency.condition
                    });
                }
            }
        });

        return deps;
    }, [dependencies, materialTotalsCalc, materials]);

    // Update state when calculations change
    useEffect(() => {
        setMaterialTotals(materialTotalsCalc);
        setLaborBreakdown(laborBreakdownCalc);
        setDependentMaterials(dependentMaterialsCalc);
    }, [materialTotalsCalc, laborBreakdownCalc, dependentMaterialsCalc]);

    // Optimize callbacks
    const updateMaterial = useCallback((index, field, value) => {
        const updated = [...bidMaterials];
        updated[index][field] = value;
        setBidMaterials(updated);
        onMaterialsChange(updated);
    }, [bidMaterials, onMaterialsChange]);

    const removeMaterial = useCallback((index) => {
        const updated = bidMaterials.filter((_, i) => i !== index);
        setBidMaterials(updated);
        onMaterialsChange(updated);
    }, [bidMaterials, onMaterialsChange]);

    const addMaterial = useCallback(() => {
        const newMaterials = [...bidMaterials, {
            materialId: '',
            quantity: '',
            laborType: 'finished',
            location: 'house'
        }];
        setBidMaterials(newMaterials);
        onMaterialsChange(newMaterials);
    }, [bidMaterials, onMaterialsChange]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Materials</h3>
                <button
                    onClick={addMaterial}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                    Add Material
                </button>
            </div>

            {/* Primary Materials */}
            <div className="mb-6">
                <h4 className="text-md font-medium mb-2">Primary Materials</h4>
                <div className="space-y-2">
                    {bidMaterials.map((bidMat, index) => (
                        <div key={index} className="grid grid-cols-6 gap-4 p-3 border rounded">
                            <div>
                                <select
                                    value={bidMat.materialId}
                                    onChange={(e) => updateMaterial(index, 'materialId', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md py-2 px-3"
                                >
                                    <option value="">Select Material</option>
                                    {materials.map(material => (
                                        <option key={material.id} value={material.id}>
                                            {material.name} ({material.category?.replace('-', ' ')})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <input
                                    type="number"
                                    placeholder="Quantity"
                                    value={bidMat.quantity}
                                    onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md py-2 px-3"
                                />
                            </div>
                            <div>
                                <select
                                    value={bidMat.laborType}
                                    onChange={(e) => updateMaterial(index, 'laborType', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md py-2 px-3"
                                >
                                    <option value="finished">Finished</option>
                                    <option value="unfinished">Unfinished</option>
                                </select>
                            </div>
                            <div>
                                <select
                                    value={bidMat.location}
                                    onChange={(e) => updateMaterial(index, 'location', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md py-2 px-3"
                                >
                                    <option value="house">House</option>
                                    <option value="garage">Garage</option>
                                    <option value="bonus">Bonus</option>
                                    <option value="upper">Upper</option>
                                    <option value="lower">Lower</option>
                                </select>
                            </div>
                            <div className="text-sm text-gray-600 py-2">
                                {(() => {
                                    const material = materials.find(m => m.id === bidMat.materialId);
                                    return material ? material.unit : '';
                                })()}
                            </div>
                            <div>
                                <button
                                    onClick={() => removeMaterial(index)}
                                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dependent Materials */}
            {dependentMaterials.length > 0 && (
                <div className="mb-6">
                    <h4 className="text-md font-medium mb-2 text-blue-600">
                        Dependent Materials (Auto-calculated)
                    </h4>
                    <div className="bg-blue-50 p-4 rounded">
                        {dependentMaterials.map((depMat, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                                <span className="font-medium">{depMat.materialName}</span>
                                <span className="text-blue-600">
                                    {depMat.quantity} {materials.find(m => m.id === depMat.materialId)?.unit || ''}
                                </span>
                                <span className="text-sm text-gray-500">
                                    ({depMat.appliesTo.join(', ')})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Material Totals Summary */}
            <div className="bg-gray-50 p-4 rounded">
                <h4 className="text-md font-medium mb-2">Material Totals</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Total Sq Ft:</span>
                        <div>{materialTotals.totalSqFt || 0}</div>
                    </div>
                    <div>
                        <span className="font-medium">Finished Sq Ft:</span>
                        <div>{materialTotals.finishedSqFt || 0}</div>
                    </div>
                    <div>
                        <span className="font-medium">Unfinished Sq Ft:</span>
                        <div>{materialTotals.unfinishedSqFt || 0}</div>
                    </div>
                    <div>
                        <span className="font-medium">2nd Layer Sq Ft:</span>
                        <div>{materialTotals.secondLayerSqFt || 0}</div>
                    </div>
                </div>
            </div>

            {/* Labor Breakdown Summary */}
            <div className="bg-green-50 p-4 rounded mt-4">
                <h4 className="text-md font-medium mb-2 text-green-700">Labor Breakdown</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Hanging Labor:</span>
                        <div>${laborBreakdown.hanging?.labor?.toFixed(2) || 0} ({laborBreakdown.hanging?.sqFt || 0} sq ft)</div>
                    </div>
                    <div>
                        <span className="font-medium">Taping Labor:</span>
                        <div>${laborBreakdown.taping?.labor?.toFixed(2) || 0} ({laborBreakdown.taping?.sqFt || 0} sq ft)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}