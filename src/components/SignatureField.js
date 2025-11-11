import React, { useRef, useState, useEffect } from 'react';

const SignatureField = ({ 
    signature, 
    onSignatureChange, 
    required = false, 
    disabled = false,
    onClear,
    showClearButton = false,
    isAdmin = false
}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        if (signature) {
            try {
                const sigData = JSON.parse(signature);
                setCustomerName(sigData.name || '');
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
            }
        }
    }, [signature]);

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
        if (disabled) return;
        
        setIsDrawing(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const pos = e.touches ? getTouchPos(canvas, e) : getMousePos(canvas, e);
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        
        e.preventDefault();
    };

    const draw = (e) => {
        if (!isDrawing || disabled) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const pos = e.touches ? getTouchPos(canvas, e) : getMousePos(canvas, e);
        
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        e.preventDefault();
    };

    const stopDrawing = (e) => {
        if (!isDrawing || disabled) return;
        
        setIsDrawing(false);
        setHasDrawnSignature(true);
        updateSignature();
        
        e.preventDefault();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawnSignature(false);
        updateSignature();
    };

    const updateSignature = () => {
        const canvas = canvasRef.current;
        const signatureData = {
            name: customerName,
            drawing: hasDrawnSignature ? canvas.toDataURL() : null,
            timestamp: new Date().toISOString()
        };
        
        onSignatureChange(JSON.stringify(signatureData));
    };

    const handleNameChange = (e) => {
        const newName = e.target.value;
        setCustomerName(newName);
        
        // Update signature immediately with the new name
        const canvas = canvasRef.current;
        const signatureData = {
            name: newName,
            drawing: hasDrawnSignature ? canvas?.toDataURL() : null,
            timestamp: new Date().toISOString()
        };
        
        onSignatureChange(JSON.stringify(signatureData));
    };

    const isSigned = () => {
        return customerName.trim().length > 0 && hasDrawnSignature;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contractor Name Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contractor Name
                    {required && <span className="text-red-600"> *</span>}
                </label>
                <input
                    type="text"
                    value={customerName}
                    onChange={handleNameChange}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100' : ''}`}
                    placeholder="Contractor name"
                />
            </div>

            {/* Signature Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Signature
                    {required && <span className="text-red-600"> *</span>}
                    {isSigned() && <span className="text-green-600 ml-2">✓ Signed</span>}
                </label>
                
                <div className="border border-gray-300 rounded-md p-2 bg-white">
                    <canvas
                        ref={canvasRef}
                        width={300}
                        height={80}
                        className="border border-gray-200 w-full"
                        style={{ touchAction: 'none' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                    <div className="mt-2 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={clearCanvas}
                            disabled={disabled}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50"
                        >
                            Clear
                        </button>
                        <p className="text-xs text-gray-500">
                            Sign above
                        </p>
                    </div>
                </div>

                {/* Admin Clear Button */}
                {showClearButton && isAdmin && isSigned() && (
                    <div className="mt-2">
                        <button
                            type="button"
                            onClick={onClear}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                            Admin: Clear Signature
                        </button>
                    </div>
                )}

                {required && !isSigned() && (
                    <p className="text-xs text-red-600 mt-1">
                        * Contractor signature is required
                    </p>
                )}
            </div>
        </div>
    );
};

export default SignatureField;