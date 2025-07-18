import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { PlusIcon, DeleteIcon, SortIcon } from '../Icons.js';
import ConfirmationModal from '../components/ConfirmationModal';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;

const ProjectsPage = ({ db, onNewBid, onEditProject }) => {
    const [projects, setProjects] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);

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

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
        });

        return unsubscribe;
        return () => {
            unsubscribe();
            unsubscribeSupervisors();
        };
    }, [db]);

    const sortedProjects = useMemo(() => {
        let sortableItems = projects.map(p => {
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
    }, [projects, sortConfig, supervisors]);

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
        await deleteDoc(doc(db, projectsPath, projectToDelete.id));
        closeDeleteModal();
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
                            {sortedProjects.map(project => (
                                <tr key={project.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono text-gray-500">{project.jobNumber}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => onEditProject(project.id)} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                                            {project.projectName}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                            project.status === 'bid' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                                        }`}>
                                            {project.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{project.address}</td>
                                    <td className="px-6 py-4">{project.supervisorName}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openDeleteModal(project)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full">
                                            <DeleteIcon />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleDeleteProject}
                title="Delete Project"
                message={`Are you sure you want to delete the project "${projectToDelete?.projectName}"? This action cannot be undone.`}
            />
        </div>
    );
};

export default ProjectsPage;