import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const SuppliersPage = ({ db }) => {
    const [suppliers, setSuppliers] = useState([]);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedSupplier, setExpandedSupplier] = useState(null);

    const emptySupplier = {
        name: '',
        salesmanName: '',
        salesmanPhone: '',
        salesmanEmail: '',
        branches: []
    };

    useEffect(() => {
        if (!db) return;
        
        const suppliersQuery = query(collection(db, configPath, 'suppliers', 'supplierList'), orderBy('name'));
        const unsubscribe = onSnapshot(suppliersQuery, (snapshot) => {
            const suppliersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSuppliers(suppliersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

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
            setShowForm(false);
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

    const startEdit = (supplier) => {
        setEditingSupplier({ 
            ...supplier, 
            branches: supplier.branches || [],
            salesmanName: supplier.salesmanName || '',
            salesmanPhone: supplier.salesmanPhone || '',
            salesmanEmail: supplier.salesmanEmail || ''
        });
        setShowForm(true);
    };

    const startNew = () => {
        setEditingSupplier({ ...emptySupplier });
        setShowForm(true);
    };

    if (loading) {
        return <div className="loading">Loading suppliers...</div>;
    }

    return (
        <div className="suppliers-page">
            <div className="page-header">
                <h1>Suppliers</h1>
                <button onClick={startNew} className="btn btn-primary">
                    Add New Supplier
                </button>
            </div>

            {showForm && (
                <SupplierForm
                    supplier={editingSupplier}
                    onSave={handleSaveSupplier}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingSupplier(null);
                    }}
                />
            )}

            <div className="suppliers-list">
                {suppliers.map(supplier => (
                    <SupplierCard
                        key={supplier.id}
                        supplier={supplier}
                        isExpanded={expandedSupplier === supplier.id}
                        onToggleExpand={() => setExpandedSupplier(
                            expandedSupplier === supplier.id ? null : supplier.id
                        )}
                        onEdit={() => startEdit(supplier)}
                        onDelete={() => handleDeleteSupplier(supplier.id)}
                    />
                ))}
            </div>

            {suppliers.length === 0 && !loading && (
                <div className="empty-state">
                    <h3>No suppliers yet</h3>
                    <p>Click "Add New Supplier" to get started.</p>
                </div>
            )}
        </div>
    );
};

const SupplierForm = ({ supplier, onSave, onCancel }) => {
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

    const handleContactChange = (branchIndex, contactIndex, field, value) => {
        const updatedBranches = [...formData.branches];
        const updatedContacts = [...updatedBranches[branchIndex].contacts];
        updatedContacts[contactIndex] = {
            ...updatedContacts[contactIndex],
            [field]: value
        };
        updatedBranches[branchIndex] = {
            ...updatedBranches[branchIndex],
            contacts: updatedContacts
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

    const addContact = (branchIndex) => {
        const updatedBranches = [...formData.branches];
        updatedBranches[branchIndex].contacts.push({ name: '', phone: '', email: '', role: '' });
        setFormData(prev => ({
            ...prev,
            branches: updatedBranches
        }));
    };

    const removeContact = (branchIndex, contactIndex) => {
        const updatedBranches = [...formData.branches];
        updatedBranches[branchIndex].contacts = updatedBranches[branchIndex].contacts.filter((_, i) => i !== contactIndex);
        setFormData(prev => ({
            ...prev,
            branches: updatedBranches
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
        <div className="supplier-form-overlay">
            <div className="supplier-form">
                <h2>{supplier.id ? 'Edit Supplier' : 'Add New Supplier'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Supplier Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="salesman-section">
                        <h3>Main Salesman</h3>
                        <div className="salesman-fields">
                            <input
                                type="text"
                                name="salesmanName"
                                placeholder="Salesman Name"
                                value={formData.salesmanName}
                                onChange={handleChange}
                            />
                            <input
                                type="tel"
                                name="salesmanPhone"
                                placeholder="Phone"
                                value={formData.salesmanPhone}
                                onChange={handleChange}
                            />
                            <input
                                type="email"
                                name="salesmanEmail"
                                placeholder="Email"
                                value={formData.salesmanEmail}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="branches-section">
                        <div className="section-header">
                            <h3>Branches</h3>
                            <button type="button" onClick={addBranch} className="btn btn-secondary">
                                Add Branch
                            </button>
                        </div>

                        {formData.branches.map((branch, branchIndex) => (
                            <div key={branchIndex} className="branch-form">
                                <div className="branch-header">
                                    <h4>Branch {branchIndex + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeBranch(branchIndex)}
                                        className="btn btn-danger btn-small"
                                    >
                                        Remove Branch
                                    </button>
                                </div>

                                <div className="branch-fields">
                                    <input
                                        type="text"
                                        placeholder="Branch Name"
                                        value={branch.name}
                                        onChange={(e) => handleBranchChange(branchIndex, 'name', e.target.value)}
                                    />
                                    <textarea
                                        placeholder="Branch Address"
                                        value={branch.address}
                                        onChange={(e) => handleBranchChange(branchIndex, 'address', e.target.value)}
                                        rows="2"
                                    />
                                </div>

                                <div className="branch-contacts">
                                    <div className="contacts-header">
                                        <h5>Branch Contacts</h5>
                                        <button
                                            type="button"
                                            onClick={() => addContact(branchIndex)}
                                            className="btn btn-secondary btn-small"
                                        >
                                            Add Contact
                                        </button>
                                    </div>

                                    {branch.contacts && branch.contacts.map((contact, contactIndex) => (
                                        <div key={contactIndex} className="contact-form">
                                            <div className="contact-header">
                                                <span>Contact {contactIndex + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeContact(branchIndex, contactIndex)}
                                                    className="btn btn-danger btn-small"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <div className="contact-fields">
                                                <input
                                                    type="text"
                                                    placeholder="Name"
                                                    value={contact.name}
                                                    onChange={(e) => handleContactChange(branchIndex, contactIndex, 'name', e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Role"
                                                    value={contact.role}
                                                    onChange={(e) => handleContactChange(branchIndex, contactIndex, 'role', e.target.value)}
                                                />
                                                <input
                                                    type="tel"
                                                    placeholder="Phone"
                                                    value={contact.phone}
                                                    onChange={(e) => handleContactChange(branchIndex, contactIndex, 'phone', e.target.value)}
                                                />
                                                <input
                                                    type="email"
                                                    placeholder="Email"
                                                    value={contact.email}
                                                    onChange={(e) => handleContactChange(branchIndex, contactIndex, 'email', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {supplier.id ? 'Update Supplier' : 'Add Supplier'}
                        </button>
                        <button type="button" onClick={onCancel} className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SupplierCard = ({ supplier, isExpanded, onToggleExpand, onEdit, onDelete }) => {
    return (
        <div className="supplier-card">
            <div className="supplier-header" onClick={onToggleExpand}>
                <div className="supplier-info">
                    <h3>{supplier.name}</h3>
                    <span className="salesman-info">
                        Salesman: {supplier.salesmanName || 'Not specified'}
                    </span>
                    <span className="branch-count">
                        {supplier.branches?.length || 0} branch{supplier.branches?.length !== 1 ? 'es' : ''}
                    </span>
                </div>
                <div className="supplier-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onEdit} className="btn btn-secondary">
                        Edit
                    </button>
                    <button onClick={onDelete} className="btn btn-danger">
                        Delete
                    </button>
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>

            {isExpanded && (
                <div className="supplier-details">
                    {(supplier.salesmanName || supplier.salesmanPhone || supplier.salesmanEmail) && (
                        <div className="salesman-section">
                            <strong>Main Salesman:</strong>
                            <div className="salesman-details">
                                {supplier.salesmanName && <div>👤 {supplier.salesmanName}</div>}
                                {supplier.salesmanPhone && <div>📞 {supplier.salesmanPhone}</div>}
                                {supplier.salesmanEmail && <div>✉️ {supplier.salesmanEmail}</div>}
                            </div>
                        </div>
                    )}

                    {supplier.branches && supplier.branches.length > 0 && (
                        <div className="branches-section">
                            <strong>Branches:</strong>
                            <div className="branches-list">
                                {supplier.branches.map((branch, index) => (
                                    <div key={index} className="branch-item">
                                        <div className="branch-name">
                                            <strong>{branch.name || `Branch ${index + 1}`}</strong>
                                        </div>
                                        {branch.address && (
                                            <div className="branch-address">📍 {branch.address}</div>
                                        )}
                                        {branch.contacts && branch.contacts.length > 0 && (
                                            <div className="branch-contacts">
                                                <strong>Contacts:</strong>
                                                {branch.contacts.map((contact, contactIndex) => (
                                                    <div key={contactIndex} className="contact-item">
                                                        <div className="contact-name">
                                                            {contact.name}
                                                            {contact.role && <span className="contact-role"> - {contact.role}</span>}
                                                        </div>
                                                        <div className="contact-details">
                                                            {contact.phone && <span className="contact-phone">📞 {contact.phone}</span>}
                                                            {contact.email && <span className="contact-email">✉️ {contact.email}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SuppliersPage;