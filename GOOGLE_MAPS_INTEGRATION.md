# Google Maps Integration - Location Services Enhancement

## Overview
The location services have been enhanced with an interactive Google Maps component that allows users to select precise locations using a draggable marker. This provides a much more intuitive way to set exact coordinates for job sites.

## Features

### 🎯 Interactive Map Selection
- **Draggable Marker**: Users can drag the red marker to any location on the map
- **Click to Place**: Simply click anywhere on the map to move the marker
- **Real-time Address Updates**: The address automatically updates as the marker is moved
- **Reverse Geocoding**: Coordinates are converted to human-readable addresses using Google's Geocoding API

### 🗺️ Enhanced Address Processing
- **Forward Geocoding**: Enter an address and the map centers on that location
- **Search Integration**: Built-in address search with Google's geocoding
- **Automatic Tax Calculation**: Sales tax rates are automatically calculated based on the selected location

### 📍 Multiple Input Methods
1. **"Select on Map"** - Opens the interactive map selector
2. **"Map"** - Views existing address on Google Maps (external)
3. **"GPS"** - Uses device's current location
4. **Manual Entry** - Direct coordinate input for precision

## Implementation Details

### Components Added
- **GoogleMapSelector.js** - Main interactive map component with draggable marker
- **Enhanced LocationServices.js** - Integrated map functionality into existing location services

### API Requirements
You'll need a Google Maps API key with the following APIs enabled:
- Maps JavaScript API
- Geocoding API

### Setup Instructions
1. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Enable the required APIs (Maps JavaScript API, Geocoding API)
3. Add the API key to your `.env` file:
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your-api-key-here
   ```

### User Experience
1. **Address Entry**: User types an address in the address field
2. **Map Selection**: User clicks "Select on Map" button
3. **Interactive Selection**: 
   - Map opens centered on the address (if available) or default location
   - User can search for locations using the search bar
   - User drags the marker or clicks to select precise location
   - Address updates automatically based on marker position
4. **Confirmation**: User clicks "Use This Location" to save coordinates and address
5. **Auto-tax Calculation**: Sales tax rate is automatically calculated for the location

### Technical Features
- **Lazy Loading**: Google Maps API is only loaded when the map selector is opened
- **Error Handling**: Graceful fallbacks if Google Maps fails to load
- **Responsive Design**: Map works on desktop and mobile devices
- **Memory Management**: Proper cleanup of map instances

### Benefits
- **Precision**: Exact coordinate selection down to building level
- **User-Friendly**: Visual selection is more intuitive than coordinate entry
- **Automatic**: Address and tax rate calculation happens automatically
- **Integrated**: Seamlessly works with existing location services
- **Fallback**: Original location methods still available if needed

## Usage Example

```javascript
// The enhanced LocationControls component now includes:
<LocationControls 
    bid={bid}
    locationSettings={locationSettings}
    locationServices={locationServices}
/>

// Which provides these buttons:
// 🎯 Select on Map - Opens interactive map selector
// 🗺️ Map - View address on Google Maps (external)
// 📍 GPS - Use current device location
```

The interactive map selector provides the exact functionality you requested - users can now drag a marker on Google Maps to select precise locations, with automatic reverse geocoding to get the address for the selected coordinates.
