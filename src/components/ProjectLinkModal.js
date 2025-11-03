import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;

const ProjectLinkModal = ({ isOpen, onClose, onSelectProject, onCreateNew, db }) => {
    const [projects, setProjects] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Load projects
    useEffect(() => {
        if (!db || !isOpen) return;
        
        setIsLoading(true);
        const projectsCollection = collection(db, projectsPath);
        const q = query(projectsCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, isOpen]);

    // Filter projects based on search
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProjects(projects.slice(0, 10)); // Show first 10 by default
            return;
        }

        const filtered = projects.filter(project => 
            project.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10); // Limit to 10 results

        setFilteredProjects(filtered);
    }, [searchTerm, projects]);

    const handleSelectProject = (project) => {
        onSelectProject(project);
        onClose();
    };

    const handleCreateNew = () => {
        onCreateNew();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Link to Project</h3>
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

                    {/* Instructions */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                            You can link this patch job to an existing project to automatically populate customer information, 
                            or create a new standalone patch job.
                        </p>
                    </div>

                    {/* Create New Button */}
                    <div className="mb-6">
                        <button
                            onClick={handleCreateNew}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md"
                        >
                            Create New Standalone Patch Job
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or search for existing project</span>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search Projects
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Search by project name, customer, address, or job number..."
                            autoFocus
                        />
                    </div>

                    {/* Project Results */}
                    <div className="mb-6">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <div className="text-gray-500">Loading projects...</div>
                            </div>
                        ) : filteredProjects.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                                {filteredProjects.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => handleSelectProject(project)}
                                        className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">
                                                    {project.projectName || 'Untitled Project'}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {project.customer || 'No customer'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {project.address || 'No address'}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {project.jobNumber || 'No job #'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : searchTerm ? (
                            <div className="text-center py-8 text-gray-500">
                                No projects found matching "{searchTerm}"
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                Enter search terms to find projects
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectLinkModal;