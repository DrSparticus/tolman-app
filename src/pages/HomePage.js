import React from 'react';
import { pages as pageConfig } from '../pagesConfig.js';

const PageButton = ({ icon, text, onClick }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center w-48 h-48 bg-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
    >
        <div className="text-blue-600 mb-4">{React.cloneElement(icon, { className: "h-16 w-16" })}</div>
        <h2 className="text-xl font-bold text-gray-700">{text}</h2>
    </button>
);

const HomePage = ({ setCurrentPage, userData }) => {
    const hasAccess = (pageId) => userData?.role === 'admin' || !!userData?.permissions?.[pageId];

    return (
        <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">Tolman Construction</h1>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {pageConfig.filter(p => !p.hidden && p.id !== 'home').map(p => (
                    hasAccess(p.id) && (
                        <PageButton key={p.id} icon={p.icon} text={p.text} onClick={() => setCurrentPage(p.id)} />
                    )
                ))}
            </div>
        </div>
    );
};

export default HomePage;