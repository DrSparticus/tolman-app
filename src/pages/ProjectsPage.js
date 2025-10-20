import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { PlusIcon, DeleteIcon, SortIcon, DuplicateIcon } from '../Icons.js';
import ConfirmationModal from '../components/ConfirmationModal';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;

const ProjectsPage = ({ db, userData, onNewBid, onEditProject }) => {
    const [projects, setProjects] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [projectToRestore, setProjectToRestore] = useState(null);
    const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
    const [projectToPermanentlyDelete, setProjectToPermanentlyDelete] = useState(null);
    const [editingStatus, setEditingStatus] = useState({});
    const [pendingStatusChanges, setPendingStatusChanges] = useState({});
    
    const isAdmin = userData?.role === 'admin';

    useEffect(() => {
        if (!db) return;
        const projectsCollection = collection(db, projectsPath);
        const q = query(projectsCollection);

        const usersCollection = collection(db, usersPath);
        const supervisorsQuery = query(usersCollection, where('role', '==', 'supervisor'));
        
        const unsubscribeSupervisors = onSnapshot(supervisorsQuery, (snapshot) => {
            const supervisorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supervisorData);
        });

        const unsubscribeProjects = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
        });

        // Fix: Return proper cleanup function
        return () => {
            unsubscribeProjects();
            unsubscribeSupervisors();
        };
    }, [db]);

    const sortedProjects = useMemo(() => {
        let sortableItems = projects
            .filter(p => {
                // First filter out deleted projects (except for trash tab)
                if (activeTab === 'trash') return p.deleted;
                if (p.deleted) return false;

                // Check for inactive projects (bids not updated in 90+ days OR status is Inactive)
                const isOldBid = p.status === 'Bid' && p.updatedAt && 
                    (new Date() - new Date(p.updatedAt)) > (90 * 24 * 60 * 60 * 1000);
                const isInactive = p.status === 'Inactive' || isOldBid;

                switch (activeTab) {
                    case 'all':
                        return !isInactive; // All active projects except inactive ones
                    case 'bids':
                        return p.status === 'Bid' && !isOldBid;
                    case 'production':
                        return ['Stocked', 'Production', 'QC\'d'].includes(p.status);
                    case 'finished':
                        return ['Paid', 'Completed'].includes(p.status);
                    case 'inactive':
                        return isInactive;
                    case 'trash':
                        return p.deleted;
                    default:
                        return true;
                }
            })
            .map(p => {
                const supervisor = supervisors.find(s => s.id === p.supervisor);
                const supervisorName = supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : 'N/A';
                return { ...p, supervisorName };
            });

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key === 'supervisor' ? 'supervisorName' : sortConfig.key;
                const valA = a[key] || '';
                const valB = b[key] || '';
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
    }, [projects, sortConfig, supervisors, activeTab]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const openDeleteModal = (project) => {
        setProjectToDelete(project);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setProjectToDelete(null);
    };

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;
        await updateDoc(doc(db, projectsPath, projectToDelete.id), {
            deleted: true,
            deletedAt: new Date()
        });
        closeDeleteModal();
    };

    const openRestoreModal = (project) => {
        setProjectToRestore(project);
        setIsRestoreModalOpen(true);
    };

    const closeRestoreModal = () => {
        setIsRestoreModalOpen(false);
        setProjectToRestore(null);
    };

    const handleRestoreProject = async () => {
        if (!projectToRestore) return;
        await updateDoc(doc(db, projectsPath, projectToRestore.id), {
            deleted: false,
            deletedAt: null
        });
        closeRestoreModal();
    };

    const openPermanentDeleteModal = (project) => {
        setProjectToPermanentlyDelete(project);
        setIsPermanentDeleteModalOpen(true);
    };

    const closePermanentDeleteModal = () => {
        setIsPermanentDeleteModalOpen(false);
        setProjectToPermanentlyDelete(null);
    };

    const handlePermanentDeleteProject = async () => {
        if (!projectToPermanentlyDelete) return;
        await deleteDoc(doc(db, projectsPath, projectToPermanentlyDelete.id));
        closePermanentDeleteModal();
    };

    const handleStatusEdit = (projectId, currentStatus) => {
        setEditingStatus({ ...editingStatus, [projectId]: true });
        setPendingStatusChanges({ ...pendingStatusChanges, [projectId]: currentStatus });
    };

    const handleStatusChange = (projectId, newStatus) => {
        setPendingStatusChanges({ ...pendingStatusChanges, [projectId]: newStatus });
    };

    const saveStatusChange = async (projectId) => {
        const newStatus = pendingStatusChanges[projectId];
        if (newStatus) {
            await updateDoc(doc(db, projectsPath, projectId), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
        }
        setEditingStatus({ ...editingStatus, [projectId]: false });
        delete pendingStatusChanges[projectId];
        setPendingStatusChanges({ ...pendingStatusChanges });
    };

    const cancelStatusChange = (projectId) => {
        setEditingStatus({ ...editingStatus, [projectId]: false });
        delete pendingStatusChanges[projectId];
        setPendingStatusChanges({ ...pendingStatusChanges });
    };

    const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, project: null });

    const duplicateProject = async (originalProject, includeNotes = false) => {
        if (!db) return;
        
        // Create a new project with all the data except project-specific info
        const newProject = {
            // Keep all the project details and calculations
            areas: originalProject.areas || [],
            materials: originalProject.materials || [],
            
            // Keep ALL configuration settings (finishes)
            wallTexture: originalProject.wallTexture || '',
            ceilingTexture: originalProject.ceilingTexture || '',
            corners: originalProject.corners || '',
            windowWrap: originalProject.windowWrap || '',
            
            // Copy hang and tape rates
            finishedHangingRate: originalProject.finishedHangingRate || '',
            finishedTapeRate: originalProject.finishedTapeRate || '',
            unfinishedTapingRate: originalProject.unfinishedTapingRate || '',
            autoTapeRate: originalProject.autoTapeRate || true,
            
            // Keep contractor but conditionally copy notes
            contractor: originalProject.contractor || '',
            notes: includeNotes ? (originalProject.notes || '') : '',
            
            // Keep all calculated totals and summaries (will recalculate in bid sheet)
            totalMaterialCost: originalProject.totalMaterialCost || 0,
            totalHangingLabor: originalProject.totalHangingLabor || 0,
            totalTapingLabor: originalProject.totalTapingLabor || 0,
            totalHangingSqFt: originalProject.totalHangingSqFt || 0,
            totalTapingSqFt: originalProject.totalTapingSqFt || 0,
            changeLog: [], // Start fresh change log for new project
            
            // CLEAR project-specific information fields
            projectName: '', // Blank out as requested
            jobNumber: '', 
            address: '',
            coordinates: null,
            
            // CLEAR scheduling and administrative data
            supervisor: '',
            hangCrew: '',
            tapeCrew: '',
            crewNotes: '', // Always clear crew notes (scheduling data)
            materialStockDate: '', // Clear stock date (project info)
            
            // Reset status and dates to bid state
            status: 'Bid',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // Reset completion flags
            qcd: false,
            paid: false,
            
            // Reset any other scheduling/administrative data
            deleted: false
        };

        try {
            const docRef = await addDoc(collection(db, projectsPath), newProject);
            // Navigate directly to the bid sheet for the new project
            onEditProject(docRef.id);
            setDuplicateModal({ isOpen: false, project: null });
        } catch (error) {
            console.error('Error duplicating project:', error);
            alert('Error duplicating project. Please try again.');
        }
    };

    const showDuplicateModal = (project) => {
        setDuplicateModal({ isOpen: true, project });
    };

    const getSortDirection = (name) => sortConfig.key === name ? sortConfig.direction : undefined;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Projects</h1>
                <button
                    onClick={onNewBid}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md"
                >
                    <PlusIcon />
                    <span className="ml-2">New Bid</span>
                </button>
            </div>
            
            {/* Tabs */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex flex-wrap space-x-8">
                        {['all', 'bids', 'production', 'finished', 'inactive', 'trash'].map(tab => {
                            const labels = {
                                all: 'All',
                                bids: 'Bids',
                                production: 'Production',
                                finished: 'Finished',
                                inactive: 'Inactive',
                                trash: 'Trash'
                            };
                            
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === tab
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    {labels[tab]}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('jobNumber')}>
                                    Job Number <SortIcon direction={getSortDirection('jobNumber')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('projectName')}>
                                    Project Name <SortIcon direction={getSortDirection('projectName')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('status')}>
                                    Status <SortIcon direction={getSortDirection('status')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('address')}>
                                    Address <SortIcon direction={getSortDirection('address')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('supervisor')}>
                                    Supervisor <SortIcon direction={getSortDirection('supervisor')} />
                                </th>
                                <th scope="col" className="px-6 py-3 text-right">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProjects.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        {activeTab === 'all' ? 'No projects found.' :
                                         activeTab === 'bids' ? 'No active bids found.' :
                                         activeTab === 'production' ? 'No projects in production found.' :
                                         activeTab === 'finished' ? 'No finished projects found.' :
                                         activeTab === 'inactive' ? 'No inactive bids found.' :
                                         activeTab === 'trash' ? 'No deleted projects found.' :
                                         'No projects found.'}
                                    </td>
                                </tr>
                            ) : (
                                sortedProjects.map(project => (
                                <tr key={project.id} className={`border-b hover:bg-gray-50 ${activeTab === 'trash' ? 'bg-red-50' : 'bg-white'}`}>
                                    <td className="px-6 py-4 font-mono text-gray-500">{project.jobNumber}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => onEditProject(project.id)} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                                            {project.projectName}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isAdmin && activeTab !== 'trash' && editingStatus[project.id] ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={pendingStatusChanges[project.id] || project.status}
                                                    onChange={(e) => handleStatusChange(project.id, e.target.value)}
                                                    className="text-xs border rounded px-2 py-1"
                                                >
                                                    <option value="Bid">Bid</option>
                                                    <option value="Stocked">Stocked</option>
                                                    <option value="Production">Production</option>
                                                    <option value="QC'd">QC'd</option>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Completed">Completed</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                                <button
                                                    onClick={() => saveStatusChange(project.id)}
                                                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => cancelStatusChange(project.id)}
                                                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => isAdmin && activeTab !== 'trash' ? handleStatusEdit(project.id, project.status) : null}
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    project.status === 'Bid' ? 'bg-yellow-200 text-yellow-800' :
                                                    project.status === 'Stocked' ? 'bg-blue-200 text-blue-800' :
                                                    project.status === 'Production' ? 'bg-orange-200 text-orange-800' :
                                                    project.status === 'QC\'d' ? 'bg-indigo-200 text-indigo-800' :
                                                    project.status === 'Paid' ? 'bg-green-200 text-green-800' :
                                                    project.status === 'Completed' ? 'bg-emerald-200 text-emerald-800' :
                                                    project.status === 'Inactive' ? 'bg-gray-200 text-gray-800' :
                                                    'bg-gray-200 text-gray-800'
                                                } ${isAdmin && activeTab !== 'trash' ? 'hover:opacity-75 cursor-pointer' : ''}`}
                                                title={isAdmin && activeTab !== 'trash' ? 'Click to edit status' : ''}
                                            >
                                                {project.status}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{project.address}</td>
                                    <td className="px-6 py-4">{project.supervisorName}</td>
                                    <td className="px-6 py-4 text-right">
                                        {activeTab === 'trash' ? (
                                            <div className="flex justify-end space-x-2">
                                                <button 
                                                    onClick={() => openRestoreModal(project)} 
                                                    className="px-3 py-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded text-sm font-medium"
                                                    title="Restore Project"
                                                >
                                                    Restore
                                                </button>
                                                {isAdmin && (
                                                    <button 
                                                        onClick={() => openPermanentDeleteModal(project)} 
                                                        className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded text-sm font-medium"
                                                        title="Permanently Delete"
                                                    >
                                                        Delete Forever
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex justify-end space-x-2">
                                                <button 
                                                    onClick={() => showDuplicateModal(project)}
                                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"
                                                    title="Duplicate Project"
                                                >
                                                    <DuplicateIcon />
                                                </button>
                                                <button 
                                                    onClick={() => openDeleteModal(project)} 
                                                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full" 
                                                    title="Move to Trash"
                                                >
                                                    <DeleteIcon />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleDeleteProject}
                title="Move to Trash"
                message={`Are you sure you want to move the project "${projectToDelete?.projectName}" to trash? You can restore it later.`}
            />
            <ConfirmationModal
                isOpen={isRestoreModalOpen}
                onClose={closeRestoreModal}
                onConfirm={handleRestoreProject}
                title="Restore Project"
                message={`Are you sure you want to restore the project "${projectToRestore?.projectName}"?`}
            />
            <ConfirmationModal
                isOpen={isPermanentDeleteModalOpen}
                onClose={closePermanentDeleteModal}
                onConfirm={handlePermanentDeleteProject}
                title="Permanently Delete Project"
                message={`Are you sure you want to permanently delete the project "${projectToPermanentlyDelete?.projectName}"? This action cannot be undone.`}
            />
            
            {/* Duplicate Project Modal */}
            {duplicateModal.isOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Duplicate Project
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                This will create a copy of "{duplicateModal.project?.projectName}" with all finishes, rates, and configuration preserved. The project name will be cleared for you to enter a new one.
                            </p>
                            <div className="mb-4">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="includeNotes"
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">
                                        Also copy project notes
                                    </span>
                                </label>
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                                <button
                                    onClick={() => setDuplicateModal({ isOpen: false, project: null })}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const includeNotes = document.getElementById('includeNotes').checked;
                                        duplicateProject(duplicateModal.project, includeNotes);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Duplicate Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsPage;