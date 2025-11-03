import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { LocationControls, useLocationServices } from '../components/LocationServices';
import Patch from '../components/patches/Patch';
import ProjectLinkModal from '../components/ProjectLinkModal';
import SignatureField from '../components/SignatureField';
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
        totalAmount: 0,
        createdAt: new Date().toISOString(),
        createdBy: userData?.email || 'Unknown'
    });

    const [showProjectLinkModal, setShowProjectLinkModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isNewPatchJob] = useState(!patchJobId);
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
            // For new patch jobs, show the project link modal
            if (!patchJobId) {
                setShowProjectLinkModal(true);
            }
            return;
        }

        const loadPatchJob = async () => {
            setIsLoading(true);
            try {
                const patchJobDoc = await getDoc(doc(db, patchJobsPath, patchJobId));
                if (patchJobDoc.exists()) {
                    const data = patchJobDoc.data();
                    setPatchJob(prev => ({
                        ...prev,
                        ...data,
                        patches: data.patches || [createNewPatch(1)]
                    }));
                }
            } catch (error) {
                console.error('Error loading patch job:', error);
                alert('Error loading patch job. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPatchJob();
    }, [db, patchJobId]);

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

    const handleProjectSelection = (project) => {
        setPatchJob(prev => ({
            ...prev,
            projectId: project.id,
            projectName: project.projectName,
            customer: project.customer || '',
            customerPhone: project.customerPhone || '',
            customerEmail: project.customerEmail || '',
            address: project.address || '',
            jobName: `${project.projectName} - Patch Work`
        }));
    };

    const handleCreateNew = () => {
        // Just proceed with a blank patch job
        setPatchJob(prev => ({
            ...prev,
            jobName: 'New Patch Job'
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

    const isAdmin = () => {
        return userData?.role === 'admin';
    };

    const handleClearSignature = () => {
        if (isAdmin()) {
            handleInputChange('signature', '');
        }
    };

    // Save function - minimal validation, allows saving drafts
    const savePatchJob = async () => {
        setIsSaving(true);

        try {
            const patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: patchJob.status || 'Draft'
            };

            if (patchJobId) {
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
            } else {
                await addDoc(collection(db, patchJobsPath), patchJobData);
            }

            alert('Patch job saved successfully!');
            setCurrentPage('patch-jobs');
        } catch (error) {
            console.error('Error saving patch job:', error);
            alert('Error saving patch job. Please try again.');
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
            const patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: 'Submitted'
            };

            if (patchJobId) {
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
            } else {
                await addDoc(collection(db, patchJobsPath), patchJobData);
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
                {/* Job Name, Address, and Job Number */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Name *
                        </label>
                        <input
                            type="text"
                            value={patchJob.jobName}
                            onChange={(e) => handleInputChange('jobName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter job name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Address *
                        </label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={patchJob.address || ''}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter address or use current location"
                                />
                                <LocationControls
                                    bid={patchJob}
                                    locationSettings={{ enableLocationServices: true }}
                                    locationServices={locationServices}
                                    hideLabel={true}
                                />
                            </div>
                            {patchJob.coordinates && (
                                <div className="mt-1 text-xs text-gray-600">
                                    <span>Coordinates: {patchJob.coordinates.lat.toFixed(6)}, {patchJob.coordinates.lng.toFixed(6)}</span>
                                </div>
                            )}
                        </div>
                    </div>

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

                {/* Status */}
                <div className="mb-6">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        {/* Signature Field */}
                        <div>
                            <SignatureField
                                signature={patchJob.signature || ''}
                                onSignatureChange={(signature) => handleInputChange('signature', signature)}
                                required={calculateTotal() >= patchJobConfig.signatureThreshold}
                                disabled={false}
                                showClearButton={true}
                                isAdmin={isAdmin()}
                                onClear={handleClearSignature}
                            />
                            {calculateTotal() >= patchJobConfig.signatureThreshold && !isSignaturePresent() && (
                                <p className="text-xs text-red-600 mt-1">
                                    * Signature required for amounts over ${patchJobConfig.signatureThreshold.toFixed(2)}
                                </p>
                            )}
                        </div>

                        {/* Total */}
                        <div className="flex flex-col justify-center">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold">Total Charge:</span>
                                <span className="text-xl font-bold text-green-600">
                                    ${calculateTotal().toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



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
        </div>
    );
};

export default PatchJobPage;