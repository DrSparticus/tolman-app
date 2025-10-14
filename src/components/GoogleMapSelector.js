import React, { useEffect, useRef, useState, useCallback } from 'react';

// Helper function to remove country from formatted address
const removeCountryFromAddress = (formattedAddress) => {
    if (!formattedAddress) return '';
    
    // Split by comma and remove the last component (which is typically the country)
    const parts = formattedAddress.split(',').map(part => part.trim());
    
    // Remove the last part if it looks like a country (typically just letters and spaces)
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        // Check if the last part is likely a country (contains only letters, spaces, and common country indicators)
        if (/^[A-Za-z\s]+$/.test(lastPart) && lastPart.length <= 50) {
            parts.pop(); // Remove the last component
        }
    }
    
    return parts.join(', ');
};

const GoogleMapSelector = ({ 
    initialCoordinates, 
    initialAddress,  // New prop for existing address
    onLocationSelect, 
    onAddressUpdate, 
    isOpen, 
    onClose 
}) => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [marker, setMarker] = useState(null);
    const [geocoder, setGeocoder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [userLocation, setUserLocation] = useState(null);

    // Get user's current location
    const getCurrentLocation = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            console.log('GoogleMapSelector: Requesting user location...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('GoogleMapSelector: User location obtained:', coords);
                    setUserLocation(coords);
                    resolve(coords);
                },
                (error) => {
                    console.log('GoogleMapSelector: Location access denied or failed:', error.message);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    }, []);

    // Geocode an address to get coordinates
    const geocodeAddress = useCallback((geocoderInstance, address) => {
        return new Promise((resolve, reject) => {
            geocoderInstance.geocode({ address: address }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    const coordinates = {
                        lat: location.lat(),
                        lng: location.lng()
                    };
                    const cleanAddress = removeCountryFromAddress(results[0].formatted_address);
                    resolve({ coordinates, formattedAddress: cleanAddress });
                } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                }
            });
        });
    }, []);

    // Reverse geocode function using Google's Geocoding API
    const reverseGeocode = useCallback((geocoderInstance, coordinates) => {
        geocoderInstance.geocode({ location: coordinates }, (results, status) => {
            if (status === 'OK') {
                if (results[0]) {
                    const cleanAddress = removeCountryFromAddress(results[0].formatted_address);
                    setSelectedAddress(cleanAddress);
                    
                    // Call the callback with both coordinates and address
                    if (onLocationSelect) {
                        onLocationSelect(coordinates);
                    }
                    if (onAddressUpdate) {
                        onAddressUpdate(cleanAddress);
                    }
                } else {
                    console.log('No results found for reverse geocoding');
                    setSelectedAddress('Location found, but no address available');
                }
            } else {
                console.log('Geocoder failed due to: ' + status);
                setSelectedAddress('Unable to get address for this location');
            }
        });
    }, [onLocationSelect, onAddressUpdate]);

    // Load Google Maps API
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: Adding geocoder, isInitializing, isLoading, map, marker, onAddressUpdate to deps would cause infinite re-renders
    // since this effect manages these state variables. The effect correctly depends on external props only.
    useEffect(() => {
        if (!isOpen) return;
        
        // Check if map exists but container is no longer valid (modal was closed/reopened)
        let needsReinitialization = false;
        if (map && (!map.getDiv() || !document.contains(map.getDiv()))) {
            // Map container is invalid, reset all map-related state
            console.log('GoogleMapSelector: Detected stale map container, resetting...');
            setMap(null);
            setMarker(null);
            setGeocoder(null);
            setIsLoading(true);
            needsReinitialization = true;
        }
        
        // If map is already loaded and initialCoordinates haven't changed significantly, don't reload
        if (!needsReinitialization && map && marker && geocoder && !isLoading && !isInitializing && map.getDiv() && document.contains(map.getDiv())) {
            // Update marker position if coordinates changed
            if (initialCoordinates && marker) {
                const currentPos = marker.position;
                const newLat = initialCoordinates.lat;
                const newLng = initialCoordinates.lng;
                
                // Only update if coordinates are significantly different (more than ~1 meter)
                if (!currentPos || 
                    Math.abs(currentPos.lat - newLat) > 0.00001 || 
                    Math.abs(currentPos.lng - newLng) > 0.00001) {
                    marker.position = new window.google.maps.LatLng(initialCoordinates.lat, initialCoordinates.lng);
                    map.setCenter(initialCoordinates);
                    if (geocoder) {
                        reverseGeocode(geocoder, initialCoordinates);
                    }
                }
            }
            return;
        }

        const loadGoogleMaps = () => {
            if (isInitializing) {
                console.log('GoogleMapSelector: Already initializing, skipping...');
                return;
            }
            
            console.log('GoogleMapSelector: Loading Google Maps API...');
            // Check if Google Maps is already loaded
            if (window.google && window.google.maps) {
                console.log('GoogleMapSelector: Google Maps API already loaded');
                // Always initialize if we don't have a valid map or if reinitialization is needed
                if (!map || needsReinitialization) {
                    initializeMap();
                }
                return;
            }

            // Check if script is already being loaded
            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                console.log('GoogleMapSelector: Google Maps script already loading, waiting...');
                // Wait for it to load
                const checkLoaded = () => {
                    if (window.google && window.google.maps) {
                        console.log('GoogleMapSelector: Google Maps API loaded via existing script');
                        initializeMap();
                    } else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                checkLoaded();
                return;
            }

            // Create script tag to load Google Maps API with async loading
            console.log('GoogleMapSelector: Creating new Google Maps script');
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'}&libraries=geometry,marker&loading=async`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                console.log('GoogleMapSelector: Google Maps script loaded successfully');
                initializeMap();
            };
            script.onerror = () => {
                console.error('GoogleMapSelector: Failed to load Google Maps API');
                setIsLoading(false);
                setIsInitializing(false);
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            if (isInitializing) {
                console.log('GoogleMapSelector: Already initializing map, skipping...');
                return;
            }
            
            setIsInitializing(true);
            console.log('GoogleMapSelector: Starting map initialization...');
            // Wait for the map container to be fully ready
            const waitForContainer = () => {
                return new Promise((resolve) => {
                    const checkContainer = () => {
                        if (!mapRef.current) {
                            console.log('GoogleMapSelector: Waiting for map container...');
                            setTimeout(checkContainer, 50);
                            return;
                        }

                        const container = mapRef.current;
                        const isInDOM = document.contains(container);
                        const hasWidth = container.offsetWidth > 0;
                        const hasHeight = container.offsetHeight > 0;
                        const isVisible = container.offsetParent !== null;

                        console.log('GoogleMapSelector: Container check -', {
                            isInDOM,
                            hasWidth,
                            hasHeight,
                            isVisible,
                            width: container.offsetWidth,
                            height: container.offsetHeight
                        });

                        // Check if container has dimensions (relaxed visibility requirement)
                        if (isInDOM && hasWidth && hasHeight) {
                            console.log('GoogleMapSelector: Container ready!');
                            resolve(container);
                        } else {
                            setTimeout(checkContainer, 50);
                        }
                    };
                    checkContainer();
                });
            };

            // Initialize with proper container waiting
            waitForContainer().then((container) => {
                console.log('GoogleMapSelector: Container ready, checking Google Maps API...');
                if (!window.google) {
                    console.error('GoogleMapSelector: Google Maps API not available');
                    setIsLoading(false);
                    setIsInitializing(false);
                    return;
                }

                console.log('GoogleMapSelector: Google Maps API available, creating map...');
                try {
                    // Additional delay to ensure IntersectionObserver can work properly
                    setTimeout(async () => {
                        try {
                            // Determine the best location to use
                            let defaultLocation = { lat: 39.8283, lng: -98.5795 }; // Fallback to center of US
                            
                            if (initialCoordinates) {
                                // Use provided coordinates
                                defaultLocation = initialCoordinates;
                            } else if (initialAddress && initialAddress.trim()) {
                                // Try to geocode the provided address
                                try {
                                    const geocoderInstance = new window.google.maps.Geocoder();
                                    let addressToGeocode = initialAddress.trim();
                                    
                                    // If address doesn't seem to have a state or country, append a default region
                                    // This helps with incomplete addresses like just "123 Main St"
                                    if (!addressToGeocode.match(/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/i) && 
                                        !addressToGeocode.toLowerCase().includes('usa') && 
                                        !addressToGeocode.toLowerCase().includes('united states')) {
                                        addressToGeocode += ', USA';
                                    }
                                    
                                    const result = await geocodeAddress(geocoderInstance, addressToGeocode);
                                    defaultLocation = result.coordinates;
                                } catch (error) {
                                    // If address geocoding fails, DON'T get user location - just use default location
                                    // This prevents the map from jumping to current location when user has entered an address
                                }
                            } else {
                                // No coordinates or address provided, try to get user location
                                try {
                                    defaultLocation = await getCurrentLocation();
                                } catch (error) {
                                    // Use default location if current location fails
                                }
                            }
                            
                            // Initialize map
                            const mapInstance = new window.google.maps.Map(container, {
                                center: defaultLocation,
                                zoom: (initialCoordinates || userLocation) ? 15 : 13,
                                mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                                mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
                                streetViewControl: false,
                                mapTypeControl: true,
                                fullscreenControl: true,
                            });
                            console.log('GoogleMapSelector: Map instance created successfully');

                            // Initialize geocoder
                            console.log('GoogleMapSelector: Creating geocoder...');
                            const geocoderInstance = new window.google.maps.Geocoder();
                            console.log('GoogleMapSelector: Geocoder created successfully');
                
                            // Create draggable marker using new AdvancedMarkerElement
                            console.log('GoogleMapSelector: Creating marker...');
                            const markerInstance = new window.google.maps.marker.AdvancedMarkerElement({
                                position: defaultLocation,
                                map: mapInstance,
                                gmpDraggable: true,
                                title: "Drag to select exact location"
                            });
                            console.log('GoogleMapSelector: Marker created successfully');

                            // Listen for marker drag events
                            markerInstance.addListener('dragend', function() {
                                const newPosition = markerInstance.position;
                                const coordinates = {
                                    lat: newPosition.lat,
                                    lng: newPosition.lng
                                };
                                
                                // Perform reverse geocoding
                                reverseGeocode(geocoderInstance, coordinates);
                            });

                            // Listen for map clicks to move marker
                            mapInstance.addListener('click', function(event) {
                                const coordinates = {
                                    lat: event.latLng.lat(),
                                    lng: event.latLng.lng()
                                };
                                
                                markerInstance.position = event.latLng;
                                reverseGeocode(geocoderInstance, coordinates);
                            });

                            console.log('GoogleMapSelector: Setting map state');
                            setMap(mapInstance);
                            console.log('GoogleMapSelector: Setting marker state');
                            setMarker(markerInstance);
                            console.log('GoogleMapSelector: Setting geocoder state');
                            setGeocoder(geocoderInstance);
                            console.log('GoogleMapSelector: Setting loading to false');
                            setIsLoading(false);
                            setIsInitializing(false);
                            console.log('GoogleMapSelector: Initialization complete!');

                            // Do reverse geocoding for the final location
                            if (initialCoordinates) {
                                // Use provided coordinates for reverse geocoding
                                reverseGeocode(geocoderInstance, initialCoordinates);
                            } else if (defaultLocation && (defaultLocation.lat !== 39.8283 || defaultLocation.lng !== -98.5795)) {
                                // If we have a real location (not the fallback), do reverse geocoding
                                reverseGeocode(geocoderInstance, defaultLocation);
                            } else if (initialAddress && initialAddress.trim()) {
                                // If we have an initial address but coordinates failed, show the address
                                setSelectedAddress(initialAddress.trim());
                                if (onAddressUpdate) {
                                    onAddressUpdate(initialAddress.trim());
                                }
                            }
                        } catch (innerError) {
                            console.error('Error creating Google Maps instance:', innerError);
                            setIsLoading(false);
                            setIsInitializing(false);
                        }
                    }, 200); // Additional delay before map creation

                } catch (error) {
                    console.error('Error initializing Google Maps:', error);
                    setIsLoading(false);
                    setIsInitializing(false);
                }
            }).catch((error) => {
                console.error('Error waiting for container:', error);
                setIsLoading(false);
                setIsInitializing(false);
            });
        };

        loadGoogleMaps();

        // Cleanup function
        return () => {
            // Google Maps cleanup is handled by React's component lifecycle
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialCoordinates, initialAddress, getCurrentLocation, geocodeAddress, reverseGeocode]);

    // Handle address search
    const searchAddress = (address) => {
        if (!geocoder || !address.trim()) return;

        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                const coordinates = {
                    lat: location.lat(),
                    lng: location.lng()
                };

                // Update map and marker
                map.setCenter(location);
                map.setZoom(15);
                marker.position = location;
                
                const cleanAddress = removeCountryFromAddress(results[0].formatted_address);
                setSelectedAddress(cleanAddress);
                
                if (onLocationSelect) {
                    onLocationSelect(coordinates);
                }
                if (onAddressUpdate) {
                    onAddressUpdate(cleanAddress);
                }
            } else {
                alert('Geocode was not successful for the following reason: ' + status);
            }
        });
    };

    const handleSaveAndClose = () => {
        if (marker) {
            const position = marker.position;
            const coordinates = {
                lat: position.lat,
                lng: position.lng
            };
            
            if (onLocationSelect) {
                onLocationSelect(coordinates);
            }
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Select Location</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>
                
                <div className="p-4 border-b">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search for an address..."
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    searchAddress(e.target.value);
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const input = e.target.previousElementSibling;
                                searchAddress(input.value);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        >
                            Search
                        </button>
                    </div>
                    
                    {selectedAddress && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-800">
                                <strong>Selected:</strong> {selectedAddress}
                            </p>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 relative" style={{ height: '500px' }}>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Loading Google Maps...</p>
                            </div>
                        </div>
                    )}
                    
                    <div 
                        ref={mapRef} 
                        className="w-full h-full"
                        style={{ 
                            display: 'block',
                            visibility: 'visible',
                            width: '100%',
                            height: '500px'
                        }}
                    />
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            💡 Drag the marker or click on the map to select a precise location
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAndClose}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                            >
                                Use This Location
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoogleMapSelector;
