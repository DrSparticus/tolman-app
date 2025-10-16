import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { PlusIcon, EditIcon, DeleteIcon, SortIcon } from '../Icons.js';
import ConfirmationModal from '../components/ConfirmationModal';

const crewsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/crews`;
const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const CrewsPage = ({ db, userData }) => {
    const [crews, setCrews] = useState([]);
    const [laborCrewTypes, setLaborCrewTypes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCrew, setEditingCrew] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [crewToDelete, setCrewToDelete] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    
    // Create initial crew types object from labor config
    const getInitialCrewTypes = () => {
        const initialTypes = {};
        laborCrewTypes.forEach(type => {
            // Convert crew type names to lowercase keys for consistency
            const key = type.name.toLowerCase().replace(/\s+/g, '');
            initialTypes[key] = false;
        });
        return initialTypes;
    };

    const [formData, setFormData] = useState({
        name: '',
        contractorType: 'employee',
        members: [''],
        crewTypes: getInitialCrewTypes()
    });

    useEffect(() => {
        if (!db) return;
        
        // Load crews
        const crewsCollection = collection(db, crewsPath);
        const unsubscribeCrews = onSnapshot(crewsCollection, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrews(crewsData);
        });

        // Load labor crew types from config
        const laborCrewTypesCollection = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribeLaborTypes = onSnapshot(laborCrewTypesCollection, (snapshot) => {
            const laborTypesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLaborCrewTypes(laborTypesData);
        });

        return () => {
            unsubscribeCrews();
            unsubscribeLaborTypes();
        };
    }, [db]);

    const sortedCrews = React.useMemo(() => {
        if (!sortConfig) return crews;
        
        return [...crews].sort((a, b) => {
            const aValue = a[sortConfig.key] || '';
            const bValue = b[sortConfig.key] || '';
            
            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [crews, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig?.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortDirection = (name) => sortConfig?.key === name ? sortConfig.direction : undefined;

    const resetForm = () => {
        setFormData({
            name: '',
            contractorType: 'employee',
            members: [''],
            crewTypes: getInitialCrewTypes()
        });
        setEditingCrew(null);
    };

    const openModal = (crew = null) => {
        if (crew) {
            setEditingCrew(crew);
            // Build crew types object dynamically from available types
            const crewTypes = {};
            laborCrewTypes.forEach(type => {
                const key = type.name.toLowerCase().replace(/\s+/g, '');
                crewTypes[key] = crew.crewTypes?.[key] || false;
            });
            
            setFormData({
                name: crew.name || '',
                contractorType: crew.contractorType || 'employee',
                members: crew.members && crew.members.length > 0 ? crew.members : [''],
                crewTypes: crewTypes
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCrew(null);
        resetForm();
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCrewTypeChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            crewTypes: {
                ...prev.crewTypes,
                [name]: checked
            }
        }));
    };

    const handleMemberChange = (index, value) => {
        const newMembers = [...formData.members];
        newMembers[index] = value;
        setFormData(prev => ({ ...prev, members: newMembers }));
    };

    const addMember = () => {
        setFormData(prev => ({
            ...prev,
            members: [...prev.members, '']
        }));
    };

    const removeMember = (index) => {
        if (formData.members.length > 1) {
            setFormData(prev => ({
                ...prev,
                members: prev.members.filter((_, i) => i !== index)
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db) return;

        // Filter out empty members
        const cleanMembers = formData.members.filter(member => member.trim() !== '');
        
        const crewData = {
            ...formData,
            members: cleanMembers,
            updatedAt: new Date().toISOString()
        };

        if (editingCrew) {
            await updateDoc(doc(db, crewsPath, editingCrew.id), crewData);
        } else {
            crewData.createdAt = new Date().toISOString();
            const newDocRef = doc(collection(db, crewsPath));
            await setDoc(newDocRef, crewData);
        }
        
        closeModal();
    };

    const openDeleteModal = (crew) => {
        setCrewToDelete(crew);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setCrewToDelete(null);
    };

    const handleDeleteCrew = async () => {
        if (!crewToDelete || !db) return;
        await deleteDoc(doc(db, crewsPath, crewToDelete.id));
        closeDeleteModal();
    };

    const getCrewTypeBadges = (crewTypes) => {
        const types = [];
        laborCrewTypes.forEach(type => {
            const key = type.name.toLowerCase().replace(/\s+/g, '');
            if (crewTypes?.[key]) {
                types.push(type.name);
            }
        });
        return types;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Crews</h1>
                <button
                    onClick={() => openModal()}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span className="ml-2">Add Crew</span>
                </button>
            </div>

            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('name')}>
                                    Crew Name <SortIcon direction={getSortDirection('name')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('contractorType')}>
                                    Type <SortIcon direction={getSortDirection('contractorType')} />
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Members
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Crew Types
                                </th>
                                <th scope="col" className="px-6 py-3 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCrews.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No crews found. Click "Add Crew" to create your first crew.
                                    </td>
                                </tr>
                            ) : (
                                sortedCrews.map(crew => {
                                    const crewTypeBadges = getCrewTypeBadges(crew.crewTypes);
                                    return (
                                        <tr key={crew.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{crew.name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    crew.contractorType === 'subcontractor' 
                                                        ? 'bg-orange-200 text-orange-800' 
                                                        : 'bg-green-200 text-green-800'
                                                }`}>
                                                    {crew.contractorType === 'subcontractor' ? 'Sub Contractor' : 'Employee'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    {crew.members && crew.members.length > 0 ? (
                                                        <div>
                                                            <span className="font-medium">{crew.members.length} member{crew.members.length !== 1 ? 's' : ''}</span>
                                                            <div className="text-gray-500 mt-1">
                                                                {crew.members.slice(0, 2).join(', ')}
                                                                {crew.members.length > 2 && ` +${crew.members.length - 2} more`}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">No members</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {crewTypeBadges.length > 0 ? (
                                                        crewTypeBadges.map(type => (
                                                            <span key={type} className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                                                {type}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">No types set</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end space-x-2">
                                                    <button 
                                                        onClick={() => openModal(crew)}
                                                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                                                        title="Edit crew"
                                                    >
                                                        <EditIcon />
                                                    </button>
                                                    <button 
                                                        onClick={() => openDeleteModal(crew)}
                                                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                                                        title="Delete crew"
                                                    >
                                                        <DeleteIcon />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Crew Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {editingCrew ? 'Edit Crew' : 'Add New Crew'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Crew Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Crew Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Enter crew name"
                                />
                            </div>

                            {/* Contractor Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Contractor Type
                                </label>
                                <select
                                    name="contractorType"
                                    value={formData.contractorType}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="employee">Employee</option>
                                    <option value="subcontractor">Sub Contractor</option>
                                </select>
                            </div>

                            {/* Crew Members */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Crew Members
                                </label>
                                {formData.members.map((member, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={member}
                                            onChange={(e) => handleMemberChange(index, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Enter member name"
                                        />
                                        {formData.members.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeMember(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-100 rounded-md"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addMember}
                                    className="mt-2 px-4 py-2 text-blue-600 hover:bg-blue-100 rounded-md text-sm"
                                >
                                    + Add Member
                                </button>
                            </div>

                            {/* Crew Types */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Crew Types
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {laborCrewTypes.map((type) => {
                                        const key = type.name.toLowerCase().replace(/\s+/g, '');
                                        return { key, label: type.name };
                                    }).map(({ key, label }) => (
                                        <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name={key}
                                                checked={formData.crewTypes[key]}
                                                onChange={handleCrewTypeChange}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    {editingCrew ? 'Update Crew' : 'Create Crew'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleDeleteCrew}
                title="Delete Crew"
                message={`Are you sure you want to delete the crew "${crewToDelete?.name}"? This action cannot be undone.`}
            />
        </div>
    );
};

export default CrewsPage;