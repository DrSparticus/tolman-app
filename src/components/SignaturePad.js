import React, { useRef, useEffect, useState } from 'react';

const SignaturePad = ({ isOpen, onClose, onSave, initialSignature = '' }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                // Set canvas size
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * 2; // High DPI
                canvas.height = rect.height * 2;
                ctx.scale(2, 2);
                
                // Set drawing style
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Clear canvas
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Load existing signature if provided
                if (initialSignature) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
                        setHasSignature(true);
                    };
                    img.src = initialSignature;
                }
            }
        }
    }, [isOpen, initialSignature]);

    const startDrawing = (e) => {
        setIsDrawing(true);
        setHasSignature(true);
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        const dataURL = canvas.toDataURL('image/png');
        onSave(dataURL);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    // Prevent scrolling when drawing on mobile
    useEffect(() => {
        const preventScroll = (e) => {
            if (isDrawing) {
                e.preventDefault();
            }
        };

        if (isOpen) {
            document.addEventListener('touchmove', preventScroll, { passive: false });
            return () => {
                document.removeEventListener('touchmove', preventScroll);
            };
        }
    }, [isOpen, isDrawing]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Digital Signature</h3>
                        <button
                            onClick={handleCancel}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Instructions */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                            Sign in the box below using your finger or mouse. Your signature will be saved with the patch job.
                        </p>
                    </div>

                    {/* Signature Canvas */}
                    <div className="border-2 border-gray-300 rounded-lg mb-6 bg-white">
                        <canvas
                            ref={canvasRef}
                            className="w-full h-48 cursor-crosshair touch-none"
                            style={{ touchAction: 'none' }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 sm:space-x-4">
                        <button
                            onClick={clearSignature}
                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                            Clear Signature
                        </button>
                        
                        <div className="flex space-x-2">
                            <button
                                onClick={handleCancel}
                                className="flex-1 sm:flex-none px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveSignature}
                                disabled={!hasSignature}
                                className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Signature
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignaturePad;