import React, { useState, useEffect } from 'react';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    query,
    orderBy
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
import MaterialDependencyManager from '../components/materials/MaterialDependencyManager';

const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;
const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const MaterialsPage = ({ db }) => {
    const [materials, setMaterials] = useState([]);
    const [crewTypes, setCrewTypes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState(null);
    const [materialToDelete, setMaterialToDelete] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [activeTab, setActiveTab] = useState('materials');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) {
            console.log('MaterialsPage: No database connection');
            return;
        }
        
        console.log('MaterialsPage: Loading materials from path:', materialsPath);
        console.log('MaterialsPage: Environment variable REACT_APP_FIREBASE_PROJECT_ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
        console.log('MaterialsPage: Constructed path:', materialsPath);
        console.log('MaterialsPage: Database object:', db);
        
        try {
            const materialsCollection = collection(db, materialsPath);
            console.log('MaterialsPage: Materials collection created:', materialsCollection);
            
            // Use simple query without ordering to match working MaterialSelectModal
            const unsubscribe = onSnapshot(materialsCollection, (snapshot) => {
                console.log('MaterialsPage: Materials snapshot received:', snapshot.docs.length, 'documents');
                console.log('MaterialsPage: Snapshot metadata:', snapshot.metadata);
                console.log('MaterialsPage: Snapshot empty?', snapshot.empty);
                
                if (snapshot.empty) {
                    console.log('MaterialsPage: No materials found in collection');
                } else {
                    console.log('MaterialsPage: Materials found:', snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, data: doc.data() })));
                }
                
                const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('MaterialsPage: Processed materials data:', materialsData);
                setMaterials(materialsData);
                setLoading(false);
            }, (error) => {
                console.error('MaterialsPage: Error loading materials:', error);
                console.error('MaterialsPage: Error code:', error.code);
                console.error('MaterialsPage: Error message:', error.message);
                setLoading(false);
            });

            return unsubscribe;
        } catch (error) {
            console.error('MaterialsPage: Error setting up materials listener:', error);
            setLoading(false);
        }
    }, [db, materialsPath]);

    useEffect(() => {
        if (!db) {
            console.log('MaterialsPage: No database connection for crew types');
            return;
        }
        
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        const fullCrewPath = `${configPath}/labor/crewTypes`;
        console.log('MaterialsPage: Loading crew types from:', fullCrewPath);
        console.log('MaterialsPage: Crew collection ref:', crewCollectionRef);
        
        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            console.log('MaterialsPage: Crew types snapshot received:', snapshot.docs.length, 'documents');
            if (snapshot.empty) {
                console.log('MaterialsPage: No crew types found');
            } else {
                console.log('MaterialsPage: Crew types found:', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrewTypes(crewsData);
        }, (error) => {
            console.error('MaterialsPage: Error loading crew types:', error);
        });

        return unsubscribe;
    }, [db, configPath]);

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
                await updateDoc(materialDoc, {
                    ...materialData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, materialsPath), {
                    ...materialData,
                    displayOrder: materialData.displayOrder || (materials.length + 1) * 10,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
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

    const moveItem = async (dragIndex, dropIndex) => {
        const draggedItem = materials[dragIndex];
        const newMaterials = [...materials];
        newMaterials.splice(dragIndex, 1);
        newMaterials.splice(dropIndex, 0, draggedItem);
        
        // Update display orders
        const updatePromises = newMaterials.map((material, index) => {
            const newOrder = (index + 1) * 10;
            if (material.displayOrder !== newOrder) {
                return updateDoc(doc(db, materialsPath, material.id), { displayOrder: newOrder });
            }
            return Promise.resolve();
        });

        try {
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error updating material order:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg text-gray-600">Loading materials...</div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6">
                <button
                    onClick={() => setActiveTab('materials')}
                    className={`px-4 py-2 rounded-t-lg font-medium ${
                        activeTab === 'materials'
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    Materials Database
                </button>
                <button
                    onClick={() => setActiveTab('dependencies')}
                    className={`px-4 py-2 rounded-t-lg font-medium ${
                        activeTab === 'dependencies'
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    Material Dependencies
                </button>
            </div>

            {activeTab === 'materials' ? (
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
                                {sortedMaterials.map((material, index) => (
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => moveItem(index, Math.max(0, index - 1))}
                                                            disabled={index === 0}
                                                            className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            onClick={() => moveItem(index, Math.min(materials.length - 1, index + 1))}
                                                            disabled={index === materials.length - 1}
                                                            className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                                                        >
                                                            ↓
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(material);}} className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"><EditIcon />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(material);}} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"><DeleteIcon />
                                                        </button>
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
                </div>
            ) : (
                <MaterialDependencyManager db={db} materials={materials} />
            )}

            {isModalOpen && (
                <MaterialModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveMaterial}
                    material={currentMaterial}
                    crewTypes={crewTypes}
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