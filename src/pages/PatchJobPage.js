import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, addDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { LocationControls, useLocationServices } from '../components/LocationServices';
import Patch from '../components/patches/Patch';
import ProjectLinkModal from '../components/ProjectLinkModal';
import SignatureModal from '../components/SignatureModal';
import ChangeLog from '../components/bids/ChangeLog';
import { PlusIcon } from '../Icons';

const patchJobsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/patchJobs`;

const PatchJobPage = ({ db, userData, patchJobId, setCurrentPage }) => {
    const [patchJob, setPatchJob] = useState({
        jobName: '',
        jobNumber: '',
        customer: '',
        customerPhone: '',
        customerEmail: '',
        address: '',
        projectId: '',
        projectName: '',
        patches: [],
        status: 'Scheduled',
        notes: '',
        signature: '',
        assignedTo: '',
        assignedToName: '',
        totalAmount: 0,
        createdAt: new Date().toISOString(),
        createdBy: userData?.email || 'Unknown',
        changeLog: []
    });

    const [showProjectLinkModal, setShowProjectLinkModal] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isNewPatchJob] = useState(!patchJobId);
    const [patchGuys, setPatchGuys] = useState([]);
    const [lastSavedPatchJob, setLastSavedPatchJob] = useState(null); // Track last saved state for change logging
    const [patchJobConfig, setPatchJobConfig] = useState({
        hourlyRate: 50.00,
        minimumTotalCharge: 150.00,
        signatureThreshold: 500.00
    });

    const locationServices = useLocationServices(db, (event, value) => {
        // Handle both direct calls and event-like calls from LocationServices
        if (event && event.target) {
            setPatchJob(prev => ({ ...prev, [event.target.name]: event.target.value }));
        } else {
            // Direct field/value call
            setPatchJob(prev => ({ ...prev, [event]: value }));
        }
    });

    // Load existing patch job if editing
    useEffect(() => {
        if (!db || !patchJobId) {
            // For completely new patch jobs (no ID at all), show the project link modal
            if (!patchJobId) {
                setShowProjectLinkModal(true);
            }
            return;
        }

        // Check if this is a temporary ID (new patch job)
        if (patchJobId.startsWith('new-')) {
            // Try to restore from sessionStorage for unsaved patch jobs
            const savedData = sessionStorage.getItem(`patchJob_${patchJobId}`);
            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    setPatchJob(prev => ({
                        ...prev,
                        ...parsedData,
                        patches: parsedData.patches || [createNewPatch(1)]
                    }));
                } catch (error) {
                    console.error('Error parsing saved patch job data:', error);
                    // If parsing fails, show project link modal
                    setShowProjectLinkModal(true);
                }
            } else {
                // No saved data, show project link modal for new patch job
                setShowProjectLinkModal(true);
            }
            return;
        }

        // Load existing saved patch job from database
        const loadPatchJob = async () => {
            setIsLoading(true);
            try {
                const patchJobDoc = await getDoc(doc(db, patchJobsPath, patchJobId));
                if (patchJobDoc.exists()) {
                    const data = patchJobDoc.data();
                    const patchJobData = {
                        ...data,
                        patches: data.patches || [createNewPatch(1)]
                    };
                    setPatchJob(prev => ({
                        ...prev,
                        ...patchJobData
                    }));
                    setLastSavedPatchJob(patchJobData); // Set baseline for change tracking
                } else {
                    // Patch job doesn't exist, might be a bad URL
                    console.error('Patch job not found:', patchJobId);
                    alert('Patch job not found. Redirecting to patch jobs list.');
                    setCurrentPage('patch-jobs');
                }
            } catch (error) {
                console.error('Error loading patch job:', error);
                alert('Error loading patch job. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPatchJob();
    }, [db, patchJobId, setCurrentPage]);

    // Save patch job data to sessionStorage for temporary IDs (unsaved patch jobs)
    useEffect(() => {
        if (patchJobId && patchJobId.startsWith('new-')) {
            sessionStorage.setItem(`patchJob_${patchJobId}`, JSON.stringify(patchJob));
        }
    }, [patchJob, patchJobId]);

    // Load patch job configuration
    useEffect(() => {
        if (!db) return;
        
        const loadConfig = async () => {
            try {
                const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config/patchJobSettings`;
                const configRef = doc(db, configPath);
                const configSnap = await getDoc(configRef);
                
                if (configSnap.exists()) {
                    setPatchJobConfig(prev => ({ ...prev, ...configSnap.data() }));
                }
            } catch (error) {
                console.error('Error loading patch job config:', error);
            }
        };

        loadConfig();
    }, [db]);

    // Load patch guys (users with patch-guy role)
    useEffect(() => {
        if (!db) return;

        const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
        const q = query(collection(db, usersPath), where('role', '==', 'patch-guy'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const patchGuysList = snapshot.docs.map(doc => {
                const userData = doc.data();
                // Try multiple ways to get a display name
                const displayName = userData.name || 
                                   (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
                                   userData.firstName ||
                                   userData.displayName ||
                                   userData.email;
                
                return {
                    id: doc.id,
                    email: userData.email,
                    name: displayName,
                    ...userData
                };
            });
            setPatchGuys(patchGuysList);
        });

        return unsubscribe;
    }, [db]);

    // Initialize with one blank patch for new jobs
    useEffect(() => {
        if (isNewPatchJob && patchJob.patches.length === 0) {
            setPatchJob(prev => ({
                ...prev,
                patches: [createNewPatch(1)]
            }));
        }
    }, [isNewPatchJob, patchJob.patches.length]);

    const createNewPatch = (number) => ({
        id: `patch-${Date.now()}-${Math.random()}`,
        number: number,
        description: '',
        amountType: 'hours', // 'hours' or 'charge'
        amount: '',
        photos: []
    });

    const handleInputChange = (field, value) => {
        setPatchJob(prev => ({ ...prev, [field]: value }));
    };

    const handleSignatureChange = async (signature) => {
        handleInputChange('signature', signature);
        
        // Auto-save when signature is added to immediately lock patches
        if (signature && signature.trim().length > 0 && patchJobId) {
            try {
                await savePatchJob(false); // Don't navigate away on auto-save
            } catch (error) {
                console.error('Error auto-saving signature:', error);
            }
        }
    };

    const handleProjectSelection = (project) => {
        setPatchJob(prev => ({
            ...prev,
            projectId: project.id,
            projectName: project.projectName,
            jobNumber: project.jobNumber || '',
            // Map contractor fields to customer fields for unified data structure
            customer: project.contractor || project.customer || '',
            customerPhone: project.contractorPhone || project.customerPhone || '',
            customerEmail: project.contractorEmail || project.customerEmail || '',
            address: project.address || '',
            jobName: `${project.projectName} - Patch Work`,
            patches: [createNewPatch(1)]
        }));
    };

    const handleCreateNew = () => {
        // Just proceed with a blank patch job with one patch
        setPatchJob(prev => ({
            ...prev,
            jobName: 'New Patch Job',
            patches: [createNewPatch(1)]
        }));
    };

    const addPatch = () => {
        const newPatchNumber = patchJob.patches.length + 1;
        const newPatch = createNewPatch(newPatchNumber);
        setPatchJob(prev => ({
            ...prev,
            patches: [...prev.patches, newPatch]
        }));
    };

    const updatePatch = (patchId, updatedPatch) => {
        // Only update the patch data, don't log changes here (will be logged on save)
        setPatchJob(prev => ({
            ...prev,
            patches: prev.patches.map(patch =>
                patch.id === patchId ? updatedPatch : patch
            )
        }));
    };

    const removePatch = (patchId) => {
        setPatchJob(prev => ({
            ...prev,
            patches: prev.patches.filter(patch => patch.id !== patchId)
        }));
    };

    const calculateTotal = () => {
        return patchJob.patches.reduce((total, patch) => {
            if (patch.amountType === 'charge' && patch.amount) {
                return total + parseFloat(patch.amount || 0);
            } else if (patch.amountType === 'hours' && patch.amount) {
                return total + (parseFloat(patch.amount || 0) * patchJobConfig.hourlyRate);
            }
            return total;
        }, 0);
    };

    const isSignaturePresent = () => {
        if (!patchJob.signature) return false;
        try {
            const sigData = JSON.parse(patchJob.signature);
            return sigData.name && sigData.name.trim().length > 0;
        } catch (error) {
            // Legacy signature format
            return patchJob.signature.trim().length > 0;
        }
    };

    const isPatchesLocked = () => {
        return isSignaturePresent() && !isAdmin();
    };

    const isAdmin = () => {
        return userData?.role === 'admin';
    };

    // Helper function to get proper display name for current user
    const getUserDisplayName = () => {
        return userData?.name || 
               (userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
               userData?.firstName ||
               userData?.displayName ||
               userData?.email ||
               'Unknown User';
    };

    // Generate change log entries by comparing current state with last saved state
    const generateChangeLogEntries = () => {
        if (!lastSavedPatchJob) return [];
        
        const changes = [];
        
        // Check basic field changes
        const fieldsToCheck = {
            jobName: 'Job Name',
            customer: 'Customer',
            customerPhone: 'Customer Phone',
            customerEmail: 'Customer Email',
            address: 'Address',
            projectName: 'Project Name',
            status: 'Status',
            notes: 'Notes',
            assignedToName: 'Assigned To'
        };
        
        Object.entries(fieldsToCheck).forEach(([field, label]) => {
            if (lastSavedPatchJob[field] !== patchJob[field]) {
                changes.push(`${label} changed: "${lastSavedPatchJob[field] || ''}" → "${patchJob[field] || ''}"`);
            }
        });
        
        // Check signature changes
        const hadSignature = lastSavedPatchJob.signature && lastSavedPatchJob.signature.trim().length > 0;
        const hasSignature = patchJob.signature && patchJob.signature.trim().length > 0;
        
        if (!hadSignature && hasSignature) {
            changes.push('Customer signature added - patches now locked');
        } else if (hadSignature && !hasSignature) {
            changes.push('Customer signature removed - patches unlocked');
        }
        
        // Check patch changes
        const oldPatches = lastSavedPatchJob.patches || [];
        const newPatches = patchJob.patches || [];
        
        // Helper function to format amount based on type
        const formatAmount = (amount, amountType) => {
            if (!amount || amount === '') return '$0';
            if (amountType === 'hours') {
                return `${amount} hours`;
            } else {
                return `$${amount}`;
            }
        };

        // Find added patches
        newPatches.forEach(newPatch => {
            const oldPatch = oldPatches.find(p => p.id === newPatch.id);
            if (!oldPatch) {
                changes.push(`Added Patch ${newPatch.number}: ${newPatch.description}`);
            } else {
                // Check for patch updates
                const patchChanges = [];
                if (oldPatch.description !== newPatch.description) {
                    patchChanges.push(`description: "${oldPatch.description}" → "${newPatch.description}"`);
                }
                if (oldPatch.amount !== newPatch.amount || oldPatch.amountType !== newPatch.amountType) {
                    const oldAmountFormatted = formatAmount(oldPatch.amount, oldPatch.amountType);
                    const newAmountFormatted = formatAmount(newPatch.amount, newPatch.amountType);
                    patchChanges.push(`amount: ${oldAmountFormatted} → ${newAmountFormatted}`);
                }
                
                // Check for photo attachments
                const oldPhotosCount = (oldPatch.photos || []).length;
                const newPhotosCount = (newPatch.photos || []).length;
                if (oldPhotosCount !== newPhotosCount) {
                    if (newPhotosCount > oldPhotosCount) {
                        const addedCount = newPhotosCount - oldPhotosCount;
                        patchChanges.push(`${addedCount} photo${addedCount > 1 ? 's' : ''} attached`);
                    } else {
                        const removedCount = oldPhotosCount - newPhotosCount;
                        patchChanges.push(`${removedCount} photo${removedCount > 1 ? 's' : ''} removed`);
                    }
                }
                
                if (patchChanges.length > 0) {
                    changes.push(`Updated Patch ${newPatch.number}:\n${patchChanges.map(c => `- ${c}`).join('\n')}`);
                }
            }
        });
        
        // Find removed patches
        oldPatches.forEach(oldPatch => {
            const stillExists = newPatches.find(p => p.id === oldPatch.id);
            if (!stillExists) {
                changes.push(`Removed Patch ${oldPatch.number}: ${oldPatch.description}`);
            }
        });
        
        return changes;
    };



    const handleClearSignature = () => {
        if (isAdmin()) {
            handleInputChange('signature', '');
        }
    };

    // Save function - minimal validation, allows saving drafts
    const savePatchJob = async (shouldNavigateAway = true) => {
        setIsSaving(true);

        try {
            let patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: patchJob.status || 'Draft'
            };

            // Auto-assign patch-guy users to their own jobs if no assignment is set
            if (userData?.role === 'patch-guy' && (!patchJob.assignedTo || patchJob.assignedTo === '')) {
                patchJobData = {
                    ...patchJobData,
                    assignedTo: userData.uid || userData.id,
                    assignedToName: userData.name || userData.email
                };
            }

            if (patchJobId && !patchJobId.startsWith('new-')) {
                // Updating existing patch job - generate change log entries
                const changesList = generateChangeLogEntries();
                const newChangeEntries = [];
                
                if (changesList.length > 0) {
                    const changeDescription = changesList.length === 1 
                        ? `${changesList[0]} (saved as draft)`
                        : `${changesList.length} changes made (saved as draft):\n${changesList.map(c => `- ${c}`).join('\n')}`;
                    
                    newChangeEntries.push({
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: changeDescription
                    });
                } else if (!lastSavedPatchJob) {
                    // Only add a "saved" entry for the very first save when no changes are detected
                    newChangeEntries.push({
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: 'Patch job saved as draft'
                    });
                }
                // If there are no changes and this isn't the first save, don't log anything
                
                patchJobData.changeLog = [...(patchJob.changeLog || []), ...newChangeEntries];
                
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
                
                // Update the last saved state
                setLastSavedPatchJob({...patchJobData});
            } else {
                // Creating new patch job (either no ID or temporary ID)
                const initialChangeLog = {
                    timestamp: new Date().toISOString(),
                    user: {
                        name: getUserDisplayName(),
                        email: userData?.email || 'Unknown'
                    },
                    change: 'Patch job created'
                };
                
                patchJobData.changeLog = [initialChangeLog];
                
                const docRef = await addDoc(collection(db, patchJobsPath), patchJobData);
                
                // Set the last saved state for new patch jobs
                setLastSavedPatchJob({...patchJobData});
                
                // If this was a temporary ID, clean up sessionStorage and update URL
                if (patchJobId && patchJobId.startsWith('new-')) {
                    sessionStorage.removeItem(`patchJob_${patchJobId}`);
                    // Update the URL with the real ID using the parent's navigation function
                    // This will be handled by updating the parent state
                    window.history.replaceState(
                        { page: 'patch-job-edit', patchJobId: docRef.id }, 
                        '', 
                        `?page=patch-job-edit&patchJobId=${docRef.id}`
                    );
                }
            }

            if (shouldNavigateAway) {
                alert('Patch job saved successfully!');
                setCurrentPage('patch-jobs');
            }
        } catch (error) {
            console.error('Error saving patch job:', error);
            if (shouldNavigateAway) {
                alert('Error saving patch job. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Submit function - full validation required
    const submitPatchJob = async () => {
        if (!patchJob.jobName.trim()) {
            alert('Please enter a job name');
            return;
        }

        if (!patchJob.customer.trim()) {
            alert('Please enter a customer name');
            return;
        }

        if (!patchJob.address.trim()) {
            alert('Please enter an address');
            return;
        }

        if (!patchJob.customerPhone?.trim()) {
            alert('Please enter a phone number');
            return;
        }

        if (!patchJob.customerEmail?.trim()) {
            alert('Please enter an email address');
            return;
        }

        if (patchJob.patches.length === 0) {
            alert('Please add at least one patch');
            return;
        }

        // Validate patches
        for (const patch of patchJob.patches) {
            if (!patch.description.trim()) {
                alert('Please enter a description for all patches');
                return;
            }
            if (!patch.amount || patch.amount <= 0) {
                alert('Please enter an amount for all patches');
                return;
            }
        }

        // Validate signature if required
        const total = calculateTotal();
        if (total >= patchJobConfig.signatureThreshold && !isSignaturePresent()) {
            alert(`Customer signature is required for amounts over $${patchJobConfig.signatureThreshold.toFixed(2)}`);
            return;
        }

        setIsSaving(true);

        try {
            let patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: 'Submitted'
            };

            // Auto-assign patch-guy users to their own jobs if no assignment is set
            if (userData?.role === 'patch-guy' && (!patchJob.assignedTo || patchJob.assignedTo === '')) {
                patchJobData = {
                    ...patchJobData,
                    assignedTo: userData.uid || userData.id,
                    assignedToName: userData.name || userData.email
                };
            }

            if (patchJobId && !patchJobId.startsWith('new-')) {
                // Updating existing patch job - generate change log entries
                const changesList = generateChangeLogEntries();
                const newChangeEntries = [];
                
                // Combine changes with submission info in a single entry
                let changeDescription;
                if (changesList.length > 0) {
                    const changesText = changesList.length === 1 
                        ? changesList[0] 
                        : `${changesList.length} changes made:\n${changesList.map(c => `- ${c}`).join('\n')}`;
                    changeDescription = `${changesText}\n\nPatch job submitted (Total: $${calculateTotal().toFixed(2)})`;
                } else {
                    changeDescription = `Patch job submitted (Total: $${calculateTotal().toFixed(2)})`;
                }
                
                newChangeEntries.push({
                    timestamp: new Date().toISOString(),
                    user: {
                        name: getUserDisplayName(),
                        email: userData?.email || 'Unknown'
                    },
                    change: changeDescription
                });
                
                patchJobData.changeLog = [...(patchJob.changeLog || []), ...newChangeEntries];
                
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
            } else {
                // Creating new patch job (either no ID or temporary ID)
                const initialChanges = [
                    {
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: 'Patch job created'
                    },
                    {
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: `Patch job submitted (Total: $${calculateTotal().toFixed(2)})`
                    }
                ];
                
                patchJobData.changeLog = [...initialChanges, ...(patchJob.changeLog || [])];
                
                await addDoc(collection(db, patchJobsPath), patchJobData);
                
                // If this was a temporary ID, clean up sessionStorage
                if (patchJobId && patchJobId.startsWith('new-')) {
                    sessionStorage.removeItem(`patchJob_${patchJobId}`);
                }
            }

            alert('Patch job submitted successfully!');
            setCurrentPage('patch-jobs');
        } catch (error) {
            console.error('Error submitting patch job:', error);
            alert('Error submitting patch job. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-xl font-semibold">Loading patch job...</div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">
                    {isNewPatchJob ? 'New Patch Job' : 'Edit Patch Job'}
                </h1>
                <div className="flex space-x-4">
                    <button
                        onClick={() => setCurrentPage('patch-jobs')}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={savePatchJob}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        onClick={submitPatchJob}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Submitting...' : 'Submit Patch Job'}
                    </button>
                </div>
            </div>

            {/* Main Form */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                {/* Job Name and Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Job Name *
                            </label>
                        </div>
                        <input
                            type="text"
                            value={patchJob.jobName}
                            onChange={(e) => handleInputChange('jobName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter job name"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Address *
                            </label>
                            <LocationControls
                                bid={patchJob}
                                locationSettings={{ enableLocationServices: true }}
                                locationServices={locationServices}
                                showButtonOnly={true}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={patchJob.address || ''}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter address or use current location"
                            />
                            {patchJob.coordinates && (
                                <div className="mt-2 text-xs text-gray-600">
                                    <div className="flex items-center justify-between">
                                        <span>Coordinates: {patchJob.coordinates.lat.toFixed(6)}, {patchJob.coordinates.lng.toFixed(6)}</span>
                                        <div className="flex space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => locationServices.openInMaps(patchJob.coordinates)}
                                                className="text-blue-600 hover:text-blue-800 underline"
                                            >
                                                Map
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Customer Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name *
                        </label>
                        <input
                            type="text"
                            value={patchJob.customer}
                            onChange={(e) => handleInputChange('customer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Customer name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone *
                        </label>
                        <input
                            type="tel"
                            value={patchJob.customerPhone}
                            onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Phone number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={patchJob.customerEmail}
                            onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Email address"
                        />
                    </div>
                </div>

                {/* Notes Section - Moved up */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                    </label>
                    <textarea
                        value={patchJob.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Any additional notes or special instructions..."
                    />
                </div>

                {/* Advanced View: Status, Assignment, and Job Number - Only show for users with advanced view permission */}
                {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Job Number
                            </label>
                            <input
                                type="text"
                                value={patchJob.jobNumber}
                                onChange={(e) => handleInputChange('jobNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Optional - for linking to existing project"
                            />
                            {patchJob.projectId && (
                                <p className="mt-1 text-sm text-green-600">
                                    Linked to: {patchJob.projectName}
                                </p>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={patchJob.status}
                                onChange={(e) => handleInputChange('status', e.target.value)}
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
                                Assign To
                            </label>
                            <select
                                value={patchJob.assignedTo}
                                onChange={(e) => {
                                    const selectedPatchGuy = patchGuys.find(pg => pg.id === e.target.value);
                                    handleInputChange('assignedTo', e.target.value);
                                    handleInputChange('assignedToName', selectedPatchGuy ? (selectedPatchGuy.name || selectedPatchGuy.email) : '');
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Unassigned</option>
                                {patchGuys.map(patchGuy => (
                                    <option key={patchGuy.id} value={patchGuy.id}>
                                        {patchGuy.name || patchGuy.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Patches Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        Patches
                        {isSignaturePresent() && !isAdmin() && (
                            <span className="text-sm text-gray-500 ml-2">🔒 Locked (Signed)</span>
                        )}
                    </h2>
                    {(!isSignaturePresent() || isAdmin()) && (
                        <button
                            onClick={addPatch}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            title={isSignaturePresent() && isAdmin() ? "Admin: Add patch to signed job" : "Add Patch"}
                        >
                            <PlusIcon />
                            <span className="ml-2">Add Patch</span>
                        </button>
                    )}
                </div>

                <div className="space-y-6">
                    {patchJob.patches.map((patch, index) => (
                        <Patch
                            key={patch.id}
                            patch={patch}
                            onUpdate={updatePatch}
                            onRemove={removePatch}
                            canRemove={patchJob.patches.length > 1}
                            disabled={isSignaturePresent()}
                            isAdmin={isAdmin()}
                        />
                    ))}
                </div>

                {/* Signature and Total Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                        {/* Signature Button */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Signature {calculateTotal() >= patchJobConfig.signatureThreshold && '*'}
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowSignatureModal(true)}
                                className={`w-full px-4 py-2 rounded-md border text-sm font-medium ${
                                    isSignaturePresent()
                                        ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                        : calculateTotal() >= patchJobConfig.signatureThreshold
                                        ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {isSignaturePresent() ? (
                                    <span>✅ Signed {isSignaturePresent() && isPatchesLocked() && '🔒'}</span>
                                ) : (
                                    <span>📝 Click to Sign</span>
                                )}
                            </button>
                            {calculateTotal() >= patchJobConfig.signatureThreshold && !isSignaturePresent() && (
                                <p className="text-xs text-red-600 mt-1">
                                    * Signature required for amounts over ${patchJobConfig.signatureThreshold.toFixed(2)}
                                </p>
                            )}
                        </div>

                        {/* Total */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Total Charge
                            </label>
                            <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                <div className="text-2xl font-bold text-green-600">
                                    ${calculateTotal().toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Log - Only visible to Advanced View users */}
            {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                <ChangeLog 
                    log={patchJob.changeLog || []} 
                    hasLogAccess={true}
                />
            )}

            {/* Project Link Modal */}
            <ProjectLinkModal
                isOpen={showProjectLinkModal}
                onClose={() => setShowProjectLinkModal(false)}
                onSelectProject={handleProjectSelection}
                onCreateNew={handleCreateNew}
                db={db}
            />

            {/* Location Services */}
            {locationServices.mapModal}

            {/* Signature Modal */}
            <SignatureModal
                isOpen={showSignatureModal}
                onClose={() => setShowSignatureModal(false)}
                signature={patchJob.signature || ''}
                onSignatureChange={handleSignatureChange}
                required={calculateTotal() >= patchJobConfig.signatureThreshold}
                isAdmin={isAdmin()}
                onClear={handleClearSignature}
                patchesLocked={isPatchesLocked()}
            />
        </div>
    );
};

export default PatchJobPage;