import React, { useEffect, useRef, useState, useCallback } from 'react';

const GoogleMapSelector = ({ 
    initialCoordinates, 
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
    const [selectedAddress, setSelectedAddress] = useState('');

    // Reverse geocode function using Google's Geocoding API
    const reverseGeocode = useCallback((geocoderInstance, coordinates) => {
        geocoderInstance.geocode({ location: coordinates }, (results, status) => {
            if (status === 'OK') {
                if (results[0]) {
                    const address = results[0].formatted_address;
                    setSelectedAddress(address);
                    
                    // Call the callback with both coordinates and address
                    if (onLocationSelect) {
                        onLocationSelect(coordinates);
                    }
                    if (onAddressUpdate) {
                        onAddressUpdate(address);
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
    useEffect(() => {
        if (!isOpen) return;

        const loadGoogleMaps = () => {
            // Check if Google Maps is already loaded
            if (window.google && window.google.maps) {
                // Add a small delay to ensure DOM is ready
                setTimeout(initializeMap, 100);
                return;
            }

            // Create script tag to load Google Maps API
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'}&libraries=geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => setTimeout(initializeMap, 100);
            script.onerror = () => {
                console.error('Failed to load Google Maps API');
                setIsLoading(false);
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            if (!window.google || !mapRef.current) {
                console.error('Google Maps API not available or map container not ready');
                setIsLoading(false);
                return;
            }

            try {
                // Default to a central location if no coordinates provided
                const defaultLocation = initialCoordinates || { lat: 39.8283, lng: -98.5795 }; // Center of US
                
                // Initialize map
                const mapInstance = new window.google.maps.Map(mapRef.current, {
                    center: defaultLocation,
                    zoom: initialCoordinates ? 17 : 4,
                    mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                    streetViewControl: false,
                    mapTypeControl: true,
                    fullscreenControl: true,
                });

                // Initialize geocoder
                const geocoderInstance = new window.google.maps.Geocoder();
                
                // Create draggable marker
                const markerInstance = new window.google.maps.Marker({
                    position: defaultLocation,
                    map: mapInstance,
                    draggable: true,
                    title: "Drag to select exact location",
                    animation: window.google.maps.Animation.DROP
                });

                // Listen for marker drag events
                markerInstance.addListener('dragend', function() {
                    const newPosition = markerInstance.getPosition();
                    const coordinates = {
                        lat: newPosition.lat(),
                        lng: newPosition.lng()
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
                    
                    markerInstance.setPosition(event.latLng);
                    reverseGeocode(geocoderInstance, coordinates);
                });

                setMap(mapInstance);
                setMarker(markerInstance);
                setGeocoder(geocoderInstance);
                setIsLoading(false);

                // If we have initial coordinates, do reverse geocoding
                if (initialCoordinates) {
                    reverseGeocode(geocoderInstance, initialCoordinates);
                }

            } catch (error) {
                console.error('Error initializing Google Maps:', error);
                setIsLoading(false);
            }
        };

        loadGoogleMaps();

        // Cleanup function
        return () => {
            // Google Maps cleanup is handled by React's component lifecycle
        };
    }, [isOpen, initialCoordinates, reverseGeocode]);

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
                map.setZoom(17);
                marker.setPosition(location);
                
                setSelectedAddress(results[0].formatted_address);
                
                if (onLocationSelect) {
                    onLocationSelect(coordinates);
                }
                if (onAddressUpdate) {
                    onAddressUpdate(results[0].formatted_address);
                }
            } else {
                alert('Geocode was not successful for the following reason: ' + status);
            }
        });
    };

    const handleSaveAndClose = () => {
        if (marker) {
            const position = marker.getPosition();
            const coordinates = {
                lat: position.lat(),
                lng: position.lng()
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
                
                <div className="flex-1 relative">
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
                        className="w-full h-full min-h-[400px]"
                        style={{ display: isLoading ? 'none' : 'block' }}
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
