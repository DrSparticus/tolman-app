import React from 'react';

const formatDimensions = (variant) => {
    if (!variant) return 'N/A';
    const widthFtStr = variant.widthFt > 0 ? `${variant.widthFt}'` : '';
    const widthInStr = variant.widthIn > 0 ? `${variant.widthIn}"` : '';
    const widthParts = [widthFtStr, widthInStr].filter(Boolean);
    const width = widthParts.join(' ');

    const lengthFtStr = variant.lengthFt > 0 ? `${variant.lengthFt}'` : '';
    const lengthInStr = variant.lengthIn > 0 ? `${variant.lengthIn}"` : '';
    const lengthParts = [lengthFtStr, lengthInStr].filter(Boolean);
    const length = lengthParts.join(' ');

    if (width && length) return `${width} x ${length}`;
    if (width) return width;
    if (length) return length;
    return 'N/A';
};

export default function MaterialItem({ material, onUpdate, onRemove }) {
    const handleQuantityButtonClick = (variantId, change) => {
        const currentQty = parseInt(material.variants.find(v => v.id === variantId)?.quantity, 10) || 0;
        const newQuantity = currentQty + change;

        const updatedVariants = material.variants.map(v =>
            v.id === variantId ? { ...v, quantity: newQuantity } : v
        );
        onUpdate(material.materialId, { ...material, variants: updatedVariants });
    };

    const handleQuantityInputChange = (variantId, value) => {
        if (/^-?\d*$/.test(value)) {
            const updatedVariants = material.variants.map(v =>
                v.id === variantId ? { ...v, quantity: value } : v
            );
            onUpdate(material.materialId, { ...material, variants: updatedVariants });
        }
    };

    const handleQuantityBlur = (variantId, value) => {
        const parsedValue = parseInt(value, 10);
        const finalQuantity = isNaN(parsedValue) ? 0 : parsedValue;

        const updatedVariants = material.variants.map(v =>
            v.id === variantId ? { ...v, quantity: finalQuantity } : v
        );
        onUpdate(material.materialId, { ...material, variants: updatedVariants });
    };

    return (
        <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-gray-800">{material.name}</h4>
                <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="space-y-2">
                {material.variants.map(variant => (
                    <div key={variant.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span>{formatDimensions(variant)}</span>
                        <div className="flex items-center">
                            <button type="button" onClick={() => handleQuantityButtonClick(variant.id, -1)} className="bg-gray-300 text-black rounded-l-md h-9 w-9 font-bold text-lg flex items-center justify-center">-</button>
                            <input
                                type="text"
                                value={variant.quantity ?? ''}
                                onChange={(e) => handleQuantityInputChange(variant.id, e.target.value)}
                                onBlur={(e) => handleQuantityBlur(variant.id, e.target.value)}
                                className="text-lg font-medium w-16 text-center border-t border-b border-gray-300 h-9 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Qty"
                            />
                            <button type="button" onClick={() => handleQuantityButtonClick(variant.id, 1)} className="bg-gray-300 text-black rounded-r-md h-9 w-9 font-bold text-lg flex items-center justify-center">+</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
