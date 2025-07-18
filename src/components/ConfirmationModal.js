import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">{title}</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;