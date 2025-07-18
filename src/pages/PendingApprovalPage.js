import React from 'react';
import TolmanLogo from '../TolmanConstructionLogo.png';

const PendingApprovalPage = ({ onSignOut }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg text-center">
            <div>
                <img
                    src={TolmanLogo}
                    alt="Tolman Construction Logo" 
                    className="w-48 h-auto rounded-lg mx-auto mb-4"
                />
                <h1 className="text-3xl font-bold text-gray-800">Account Pending Approval</h1>
                <p className="mt-2 text-gray-600">Your account has been created and is waiting for an administrator to approve it. Please check back later.</p>
            </div>
            <button
                onClick={onSignOut}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300"
            >
                Sign Out
            </button>
        </div>
    </div>
);

export default PendingApprovalPage;