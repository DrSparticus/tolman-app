import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;

export default function MaterialSelectModal({ isOpen, onClose, onSelect, db, existingMaterials }) {
    const [materials, setMaterials] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!db) return;
        const materialsCollection = collection(db, materialsPath);
        const unsubscribe = onSnapshot(materialsCollection, (snapshot) => {
            const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(materialsData);
        });
        return unsubscribe;
    }, [db]);

    const filteredMaterials = materials.filter(material => 
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !existingMaterials.some(em => em.materialId === material.id)
    );

    const handleSelect = (material) => {
        onSelect(material);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Select a Material</h2>
                <input
                    type="text"
                    placeholder="Search materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded-md mb-4"
                />
                <div className="overflow-y-auto flex-grow">
                    {filteredMaterials.map(material => (
                        <div key={material.id} onClick={() => handleSelect(material)} className="p-3 hover:bg-gray-100 cursor-pointer rounded-md">
                            <h3 className="font-bold">{material.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">{material.category.replace('-', ' ')}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 text-right">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
