import React from 'react';
import TolmanLogo from '../TolmanConstructionLogo.png';
import { GoogleIcon } from '../Icons.js';

const LoginPage = ({ onSignIn }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg text-center">
            <div>
                <img
                    src={TolmanLogo}
                    alt="Tolman Construction Logo" 
                    className="w-2/3 h-auto rounded-lg mx-auto mb-4"
                />
                <h1 className="text-3xl font-bold text-gray-800">Tolman Project Management</h1>
                <p className="mt-2 text-gray-600">Please sign in to continue</p>
            </div>
            <button
                onClick={onSignIn}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300"
            >
                <GoogleIcon />
                Sign in with Google
            </button>
        </div>
    </div>
);

export default LoginPage;