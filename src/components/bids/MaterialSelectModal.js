import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;

export default function MaterialSelectModal({ db, isOpen, onClose, onSelect, existingMaterials }) {
    const [materials, setMaterials] = useState([]);
    const [filteredMaterials, setFilteredMaterials] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('drywall-board');

    useEffect(() => {
        if (!db || !isOpen) return;
        
        const materialsCollection = collection(db, materialsPath);
        const unsubscribe = onSnapshot(materialsCollection, (snapshot) => {
            const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(materialsData);
        });
        
        return unsubscribe;
    }, [db, isOpen]);

    useEffect(() => {
        let filtered = materials.filter(material => {
            const existingIds = existingMaterials?.map(m => m.materialId) || [];
            return !existingIds.includes(material.id);
        });

        if (searchTerm) {
            filtered = filtered.filter(material =>
                material.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedCategory) {
            filtered = filtered.filter(material => material.category === selectedCategory);
        }

        setFilteredMaterials(filtered);
    }, [materials, searchTerm, selectedCategory, existingMaterials]);

    const handleSelect = (material) => {
        const newMaterial = {
            materialId: material.id,
            materialName: material.name,
            laborType: 'finished',
            variants: [] // Start with empty variants, will be populated when quantities are added
        };
        onSelect(newMaterial);
        onClose();
    };

    const categories = [...new Set(materials.map(m => m.category).filter(Boolean))];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Select Material</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search materials..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3"
                    >
                        <option value="">All Categories</option>
                        <option value="drywall-board">Drywall Board</option>
                        {categories.filter(cat => cat !== 'drywall-board').map(category => (
                            <option key={category} value={category}>
                                {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="max-h-64 overflow-y-auto">
                    {filteredMaterials.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No materials found</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredMaterials.map(material => (
                                <button
                                    key={material.id}
                                    onClick={() => handleSelect(material)}
                                    className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50"
                                >
                                    <div className="font-medium">{material.name}</div>
                                    <div className="text-sm text-gray-500">{material.category?.replace('-', ' ')}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
