import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const patchJobConfigPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config/patchJobs`;

const PatchJobAdminConfig = ({ db, userData, isOpen, onClose }) => {
    const [config, setConfig] = useState({
        defaultLaborRate: 50,
        defaultMarkup: 15,
        autoGenerateJobNumbers: true,
        jobNumberPrefix: 'P',
        statusWorkflow: {
            allowDirectToArchived: false,
            requireSignatureForCompletion: true,
            requirePhotosForCompletion: false,
            allowStatusRollback: true
        },
        approvalRequirements: {
            requireApprovalOverAmount: 1000,
            approvers: [],
            notifyApproversEmail: true
        },
        defaultValues: {
            scheduledDaysFromNow: 1,
            equipmentCost: 0,
            materialCost: 0
        },
        laborRatesByRole: {
            standard: 50,
            foreman: 65,
            specialized: 75
        },
        markupRules: {
            minimumMarkup: 5,
            maximumMarkup: 30,
            materialMarkup: 15,
            laborMarkup: 15,
            equipmentMarkup: 10
        },
        formValidation: {
            requireCustomerPhone: true,
            requireCustomerEmail: false,
            requireAddress: true,
            requireDescription: true,
            requireScheduledDate: false,
            allowNegativeCosts: false
        }
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Load existing configuration
    useEffect(() => {
        if (!db || !isOpen) return;

        const loadConfig = async () => {
            setIsLoading(true);
            try {
                const configDoc = await getDoc(doc(db, patchJobConfigPath));
                if (configDoc.exists()) {
                    setConfig(prev => ({
                        ...prev,
                        ...configDoc.data()
                    }));
                }
            } catch (error) {
                console.error('Error loading patch job config:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, [db, isOpen]);

    const handleInputChange = (section, field, value) => {
        if (section) {
            setConfig(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: value
                }
            }));
        } else {
            setConfig(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const validateConfig = () => {
        const newErrors = {};

        if (config.defaultLaborRate <= 0) {
            newErrors.defaultLaborRate = 'Default labor rate must be greater than 0';
        }

        if (config.defaultMarkup < 0 || config.defaultMarkup > 100) {
            newErrors.defaultMarkup = 'Default markup must be between 0 and 100';
        }

        if (config.markupRules.minimumMarkup > config.markupRules.maximumMarkup) {
            newErrors.markupRules = 'Minimum markup cannot be greater than maximum markup';
        }

        if (config.approvalRequirements.requireApprovalOverAmount < 0) {
            newErrors.approvalAmount = 'Approval amount cannot be negative';
        }

        Object.values(config.laborRatesByRole).forEach((rate, index) => {
            if (rate <= 0) {
                newErrors[`laborRate${index}`] = 'Labor rates must be greater than 0';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateConfig()) return;

        setIsSaving(true);
        try {
            const configData = {
                ...config,
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown'
            };

            await setDoc(doc(db, patchJobConfigPath), configData, { merge: true });
            alert('Patch job configuration saved successfully!');
            onClose();
        } catch (error) {
            console.error('Error saving patch job config:', error);
            alert('Error saving configuration. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-xl font-semibold">Loading configuration...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white mb-20">
                <div className="mt-3">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Patch Job Configuration</h3>
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

                    <div className="space-y-8">
                        {/* Default Values */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Default Values</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Labor Rate ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.defaultLaborRate}
                                        onChange={(e) => handleInputChange(null, 'defaultLaborRate', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.defaultLaborRate ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {errors.defaultLaborRate && <p className="mt-1 text-sm text-red-600">{errors.defaultLaborRate}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Markup (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.defaultMarkup}
                                        onChange={(e) => handleInputChange(null, 'defaultMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.defaultMarkup ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {errors.defaultMarkup && <p className="mt-1 text-sm text-red-600">{errors.defaultMarkup}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Schedule (days from now)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.defaultValues.scheduledDaysFromNow}
                                        onChange={(e) => handleInputChange('defaultValues', 'scheduledDaysFromNow', parseInt(e.target.value) || 0)}
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Job Number Configuration */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Job Number Configuration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="autoGenerateJobNumbers"
                                        checked={config.autoGenerateJobNumbers}
                                        onChange={(e) => handleInputChange(null, 'autoGenerateJobNumbers', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="autoGenerateJobNumbers" className="text-sm font-medium text-gray-700">
                                        Auto-generate job numbers
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Job Number Prefix
                                    </label>
                                    <input
                                        type="text"
                                        value={config.jobNumberPrefix}
                                        onChange={(e) => handleInputChange(null, 'jobNumberPrefix', e.target.value)}
                                        maxLength="5"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="P"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Labor Rates by Role */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Labor Rates by Role</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Standard Rate ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.laborRatesByRole.standard}
                                        onChange={(e) => handleInputChange('laborRatesByRole', 'standard', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Foreman Rate ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.laborRatesByRole.foreman}
                                        onChange={(e) => handleInputChange('laborRatesByRole', 'foreman', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Specialized Rate ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.laborRatesByRole.specialized}
                                        onChange={(e) => handleInputChange('laborRatesByRole', 'specialized', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Markup Rules */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Markup Rules</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Min Markup (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.markupRules.minimumMarkup}
                                        onChange={(e) => handleInputChange('markupRules', 'minimumMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Max Markup (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.markupRules.maximumMarkup}
                                        onChange={(e) => handleInputChange('markupRules', 'maximumMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Material (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.markupRules.materialMarkup}
                                        onChange={(e) => handleInputChange('markupRules', 'materialMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Labor (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.markupRules.laborMarkup}
                                        onChange={(e) => handleInputChange('markupRules', 'laborMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Equipment (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.markupRules.equipmentMarkup}
                                        onChange={(e) => handleInputChange('markupRules', 'equipmentMarkup', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            {errors.markupRules && <p className="mt-2 text-sm text-red-600">{errors.markupRules}</p>}
                        </div>

                        {/* Workflow Configuration */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Workflow Configuration</h4>
                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requireSignature"
                                        checked={config.statusWorkflow.requireSignatureForCompletion}
                                        onChange={(e) => handleInputChange('statusWorkflow', 'requireSignatureForCompletion', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requireSignature" className="text-sm font-medium text-gray-700">
                                        Require signature for completion
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requirePhotos"
                                        checked={config.statusWorkflow.requirePhotosForCompletion}
                                        onChange={(e) => handleInputChange('statusWorkflow', 'requirePhotosForCompletion', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requirePhotos" className="text-sm font-medium text-gray-700">
                                        Require photos for completion
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="allowStatusRollback"
                                        checked={config.statusWorkflow.allowStatusRollback}
                                        onChange={(e) => handleInputChange('statusWorkflow', 'allowStatusRollback', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="allowStatusRollback" className="text-sm font-medium text-gray-700">
                                        Allow status rollback (e.g., Done → Scheduled)
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="allowDirectToArchived"
                                        checked={config.statusWorkflow.allowDirectToArchived}
                                        onChange={(e) => handleInputChange('statusWorkflow', 'allowDirectToArchived', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="allowDirectToArchived" className="text-sm font-medium text-gray-700">
                                        Allow direct transition to Archived status
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Form Validation Rules */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Form Validation Rules</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requirePhone"
                                        checked={config.formValidation.requireCustomerPhone}
                                        onChange={(e) => handleInputChange('formValidation', 'requireCustomerPhone', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requirePhone" className="text-sm font-medium text-gray-700">
                                        Require customer phone
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requireEmail"
                                        checked={config.formValidation.requireCustomerEmail}
                                        onChange={(e) => handleInputChange('formValidation', 'requireCustomerEmail', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requireEmail" className="text-sm font-medium text-gray-700">
                                        Require customer email
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requireScheduledDate"
                                        checked={config.formValidation.requireScheduledDate}
                                        onChange={(e) => handleInputChange('formValidation', 'requireScheduledDate', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requireScheduledDate" className="text-sm font-medium text-gray-700">
                                        Require scheduled date
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="allowNegativeCosts"
                                        checked={config.formValidation.allowNegativeCosts}
                                        onChange={(e) => handleInputChange('formValidation', 'allowNegativeCosts', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="allowNegativeCosts" className="text-sm font-medium text-gray-700">
                                        Allow negative costs (credits)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Approval Requirements */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold mb-4">Approval Requirements</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Require approval over amount ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.approvalRequirements.requireApprovalOverAmount}
                                        onChange={(e) => handleInputChange('approvalRequirements', 'requireApprovalOverAmount', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.approvalAmount ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {errors.approvalAmount && <p className="mt-1 text-sm text-red-600">{errors.approvalAmount}</p>}
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="notifyApprovers"
                                        checked={config.approvalRequirements.notifyApproversEmail}
                                        onChange={(e) => handleInputChange('approvalRequirements', 'notifyApproversEmail', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="notifyApprovers" className="text-sm font-medium text-gray-700">
                                        Email notify approvers
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 pt-8 mt-8 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatchJobAdminConfig;