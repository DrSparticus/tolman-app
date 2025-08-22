import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const CustomersPage = ({ db }) => {
    const [customers, setCustomers] = useState([]);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedCustomer, setExpandedCustomer] = useState(null);

    const emptyCustomer = {
        name: '',
        type: 'individual', // 'individual' or 'company'
        address: '',
        contacts: []
    };

    useEffect(() => {
        if (!db) return;
        
        const customersQuery = query(collection(db, configPath, 'customers', 'customerList'), orderBy('name'));
        const unsubscribe = onSnapshot(customersQuery, (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCustomers(customersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

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
            setShowForm(false);
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

    const startEdit = (customer) => {
        setEditingCustomer({ ...customer, contacts: customer.contacts || [] });
        setShowForm(true);
    };

    const startNew = () => {
        setEditingCustomer({ ...emptyCustomer });
        setShowForm(true);
    };

    if (loading) {
        return <div className="loading">Loading customers...</div>;
    }

    return (
        <div className="customers-page">
            <div className="page-header">
                <h1>Customers</h1>
                <button onClick={startNew} className="btn btn-primary">
                    Add New Customer
                </button>
            </div>

            {showForm && (
                <CustomerForm
                    customer={editingCustomer}
                    onSave={handleSaveCustomer}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingCustomer(null);
                    }}
                />
            )}

            <div className="customers-list">
                {customers.map(customer => (
                    <CustomerCard
                        key={customer.id}
                        customer={customer}
                        isExpanded={expandedCustomer === customer.id}
                        onToggleExpand={() => setExpandedCustomer(
                            expandedCustomer === customer.id ? null : customer.id
                        )}
                        onEdit={() => startEdit(customer)}
                        onDelete={() => handleDeleteCustomer(customer.id)}
                    />
                ))}
            </div>

            {customers.length === 0 && !loading && (
                <div className="empty-state">
                    <h3>No customers yet</h3>
                    <p>Click "Add New Customer" to get started.</p>
                </div>
            )}
        </div>
    );
};

const CustomerForm = ({ customer, onSave, onCancel }) => {
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
        <div className="customer-form-overlay">
            <div className="customer-form">
                <h2>{customer.id ? 'Edit Customer' : 'Add New Customer'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Customer Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Type:</label>
                        <select name="type" value={formData.type} onChange={handleChange}>
                            <option value="individual">Individual</option>
                            <option value="company">Company</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Address:</label>
                        <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            rows="3"
                        />
                    </div>

                    <div className="contacts-section">
                        <div className="section-header">
                            <h3>Contacts</h3>
                            <button type="button" onClick={addContact} className="btn btn-secondary">
                                Add Contact
                            </button>
                        </div>

                        {formData.contacts.map((contact, index) => (
                            <div key={index} className="contact-form">
                                <div className="contact-header">
                                    <h4>Contact {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeContact(index)}
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
                                        onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Role"
                                        value={contact.role}
                                        onChange={(e) => handleContactChange(index, 'role', e.target.value)}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={contact.phone}
                                        onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={contact.email}
                                        onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {customer.id ? 'Update Customer' : 'Add Customer'}
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

const CustomerCard = ({ customer, isExpanded, onToggleExpand, onEdit, onDelete }) => {
    return (
        <div className="customer-card">
            <div className="customer-header" onClick={onToggleExpand}>
                <div className="customer-info">
                    <h3>{customer.name}</h3>
                    <span className="customer-type">{customer.type}</span>
                    <span className="contact-count">
                        {customer.contacts?.length || 0} contact{customer.contacts?.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="customer-actions" onClick={(e) => e.stopPropagation()}>
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
                <div className="customer-details">
                    {customer.address && (
                        <div className="address-section">
                            <strong>Address:</strong>
                            <p>{customer.address}</p>
                        </div>
                    )}

                    {customer.contacts && customer.contacts.length > 0 && (
                        <div className="contacts-section">
                            <strong>Contacts:</strong>
                            <div className="contacts-list">
                                {customer.contacts.map((contact, index) => (
                                    <div key={index} className="contact-item">
                                        <div className="contact-name">
                                            {contact.name}
                                            {contact.role && <span className="contact-role"> - {contact.role}</span>}
                                        </div>
                                        <div className="contact-details">
                                            {contact.phone && <div className="contact-phone">📞 {contact.phone}</div>}
                                            {contact.email && <div className="contact-email">✉️ {contact.email}</div>}
                                        </div>
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

export default CustomersPage;