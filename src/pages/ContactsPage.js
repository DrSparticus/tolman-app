import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { PlusIcon, EditIcon, DeleteIcon } from '../Icons.js';
import ConfirmationModal from '../components/ConfirmationModal';

const crewsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/crews`;
const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const ContactsPage = ({ db, userData }) => {
    const [activeTab, setActiveTab] = useState('crews');
    
    // Crews state
    const [crews, setCrews] = useState([]);
    const [laborCrewTypes, setLaborCrewTypes] = useState([]);
    const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
    const [editingCrew, setEditingCrew] = useState(null);
    const [isCrewDeleteModalOpen, setIsCrewDeleteModalOpen] = useState(false);
    const [crewToDelete, setCrewToDelete] = useState(null);
    const [crewSortConfig] = useState({ key: 'name', direction: 'asc' });
    
    // Customers state
    const [customers, setCustomers] = useState([]);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    
    // Suppliers state
    const [suppliers, setSuppliers] = useState([]);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [showSupplierForm, setShowSupplierForm] = useState(false);
    
    // Common state
    const [loading, setLoading] = useState(true);

    // Initial form states
    const getInitialCrewTypes = () => {
        const initialTypes = {};
        laborCrewTypes.forEach(type => {
            const key = type.name.toLowerCase().replace(/\s+/g, '');
            initialTypes[key] = false;
        });
        return initialTypes;
    };

    const [crewFormData, setCrewFormData] = useState({
        name: '',
        contractorType: 'employee',
        members: [''],
        crewTypes: {}
    });

    const emptyCustomer = {
        name: '',
        type: 'individual',
        address: '',
        contacts: []
    };

    const emptySupplier = {
        name: '',
        salesmanName: '',
        salesmanPhone: '',
        salesmanEmail: '',
        branches: []
    };

    useEffect(() => {
        if (!db) return;
        
        // Load crews
        const crewsCollection = collection(db, crewsPath);
        const unsubscribeCrews = onSnapshot(crewsCollection, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrews(crewsData);
        });

        // Load customers
        const customersQuery = query(collection(db, configPath, 'customers', 'customerList'), orderBy('name'));
        const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(customersData);
        });

        // Load suppliers
        const suppliersQuery = query(collection(db, configPath, 'suppliers', 'supplierList'), orderBy('name'));
        const unsubscribeSuppliers = onSnapshot(suppliersQuery, (snapshot) => {
            const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSuppliers(suppliersData);
        });

        // Load labor crew types from config
        const laborCrewTypesCollection = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribeLaborTypes = onSnapshot(laborCrewTypesCollection, (snapshot) => {
            const laborTypesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLaborCrewTypes(laborTypesData);
            setLoading(false);
        });

        return () => {
            unsubscribeCrews();
            unsubscribeCustomers();
            unsubscribeSuppliers();
            unsubscribeLaborTypes();
        };
    }, [db]);

    // Update crew form data when laborCrewTypes changes
    useEffect(() => {
        const getInitialCrewTypes = () => {
            const initialTypes = {};
            laborCrewTypes.forEach(type => {
                const key = type.name.toLowerCase().replace(/\s+/g, '');
                initialTypes[key] = false;
            });
            return initialTypes;
        };
        
        setCrewFormData(prev => ({
            ...prev,
            crewTypes: getInitialCrewTypes()
        }));
    }, [laborCrewTypes]);

    // Crew functions
    const sortedCrews = React.useMemo(() => {
        if (!crewSortConfig) return crews;
        
        return [...crews].sort((a, b) => {
            const aValue = a[crewSortConfig.key] || '';
            const bValue = b[crewSortConfig.key] || '';
            
            if (aValue < bValue) {
                return crewSortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return crewSortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [crews, crewSortConfig]);

    const resetCrewForm = () => {
        setCrewFormData({
            name: '',
            contractorType: 'employee',
            members: [''],
            crewTypes: getInitialCrewTypes()
        });
        setEditingCrew(null);
    };

    const openCrewModal = (crew = null) => {
        if (crew) {
            setEditingCrew(crew);
            const crewTypes = {};
            laborCrewTypes.forEach(type => {
                const key = type.name.toLowerCase().replace(/\s+/g, '');
                crewTypes[key] = crew.crewTypes?.[key] || false;
            });
            
            setCrewFormData({
                name: crew.name || '',
                contractorType: crew.contractorType || 'employee',
                members: crew.members && crew.members.length > 0 ? crew.members : [''],
                crewTypes: crewTypes
            });
        } else {
            resetCrewForm();
        }
        setIsCrewModalOpen(true);
    };

    const closeCrewModal = () => {
        setIsCrewModalOpen(false);
        setEditingCrew(null);
        resetCrewForm();
    };

    const handleCrewInputChange = (e) => {
        const { name, value } = e.target;
        setCrewFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCrewTypeChange = (e) => {
        const { name, checked } = e.target;
        setCrewFormData(prev => ({
            ...prev,
            crewTypes: {
                ...prev.crewTypes,
                [name]: checked
            }
        }));
    };

    const handleMemberChange = (index, value) => {
        const newMembers = [...crewFormData.members];
        newMembers[index] = value;
        setCrewFormData(prev => ({ ...prev, members: newMembers }));
    };

    const addMember = () => {
        setCrewFormData(prev => ({
            ...prev,
            members: [...prev.members, '']
        }));
    };

    const removeMember = (index) => {
        if (crewFormData.members.length > 1) {
            setCrewFormData(prev => ({
                ...prev,
                members: prev.members.filter((_, i) => i !== index)
            }));
        }
    };

    const handleCrewSubmit = async (e) => {
        e.preventDefault();
        if (!db) return;

        const cleanMembers = crewFormData.members.filter(member => member.trim() !== '');
        
        const crewData = {
            ...crewFormData,
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
        
        closeCrewModal();
    };

    const openCrewDeleteModal = (crew) => {
        setCrewToDelete(crew);
        setIsCrewDeleteModalOpen(true);
    };

    const closeCrewDeleteModal = () => {
        setIsCrewDeleteModalOpen(false);
        setCrewToDelete(null);
    };

    const handleDeleteCrew = async () => {
        if (!crewToDelete || !db) return;
        await deleteDoc(doc(db, crewsPath, crewToDelete.id));
        closeCrewDeleteModal();
    };

    // Customer functions
    const handleSaveCustomer = async (customer) => {
        try {
            if (customer.id) {
                const customerRef = doc(db, configPath, 'customers', 'customerList', customer.id);
                await updateDoc(customerRef, {
                    name: customer.name,
                    type: customer.type,
                    address: customer.address,
                    contacts: customer.contacts,
                    updatedAt: new Date()
                });
            } else {
                await addDoc(collection(db, configPath, 'customers', 'customerList'), {
                    name: customer.name,
                    type: customer.type,
                    address: customer.address,
                    contacts: customer.contacts,
                    createdAt: new Date()
                });
            }
            setShowCustomerForm(false);
            setEditingCustomer(null);
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer. Please try again.');
        }
    };

    const handleDeleteCustomer = async (customerId) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            try {
                await deleteDoc(doc(db, configPath, 'customers', 'customerList', customerId));
            } catch (error) {
                console.error('Error deleting customer:', error);
                alert('Error deleting customer. Please try again.');
            }
        }
    };

    const startEditCustomer = (customer) => {
        setEditingCustomer({ ...customer, contacts: customer.contacts || [] });
        setShowCustomerForm(true);
    };

    const startNewCustomer = () => {
        setEditingCustomer({ ...emptyCustomer });
        setShowCustomerForm(true);
    };

    // Supplier functions
    const handleSaveSupplier = async (supplier) => {
        try {
            if (supplier.id) {
                const supplierRef = doc(db, configPath, 'suppliers', 'supplierList', supplier.id);
                await updateDoc(supplierRef, {
                    name: supplier.name,
                    salesmanName: supplier.salesmanName,
                    salesmanPhone: supplier.salesmanPhone,
                    salesmanEmail: supplier.salesmanEmail,
                    branches: supplier.branches,
                    updatedAt: new Date()
                });
            } else {
                await addDoc(collection(db, configPath, 'suppliers', 'supplierList'), {
                    name: supplier.name,
                    salesmanName: supplier.salesmanName,
                    salesmanPhone: supplier.salesmanPhone,
                    salesmanEmail: supplier.salesmanEmail,
                    branches: supplier.branches,
                    createdAt: new Date()
                });
            }
            setShowSupplierForm(false);
            setEditingSupplier(null);
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('Error saving supplier. Please try again.');
        }
    };

    const handleDeleteSupplier = async (supplierId) => {
        if (window.confirm('Are you sure you want to delete this supplier?')) {
            try {
                await deleteDoc(doc(db, configPath, 'suppliers', 'supplierList', supplierId));
            } catch (error) {
                console.error('Error deleting supplier:', error);
                alert('Error deleting supplier. Please try again.');
            }
        }
    };

    const startEditSupplier = (supplier) => {
        setEditingSupplier({ 
            ...supplier, 
            branches: supplier.branches || [] 
        });
        setShowSupplierForm(true);
    };

    const startNewSupplier = () => {
        setEditingSupplier({ ...emptySupplier });
        setShowSupplierForm(true);
    };

    // Add new contact handler
    const handleAddNew = () => {
        switch (activeTab) {
            case 'crews':
                openCrewModal();
                break;
            case 'customers':
                startNewCustomer();
                break;
            case 'suppliers':
                startNewSupplier();
                break;
            default:
                break;
        }
    };

    const renderCrewsTab = () => {
        return (
            <div className="crews-section">
                <div className="space-y-2">
                    {sortedCrews.map(crew => (
                        <div key={crew.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{crew.name}</h4>
                                    <p className="text-sm text-gray-600 capitalize">{crew.contractorType}</p>
                                    <div className="text-sm text-gray-500">
                                        Members: {crew.members?.join(', ') || 'None'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {Object.entries(crew.crewTypes || {})
                                            .filter(([_, value]) => value)
                                            .map(([key]) => key)
                                            .join(', ') || 'No specializations'
                                        }
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => openCrewModal(crew)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <EditIcon size={16} />
                                    </button>
                                    <button 
                                        onClick={() => openCrewDeleteModal(crew)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <DeleteIcon size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCustomersTab = () => {
        return (
            <div className="customers-section">
                <div className="space-y-2">
                    {customers.map(customer => (
                        <div key={customer.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{customer.name}</h4>
                                    <p className="text-sm text-gray-600 capitalize">{customer.type}</p>
                                    {customer.address && (
                                        <div className="text-sm text-gray-500">
                                            {customer.address}
                                        </div>
                                    )}
                                    {customer.contacts && customer.contacts.length > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {customer.contacts.length} contact(s)
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => startEditCustomer(customer)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <EditIcon size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCustomer(customer.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <DeleteIcon size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderSuppliersTab = () => {
        return (
            <div className="suppliers-section">
                <div className="space-y-2">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{supplier.name}</h4>
                                    {supplier.salesmanName && (
                                        <p className="text-sm text-gray-600">{supplier.salesmanName}</p>
                                    )}
                                    <div className="text-sm text-gray-500">
                                        {[supplier.salesmanPhone, supplier.salesmanEmail].filter(Boolean).join(' • ')}
                                    </div>
                                    {supplier.branches && supplier.branches.length > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {supplier.branches.length} branch(es)
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => startEditSupplier(supplier)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <EditIcon size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSupplier(supplier.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <DeleteIcon size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64">Loading contacts...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Contacts</h1>
                <button 
                    onClick={handleAddNew}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <PlusIcon size={16} />
                    Add New {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                    {['crews', 'customers', 'suppliers'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                                activeTab === tab
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'crews' && renderCrewsTab()}
                {activeTab === 'customers' && renderCustomersTab()}
                {activeTab === 'suppliers' && renderSuppliersTab()}
            </div>

            {/* Crew Modal */}
            {isCrewModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                {editingCrew ? 'Edit Crew' : 'Add New Crew'}
                            </h3>
                            <form onSubmit={handleCrewSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={crewFormData.name}
                                        onChange={handleCrewInputChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contractor Type</label>
                                    <select
                                        name="contractorType"
                                        value={crewFormData.contractorType}
                                        onChange={handleCrewInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="subcontractor">Subcontractor</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Members</label>
                                    {crewFormData.members.map((member, index) => (
                                        <div key={index} className="flex gap-2 mt-1">
                                            <input
                                                type="text"
                                                value={member}
                                                onChange={(e) => handleMemberChange(index, e.target.value)}
                                                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                                                placeholder="Member name"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeMember(index)}
                                                disabled={crewFormData.members.length === 1}
                                                className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                                            >
                                                <DeleteIcon size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addMember}
                                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        + Add Member
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Crew Types</label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {laborCrewTypes.map(type => {
                                            const key = type.name.toLowerCase().replace(/\s+/g, '');
                                            return (
                                                <label key={type.id} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        name={key}
                                                        checked={crewFormData.crewTypes[key] || false}
                                                        onChange={handleCrewTypeChange}
                                                        className="mr-2"
                                                    />
                                                    <span className="text-sm">{type.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={closeCrewModal}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        {editingCrew ? 'Update' : 'Create'} Crew
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Modal */}
            {showCustomerForm && editingCustomer && (
                <CustomerFormModal
                    customer={editingCustomer}
                    onSave={handleSaveCustomer}
                    onCancel={() => {
                        setShowCustomerForm(false);
                        setEditingCustomer(null);
                    }}
                />
            )}

            {/* Supplier Modal */}
            {showSupplierForm && editingSupplier && (
                <SupplierFormModal
                    supplier={editingSupplier}
                    onSave={handleSaveSupplier}
                    onCancel={() => {
                        setShowSupplierForm(false);
                        setEditingSupplier(null);
                    }}
                />
            )}

            {/* Crew Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isCrewDeleteModalOpen}
                onClose={closeCrewDeleteModal}
                onConfirm={handleDeleteCrew}
                title="Delete Crew"
                message={`Are you sure you want to delete "${crewToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
            />
        </div>
    );
};

