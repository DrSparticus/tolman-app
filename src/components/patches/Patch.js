import React, { useState, useRef } from 'react';
import { CameraIcon } from '../../Icons';

const Patch = ({ patch, onUpdate, onRemove, canRemove = true, disabled = false, isAdmin = false }) => {
    const [photos, setPhotos] = useState(patch.photos || []);
    const fileInputRef = useRef(null);

    const handleInputChange = (field, value) => {
        onUpdate(patch.id, { ...patch, [field]: value });
    };

    const handlePhotoCapture = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newPhoto = {
                    id: Date.now() + Math.random(),
                    data: event.target.result,
                    name: file.name,
                    timestamp: new Date().toISOString()
                };
                const updatedPhotos = [...photos, newPhoto];
                setPhotos(updatedPhotos);
                onUpdate(patch.id, { ...patch, photos: updatedPhotos });
            };
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (photoId) => {
        const updatedPhotos = photos.filter(photo => photo.id !== photoId);
        setPhotos(updatedPhotos);
        onUpdate(patch.id, { ...patch, photos: updatedPhotos });
    };

    return (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-semibold text-gray-800">
                    Patch {patch.number || ''}
                </h4>
                {canRemove && (!disabled || isAdmin) && (
                    <button
                        onClick={() => onRemove(patch.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title={disabled && !isAdmin ? "Cannot remove - job is signed" : "Remove Patch"}
                        disabled={disabled && !isAdmin}
                    >
                        ✕ Remove
                    </button>
                )}
                {disabled && !isAdmin && (
                    <span className="text-sm text-gray-500 italic">
                        🔒 Locked (Signed)
                    </span>
                )}
            </div>

            {/* Description */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                </label>
                <textarea
                    value={patch.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    disabled={disabled && !isAdmin}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled && !isAdmin ? 'bg-gray-100 text-gray-600' : ''}`}
                    placeholder="Describe the patch work..."
                />
            </div>

            {/* Amount Type and Value */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Type *
                </label>
                <div className="flex items-center space-x-6 mb-3">
                    <label className="flex items-center">
                        <input
                            type="radio"
                            name={`amountType-${patch.id}`}
                            value="hours"
                            checked={patch.amountType === 'hours'}
                            onChange={(e) => handleInputChange('amountType', e.target.value)}
                            disabled={disabled && !isAdmin}
                            className="mr-2"
                        />
                        <span className="text-sm">Hours</span>
                    </label>
                    <label className="flex items-center">
                        <input
                            type="radio"
                            name={`amountType-${patch.id}`}
                            value="charge"
                            checked={patch.amountType === 'charge'}
                            onChange={(e) => handleInputChange('amountType', e.target.value)}
                            disabled={disabled && !isAdmin}
                            className="mr-2"
                        />
                        <span className="text-sm">$ Charge</span>
                    </label>
                </div>
                <div className="flex items-center">
                    {patch.amountType === 'charge' && (
                        <span className="text-gray-500 mr-1">$</span>
                    )}
                    <input
                        type="number"
                        value={patch.amount || ''}
                        onChange={(e) => handleInputChange('amount', e.target.value)}
                        min="0"
                        step={patch.amountType === 'hours' ? '0.25' : '0.01'}
                        disabled={disabled && !isAdmin}
                        className={`w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled && !isAdmin ? 'bg-gray-100 text-gray-600' : ''}`}
                        placeholder={patch.amountType === 'hours' ? '0.0' : '0.00'}
                    />
                    {patch.amountType === 'hours' && (
                        <span className="text-gray-500 ml-2">hours</span>
                    )}
                </div>
            </div>

            {/* Photos */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photos
                </label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled && !isAdmin}
                    className={`flex items-center px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 ${
                        disabled && !isAdmin 
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    title={disabled && !isAdmin ? "Cannot add photos - job is signed" : "Take Photos"}
                >
                    <CameraIcon />
                    <span className="ml-2">Take Photos</span>
                </button>
                
                {photos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {photos.map(photo => (
                            <div key={photo.id} className="relative">
                                <img
                                    src={photo.data}
                                    alt="Patch work"
                                    className="w-full h-24 object-cover rounded-md border border-gray-300"
                                />
                                {(!disabled || isAdmin) && (
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(photo.id)}
                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                                        title={disabled && !isAdmin ? "Cannot remove photos - job is signed" : "Remove photo"}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Patch;