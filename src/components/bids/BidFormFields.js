import React from 'react';
import { LocationControls } from '../LocationServices';

export const BidFormFields = React.memo(({ 
    bid, 
    handleInputChange, 
    supervisors, 
    finishes, 
    locationSettings, 
    locationServices, 
    rateCalculations,
    headerConfig,
    getLayoutClass
}) => {
    
    const renderField = (fieldName) => {
        switch (fieldName) {
            case 'projectName':
                return (
                    <div key={fieldName}>
                        <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Project Name</label>
                        <input
                            id="projectName"
                            type="text"
                            name="projectName"
                            value={bid.projectName || ''}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
                
            case 'contractor':
                return (
                    <div key={fieldName}>
                        <label htmlFor="contractor" className="block text-sm font-medium text-gray-700">Contractor</label>
                        <input
                            id="contractor"
                            type="text"
                            name="contractor"
                            value={bid.contractor || ''}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
                
            case 'address':
                return (
                    <div key={fieldName}>
                        <LocationControls 
                            bid={bid}
                            locationSettings={locationSettings}
                            locationServices={locationServices}
                        />
                        <input
                            id="address"
                            type="text"
                            name="address"
                            value={bid.address || ''}
                            onChange={handleInputChange}
                            autoComplete="address-line1"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter address or use current location"
                        />
                        {locationSettings.enableLocationServices && !bid.address && !bid.coordinates && (
                            <div className="mt-2 text-xs text-gray-500">
                                <button
                                    type="button"
                                    onClick={locationServices.openManualCoordinateInput}
                                    className="text-purple-600 hover:text-purple-800 underline"
                                >
                                    📝 Enter coordinates manually
                                </button>
                            </div>
                        )}
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
                );
                
            case 'supervisor':
                return (
                    <div key={fieldName}>
                        <label htmlFor="supervisor" className="block text-sm font-medium text-gray-700">Supervisor</label>
                        <select
                            id="supervisor"
                            name="supervisor"
                            value={bid.supervisor || ''}
                            onChange={handleInputChange}
                            autoComplete="off"
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
                );
                
            default:
                return null;
        }
    };

    const RatesSection = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4 mt-4 border-t">
            <div>
                <label htmlFor="finishedHangingRate" className="block text-sm font-medium text-gray-700">Hang Rate</label>
                <input
                    id="finishedHangingRate"
                    type="number"
                    step="0.01"
                    name="finishedHangingRate"
                    value={bid.finishedHangingRate ?? ''}
                    placeholder={rateCalculations.defaultRates.hangRate || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {rateCalculations.getHangRateUpgrades() && (
                    <div className="text-xs text-gray-500 mt-1">
                        {rateCalculations.getHangRateUpgrades()}
                    </div>
                )}
            </div>
            
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor="finishedTapeRate" className="block text-sm font-medium text-gray-700">Finished Tape Rate</label>
                    <div className="flex items-center">
                        <input
                            id="autoTapeRate"
                            type="checkbox"
                            name="autoTapeRate"
                            checked={bid.autoTapeRate ?? true}
                            onChange={(e) => {
                                const isAuto = e.target.checked;
                                handleInputChange({
                                    target: { name: 'autoTapeRate', type: 'checkbox', checked: isAuto }
                                });
                                if (isAuto) {
                                    const newRate = rateCalculations.calculateFinishedTapeRate();
                                    handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
                                }
                            }}
                            autoComplete="off"
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="autoTapeRate" className="ml-2 text-sm font-medium text-gray-700">Auto</label>
                    </div>
                </div>
                <input
                    id="finishedTapeRate"
                    type="number"
                    step="0.01"
                    name="finishedTapeRate"
                    value={bid.autoTapeRate ? rateCalculations.calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                    onChange={bid.autoTapeRate ? undefined : handleInputChange}
                    disabled={bid.autoTapeRate}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    title={bid.autoTapeRate ? rateCalculations.getFinishedTapeRateBreakdown() : ''}
                />
                {bid.autoTapeRate && (
                    <div className="text-xs text-gray-500 mt-1">
                        {rateCalculations.getFinishedTapeRateBreakdown()}
                    </div>
                )}
            </div>
            
            <div>
                <label htmlFor="unfinishedTapingRate" className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                <input
                    id="unfinishedTapingRate"
                    type="number"
                    step="0.01"
                    name="unfinishedTapingRate"
                    value={bid.unfinishedTapingRate ?? ''}
                    placeholder={rateCalculations.defaultRates.unfinishedTapeRate || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
        </div>
    );

    const FinishesSection = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 mt-4 border-t">
            <div>
                <label htmlFor="wallTexture" className="block text-sm font-medium text-gray-700">Wall Texture</label>
                <select
                    id="wallTexture"
                    name="wallTexture"
                    value={bid.wallTexture || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select --</option>
                    {(finishes.wallTextures || []).map(f => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                </select>
            </div>
            
            <div>
                <label htmlFor="ceilingTexture" className="block text-sm font-medium text-gray-700">Ceiling Texture</label>
                <select
                    id="ceilingTexture"
                    name="ceilingTexture"
                    value={bid.ceilingTexture || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select --</option>
                    {(finishes.ceilingTextures || []).filter(f => f.name).map(f => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                </select>
            </div>
            
            <div>
                <label htmlFor="corners" className="block text-sm font-medium text-gray-700">Corners</label>
                <select
                    id="corners"
                    name="corners"
                    value={bid.corners || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select --</option>
                    {(finishes.corners || []).map(f => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const NotesSection = () => (
        <div className="col-span-4 pt-4 mt-4 border-t">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
                id="notes"
                name="notes"
                value={bid.notes || ''}
                onChange={(e) => {
                    if (e.target.value.length <= 3000) {
                        handleInputChange(e);
                    }
                }}
                placeholder="Add any notes about this bid..."
                autoComplete="off"
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                style={{ minHeight: '60px' }}
                onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px';
                }}
            />
            <div className="text-xs text-gray-500 mt-1">
                {(bid.notes || '').length}/3000 characters
            </div>
        </div>
    );

    const MaterialStockSection = () => {
        if (bid.status !== 'bid') return null;
        
        return (
            <div className="col-span-4 pt-4 mt-4 border-t">
                <label htmlFor="materialStockDate" className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                <p className="text-xs text-gray-500 mb-1">Setting this date will convert the bid into a project and assign a new job number.</p>
                <input
                    id="materialStockDate"
                    type="date"
                    name="materialStockDate"
                    value={bid.materialStockDate || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
        );
    };

    return (
        <>
            {/* Main Header Fields */}
            <div className={`grid ${getLayoutClass()} gap-6`}>
                {headerConfig.visibleFields.map(field => renderField(field))}
            </div>

            {/* Rates Section */}
            <RatesSection />

            {/* Finishes Section */}
            <FinishesSection />
            
            {/* Notes Field */}
            <NotesSection />
            
            {/* Material Stock Date (for bids only) */}
            <MaterialStockSection />
        </>
    );
});

BidFormFields.displayName = 'BidFormFields';

// Simple React.memo to prevent unnecessary re-renders
export default React.memo(BidFormFields);