// Customer Form Modal Component
const CustomerFormModal = ({ customer, onSave, onCancel }) => {
    const [formData, setFormData] = useState(customer);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleContactChange = (index, field, value) => {
        const updatedContacts = [...formData.contacts];
        updatedContacts[index] = {
            ...updatedContacts[index],
            [field]: value
        };
        setFormData(prev => ({
            ...prev,
            contacts: updatedContacts
        }));
    };

    const addContact = () => {
        setFormData(prev => ({
            ...prev,
            contacts: [...prev.contacts, { name: '', phone: '', email: '', role: '' }]
        }));
    };

    const removeContact = (index) => {
        setFormData(prev => ({
            ...prev,
            contacts: prev.contacts.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Customer name is required');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
                <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {customer.id ? 'Edit Customer' : 'Add New Customer'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Customer Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            >
                                <option value="individual">Individual</option>
                                <option value="company">Company</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="3"
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">Contacts</label>
                                <button
                                    type="button"
                                    onClick={addContact}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    + Add Contact
                                </button>
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto">
                                {formData.contacts.map((contact, index) => (
                                    <div key={index} className="border rounded-md p-3 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Contact {index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeContact(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <DeleteIcon size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="Name"
                                                value={contact.name}
                                                onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Role"
                                                value={contact.role}
                                                onChange={(e) => handleContactChange(index, 'role', e.target.value)}
                                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Phone"
                                                value={contact.phone}
                                                onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                value={contact.email}
                                                onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                {customer.id ? 'Update' : 'Add'} Customer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Supplier Form Modal Component
const SupplierFormModal = ({ supplier, onSave, onCancel }) => {
    const [formData, setFormData] = useState(supplier);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBranchChange = (branchIndex, field, value) => {
        const updatedBranches = [...formData.branches];
        updatedBranches[branchIndex] = {
            ...updatedBranches[branchIndex],
            [field]: value
        };
        setFormData(prev => ({
            ...prev,
            branches: updatedBranches
        }));
    };

    const addBranch = () => {
        setFormData(prev => ({
            ...prev,
            branches: [...prev.branches, { name: '', address: '', contacts: [] }]
        }));
    };

    const removeBranch = (index) => {
        setFormData(prev => ({
            ...prev,
            branches: prev.branches.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Supplier name is required');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
                <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {supplier.id ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Main Salesman</label>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    name="salesmanName"
                                    placeholder="Salesman Name"
                                    value={formData.salesmanName}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                                <input
                                    type="tel"
                                    name="salesmanPhone"
                                    placeholder="Phone"
                                    value={formData.salesmanPhone}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                                <input
                                    type="email"
                                    name="salesmanEmail"
                                    placeholder="Email"
                                    value={formData.salesmanEmail}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">Branches</label>
                                <button
                                    type="button"
                                    onClick={addBranch}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    + Add Branch
                                </button>
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto">
                                {formData.branches.map((branch, index) => (
                                    <div key={index} className="border rounded-md p-3 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Branch {index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeBranch(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <DeleteIcon size={14} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Branch Name"
                                            value={branch.name}
                                            onChange={(e) => handleBranchChange(index, 'name', e.target.value)}
                                            className="block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                        />
                                        <textarea
                                            placeholder="Branch Address"
                                            value={branch.address}
                                            onChange={(e) => handleBranchChange(index, 'address', e.target.value)}
                                            rows="2"
                                            className="block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                {supplier.id ? 'Update' : 'Add'} Supplier
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;