import React, { useState } from 'react';

const AreaNameModal = ({ isOpen, onClose, onConfirm }) => {
    const [areaName, setAreaName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (areaName.trim()) {
            onConfirm(areaName.trim());
            setAreaName('');
        }
    };

    const handleCancel = () => {
        setAreaName('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Name Your Area</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="areaName" className="block text-sm font-medium text-gray-700 mb-2">
                            Area Name
                        </label>
                        <input
                            type="text"
                            id="areaName"
                            value={areaName}
                            onChange={(e) => setAreaName(e.target.value)}
                            placeholder="e.g., Upper, Basement, Sports Court..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                            disabled={!areaName.trim()}
                        >
                            Add Area
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AreaNameModal;
