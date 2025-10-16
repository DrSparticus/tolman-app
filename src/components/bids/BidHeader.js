import React, { useState, useEffect, useRef } from 'react';
import { LocationControls, useLocationServices } from '../LocationServices';

// Component for inputs that defer updates until blur to prevent cursor jumping
const DeferredInput = React.memo(({ value, onBlur, onChange, ...inputProps }) => {
    const [localValue, setLocalValue] = useState(value || '');
    
    // Update local value when prop value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);
    
    const handleLocalChange = (e) => {
        setLocalValue(e.target.value);
        // Call onChange if provided (for special cases like notes with auto-resize)
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

export default function BidHeader({ bid, handleInputChange, supervisors, finishes, materials, crewTypes, crews = [], userPermissions = {}, db, locationSettings, onUpdateMaterialPricing }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const locationServices = useLocationServices(db, handleInputChange);
    const notesRef = useRef(null);
    const crewNotesRef = useRef(null);

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

    // Auto-resize crew notes field when content changes
    useEffect(() => {
        autoResizeTextarea(crewNotesRef.current);
    }, [bid.crewNotes]);

    // Auto-resize on mount
    useEffect(() => {
        autoResizeTextarea(notesRef.current);
        autoResizeTextarea(crewNotesRef.current);
    }, []);

    const handleNotesChange = (e) => {
        handleInputChange(e);
        autoResizeTextarea(e.target);
    };

    const handleCrewNotesChange = (e) => {
        handleInputChange(e);
        autoResizeTextarea(e.target);
    };

    const getCrewName = (crewId) => {
        const crew = crews.find(c => c.id === crewId);
        return crew?.name || 'Not assigned';
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
        
        // Check window wrap
        if (bid.windowWrap && finishes.windowWrap) {
            const windowWrap = finishes.windowWrap.find(f => f.name === bid.windowWrap);
            if (windowWrap && typeof windowWrap === 'object') {
                // Check if the crew for this finish is a taper crew
                const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                if (windowWrap.crew === taperCrewId) {
                    taperFinishesTotal += parseFloat(windowWrap.pay) || 0;
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
                    </div>
                </div>

                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${
                    (userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.viewStockDate) && 
                    (userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.changeStatus) 
                        ? 'xl:grid-cols-6' 
                        : (userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.viewStockDate) || 
                          (userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.changeStatus)
                            ? 'xl:grid-cols-5' 
                            : 'xl:grid-cols-4'
                }`}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Project Name</label>
                        <DeferredInput
                            type="text"
                            name="projectName"
                            value={bid.projectName}
                            onBlur={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter Project Name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Customer</label>
                        <DeferredInput
                            type="text"
                            name="contractor"
                            value={bid.contractor}
                            onBlur={handleInputChange}
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
                        <DeferredInput
                            type="text"
                            id="address"
                            name="address"
                            value={bid.address}
                            onBlur={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Project Address"
                        />
                        
                        {/* Location Details */}
                        {bid.coordinates && (
                            <div className="mt-2 text-xs text-gray-600">
                                <div className="flex items-center justify-between">
                                    <span>Coordinates: {bid.coordinates.lat.toFixed(6)}, {bid.coordinates.lng.toFixed(6)}</span>
                                    <div className="flex space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => locationServices.openInMaps(bid.coordinates)}
                                            className="text-blue-600 hover:text-blue-800 underline"
                                        >
                                            Map
                                        </button>
                                        <button
                                            type="button"
                                            onClick={locationServices.openManualCoordinateInput}
                                            className="text-purple-600 hover:text-purple-800 underline ml-2"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={locationServices.removeLocation}
                                            className="text-red-600 hover:text-red-800 underline ml-2"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                                {bid.salesTaxRate && (
                                    <div className="mt-1 text-green-600">
                                        Auto-calculated sales tax: {(bid.salesTaxRate * 100).toFixed(3)}%
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Supervisor field - hide if user is a supervisor */}
                    {userPermissions?.role !== 'supervisor' && (
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
                    )}
                    
                    {/* Material Stock Date - Show based on user permissions */}
                    {(userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.viewStockDate) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                            <DeferredInput 
                                type="date" 
                                name="materialStockDate" 
                                value={bid.materialStockDate || ''} 
                                onBlur={handleInputChange} 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                            />
                        </div>
                    )}

                    {/* Project Status - Show based on user permissions */}
                    {(userPermissions?.role === 'admin' || userPermissions?.permissions?.projects?.changeStatus) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Project Status</label>
                            <select
                                name="status"
                                value={bid.status || 'Bid'}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="Bid">Bid</option>
                                <option value="Stocked">Stocked</option>
                                <option value="Production">Production</option>
                                <option value="QC'd">QC'd</option>
                                <option value="Paid">Paid</option>
                                <option value="Completed">Completed</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Finishes Configuration - Basic View */}
                <div className="pt-4 mt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Finishes</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Window Wrap</label>
                            <select 
                                name="windowWrap" 
                                value={bid.windowWrap || ''} 
                                onChange={handleInputChange} 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select --</option>
                                {(finishes.windowWrap || []).map(f => (
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
                        <DeferredInput 
                            type="number" 
                            step="0.01" 
                            name="finishedHangingRate" 
                            value={bid.finishedHangingRate ?? ''} 
                            onBlur={handleInputChange} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                        {bid.hangCrew && (
                            <div className="mt-1 text-xs text-green-600 font-medium">
                                Assigned: {getCrewName(bid.hangCrew)}
                            </div>
                        )}
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
                        <DeferredInput 
                            type="number" 
                            step="0.01" 
                            name="finishedTapeRate" 
                            value={bid.autoTapeRate ? calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                            onBlur={handleInputChange}
                            disabled={bid.autoTapeRate}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                        {bid.tapeCrew && (
                            <div className="mt-1 text-xs text-green-600 font-medium">
                                Assigned: {getCrewName(bid.tapeCrew)}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                        <DeferredInput 
                            type="number" 
                            step="0.01" 
                            name="unfinishedTapingRate" 
                            value={bid.unfinishedTapingRate ?? ''} 
                            onBlur={handleInputChange} 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                </div>

                {/* Notes Field - Moved below labor rates */}
                <div className="pt-4 mt-4 border-t">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Bid Notes</label>
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
                    
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Crew Notes</label>
                        <textarea
                            ref={crewNotesRef}
                            name="crewNotes"
                            value={bid.crewNotes || ''}
                            onChange={handleCrewNotesChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none overflow-hidden"
                            placeholder="Enter notes for the crew..."
                            style={{ minHeight: '60px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Expand/Collapse Button */}
            <div className="px-6">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`w-full flex items-center justify-center py-3 text-sm font-medium transition-all duration-200 ${
                        isExpanded 
                            ? 'text-gray-600 hover:text-gray-800 bg-gray-50 border-t border-gray-200' 
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-t border-gray-200'
                    }`}
                >
                    <span className="mr-2">
                        {isExpanded ? 'Less Options' : 'More Options'}
                    </span>
                    <svg
                        className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Advanced View - Collapsible */}
            {isExpanded && (
                <div className="px-6 pb-6 bg-gray-50 border-t border-gray-200">
                    <div className="py-4">
                        <h3 className="text-md font-medium text-gray-800 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Advanced Options
                        </h3>
                        
                        {/* Miscellaneous Items */}
                        {finishes.miscellaneous && finishes.miscellaneous.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Miscellaneous Items</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {finishes.miscellaneous.map(misc => (
                                        <div key={misc.name}>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {misc.name} {misc.description ? `(${misc.description})` : '(Count)'}
                                            </label>
                                            <DeferredInput
                                                type="number"
                                                name={`misc_${misc.name.toLowerCase().replace(/\s+/g, '_')}`}
                                                value={bid[`misc_${misc.name.toLowerCase().replace(/\s+/g, '_')}`] || ''}
                                                onBlur={handleInputChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter count"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                    </div>
                </div>
            )}
        </div>
    );
}
