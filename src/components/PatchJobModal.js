import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { CameraIcon, SignatureIcon } from '../Icons.js';
import SignaturePad from './SignaturePad';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const patchJobsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/patchJobs`;

const PatchJobModal = ({ isOpen, onClose, db, userData, patchJobId = null }) => {
    const [formData, setFormData] = useState({
        jobName: '',
        jobNumber: '',
        customer: '',
        customerPhone: '',
        customerEmail: '',
        address: '',
        projectId: '',
        projectName: '',
        description: '',
        laborHours: 0,
        laborRate: 50,
        materialCost: 0,
        equipmentCost: 0,
        markup: 15,
        totalCharge: 0,
        status: 'Scheduled',
        scheduledDate: '',
        completedDate: '',
        notes: '',
        signature: '',
        photos: [],
        location: null
    });

    const [projects, setProjects] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [projectSearch, setProjectSearch] = useState('');
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [photos, setPhotos] = useState([]);
    
    const projectDropdownRef = useRef(null);
    const fileInputRef = useRef(null);

    // Load projects
    useEffect(() => {
        if (!db || !isOpen) return;
        const projectsCollection = collection(db, projectsPath);
        const q = query(projectsCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
        });

        return () => unsubscribe();
    }, [db, isOpen]);

    // Load existing patch job if editing
    useEffect(() => {
        if (!db || !patchJobId || !isOpen) return;

        const loadPatchJob = async () => {
            try {
                const patchJobDoc = await getDoc(doc(db, patchJobsPath, patchJobId));
                if (patchJobDoc.exists()) {
                    const data = patchJobDoc.data();
                    setFormData({
                        ...data,
                        scheduledDate: data.scheduledDate ? data.scheduledDate.split('T')[0] : '',
                        completedDate: data.completedDate ? data.completedDate.split('T')[0] : ''
                    });
                    setProjectSearch(data.projectName || '');
                }
            } catch (error) {
                console.error('Error loading patch job:', error);
            }
        };

        loadPatchJob();
    }, [db, patchJobId, isOpen]);

    // Filter projects based on search
    useEffect(() => {
        if (!projectSearch) {
            setFilteredProjects([]);
            return;
        }

        const filtered = projects.filter(project => 
            project.projectName?.toLowerCase().includes(projectSearch.toLowerCase()) ||
            project.customer?.toLowerCase().includes(projectSearch.toLowerCase()) ||
            project.address?.toLowerCase().includes(projectSearch.toLowerCase())
        ).slice(0, 5); // Limit to 5 results

        setFilteredProjects(filtered);
    }, [projectSearch, projects]);

    // Calculate total charge
    useEffect(() => {
        const laborTotal = formData.laborHours * formData.laborRate;
        const subtotal = laborTotal + parseFloat(formData.materialCost || 0) + parseFloat(formData.equipmentCost || 0);
        const markupAmount = subtotal * (parseFloat(formData.markup || 0) / 100);
        const total = subtotal + markupAmount;
        
        setFormData(prev => ({ ...prev, totalCharge: total.toFixed(2) }));
    }, [formData.laborHours, formData.laborRate, formData.materialCost, formData.equipmentCost, formData.markup]);

    // Handle project selection
    const handleProjectSelect = (project) => {
        setFormData(prev => ({
            ...prev,
            projectId: project.id,
            projectName: project.projectName,
            customer: project.customer || '',
            customerPhone: project.customerPhone || '',
            customerEmail: project.customerEmail || '',
            address: project.address || ''
        }));
        setProjectSearch(project.projectName);
        setShowProjectDropdown(false);
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    // Handle project search change
    const handleProjectSearchChange = (e) => {
        const value = e.target.value;
        setProjectSearch(value);
        setShowProjectDropdown(true);
        
        // Clear project data if search is cleared
        if (!value) {
            setFormData(prev => ({
                ...prev,
                projectId: '',
                projectName: '',
                customer: '',
                customerPhone: '',
                customerEmail: '',
                address: ''
            }));
        }
    };

    // Auto-generate job number
    const generateJobNumber = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = Date.now().toString().slice(-4);
        return `P${year}${month}${day}-${time}`;
    };

    // Photo handling
    const handlePhotoCapture = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newPhoto = {
                    id: Date.now() + Math.random(),
                    data: event.target.result,
                    name: file.name,
                    timestamp: new Date().toISOString()
                };
                setPhotos(prev => [...prev, newPhoto]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (photoId) => {
        setPhotos(prev => prev.filter(photo => photo.id !== photoId));
    };

    // Handle signature
    const handleSignatureSave = (signatureData) => {
        setFormData(prev => ({ ...prev, signature: signatureData }));
    };

    const clearSignature = () => {
        setFormData(prev => ({ ...prev, signature: '' }));
    };

    // Get current location
    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        location: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: new Date().toISOString()
                        }
                    }));
                },
                (error) => {
                    console.error('Error getting location:', error);
                    alert('Could not get current location. Please ensure location access is enabled.');
                }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    };

    // Form validation
    const validateForm = () => {
        const newErrors = {};

        if (!formData.jobName.trim()) {
            newErrors.jobName = 'Job name is required';
        }

        if (!formData.customer.trim()) {
            newErrors.customer = 'Customer name is required';
        }

        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        }

        if (formData.laborHours < 0) {
            newErrors.laborHours = 'Labor hours cannot be negative';
        }

        if (formData.laborRate <= 0) {
            newErrors.laborRate = 'Labor rate must be greater than 0';
        }

        if (formData.materialCost < 0) {
            newErrors.materialCost = 'Material cost cannot be negative';
        }

        if (formData.equipmentCost < 0) {
            newErrors.equipmentCost = 'Equipment cost cannot be negative';
        }

        if (formData.markup < 0 || formData.markup > 100) {
            newErrors.markup = 'Markup must be between 0 and 100';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const patchJobData = {
                ...formData,
                photos: photos,
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown'
            };

            if (patchJobId) {
                // Update existing patch job
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
            } else {
                // Create new patch job
                patchJobData.createdAt = new Date().toISOString();
                patchJobData.createdBy = userData?.email || 'Unknown';
                patchJobData.jobNumber = patchJobData.jobNumber || generateJobNumber();
                await addDoc(collection(db, patchJobsPath), patchJobData);
            }

            onClose();
            resetForm();
        } catch (error) {
            console.error('Error saving patch job:', error);
            alert('Error saving patch job. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            jobName: '',
            jobNumber: '',
            customer: '',
            customerPhone: '',
            customerEmail: '',
            address: '',
            projectId: '',
            projectName: '',
            description: '',
            laborHours: 0,
            laborRate: 50,
            materialCost: 0,
            equipmentCost: 0,
            markup: 15,
            totalCharge: 0,
            status: 'Scheduled',
            scheduledDate: '',
            completedDate: '',
            notes: '',
            signature: '',
            photos: [],
            location: null
        });
        setProjectSearch('');
        setPhotos([]);
        setErrors({});
    };

    // Close modal on escape key
    useEffect(() => {
        const handleEscapeKey = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">
                            {patchJobId ? 'Edit Patch Job' : 'New Patch Job'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Basic Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Job Name *
                                </label>
                                <input
                                    type="text"
                                    name="jobName"
                                    value={formData.jobName}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jobName ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Enter job name"
                                />
                                {errors.jobName && <p className="mt-1 text-sm text-red-600">{errors.jobName}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Job Number
                                </label>
                                <input
                                    type="text"
                                    name="jobNumber"
                                    value={formData.jobNumber}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Auto-generated if empty"
                                />
                            </div>
                        </div>

                        {/* Project Linking */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Link to Project (Optional)
                            </label>
                            <div className="relative" ref={projectDropdownRef}>
                                <input
                                    type="text"
                                    value={projectSearch}
                                    onChange={handleProjectSearchChange}
                                    onFocus={() => setShowProjectDropdown(true)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Search projects by name, customer, or address"
                                />
                                
                                {showProjectDropdown && filteredProjects.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {filteredProjects.map(project => (
                                            <div
                                                key={project.id}
                                                onClick={() => handleProjectSelect(project)}
                                                className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="font-semibold text-gray-900">{project.projectName}</div>
                                                <div className="text-sm text-gray-600">{project.customer}</div>
                                                <div className="text-sm text-gray-500">{project.address}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer Information */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Customer Name *
                                </label>
                                <input
                                    type="text"
                                    name="customer"
                                    value={formData.customer}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customer ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Customer name"
                                />
                                {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    name="customerPhone"
                                    value={formData.customerPhone}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Phone number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="customerEmail"
                                    value={formData.customerEmail}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Email address"
                                />
                            </div>
                        </div>

                        {/* Address and Location */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Address *
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Job site address"
                                />
                                <button
                                    type="button"
                                    onClick={getCurrentLocation}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    title="Get current location"
                                >
                                    📍
                                </button>
                            </div>
                            {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
                            {formData.location && (
                                <p className="mt-1 text-sm text-green-600">
                                    Location captured: {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Work Description *
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={3}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Describe the patch work to be performed"
                            />
                            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
                        </div>

                        {/* Pricing */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Labor Hours
                                </label>
                                <input
                                    type="number"
                                    name="laborHours"
                                    value={formData.laborHours}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.5"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.laborHours ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.laborHours && <p className="mt-1 text-sm text-red-600">{errors.laborHours}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Labor Rate ($)
                                </label>
                                <input
                                    type="number"
                                    name="laborRate"
                                    value={formData.laborRate}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.laborRate ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.laborRate && <p className="mt-1 text-sm text-red-600">{errors.laborRate}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Materials ($)
                                </label>
                                <input
                                    type="number"
                                    name="materialCost"
                                    value={formData.materialCost}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.materialCost ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.materialCost && <p className="mt-1 text-sm text-red-600">{errors.materialCost}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Equipment ($)
                                </label>
                                <input
                                    type="number"
                                    name="equipmentCost"
                                    value={formData.equipmentCost}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.equipmentCost ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.equipmentCost && <p className="mt-1 text-sm text-red-600">{errors.equipmentCost}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Markup (%)
                                </label>
                                <input
                                    type="number"
                                    name="markup"
                                    value={formData.markup}
                                    onChange={handleInputChange}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.markup ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.markup && <p className="mt-1 text-sm text-red-600">{errors.markup}</p>}
                            </div>
                        </div>

                        {/* Total Charge Display */}
                        <div className="bg-gray-50 p-4 rounded-md">
                            <div className="text-lg font-semibold text-gray-900">
                                Total Charge: ${formData.totalCharge}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                                Labor: ${(formData.laborHours * formData.laborRate).toFixed(2)} + 
                                Materials: ${formData.materialCost} + 
                                Equipment: ${formData.equipmentCost} + 
                                Markup ({formData.markup}%): ${((formData.laborHours * formData.laborRate + parseFloat(formData.materialCost || 0) + parseFloat(formData.equipmentCost || 0)) * (parseFloat(formData.markup || 0) / 100)).toFixed(2)}
                            </div>
                        </div>

                        {/* Status and Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="Done">Done</option>
                                    <option value="Billed">Billed</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Scheduled Date
                                </label>
                                <input
                                    type="date"
                                    name="scheduledDate"
                                    value={formData.scheduledDate}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Completed Date
                                </label>
                                <input
                                    type="date"
                                    name="completedDate"
                                    value={formData.completedDate}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Photos */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Photos
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                capture="environment"
                                onChange={handlePhotoCapture}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <CameraIcon />
                                <span className="ml-2">Take Photos</span>
                            </button>
                            
                            {photos.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {photos.map(photo => (
                                        <div key={photo.id} className="relative">
                                            <img
                                                src={photo.data}
                                                alt="Patch job"
                                                className="w-full h-24 object-cover rounded-md border border-gray-300"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(photo.id)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Digital Signature */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Digital Signature
                            </label>
                            <div className="flex items-center space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSignaturePad(true)}
                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <SignatureIcon />
                                    <span className="ml-2">
                                        {formData.signature ? 'Update Signature' : 'Add Signature'}
                                    </span>
                                </button>
                                
                                {formData.signature && (
                                    <div className="flex items-center space-x-2">
                                        <img
                                            src={formData.signature}
                                            alt="Signature"
                                            className="h-12 border border-gray-300 rounded-md bg-white px-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={clearSignature}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Notes
                            </label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Any additional notes or special instructions"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Saving...' : (patchJobId ? 'Update Patch Job' : 'Create Patch Job')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            {/* Signature Pad Modal */}
            <SignaturePad
                isOpen={showSignaturePad}
                onClose={() => setShowSignaturePad(false)}
                onSave={handleSignatureSave}
                initialSignature={formData.signature}
            />
        </div>
    );
};

export default PatchJobModal;