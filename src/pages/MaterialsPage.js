import React, { useState, useEffect } from 'react';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc
} from 'firebase/firestore';
import { 
    SortIcon, 
    ChevronDownIcon, 
    PlusIcon, 
    EditIcon, 
    DeleteIcon 
} from '../Icons.js';
import MaterialModal from '../components/MaterialModal';
import ConfirmationModal from '../components/ConfirmationModal';

const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;

const MaterialsPage = ({ db }) => {
    const [materials, setMaterials] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState(null);
    const [materialToDelete, setMaterialToDelete] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    useEffect(() => {
        if (!db) return;
        const materialsCollection = collection(db, materialsPath);
        const unsubscribe = onSnapshot(materialsCollection, (snapshot) => {
            const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(materialsData);
        }, (error) => {
            console.error("Error fetching materials: ", error);
        });
        return unsubscribe;
    }, [db]);

    const sortedMaterials = React.useMemo(() => {
        let sortableItems = [...materials];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [materials, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleOpenModal = (material = null) => {
        setCurrentMaterial(material);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentMaterial(null);
    };

    const handleOpenDeleteModal = (material) => {
        setMaterialToDelete(material);
        setIsDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setMaterialToDelete(null);
    };

    const handleSaveMaterial = async (materialData) => {
        if (!db) return;
        try {
            if (currentMaterial && currentMaterial.id) {
                const materialDoc = doc(db, materialsPath, currentMaterial.id);
                await updateDoc(materialDoc, materialData);
            } else {
                await addDoc(collection(db, materialsPath), materialData);
            }
        } catch (error) {
            console.error("Error saving material:", error);
        }
        handleCloseModal();
    };

    const handleDeleteMaterial = async () => {
        if (!db || !materialToDelete) return;
        try {
            await deleteDoc(doc(db, materialsPath, materialToDelete.id));
        } catch(error) {
            console.error("Error deleting material:", error);
        }
        handleCloseDeleteModal();
    };
    
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

        if (width && length) {
            return `${width} x ${length}`;
        } else if (width) {
            return width;
        } else if (length) {
            return length;
        }
        
        return 'N/A';
    };

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const getSortDirection = (name) => {
        if (!sortConfig) {
            return;
        }
        return sortConfig.key === name ? sortConfig.direction : undefined;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Materials Database</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                    <PlusIcon />
                    <span className="ml-2 hidden sm:inline">Add Material</span>
                </button>
            </div>
            
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3 w-10"></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('name')}>
                                    Material Name <SortIcon direction={getSortDirection('name')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('category')}>
                                    Category <SortIcon direction={getSortDirection('category')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('unit')}>
                                    Base Unit <SortIcon direction={getSortDirection('unit')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('price')}>
                                    Base Price <SortIcon direction={getSortDirection('price')} />
                                </th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        {sortedMaterials.map((material) => (
                            <React.Fragment key={material.id}>
                                <tbody className="border-b">
                                    <tr className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(material.id)}>
                                        <td className="px-6 py-4 text-gray-400">
                                            <ChevronDownIcon className={`transform transition-transform ${
                                                expandedRow === material.id ? 'rotate-180' : ''
                                            }`} />
                                        </td>
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            {material.name}
                                        </th>
                                        <td className="px-6 py-4 capitalize">{material.category ? material.category.replace('-', ' ') : 'General'}</td>
                                        <td className="px-6 py-4">{material.unit}</td>
                                        <td className="px-6 py-4">${parseFloat(material.price || 0).toFixed(3)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(material);}} className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(material);}} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRow === material.id && (
                                        <tr>
                                            <td colSpan="6" className="p-0">
                                                <div className="p-4 bg-gray-50">
                                                    <h4 className="font-bold mb-2 text-gray-700">Available Sizes</h4>
                                                    <ul className="list-disc pl-5">
                                                        {material.variants?.map(variant => (
                                                            <li key={variant.id}>{formatDimensions(variant)}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </React.Fragment>
                        ))}
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <MaterialModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveMaterial}
                    material={currentMaterial}
                />
            )}
             {isDeleteModalOpen && (
                <ConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={handleCloseDeleteModal}
                    onConfirm={handleDeleteMaterial}
                    title="Delete Material"
                    message={`Are you sure you want to delete "${materialToDelete?.name}"? This action cannot be undone.`}
                />
            )}
        </div>
    );
};

export default MaterialsPage;