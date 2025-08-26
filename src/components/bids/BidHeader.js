import React, { useState, useEffect, useRef } from 'react';
import { LocationControls, useLocationServices } from '../LocationServices';

export default function BidHeader({ bid, handleInputChange, supervisors, finishes, materials, crewTypes, userPermissions = {}, db, locationSettings, onUpdateMaterialPricing }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const locationServices = useLocationServices(db, handleInputChange);
    const notesRef = useRef(null);

    // Auto-resize textarea function
    const autoResizeTextarea = (textarea) => {
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
        }
    };

    // Auto-resize notes field when content changes
    useEffect(() => {
        autoResizeTextarea(notesRef.current);
    }, [bid.notes]);

    // Auto-resize on mount
    useEffect(() => {
        autoResizeTextarea(notesRef.current);
    }, []);

    const handleNotesChange = (e) => {
        handleInputChange(e);
        autoResizeTextarea(e.target);
    };

    const calculateFinishedTapeRate = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || 0;
        const baseAddition = 0.04;
        
        // Calculate sum of pay rates for selected finishes that involve taper crew
        let taperFinishesTotal = 0;
        
        // Check wall texture
        if (bid.wallTexture && finishes.wallTextures) {
            const wallTexture = finishes.wallTextures.find(f => f.name === bid.wallTexture);
            if (wallTexture && typeof wallTexture === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (wallTexture.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(wallTexture.pay) || 0;
                }
            }
        }
        
        // Check ceiling texture
        if (bid.ceilingTexture && finishes.ceilingTextures) {
            const ceilingTexture = finishes.ceilingTextures.find(f => f.name === bid.ceilingTexture);
            if (ceilingTexture && typeof ceilingTexture === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (ceilingTexture.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(ceilingTexture.pay) || 0;
                }
            }
        }
        
        // Check corners
        if (bid.corners && finishes.corners) {
            const corners = finishes.corners.find(f => f.name === bid.corners);
            if (corners && typeof corners === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (corners.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(corners.pay) || 0;
                }
            }
        }
        
        // Add extra taper pay from materials used in bid
        let materialExtraPay = 0;
        if (bid.areas) {
            bid.areas.forEach(area => {
                if (area.materials) {
                    area.materials.forEach(areaMat => {
                        const material = materials?.find(m => m.id === areaMat.materialId);
                        if (material && material.extraLabor) {
                            const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                            const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                            if (taperExtra) {
                                materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                            }
                        }
                    });
                }
            });
        }
        
        return (hangRate + baseAddition + taperFinishesTotal + materialExtraPay).toFixed(3);
    };

    const handleAutoTapeRateChange = (e) => {
        const event = {
            target: {
                name: 'autoTapeRate',
                type: 'checkbox',
                checked: e.target.checked
            }
        };
        handleInputChange(event);
    };

    return (
        <div className="bg-white rounded-lg shadow-lg mb-6">
            {/* Basic View - Always Visible */}
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Project Information</h2>
                    <div className="flex items-center gap-4">
                        {/* Update Material Pricing Button */}
                        {bid.id && (userPermissions?.role === 'admin' || userPermissions?.permissions?.materials?.updatePricing) && onUpdateMaterialPricing && (
                            <button
                                type="button"
                                onClick={onUpdateMaterialPricing}
                                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                                title="Update material pricing to current rates"
                            >
                                Update Material Pricing
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            <span className="mr-2">{isExpanded ? 'Hide Advanced' : 'Show Advanced'}</span>
                            <svg
                                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Project Name</label>
                        <input
                            type="text"
                            name="projectName"
                            value={bid.projectName}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter Project Name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Customer</label>
                        <input
                            type="text"
                            name="contractor"
                            value={bid.contractor}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Customer Name"
                        />
                    </div>
                    <div>
                        <LocationControls 
                            bid={bid}
                            locationSettings={locationSettings}
                            locationServices={locationServices}
                        />
                        <input
                            type="text"
                            name="address"
                            value={bid.address}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Project Address"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Supervisor</label>
                        <select 
                            name="supervisor" 
                            value={bid.supervisor || ''} 
                            onChange={handleInputChange} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Select a Supervisor --</option>
                            {supervisors.map(sup => (
                                <option key={sup.id} value={sup.id}>
                                    {sup.firstName} {sup.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Finishes Configuration - Basic View */}
                <div className="pt-4 mt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Finishes</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Wall Texture</label>
                            <select 
                                name="wallTexture" 
                                value={bid.wallTexture || ''} 
                                onChange={handleInputChange} 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.wallTextures || []).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ceiling Texture</label>
                            <select 
                                name="ceilingTexture" 
                                value={bid.ceilingTexture || ''} 
                                onChange={handleInputChange} 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.ceilingTextures || []).filter(f => f.name).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Corners</label>
                            <select 
                                name="corners" 
                                value={bid.corners || ''} 
                                onChange={handleInputChange} 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.corners || []).map(f => (
                                    <option key={f.name} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Basic Labor Rates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 mt-4 border-t">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hang Labor Rate</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            name="finishedHangingRate" 
                            value={bid.finishedHangingRate ?? ''} 
                            onChange={handleInputChange} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">Tape Labor Rate</label>
                            <div className="flex items-center">
                                <input 
                                    id="auto-tape-rate" 
                                    name="autoTapeRate" 
                                    type="checkbox" 
                                    checked={bid.autoTapeRate ?? true}
                                    onChange={handleAutoTapeRateChange}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                />
                                <label htmlFor="auto-tape-rate" className="ml-1 text-xs text-gray-600">Auto</label>
                            </div>
                        </div>
                        <input 
                            type="number" 
                            step="0.01" 
                            name="finishedTapeRate" 
                            value={bid.autoTapeRate ? calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                            onChange={handleInputChange}
                            disabled={bid.autoTapeRate}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            name="unfinishedTapingRate" 
                            value={bid.unfinishedTapingRate ?? ''} 
                            onChange={handleInputChange} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                </div>

                {/* Notes Field - Moved below labor rates */}
                <div className="pt-4 mt-4 border-t">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea
                            ref={notesRef}
                            name="notes"
                            value={bid.notes || ''}
                            onChange={handleNotesChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none overflow-hidden"
                            placeholder="Enter project notes..."
                            style={{ minHeight: '60px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Advanced View - Collapsible */}
            {isExpanded && (
                <div className="px-6 pb-6 border-t bg-gray-50">
                    <div className="py-4">
                        <h3 className="text-md font-medium text-gray-800 mb-4">Advanced Settings</h3>
                        
                        {/* Miscellaneous Items */}
                        {finishes.miscellaneous && finishes.miscellaneous.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Miscellaneous Items</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {finishes.miscellaneous.map(misc => (
                                        <div key={misc.name}>
                                            <label className="block text-sm font-medium text-gray-700">{misc.name} (Count)</label>
                                            <input
                                                type="number"
                                                name={`misc_${misc.name.toLowerCase().replace(/\s+/g, '_')}`}
                                                value={bid[`misc_${misc.name.toLowerCase().replace(/\s+/g, '_')}`] || ''}
                                                onChange={handleInputChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter count"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Project Conversion */}
                        {bid.status === 'bid' && (
                            <div className="mt-6 pt-4 border-t">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Project Conversion</h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                                    <p className="text-xs text-gray-500 mb-2">Setting this date will convert the bid into a project and assign a new job number.</p>
                                    <input 
                                        type="date" 
                                        name="materialStockDate" 
                                        value={bid.materialStockDate || ''} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 max-w-xs" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
