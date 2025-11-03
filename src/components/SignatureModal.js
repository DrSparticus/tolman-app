import React, { useRef, useState, useEffect } from 'react';

const SignatureModal = ({ 
    isOpen,
    onClose,
    signature, 
    onSignatureChange, 
    required = false,
    isAdmin = false,
    onClear,
    patchesLocked = false
}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [tempSignature, setTempSignature] = useState('');

    useEffect(() => {
        if (signature) {
            try {
                const sigData = JSON.parse(signature);
                setCustomerName(sigData.name || '');
                setTempSignature(signature);
                if (sigData.drawing && canvasRef.current) {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        setHasDrawnSignature(true);
                    };
                    img.src = sigData.drawing;
                }
            } catch (error) {
                // Legacy signature format (just text)
                setCustomerName(signature);
                setTempSignature(signature);
            }
        } else {
            setCustomerName('');
            setTempSignature('');
            setHasDrawnSignature(false);
        }
    }, [signature, isOpen]);

    const getMousePos = (canvas, e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const getTouchPos = (canvas, e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        setIsDrawing(true);
        
        const pos = e.type.includes('mouse') ? getMousePos(canvas, e) : getTouchPos(canvas, e);
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        if (!isDrawing) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const pos = e.type.includes('mouse') ? getMousePos(canvas, e) : getTouchPos(canvas, e);
        
        ctx.lineTo(pos.x, pos.y);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.stroke();
        
        setHasDrawnSignature(true);
    };

    const stopDrawing = (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        setIsDrawing(false);
        updateTempSignature();
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawnSignature(false);
        updateTempSignature();
    };

    const updateTempSignature = () => {
        const canvas = canvasRef.current;
        const signatureData = {
            name: customerName,
            drawing: hasDrawnSignature ? canvas?.toDataURL() : null,
            timestamp: new Date().toISOString()
        };
        
        setTempSignature(JSON.stringify(signatureData));
    };

    const handleNameChange = (e) => {
        const newName = e.target.value;
        setCustomerName(newName);
        
        // Update temp signature immediately with the new name
        const canvas = canvasRef.current;
        const signatureData = {
            name: newName,
            drawing: hasDrawnSignature ? canvas?.toDataURL() : null,
            timestamp: new Date().toISOString()
        };
        
        setTempSignature(JSON.stringify(signatureData));
    };

    const handleSave = () => {
        if (customerName.trim() || hasDrawnSignature) {
            onSignatureChange(tempSignature);
            onClose();
        }
    };

    const handleClear = () => {
        setCustomerName('');
        setHasDrawnSignature(false);
        clearSignature();
        setTempSignature('');
        if (onClear) {
            onClear();
        }
        onClose();
    };

    const isSignatureComplete = customerName.trim() && hasDrawnSignature;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {patchesLocked ? '🔒 Signature Captured' : 'Customer Signature'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {patchesLocked && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-800 text-sm">
                                ✅ This job has been signed and patches are now protected from editing.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Customer Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Customer Name {required && '*'}
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={handleNameChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter customer name"
                                disabled={patchesLocked && !isAdmin}
                            />
                        </div>

                        {/* Drawing Area */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Signature Drawing {required && '*'}
                            </label>
                            <div className="border border-gray-300 rounded-md p-2 bg-white">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={200}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full border border-gray-200 rounded cursor-crosshair"
                                    style={{ 
                                        touchAction: 'none',
                                        opacity: (patchesLocked && !isAdmin) ? 0.6 : 1,
                                        pointerEvents: (patchesLocked && !isAdmin) ? 'none' : 'auto'
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Sign above using your mouse or touch screen
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center pt-4">
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                                    disabled={patchesLocked && !isAdmin}
                                >
                                    Clear Canvas
                                </button>
                                {isAdmin && patchesLocked && (
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                    >
                                        Admin: Clear All
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={required && !isSignatureComplete}
                                    className={`px-4 py-2 rounded text-white ${
                                        required && !isSignatureComplete 
                                            ? 'bg-gray-400 cursor-not-allowed' 
                                            : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {patchesLocked ? 'Update Signature' : 'Save Signature'}
                                </button>
                            </div>
                        </div>

                        {required && !isSignatureComplete && (
                            <p className="text-xs text-red-600 text-center">
                                Both name and signature drawing are required
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;