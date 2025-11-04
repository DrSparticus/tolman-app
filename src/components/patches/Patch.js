import React, { useState, useRef, useCallback } from 'react';
import { CameraIcon } from '../../Icons';

const Patch = ({ patch, onUpdate, onRemove, canRemove = true, disabled = false, isAdmin = false }) => {
    const [photos, setPhotos] = useState(patch.photos || []);
    const [isDragOver, setIsDragOver] = useState(false);
    const [showMobileOptions, setShowMobileOptions] = useState(false);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Detect if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const handleInputChange = (field, value) => {
        onUpdate(patch.id, { ...patch, [field]: value });
    };

    const processFiles = useCallback((files) => {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newPhoto = {
                        id: Date.now() + Math.random(),
                        data: event.target.result,
                        name: file.name,
                        timestamp: new Date().toISOString()
                    };
                    setPhotos(prev => {
                        const updatedPhotos = [...prev, newPhoto];
                        onUpdate(patch.id, { ...patch, photos: updatedPhotos });
                        return updatedPhotos;
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }, [patch, onUpdate]);

    const handlePhotoCapture = (e) => {
        processFiles(e.target.files);
        setShowMobileOptions(false);
    };

    // Drag and drop handlers
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled || isAdmin) {
            setIsDragOver(true);
        }
    }, [disabled, isAdmin]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        
        if (disabled && !isAdmin) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFiles(files);
        }
    }, [disabled, isAdmin, processFiles]);

    const handleAddPhotos = () => {
        if (isMobile) {
            setShowMobileOptions(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleCameraCapture = () => {
        cameraInputRef.current?.click();
        setShowMobileOptions(false);
    };

    const handleGalleryUpload = () => {
        fileInputRef.current?.click();
        setShowMobileOptions(false);
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
                    Photos *
                </label>
                
                {/* Hidden file inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                />
                
                {/* Photo upload area */}
                <div className="flex flex-wrap gap-4 mb-4">
                    {/* Add photos button/drop zone */}
                    <div
                        className={`relative w-32 h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                            disabled && !isAdmin 
                                ? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
                                : isDragOver
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-400 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                        onClick={disabled && !isAdmin ? undefined : handleAddPhotos}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        title={disabled && !isAdmin ? "Cannot add photos - job is signed" : isMobile ? "Add Photos" : "Click to upload or drag & drop photos"}
                    >
                        <div className={`text-3xl mb-2 ${disabled && !isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>
                            +
                        </div>
                        <div className={`text-xs text-center px-2 ${disabled && !isAdmin ? 'text-gray-400' : 'text-gray-600'}`}>
                            {isMobile ? "Add Photos" : isDragOver ? "Drop photos here" : "Click or drag photos"}
                        </div>
                    </div>
                    
                    {/* Photo thumbnails */}
                    {photos.map(photo => (
                        <div key={photo.id} className="relative w-32 h-40">
                            <img
                                src={photo.data}
                                alt="Patch work"
                                className="w-full h-full object-cover rounded-lg border border-gray-300"
                            />
                            {(!disabled || isAdmin) && (
                                <button
                                    type="button"
                                    onClick={() => removePhoto(photo.id)}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700 shadow-lg"
                                    title={disabled && !isAdmin ? "Cannot remove photos - job is signed" : "Remove photo"}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Mobile options modal */}
                {isMobile && showMobileOptions && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
                        <div className="bg-white rounded-t-lg w-full max-w-md p-6 pb-8">
                            <h3 className="text-lg font-semibold mb-4">Add Photos</h3>
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleCameraCapture}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    <CameraIcon />
                                    <span className="ml-2">Take New Photo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGalleryUpload}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="ml-2">Choose from Gallery</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowMobileOptions(false)}
                                    className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Patch;