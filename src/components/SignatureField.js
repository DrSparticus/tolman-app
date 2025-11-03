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
    const [signatureMode, setSignatureMode] = useState('name'); // 'name' or 'draw'

    useEffect(() => {
        if (signature) {
            try {
                const sigData = JSON.parse(signature);
                setCustomerName(sigData.name || '');
                setSignatureMode(sigData.mode || 'name');
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
                setSignatureMode('name');
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
            mode: signatureMode,
            drawing: signatureMode === 'draw' && hasDrawnSignature ? canvas.toDataURL() : null,
            timestamp: new Date().toISOString()
        };
        
        onSignatureChange(JSON.stringify(signatureData));
    };

    const handleNameChange = (e) => {
        setCustomerName(e.target.value);
        setTimeout(updateSignature, 100);
    };

    const handleModeChange = (mode) => {
        if (disabled) return;
        setSignatureMode(mode);
        if (mode === 'draw') {
            setTimeout(updateSignature, 100);
        } else {
            setTimeout(updateSignature, 100);
        }
    };

    const isSigned = () => {
        if (signatureMode === 'name') {
            return customerName.trim().length > 0;
        } else {
            return hasDrawnSignature && customerName.trim().length > 0;
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Signature
                {required && <span className="text-red-600"> *</span>}
                {isSigned() && <span className="text-green-600 ml-2">✓ Signed</span>}
            </label>
            
            {/* Customer Name Input */}
            <div className="mb-3">
                <input
                    type="text"
                    value={customerName}
                    onChange={handleNameChange}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100' : ''}`}
                    placeholder="Customer name"
                />
            </div>

            {/* Signature Mode Toggle */}
            <div className="mb-3 flex space-x-2">
                <button
                    type="button"
                    onClick={() => handleModeChange('name')}
                    disabled={disabled}
                    className={`px-3 py-1 rounded text-sm ${
                        signatureMode === 'name' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700'
                    } ${disabled ? 'opacity-50' : 'hover:bg-blue-700'}`}
                >
                    Name Only
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('draw')}
                    disabled={disabled}
                    className={`px-3 py-1 rounded text-sm ${
                        signatureMode === 'draw' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700'
                    } ${disabled ? 'opacity-50' : 'hover:bg-blue-700'}`}
                >
                    Draw Signature
                </button>
            </div>

            {/* Drawing Canvas */}
            {signatureMode === 'draw' && (
                <div className="border border-gray-300 rounded-md p-2 bg-white">
                    <canvas
                        ref={canvasRef}
                        width={400}
                        height={150}
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
                    <div className="mt-2 flex space-x-2">
                        <button
                            type="button"
                            onClick={clearCanvas}
                            disabled={disabled}
                            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                        >
                            Clear
                        </button>
                        <p className="text-xs text-gray-500 flex items-center">
                            Draw your signature above
                        </p>
                    </div>
                </div>
            )}

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
                    * Customer signature is required
                </p>
            )}
        </div>
    );
};

export default SignatureField;