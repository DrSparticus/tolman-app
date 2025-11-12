import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PlusIcon, DeleteIcon, SortIcon } from '../Icons.js';
import ConfirmationModal from '../components/ConfirmationModal';

// Search icon component
const SearchIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const patchJobsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/patchJobs`;

const PatchJobsPage = ({ db, userData, onNewPatchJob, onEditPatchJob }) => {
    const [patchJobs, setPatchJobs] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [jobToRestore, setJobToRestore] = useState(null);
    const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
    const [jobToPermanentlyDelete, setJobToPermanentlyDelete] = useState(null);
    const [editingStatus, setEditingStatus] = useState({});
    const [pendingStatusChanges, setPendingStatusChanges] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    
    const isAdmin = userData?.role === 'admin';

    useEffect(() => {
        if (!db) return;
        const patchJobsCollection = collection(db, patchJobsPath);
        let q;

        // Patch Guy users only see jobs assigned to them
        if (userData?.role === 'patch-guy') {
            q = query(patchJobsCollection, where('assignedTo', '==', userData.uid || userData.id));
        } else {
            // All other users see all jobs
            q = query(patchJobsCollection);
        }

        const unsubscribePatchJobs = onSnapshot(q, (snapshot) => {
            const patchJobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPatchJobs(patchJobsData);
        });

        return () => {
            unsubscribePatchJobs();
        };
    }, [db, userData]);

    const sortedPatchJobs = useMemo(() => {
        let sortableItems = patchJobs
            .filter(job => {
                // First filter out deleted jobs (except for trash tab)
                if (activeTab === 'trash') return job.deleted;
                if (job.deleted) return false;

                switch (activeTab) {
                    case 'all':
                        return !job.deleted;
                    case 'scheduled':
                        return job.status === 'Scheduled';
                    case 'done':
                        return job.status === 'Done';
                    case 'billed':
                        return job.status === 'Billed';
                    case 'archived':
                        return job.status === 'Archived';
                    case 'trash':
                        return job.deleted;
                    default:
                        return true;
                }
            })
            .filter(job => {
                // Apply search filter
                if (!searchTerm) return true;
                
                const searchLower = searchTerm.toLowerCase();
                return (
                    (job.projectName || '').toLowerCase().includes(searchLower) ||
                    (job.customer || '').toLowerCase().includes(searchLower) ||
                    (job.address || '').toLowerCase().includes(searchLower) ||
                    (job.jobNumber || '').toLowerCase().includes(searchLower) ||
                    (job.customerPhone || '').toLowerCase().includes(searchLower) ||
                    (job.status || '').toLowerCase().includes(searchLower)
                );
            });

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
    }, [patchJobs, sortConfig, activeTab, searchTerm]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const openDeleteModal = (job) => {
        setJobToDelete(job);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setJobToDelete(null);
    };

    const handleDeleteJob = async () => {
        if (!jobToDelete) return;
        await updateDoc(doc(db, patchJobsPath, jobToDelete.id), { 
            deleted: true,
            updatedAt: new Date().toISOString()
        });
        closeDeleteModal();
    };

    const openRestoreModal = (job) => {
        setJobToRestore(job);
        setIsRestoreModalOpen(true);
    };

    const closeRestoreModal = () => {
        setIsRestoreModalOpen(false);
        setJobToRestore(null);
    };

    const handleRestoreJob = async () => {
        if (!jobToRestore) return;
        await updateDoc(doc(db, patchJobsPath, jobToRestore.id), { 
            deleted: false,
            updatedAt: new Date().toISOString()
        });
        closeRestoreModal();
    };

    const openPermanentDeleteModal = (job) => {
        setJobToPermanentlyDelete(job);
        setIsPermanentDeleteModalOpen(true);
    };

    const closePermanentDeleteModal = () => {
        setIsPermanentDeleteModalOpen(false);
        setJobToPermanentlyDelete(null);
    };

    const handlePermanentDeleteJob = async () => {
        if (!jobToPermanentlyDelete) return;
        
        try {
            // Call Cloud Function to delete patch job and storage files
            const functions = getFunctions();
            const deletePatchJob = httpsCallable(functions, 'deletePatchJobPermanently');
            
            await deletePatchJob({ patchJobId: jobToPermanentlyDelete.id });
            
            console.log('Patch job permanently deleted:', jobToPermanentlyDelete.id);
        } catch (error) {
            console.error('Error permanently deleting patch job:', error);
            alert('Failed to delete patch job. Please try again.');
        } finally {
            closePermanentDeleteModal();
        }
    };

    const handleStatusEdit = (jobId, currentStatus) => {
        setEditingStatus({ ...editingStatus, [jobId]: true });
        setPendingStatusChanges({ ...pendingStatusChanges, [jobId]: currentStatus });
    };

    const handleStatusChange = (jobId, newStatus) => {
        setPendingStatusChanges({ ...pendingStatusChanges, [jobId]: newStatus });
    };

    const saveStatusChange = async (jobId) => {
        const newStatus = pendingStatusChanges[jobId];
        if (newStatus) {
            await updateDoc(doc(db, patchJobsPath, jobId), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
        }
        setEditingStatus({ ...editingStatus, [jobId]: false });
        delete pendingStatusChanges[jobId];
        setPendingStatusChanges({ ...pendingStatusChanges });
    };

    const cancelStatusChange = (jobId) => {
        setEditingStatus({ ...editingStatus, [jobId]: false });
        delete pendingStatusChanges[jobId];
        setPendingStatusChanges({ ...pendingStatusChanges });
    };

    const formatCurrency = (amount) => {
        if (!amount) return '$0.00';
        return `$${parseFloat(amount).toFixed(2)}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
            case 'Done': return 'bg-green-100 text-green-800';
            case 'Billed': return 'bg-blue-100 text-blue-800';
            case 'Archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const openGoogleMapsDirections = (address) => {
        if (!address || address === 'N/A') return;
        const encodedAddress = encodeURIComponent(address);
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        window.open(url, '_blank');
    };

    const tabs = [
        { key: 'all', label: 'All', count: patchJobs.filter(j => !j.deleted).length },
        { key: 'scheduled', label: 'Scheduled', count: patchJobs.filter(j => j.status === 'Scheduled' && !j.deleted).length },
        { key: 'done', label: 'Done', count: patchJobs.filter(j => j.status === 'Done' && !j.deleted).length },
        { key: 'billed', label: 'Billed', count: patchJobs.filter(j => j.status === 'Billed' && !j.deleted).length },
        { key: 'archived', label: 'Archived', count: patchJobs.filter(j => j.status === 'Archived' && !j.deleted).length },
        ...(isAdmin ? [{ key: 'trash', label: 'Trash', count: patchJobs.filter(j => j.deleted).length }] : [])
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Patch Jobs</h1>
                
                <div className="flex items-center space-x-4">
                    {/* Search Field */}
                    <div className="relative">
                        {/* Mobile: Search Icon that expands */}
                        <div className="md:hidden">
                            {!isSearchExpanded ? (
                                <button
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    <SearchIcon />
                                </button>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Search patch jobs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onBlur={() => {
                                            if (!searchTerm) setIsSearchExpanded(false);
                                        }}
                                        autoFocus
                                        className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setIsSearchExpanded(false);
                                        }}
                                        className="p-2 text-gray-600 hover:text-gray-800"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Desktop: Always visible search field */}
                        <div className="hidden md:flex items-center relative">
                            <SearchIcon className="absolute left-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search patch jobs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Show New Patch Job button to users with create permission */}
                    {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.create) && (
                        <button
                            onClick={onNewPatchJob}
                            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md"
                        >
                            <PlusIcon />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Tabs */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex flex-wrap space-x-8">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.key
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-lg rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => requestSort('projectName')}
                                >
                                    Job Name <SortIcon direction={sortConfig.key === 'projectName' ? sortConfig.direction : null} />
                                </th>
                                {/* Only show Job # for users with advanced view permission */}
                                {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                                    <th 
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => requestSort('jobNumber')}
                                    >
                                        Job # <SortIcon direction={sortConfig.key === 'jobNumber' ? sortConfig.direction : null} />
                                    </th>
                                )}
                                <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => requestSort('customer')}
                                >
                                    Contractor <SortIcon direction={sortConfig.key === 'customer' ? sortConfig.direction : null} />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Address
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total
                                </th>
                                <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => requestSort('status')}
                                >
                                    Status <SortIcon direction={sortConfig.key === 'status' ? sortConfig.direction : null} />
                                </th>
                                <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => requestSort('createdAt')}
                                >
                                    Created <SortIcon direction={sortConfig.key === 'createdAt' ? sortConfig.direction : null} />
                                </th>
                                {/* Hide Assigned To column for patch guys */}
                                {userData?.role !== 'patch-guy' && (
                                    <th 
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => requestSort('assignedToName')}
                                    >
                                        Assigned To <SortIcon direction={sortConfig.key === 'assignedToName' ? sortConfig.direction : null} />
                                    </th>
                                )}
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedPatchJobs.map((job) => (
                                <tr key={job.id} className="hover:bg-gray-50">
                                    <td 
                                        className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                                        onClick={() => onEditPatchJob(job.id)}
                                    >
                                        {job.projectName || 'Untitled Job'}
                                    </td>
                                    {/* Only show Job # for users with advanced view permission */}
                                    {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {job.jobNumber || 'N/A'}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {job.customer || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-sm max-w-xs truncate">
                                        {job.address && job.address !== 'N/A' ? (
                                            <button
                                                onClick={() => openGoogleMapsDirections(job.address)}
                                                className="text-blue-600 hover:text-blue-800 hover:underline text-left w-full truncate"
                                                title="Get directions in Google Maps"
                                            >
                                                {job.address}
                                            </button>
                                        ) : (
                                            <span className="text-gray-900">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatCurrency(job.totalAmount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {activeTab === 'trash' ? (
                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                Deleted
                                            </span>
                                        ) : editingStatus[job.id] ? (
                                            <div className="flex items-center space-x-2">
                                                <select
                                                    value={pendingStatusChanges[job.id] || job.status}
                                                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                                    className="text-xs border border-gray-300 rounded px-2 py-1"
                                                >
                                                    <option value="Scheduled">Scheduled</option>
                                                    <option value="Done">Done</option>
                                                    <option value="Billed">Billed</option>
                                                    <option value="Archived">Archived</option>
                                                </select>
                                                <button
                                                    onClick={() => saveStatusChange(job.id)}
                                                    className="text-green-600 hover:text-green-800"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => cancelStatusChange(job.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    ✗
                                                </button>
                                            </div>
                                        ) : (
                                            <span 
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${getStatusColor(job.status)}`}
                                                onClick={() => handleStatusEdit(job.id, job.status)}
                                            >
                                                {job.status || 'Scheduled'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatDate(job.createdAt)}
                                    </td>
                                    {/* Hide Assigned To column for patch guys */}
                                    {userData?.role !== 'patch-guy' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {job.assignedToName || 'Unassigned'}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            {activeTab === 'trash' ? (
                                                <>
                                                    <button
                                                        onClick={() => openRestoreModal(job)}
                                                        className="text-green-600 hover:text-green-900"
                                                        title="Restore"
                                                    >
                                                        ↶
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => openPermanentDeleteModal(job)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Delete Permanently"
                                                        >
                                                            <DeleteIcon />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {/* Remove Edit button since job name is clickable */}
                                                    <button
                                                        onClick={() => openDeleteModal(job)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Delete"
                                                    >
                                                        <DeleteIcon />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {sortedPatchJobs.map((job) => (
                    <div key={job.id} className="bg-white shadow-lg rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                                <h3 
                                    className="text-lg font-semibold text-blue-600 cursor-pointer hover:text-blue-800 mb-1"
                                    onClick={() => onEditPatchJob(job.id)}
                                >
                                    {job.projectName || 'Untitled Job'}
                                </h3>
                                {/* Only show Job # for users with advanced view permission */}
                                {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                                    <p className="text-sm text-gray-600">Job #: {job.jobNumber || 'N/A'}</p>
                                )}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-bold text-green-600 mb-1">
                                    {formatCurrency(job.totalAmount)}
                                </span>
                                {activeTab === 'trash' ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                        Deleted
                                    </span>
                                ) : editingStatus[job.id] ? (
                                    <div className="flex items-center space-x-1">
                                        <select
                                            value={pendingStatusChanges[job.id] || job.status}
                                            onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                            className="text-xs border border-gray-300 rounded px-1 py-1"
                                        >
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="Done">Done</option>
                                            <option value="Billed">Billed</option>
                                            <option value="Archived">Archived</option>
                                        </select>
                                        <button
                                            onClick={() => saveStatusChange(job.id)}
                                            className="text-green-600 hover:text-green-800 text-sm"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            onClick={() => cancelStatusChange(job.id)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            ✗
                                        </button>
                                    </div>
                                ) : (
                                    <span 
                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${getStatusColor(job.status)}`}
                                        onClick={() => handleStatusEdit(job.id, job.status)}
                                    >
                                        {job.status || 'Scheduled'}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Contractor:</span> {job.customer || 'N/A'}
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Address:</span> {
                                    job.address && job.address !== 'N/A' ? (
                                        <button
                                            onClick={() => openGoogleMapsDirections(job.address)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline ml-1"
                                            title="Get directions in Google Maps"
                                        >
                                            {job.address}
                                        </button>
                                    ) : (
                                        <span className="ml-1">N/A</span>
                                    )
                                }
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Created:</span> {formatDate(job.createdAt)}
                            </div>
                            {/* Only show assignment for non-patch-guy users */}
                            {userData?.role !== 'patch-guy' && (
                                <div>
                                    <span className="font-medium text-gray-700">Assigned To:</span> {job.assignedToName || 'Unassigned'}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-3 space-x-2">
                            {activeTab === 'trash' ? (
                                <>
                                    <button
                                        onClick={() => openRestoreModal(job)}
                                        className="px-3 py-1 text-sm text-green-600 hover:text-green-900 border border-green-300 rounded"
                                    >
                                        Restore
                                    </button>
                                    {isAdmin && (
                                        <button
                                            onClick={() => openPermanentDeleteModal(job)}
                                            className="px-3 py-1 text-sm text-red-600 hover:text-red-900 border border-red-300 rounded"
                                        >
                                            Delete Permanently
                                        </button>
                                    )}
                                </>
                            ) : (
                                <button
                                    onClick={() => openDeleteModal(job)}
                                    className="px-3 py-1 text-sm text-red-600 hover:text-red-900 border border-red-300 rounded"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
                
            {sortedPatchJobs.length === 0 && (
                <div className="text-center py-12">
                    <p className="mt-2 text-sm text-gray-500">
                        {searchTerm ? `No patch jobs found matching "${searchTerm}"` : 'No patch jobs found'}
                    </p>
                </div>
            )}

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleDeleteJob}
                title="Delete Patch Job"
                message={`Are you sure you want to delete "${jobToDelete?.projectName}"? This action can be undone from the trash.`}
            />

            <ConfirmationModal
                isOpen={isRestoreModalOpen}
                onClose={closeRestoreModal}
                onConfirm={handleRestoreJob}
                title="Restore Patch Job"
                message={`Are you sure you want to restore "${jobToRestore?.projectName}"?`}
            />

            <ConfirmationModal
                isOpen={isPermanentDeleteModalOpen}
                onClose={closePermanentDeleteModal}
                onConfirm={handlePermanentDeleteJob}
                title="Permanently Delete Patch Job"
                message={`Are you sure you want to permanently delete "${jobToPermanentlyDelete?.projectName}"? This action cannot be undone.`}
                isDestructive={true}
            />
        </div>
    );
};

export default PatchJobsPage;