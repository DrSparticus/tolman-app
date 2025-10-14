import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import GoogleMapSelector from './GoogleMapSelector';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

// Custom hook for location services
export const useLocationServices = (db, handleInputChange) => {
    const [locationSettings, setLocationSettings] = useState({
        reverseGeocodeAccuracy: 50,
        enableAutoAddressFill: true,
        enableLocationServices: true
    });

    // Load location settings from Firebase
    useEffect(() => {
        if (!db) return;
        
        const locationConfigRef = doc(db, configPath, 'locationSettings');
        const unsubscribe = onSnapshot(locationConfigRef, (docSnap) => {
            if (docSnap.exists()) {
                setLocationSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        });

        return unsubscribe;
    }, [db]);

    const reverseGeocode = useCallback(async (coordinates) => {
        try {
            console.log('Reverse geocoding coordinates:', coordinates);
            
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coordinates.lat}&longitude=${coordinates.lng}&localityLanguage=en`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Reverse geocoding response:', data);
            
            // Build the most complete address possible
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
                
                // Fallback strategies
                if (data.administrativeAreaLevel2 && data.principalSubdivision) {
                    const fallbackAddress = `${data.administrativeAreaLevel2}, ${data.principalSubdivision}`;
                    console.log('Using administrative area fallback:', fallbackAddress);
                    return fallbackAddress;
                }
                
                // Last resort: use displayName but remove country if present
                if (data.displayName) {
                    let displayAddress = data.displayName;
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
    }, []);

    const getSalesTaxRate = useCallback(async (coordinates) => {
        try {
            // Mock sales tax calculation - replace with actual API integration
            return 0.0725; // 7.25% default
        // eslint-disable-next-line no-unreachable
        } catch (error) {
            console.error('Sales tax lookup error:', error);
            return null;
        }
    }, []);

    const reverseGeocodeWithGoogleMaps = useCallback(async (coordinates) => {
        // Try Google Maps API first if available (more accurate)
        if (window.google && window.google.maps) {
            console.log('Using Google Maps Reverse Geocoding API for:', coordinates);
            return new Promise((resolve) => {
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: coordinates }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const address = results[0].formatted_address;
                        console.log('Google Maps reverse geocoding successful:', address);
                        resolve(address);
                    } else {
                        console.warn('Google Maps reverse geocoding failed:', status);
                        resolve(null);
                    }
                });
            });
        }
        
        // Fallback to existing BigDataCloud API
        console.log('Google Maps API not available, falling back to BigDataCloud');
        return reverseGeocode(coordinates);
    }, [reverseGeocode]);

    const getCurrentLocation = useCallback(() => {
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
                        const address = await reverseGeocodeWithGoogleMaps(coordinates);
                        console.log('Reverse geocoded address:', address);
                        if (address) {
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
    }, [handleInputChange, locationSettings.enableAutoAddressFill, reverseGeocodeWithGoogleMaps, getSalesTaxRate]);

    const geocodeAddress = useCallback(async (address) => {
        // Always use Google Maps Geocoding API first if available
        if (window.google && window.google.maps) {
            console.log('Using Google Maps Geocoding API for:', address);
            return new Promise((resolve) => {
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;
                        console.log('Google Maps geocoding successful');
                        resolve({
                            lat: location.lat(),
                            lng: location.lng()
                        });
                    } else {
                        console.warn('Google Geocoding failed:', status);
                        resolve(null);
                    }
                });
            });
        }
        
        // Skip BigDataCloud API due to rate limiting issues
        console.warn('Google Maps API not available for geocoding, skipping BigDataCloud due to rate limits');
        return null;
    }, []);

    const openManualCoordinateInput = useCallback(() => {
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
                        
                        handleInputChange({
                            target: { name: 'coordinates', value: coordinates }
                        });
                        
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
    }, [handleInputChange, getSalesTaxRate]);

    const openInMaps = useCallback((coordinates) => {
        if (coordinates) {
            const { lat, lng } = coordinates;
            const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            window.open(url, '_blank');
        }
    }, []);

    const removeLocation = useCallback(() => {
        handleInputChange({
            target: { name: 'coordinates', value: null }
        });
        handleInputChange({
            target: { name: 'salesTaxRate', value: null }
        });
    }, [handleInputChange]);

    const openGoogleMapSelector = useCallback((initialCoordinates) => {
        // This will be handled by the component state
        return true;
    }, []);

    const handleMapLocationSelect = useCallback(async (coordinates) => {
        // Save coordinates to bid
        handleInputChange({
            target: { name: 'coordinates', value: coordinates }
        });

        // Calculate sales tax for the new location
        try {
            const taxRate = await getSalesTaxRate(coordinates);
            if (taxRate) {
                handleInputChange({
                    target: { name: 'salesTaxRate', value: taxRate }
                });
            }
        } catch (error) {
            console.log('Could not get sales tax rate for map selection:', error);
        }
    }, [handleInputChange, getSalesTaxRate]);

    const handleMapAddressUpdate = useCallback((address) => {
        // Update the address field
        handleInputChange({
            target: { name: 'address', value: address }
        });
    }, [handleInputChange]);

    return useMemo(() => ({
        locationSettings,
        reverseGeocodeWithGoogleMaps,
        getCurrentLocation,
        openManualCoordinateInput,
        openInMaps,
        removeLocation,
        openGoogleMapSelector,
        handleMapLocationSelect,
        handleMapAddressUpdate,
        geocodeAddress
    }), [
        locationSettings, 
        reverseGeocodeWithGoogleMaps,
        getCurrentLocation,
        openManualCoordinateInput,
        openInMaps,
        removeLocation,
        openGoogleMapSelector,
        handleMapLocationSelect,
        handleMapAddressUpdate,
        geocodeAddress
    ]);
};

// Location Controls Component for address field
export const LocationControls = ({ bid, locationSettings, locationServices }) => {
    const [isMapSelectorOpen, setIsMapSelectorOpen] = useState(false);
    
    if (!locationSettings.enableLocationServices) return null;

    const handleOpenMapSelector = async () => {
        let initialCoordinates = bid.coordinates;
        
        // If we don't have coordinates but have an address, try to geocode it first
        if (!initialCoordinates && bid.address && bid.address.trim() !== '') {
            initialCoordinates = await locationServices.geocodeAddress?.(bid.address);
        }
        
        setIsMapSelectorOpen(true);
    };

    const handleMapLocationSelect = (coordinates) => {
        locationServices.handleMapLocationSelect(coordinates);
    };

    const handleMapAddressUpdate = (address) => {
        locationServices.handleMapAddressUpdate(address);
    };

    return (
        <>
            <div className="flex items-center justify-between mb-1">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                <div className="flex space-x-1">
                    <button
                        type="button"
                        onClick={handleOpenMapSelector}
                        className="px-2 py-0 text-xs text-white rounded hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{backgroundColor: '#303a7e', height: '1.25rem'}}
                    >
                        🎯 Map
                    </button>
                </div>
            </div>
            
            {/* Google Map Selector Modal */}
            <GoogleMapSelector
                initialCoordinates={bid.coordinates}
                initialAddress={bid.address}
                onLocationSelect={handleMapLocationSelect}
                onAddressUpdate={handleMapAddressUpdate}
                isOpen={isMapSelectorOpen}
                onClose={() => setIsMapSelectorOpen(false)}
            />
        </>
    );
};

export default LocationControls;
