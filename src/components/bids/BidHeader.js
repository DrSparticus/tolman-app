import React, { useState, useEffect } from 'react';

export default function BidHeader({ bid, handleInputChange, supervisors, finishes }) {
    const calculateFinishedTapeRate = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || 0;
        const baseAddition = 0.04;
        
        // Calculate sum of pay rates for selected finishes that involve taper crew
        let taperFinishesTotal = 0;
        
        // Check wall texture
        if (bid.wallTexture && finishes.wallTextures) {
            const wallTexture = finishes.wallTextures.find(f => f.name === bid.wallTexture);
            if (wallTexture && wallTexture.involvesTaper) {
                taperFinishesTotal += parseFloat(wallTexture.payRate) || 0;
            }
        }
        
        // Check ceiling texture
        if (bid.ceilingTexture && finishes.ceilingTextures) {
            const ceilingTexture = finishes.ceilingTextures.find(f => f.name === bid.ceilingTexture);
            if (ceilingTexture && ceilingTexture.involvesTaper) {
                taperFinishesTotal += parseFloat(ceilingTexture.payRate) || 0;
            }
        }
        
        // Check corners
        if (bid.corners && finishes.corners) {
            const corners = finishes.corners.find(f => f.name === bid.corners);
            if (corners && corners.involvesTaper) {
                taperFinishesTotal += parseFloat(corners.payRate) || 0;
            }
        }
        
        return (hangRate + baseAddition + taperFinishesTotal).toFixed(3);
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
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
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
                    <label className="block text-sm font-medium text-gray-700">Contractor</label>
                    <input
                        type="text"
                        name="contractor"
                        value={bid.contractor}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Contractor Name"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
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
                    <select name="supervisor" value={bid.supervisor || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                        <option value="">-- Select a Supervisor --</option>
                        {supervisors.map(sup => (<option key={sup.id} value={sup.id}> {sup.firstName} {sup.lastName} </option>))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4 mt-4 border-t">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Hang Rate</label>
                    <input type="number" step="0.001" name="finishedHangingRate" value={bid.finishedHangingRate ?? ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                </div>
                 <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Finished Tape Rate</label>
                        <div className="flex items-center">
                            <input 
                                id="auto-tape-rate" 
                                name="autoTapeRate" 
                                type="checkbox" 
                                checked={bid.autoTapeRate ?? true}
                                onChange={handleAutoTapeRateChange}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                            />
                            <label htmlFor="auto-tape-rate" className="ml-2 text-sm font-medium text-gray-700">Auto</label>
                        </div>
                    </div>
                    <input 
                        type="number" 
                        step="0.001" 
                        name="finishedTapeRate" 
                        value={bid.autoTapeRate ? calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                        onChange={handleInputChange}
                        disabled={bid.autoTapeRate}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                    <input type="number" step="0.001" name="unfinishedTapingRate" value={bid.unfinishedTapingRate ?? ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 mt-4 border-t">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Wall Texture</label>
                    <select name="wallTexture" value={bid.wallTexture || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                        <option value="">-- Select --</option>
                        {(finishes.wallTextures || []).map(f => (<option key={f.name} value={f.name}>{f.name}</option>))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Ceiling Texture</label>
                    <select name="ceilingTexture" value={bid.ceilingTexture || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                        <option value="">-- Select --</option>
                        {(finishes.ceilingTextures || []).filter(f => f.name).map(f => (<option key={f.name} value={f.name}>{f.name}</option>))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Corners</label>
                    <select name="corners" value={bid.corners || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" >
                        <option value="">-- Select --</option>
                        {(finishes.corners || []).map(f => (<option key={f.name} value={f.name}>{f.name}</option>))}
                    </select>
                </div>
            </div>
            
            {bid.status === 'bid' && (
                <div className="pt-4 mt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                    <p className="text-xs text-gray-500 mb-1">Setting this date will convert the bid into a project and assign a new job number.</p>
                    <input type="date" name="materialStockDate" value={bid.materialStockDate || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                </div>
            )}
        </div>
    );
}
