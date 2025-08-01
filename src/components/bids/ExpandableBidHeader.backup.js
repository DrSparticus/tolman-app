import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronDownIcon } from '../../Icons';
import { useLocationServices } from '../LocationServices';
import { useBidRates } from '../../hooks/useBidRates';
import { BidFormFields } from './BidFormFields';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function ExpandableBidHeader({ bid, handleInputChange, supervisors, finishes, db, userData, materials, crewTypes }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [headerConfig, setHeaderConfig] = useState({
        visibleFields: ['projectName', 'contractor', 'address', 'supervisor'],
        layout: 'grid-4',
        customFields: []
    });

    // Use custom hooks for location services and rate calculations
    const locationServices = useLocationServices(db, handleInputChange);
    const rateCalculations = useBidRates(db, bid, finishes, handleInputChange);
    const formFields = BidFormFields({ 
        bid, 
        handleInputChange, 
        supervisors, 
        finishes, 
        locationSettings: locationServices.locationSettings, 
        locationServices, 
        rateCalculations 
    });

    // Load header config
    useEffect(() => {
        if (!db) return;
        const configDocRef = doc(db, configPath, 'bidHeaderConfig');
        const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setHeaderConfig(docSnap.data());
            }
        });
        return unsubscribe;
    }, [db]);

    // Remove old location settings useEffect - handled by useLocationServices hook

    // Add this useEffect to recalculate when finishes change:
    useEffect(() => {
        if (bid.autoTapeRate) {
            const newRate = calculateFinishedTapeRate();
            handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
        }
    }, [bid.wallTexture, bid.ceilingTexture, bid.corners, bid.autoTapeRate, bid.finishedHangingRate, bid.areas]);

    // Update the calculateFinishedTapeRate function:
    const calculateFinishedTapeRate = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        const baseAddition = 0.04;
        
        let taperFinishesTotal = 0;
        
        // Calculate finish extra pay for taper
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
        
        // Add material extra pay for taper crew
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
        
        const totalRate = hangRate + baseAddition + taperFinishesTotal + materialExtraPay;
        return totalRate.toFixed(3);
    };

    // Show breakdown in the input placeholder
    const getFinishedTapeRateBreakdown = () => {
        const hangRate = parseFloat(bid.finishedHangingRate) || parseFloat(defaultRates.hangRate) || 0;
        let finishesTotal = 0;

        // Calculate finishes total
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && typeof finish === 'object') {
                    // Check if the crew for this finish is a taper crew
                    const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
                    if (finish.crew === taperCrewId) {
                        finishesTotal += parseFloat(finish.pay) || 0;
                    }
                }
            }
        });

        return `${hangRate} + 0.04 + ${finishesTotal.toFixed(3)} (finishes)`;
    };

    const getHangRateUpgrades = () => {
        let finishUpgrades = 0;
        const finishNames = [];

        // Calculate finishes that apply to hanging crew
        ['wallTexture', 'ceilingTexture', 'corners'].forEach(finishType => {
            const finishName = bid[finishType];
            const finishCategory = finishType === 'wallTexture' ? 'wallTextures' : 
                                  finishType === 'ceilingTexture' ? 'ceilingTextures' : 'corners';
            
            if (finishName && finishes[finishCategory]) {
                const finish = finishes[finishCategory].find(f => f.name === finishName);
                if (finish && typeof finish === 'object') {
                    // Check if the crew for this finish is a hanging crew
                    const hangingCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id;
                    if (finish.crew === hangingCrewId) {
                        const payRate = parseFloat(finish.pay) || 0;
                        finishUpgrades += payRate;
                        finishNames.push(`${finishName}: +$${payRate.toFixed(3)}`);
                    }
                }
            }
        });

        if (finishUpgrades > 0) {
            return `Finish upgrades: ${finishNames.join(', ')}`;
        }
        return '';
    };

    // Location service functions
    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            window.alert('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coordinates = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Save coordinates to bid
                handleInputChange({
                    target: { name: 'coordinates', value: coordinates }
                });

                // Try to get address from coordinates (reverse geocoding)
                if (locationSettings.enableAutoAddressFill) {
                    try {
                        const address = await reverseGeocode(coordinates);
                        console.log('Reverse geocoded address:', address);
                        console.log('Current bid address:', bid.address);
                        if (address && (!bid.address || bid.address.trim() === '')) {
                            console.log('Setting address to:', address);
                            handleInputChange({
                                target: { name: 'address', value: address }
                            });
                        }
                    } catch (error) {
                        console.log('Could not get address from coordinates:', error);
                    }
                }

                // Calculate sales tax for the location
                try {
                    const taxRate = await getSalesTaxRate(coordinates);
                    if (taxRate) {
                        handleInputChange({
                            target: { name: 'salesTaxRate', value: taxRate }
                        });
                        
                        // Also update the markup configuration if this is different from default
                        console.log(`Sales tax rate updated to ${(taxRate * 100).toFixed(3)}% based on location`);
                    }
                } catch (error) {
                    console.log('Could not get sales tax rate:', error);
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        window.alert('Location access denied. Please enable location services and try again.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        window.alert('Location information is unavailable.');
                        break;
                    case error.TIMEOUT:
                        window.alert('Location request timed out.');
                        break;
                    default:
                        window.alert('An unknown error occurred while getting location.');
                        break;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    };

    const reverseGeocode = async (coordinates) => {
        try {
            console.log('Reverse geocoding coordinates:', coordinates);
            console.log('Using accuracy setting:', locationSettings.reverseGeocodeAccuracy);
            
            // Use exact coordinates for geocoding - no rounding for precision
            console.log('Using exact coordinates for precise address lookup:', coordinates);
            
            // Using a free geocoding service (you could also use Google Maps API with an API key)
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coordinates.lat}&longitude=${coordinates.lng}&localityLanguage=en`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Reverse geocoding response:', data);
            
            // Always try to build the most complete address possible
            if (data) {
                let addressParts = [];
                
                // Priority 1: Try to get full street address with number
                if (data.streetNumber && data.streetName) {
                    addressParts.push(`${data.streetNumber} ${data.streetName}`);
                } 
                // Priority 2: Try to get just street name if no number available
                else if (data.streetName) {
                    addressParts.push(data.streetName);
                }
                // Priority 3: Try building, complex, or place name
                else if (data.building) {
                    addressParts.push(data.building);
                } else if (data.complexName) {
                    addressParts.push(data.complexName);
                } else if (data.placeName && data.placeName !== data.city && data.placeName !== data.locality) {
                    addressParts.push(data.placeName);
                }
                
                // Add city/locality
                if (data.city) {
                    addressParts.push(data.city);
                } else if (data.locality) {
                    addressParts.push(data.locality);
                }
                
                // Add state/province (but not country)
                if (data.principalSubdivision) {
                    addressParts.push(data.principalSubdivision);
                }
                
                if (addressParts.length > 0) {
                    const formattedAddress = addressParts.join(', ');
                    console.log('Formatted precise address:', formattedAddress);
                    return formattedAddress;
                }
                
                // Fallback: If we can't build a structured address, try other properties
                // Try administrativeArea names that might be more specific
                if (data.administrativeAreaLevel2 && data.principalSubdivision) {
                    const fallbackAddress = `${data.administrativeAreaLevel2}, ${data.principalSubdivision}`;
                    console.log('Using administrative area fallback:', fallbackAddress);
                    return fallbackAddress;
                }
                
                // Last resort: use displayName but remove country if present
                if (data.displayName) {
                    let displayAddress = data.displayName;
                    // Remove country from the end (common patterns)
                    displayAddress = displayAddress.replace(/, United States$/, '');
                    displayAddress = displayAddress.replace(/, US$/, '');
                    displayAddress = displayAddress.replace(/, USA$/, '');
                    displayAddress = displayAddress.replace(/, Canada$/, '');
                    displayAddress = displayAddress.replace(/, CA$/, '');
                    console.log('Using cleaned displayName fallback:', displayAddress);
                    return displayAddress;
                }
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
        return null;
    };

    const getSalesTaxRate = async (coordinates) => {
        try {
            // Using a sales tax API service (you might need to get an API key for production)
            // This is a placeholder - you'd need to integrate with a service like:
            // - TaxJar API
            // - Avalara API
            // - SmartyStreets API
            // - Or build your own lookup table
            
            // For now, return a mock tax rate based on state/location
            // You would replace this with actual API calls
            
            // This is a simplified example - in production you'd use the coordinates
            // to determine the exact jurisdiction and tax rate
            console.log('Mock sales tax calculation for coordinates:', coordinates);
            
            // For now, return a default rate - replace with actual API integration
            return 0.0725; // 7.25% default
            
        } catch (error) {
            console.error('Sales tax lookup error:', error);
            return null;
        }
    };

    const geocodeAddress = async (address) => {
        try {
            // Using a free geocoding service to convert address to coordinates
            const encodedAddress = encodeURIComponent(address);
            const response = await fetch(
                `https://api.bigdatacloud.net/data/geocode?address=${encodedAddress}&localityLanguage=en`
            );
            const data = await response.json();
            
            if (data && data.results && data.results.length > 0) {
                const result = data.results[0];
                return {
                    lat: result.latitude,
                    lng: result.longitude
                };
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
        return null;
    };

    const openAddressMap = async () => {
        if (!bid.address || bid.address.trim() === '') {
            window.alert('Please enter an address first.');
            return;
        }

        try {
            // First try to geocode the address to get coordinates
            const coordinates = await geocodeAddress(bid.address);
            
            if (coordinates) {
                // Create an interactive map URL that allows coordinate selection
                // This opens a Google Maps link that shows the location and allows copying coordinates
                const lat = coordinates.lat;
                const lng = coordinates.lng;
                
                // Store the geocoded coordinates immediately
                handleInputChange({
                    target: { name: 'coordinates', value: coordinates }
                });

                // Calculate sales tax for the geocoded location
                try {
                    const taxRate = await getSalesTaxRate(coordinates);
                    if (taxRate) {
                        handleInputChange({
                            target: { name: 'salesTaxRate', value: taxRate }
                        });
                        console.log(`Sales tax rate updated to ${(taxRate * 100).toFixed(3)}% based on geocoded address`);
                    }
                } catch (error) {
                    console.log('Could not get sales tax rate for geocoded address:', error);
                }

                // Open an interactive map where user can right-click to get coordinates
                // Using Google Maps with a specific zoom level and center
                const url = `https://www.google.com/maps/@${lat},${lng},17z`;
                
                // Show instructions to the user
                const userWantsToAdjust = window.confirm(
                    `Location found for "${bid.address}"!\n\n` +
                    `Coordinates have been saved: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n\n` +
                    `Click OK to open Google Maps if you want to fine-tune the location.\n` +
                    `In Google Maps:\n` +
                    `1. Right-click on the exact spot you want\n` +
                    `2. Click the coordinates that appear\n` +
                    `3. Copy them and use the "Manual Coordinates" button below to enter them\n\n` +
                    `Click Cancel if the current location is accurate.`
                );
                
                if (userWantsToAdjust) {
                    window.open(url, '_blank');
                }
                
            } else {
                // Fallback to simple address search
                const encodedAddress = encodeURIComponent(bid.address);
                const url = `https://www.google.com/maps/search/${encodedAddress}`;
                window.alert('Could not find exact coordinates for this address. Opening Google Maps search instead.');
                window.open(url, '_blank');
            }
        } catch (error) {
            console.error('Error opening address map:', error);
            // Fallback to simple address search
            const encodedAddress = encodeURIComponent(bid.address);
            const url = `https://www.google.com/maps/search/${encodedAddress}`;
            window.open(url, '_blank');
        }
    };

    const openManualCoordinateInput = () => {
        const coordInput = window.prompt(
            'Enter coordinates in format: latitude, longitude\n' +
            'Example: 40.7128, -74.0060\n\n' +
            'You can get these by right-clicking in Google Maps and copying the coordinates that appear.'
        );
        
        if (coordInput && coordInput.trim()) {
            try {
                const parts = coordInput.split(',').map(p => p.trim());
                if (parts.length === 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        const coordinates = { lat, lng };
                        
                        // Save coordinates
                        handleInputChange({
                            target: { name: 'coordinates', value: coordinates }
                        });
                        
                        // Calculate sales tax for the new location
                        getSalesTaxRate(coordinates).then(taxRate => {
                            if (taxRate) {
                                handleInputChange({
                                    target: { name: 'salesTaxRate', value: taxRate }
                                });
                                console.log(`Sales tax rate updated to ${(taxRate * 100).toFixed(3)}% based on manual coordinates`);
                            }
                        }).catch(error => {
                            console.log('Could not get sales tax rate for manual coordinates:', error);
                        });
                        
                        window.alert(`Coordinates saved: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    } else {
                        window.alert('Invalid coordinates. Please check the format and try again.');
                    }
                } else {
                    window.alert('Invalid format. Please use: latitude, longitude');
                }
            } catch (error) {
                window.alert('Error parsing coordinates. Please check the format and try again.');
            }
        }
    };

    const openInMaps = () => {
        if (bid.coordinates) {
            const { lat, lng } = bid.coordinates;
            const url = `https://www.google.com/maps?q=${lat},${lng}`;
            window.open(url, '_blank');
        }
    };

    const removeLocation = () => {
        handleInputChange({
            target: { name: 'coordinates', value: null }
        });
        handleInputChange({
            target: { name: 'salesTaxRate', value: null }
        });
    };

    const renderField = (fieldName) => {
        switch (fieldName) {
            case 'projectName':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Project Name</label>
                        <input
                            type="text"
                            name="projectName"
                            value={bid.projectName || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
            case 'contractor':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700">Contractor</label>
                        <input
                            type="text"
                            name="contractor"
                            value={bid.contractor || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                );
            case 'address':
                return (
                    <div key={fieldName}>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            {locationSettings.enableLocationServices && (
                                <div className="flex space-x-1">
                                    {bid.address && bid.address.trim() !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => openAddressMap()}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            title="View address on map and adjust location"
                                        >
                                            🗺️ Map
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => getCurrentLocation()}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        title="Use current location"
                                    >
                                        📍 GPS
                                    </button>
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            name="address"
                            value={bid.address || ''}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter address or use current location"
                        />
                        {locationSettings.enableLocationServices && bid.coordinates && (
                            <div className="mt-2 text-xs text-gray-600">
                                <div className="flex items-center justify-between">
                                    <span>📍 Location saved: {bid.coordinates.lat.toFixed(6)}, {bid.coordinates.lng.toFixed(6)}</span>
                                    <div className="flex space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => openInMaps()}
                                            className="text-blue-600 hover:text-blue-800 underline"
                                            title="Open in Google Maps"
                                        >
                                            View Map
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openManualCoordinateInput()}
                                            className="text-purple-600 hover:text-purple-800 underline ml-2"
                                            title="Enter coordinates manually"
                                        >
                                            Edit Coords
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeLocation()}
                                            className="text-red-600 hover:text-red-800 underline ml-2"
                                            title="Remove saved location"
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
                        {locationSettings.enableLocationServices && bid.address && bid.address.trim() !== '' && !bid.coordinates && (
                            <div className="mt-2 text-xs text-amber-600">
                                💡 Click "Map" to view this address and set precise coordinates
                            </div>
                        )}
                        {locationSettings.enableLocationServices && !bid.address && !bid.coordinates && (
                            <div className="mt-2 text-xs text-gray-500">
                                <button
                                    type="button"
                                    onClick={() => openManualCoordinateInput()}
                                    className="text-purple-600 hover:text-purple-800 underline"
                                    title="Enter coordinates manually if you have them"
                                >
                                    📝 Enter coordinates manually
                                </button>
                            </div>
                        )}
                    </div>
                );
            case 'supervisor':
                return (
                    <div key={fieldName}>
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
                );
            default:
                return null;
        }
    };

    const getLayoutClass = () => {
        switch (headerConfig.layout) {
            case 'grid-2': return 'grid-cols-1 md:grid-cols-2';
            case 'grid-3': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            case 'grid-4': return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
            default: return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg mb-6">
            <div 
                className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-lg font-semibold">Bid Information</h2>
                <ChevronDownIcon className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
            
            {isExpanded && (
                <div className="p-6">
                    <div className={`grid ${getLayoutClass()} gap-6`}>
                        {headerConfig.visibleFields.map(field => renderField(field))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4 mt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Hang Rate</label>
                            <input
                                type="number"
                                step="0.001"
                                name="finishedHangingRate"
                                value={bid.finishedHangingRate ?? ''}
                                placeholder={defaultRates.hangRate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                            {getHangRateUpgrades() && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {getHangRateUpgrades()}
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">Finished Tape Rate</label>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={bid.autoTapeRate ?? true}
                                        onChange={(e) => {
                                            const isAuto = e.target.checked;
                                            handleInputChange({
                                                target: { name: 'autoTapeRate', type: 'checkbox', checked: isAuto }
                                            });
                                            if (isAuto) {
                                                const newRate = calculateFinishedTapeRate();
                                                handleInputChange({ target: { name: 'finishedTapeRate', value: newRate } });
                                            }
                                        }}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label className="ml-2 text-sm font-medium text-gray-700">Auto</label>
                                </div>
                            </div>
                            <input
                                type="number"
                                step="0.001"
                                name="finishedTapeRate"
                                value={bid.autoTapeRate ? calculateFinishedTapeRate() : (bid.finishedTapeRate ?? '')}
                                onChange={bid.autoTapeRate ? undefined : handleInputChange}
                                disabled={bid.autoTapeRate}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 disabled:bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                title={bid.autoTapeRate ? getFinishedTapeRateBreakdown() : ''}
                            />
                            {bid.autoTapeRate && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {getFinishedTapeRateBreakdown()}
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Unfinished Tape Rate</label>
                            <input
                                type="number"
                                step="0.001"
                                name="unfinishedTapingRate"
                                value={bid.unfinishedTapingRate ?? ''}
                                placeholder={defaultRates.unfinishedTapeRate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 mt-4 border-t">
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
                    
                    {/* Notes Field - Full Width */}
                    <div className="col-span-4 pt-4 mt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                            name="notes"
                            value={bid.notes || ''}
                            onChange={(e) => {
                                if (e.target.value.length <= 3000) {
                                    handleInputChange(e);
                                }
                            }}
                            placeholder="Add any notes about this bid..."
                            className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                            style={{ minHeight: '60px' }}
                            onInput={(e) => {
                                // Auto-resize based on content
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px';
                            }}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            {(bid.notes || '').length}/3000 characters
                        </div>
                    </div>
                    
                    {bid.status === 'bid' && (
                        <div className="col-span-4 pt-4 mt-4 border-t">
                            <label className="block text-sm font-medium text-gray-700">Material Stock Date</label>
                            <p className="text-xs text-gray-500 mb-1">Setting this date will convert the bid into a project and assign a new job number.</p>
                            <input
                                type="date"
                                name="materialStockDate"
                                value={bid.materialStockDate || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}