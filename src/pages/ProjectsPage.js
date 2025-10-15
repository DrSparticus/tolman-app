import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { PlusIcon, DeleteIcon, SortIcon } from '../Icons.js';
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

                // Check for inactive projects (bids not updated in 90+ days)
                const isOldBid = p.status === 'bid' && p.updatedAt && 
                    (new Date() - new Date(p.updatedAt)) > (90 * 24 * 60 * 60 * 1000);

                switch (activeTab) {
                    case 'all':
                        return !isOldBid; // All active projects except old bids
                    case 'bids':
                        return p.status === 'bid' && !isOldBid;
                    case 'scheduled':
                        return ['stocked', 'hung', 'taped'].includes(p.status);
                    case 'qcd':
                        return p.status === 'qcd';
                    case 'finished':
                        return p.status === 'paid';
                    case 'inactive':
                        return isOldBid;
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
                        {['all', 'bids', 'scheduled', 'qcd', 'finished', 'inactive', 'trash'].map(tab => {
                            const labels = {
                                all: 'All',
                                bids: 'Bids',
                                scheduled: 'Scheduled',
                                qcd: "QC'd",
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
                                         activeTab === 'scheduled' ? 'No scheduled jobs found.' :
                                         activeTab === 'qcd' ? 'No QC\'d projects found.' :
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
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                            project.status === 'bid' ? 'bg-yellow-200 text-yellow-800' :
                                            project.status === 'stocked' ? 'bg-blue-200 text-blue-800' :
                                            project.status === 'hung' ? 'bg-orange-200 text-orange-800' :
                                            project.status === 'taped' ? 'bg-purple-200 text-purple-800' :
                                            project.status === 'qcd' ? 'bg-indigo-200 text-indigo-800' :
                                            project.status === 'paid' ? 'bg-green-200 text-green-800' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {project.status === 'qcd' ? "QC'd" : project.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{project.address}</td>
                                    <td className="px-6 py-4">{project.supervisorName}</td>
                                    <td className="px-6 py-4 text-right">
                                        {activeTab === 'active' ? (
                                            <button onClick={() => openDeleteModal(project)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full" title="Move to Trash">
                                                <DeleteIcon />
                                            </button>
                                        ) : (
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
        </div>
    );
};

export default ProjectsPage;