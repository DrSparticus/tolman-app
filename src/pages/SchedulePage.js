import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { SortIcon } from '../Icons.js';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

const SchedulePage = ({ db, userData, onEditProject }) => {
    const [projects, setProjects] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [crews, setCrews] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'jobNumber', direction: 'asc' });
    const [expandedRows, setExpandedRows] = useState(new Set());
    
    // Check permissions
    const canViewAllSupervisors = userData?.role === 'admin' || userData?.permissions?.schedule?.viewAllSupervisors;
    const currentUserSupervisorId = userData?.role === 'supervisor' ? userData.id : null;

    useEffect(() => {
        if (!db) return;

        // Fetch projects with T job numbers (scheduled jobs)
        const projectsCollection = collection(db, projectsPath);
        const projectsQuery = query(
            projectsCollection,
            where('jobNumber', '>=', 'T'),
            where('jobNumber', '<', 'U')
        );

        const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(project => !project.deleted && project.status !== 'qcd'); // Filter out deleted and QC'd projects
            setProjects(projectsData);
        });

        // Fetch supervisors
        const supervisorsQuery = query(collection(db, usersPath), where('role', '==', 'supervisor'));
        const unsubscribeSupervisors = onSnapshot(supervisorsQuery, (snapshot) => {
            const supervisorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supervisorsData);
        });

        // Fetch crews
        const crewsCollection = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribeCrews = onSnapshot(crewsCollection, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrews(crewsData);
        });

        return () => {
            unsubscribeProjects();
            unsubscribeSupervisors();
            unsubscribeCrews();
        };
    }, [db]);

    const filteredProjects = useMemo(() => {
        let filtered = projects;
        
        // If user is supervisor (not admin), only show their projects
        if (!canViewAllSupervisors && currentUserSupervisorId) {
            filtered = filtered.filter(project => project.supervisor === currentUserSupervisorId);
        }

        return filtered.map(project => {
            const supervisor = supervisors.find(s => s.id === project.supervisor);
            const supervisorName = supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : 'Unassigned';
            
            // Calculate total square footage
            let finishedSqFt = 0;
            let unfinishedSqFt = 0;
            
            project.areas?.forEach(area => {
                area.materials?.forEach(material => {
                    const totalQuantity = material.variants?.reduce((sum, variant) => 
                        sum + (parseFloat(variant.quantity) || 0), 0
                    ) || parseFloat(material.quantity) || 0;
                    
                    if (area.isFinished) {
                        finishedSqFt += totalQuantity;
                    } else {
                        unfinishedSqFt += totalQuantity;
                    }
                });
            });

            return {
                ...project,
                supervisorName,
                finishedSqFt: Math.round(finishedSqFt),
                unfinishedSqFt: Math.round(unfinishedSqFt)
            };
        });
    }, [projects, supervisors, canViewAllSupervisors, currentUserSupervisorId]);

    const sortedProjects = useMemo(() => {
        if (!sortConfig) return filteredProjects;

        return [...filteredProjects].sort((a, b) => {
            const aValue = a[sortConfig.key] || '';
            const bValue = b[sortConfig.key] || '';
            
            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredProjects, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig?.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortDirection = (name) => sortConfig?.key === name ? sortConfig.direction : undefined;

    const toggleExpanded = (projectId) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    const handleCrewAssignment = async (projectId, crewType, crewId) => {
        if (!db) return;

        const updateData = {};
        const now = new Date().toISOString();

        if (crewType === 'hang') {
            updateData.hangCrew = crewId;
            updateData.hangAssignedDate = crewId ? now : null;
            updateData.status = crewId ? 'hung' : 'stocked';
        } else if (crewType === 'tape') {
            updateData.tapeCrew = crewId;
            updateData.tapeAssignedDate = crewId ? now : null;
            updateData.status = crewId ? 'taped' : 'hung';
        }

        await updateDoc(doc(db, projectsPath, projectId), updateData);
    };

    const handleQCToggle = async (projectId, isQCd) => {
        if (!db) return;

        await updateDoc(doc(db, projectsPath, projectId), {
            qcd: isQCd,
            qcdDate: isQCd ? new Date().toISOString() : null,
            status: isQCd ? 'qcd' : 'taped'
        });
    };

    const copyJobInfo = async (project) => {
        // Generate Google Maps short link
        const address = project.address || '';
        const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
        
        // Build areas text
        let areasText = 'Areas:\n';
        project.areas?.forEach(area => {
            const totalSqFt = area.materials?.reduce((sum, material) => {
                return sum + (material.variants?.reduce((vSum, variant) => 
                    vSum + (parseFloat(variant.quantity) || 0), 0
                ) || parseFloat(material.quantity) || 0);
            }, 0) || 0;

            const finishedText = area.isFinished ? '' : ' (unfinished)';
            const vaultText = area.vaultHeights ? ` (Vaults: ${area.vaultHeights})` : '';
            areasText += `  ${area.name} ${Math.round(totalSqFt)} sq ft${finishedText}${vaultText}\n`;
        });

        // Build finishes text
        const finishesText = [
            project.wallTexture ? `Walls: ${project.wallTexture}` : '',
            project.ceilingTexture ? `Ceilings: ${project.ceilingTexture}` : '',
            project.corners ? `Corners: ${project.corners}` : '',
            project.windowWrap ? `Windows: ${project.windowWrap}` : ''
        ].filter(Boolean).join('\n');

        const jobInfo = `Job: ${project.projectName} (${project.jobNumber})
Customer: ${project.contractor}
Address: ${address}
${mapsUrl}

${areasText}${finishesText ? finishesText + '\n' : ''}${project.notes ? `Notes: ${project.notes}` : ''}`.trim();

        try {
            await navigator.clipboard.writeText(jobInfo);
            // You might want to show a toast notification here
            console.log('Job info copied to clipboard');
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Schedule</h1>
                <div className="text-sm text-gray-600">
                    {canViewAllSupervisors ? 'Viewing all supervisors' : 'Viewing your jobs only'}
                </div>
            </div>

            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                {canViewAllSupervisors && (
                                    <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('supervisorName')}>
                                        Supervisor <SortIcon direction={getSortDirection('supervisorName')} />
                                    </th>
                                )}
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('jobNumber')}>
                                    Job # <SortIcon direction={getSortDirection('jobNumber')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('projectName')}>
                                    Project Name <SortIcon direction={getSortDirection('projectName')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('contractor')}>
                                    Customer <SortIcon direction={getSortDirection('contractor')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('address')}>
                                    Address <SortIcon direction={getSortDirection('address')} />
                                </th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('materialStockDate')}>
                                    Stocked Date <SortIcon direction={getSortDirection('materialStockDate')} />
                                </th>
                                <th scope="col" className="px-6 py-3 text-center">
                                    Sq Ft
                                </th>
                                <th scope="col" className="px-6 py-3 text-center">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={canViewAllSupervisors ? "8" : "7"} className="px-6 py-12 text-center text-gray-500">
                                        No scheduled jobs found.
                                    </td>
                                </tr>
                            ) : (
                                sortedProjects.map(project => (
                                    <React.Fragment key={project.id}>
                                        <tr className="bg-white border-b hover:bg-gray-50">
                                            {canViewAllSupervisors && (
                                                <td className="px-6 py-4">{project.supervisorName}</td>
                                            )}
                                            <td className="px-6 py-4 font-mono text-gray-500">{project.jobNumber}</td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => onEditProject(project.id)} 
                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    {project.projectName}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">{project.contractor}</td>
                                            <td className="px-6 py-4">{project.address}</td>
                                            <td className="px-6 py-4">
                                                {project.materialStockDate ? new Date(project.materialStockDate).toLocaleDateString() : 'Not set'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-xs">
                                                    <div className="text-green-600">F: {project.finishedSqFt}</div>
                                                    <div className="text-orange-600">U: {project.unfinishedSqFt}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center space-x-2">
                                                    <button
                                                        onClick={() => toggleExpanded(project.id)}
                                                        className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded text-sm font-medium"
                                                    >
                                                        {expandedRows.has(project.id) ? 'Collapse' : 'Expand'}
                                                    </button>
                                                    <button
                                                        onClick={() => copyJobInfo(project)}
                                                        className="px-3 py-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded text-sm font-medium"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows.has(project.id) && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={canViewAllSupervisors ? "8" : "7"} className="px-6 py-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {/* Hang Crew */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                Hang Crew
                                                            </label>
                                                            <select
                                                                value={project.hangCrew || ''}
                                                                onChange={(e) => handleCrewAssignment(project.id, 'hang', e.target.value)}
                                                                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            >
                                                                <option value="">Select crew...</option>
                                                                {crews.filter(crew => crew.name.toLowerCase().includes('hang')).map(crew => (
                                                                    <option key={crew.id} value={crew.id}>{crew.name}</option>
                                                                ))}
                                                            </select>
                                                            {project.hangAssignedDate && (
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    Assigned: {new Date(project.hangAssignedDate).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Tape Crew */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                Tape Crew
                                                            </label>
                                                            <select
                                                                value={project.tapeCrew || ''}
                                                                onChange={(e) => handleCrewAssignment(project.id, 'tape', e.target.value)}
                                                                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            >
                                                                <option value="">Select crew...</option>
                                                                {crews.filter(crew => crew.name.toLowerCase().includes('tap')).map(crew => (
                                                                    <option key={crew.id} value={crew.id}>{crew.name}</option>
                                                                ))}
                                                            </select>
                                                            {project.tapeAssignedDate && (
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    Assigned: {new Date(project.tapeAssignedDate).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Pre-lien */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                Pre-lien #
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={project.preLienNumber || ''}
                                                                onChange={(e) => updateDoc(doc(db, projectsPath, project.id), { preLienNumber: e.target.value })}
                                                                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                placeholder="Enter pre-lien number"
                                                            />
                                                        </div>

                                                        {/* QC Checkbox */}
                                                        <div className="flex items-center">
                                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={project.qcd || false}
                                                                    onChange={(e) => handleQCToggle(project.id, e.target.checked)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs font-medium text-gray-700">QC'd</span>
                                                            </label>
                                                            {project.qcdDate && (
                                                                <div className="text-xs text-gray-500 ml-2">
                                                                    {new Date(project.qcdDate).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Finishes Display */}
                                                    <div className="mt-4 p-3 bg-white rounded border">
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                            <div><span className="font-medium">Walls:</span> {project.wallTexture || 'Not set'}</div>
                                                            <div><span className="font-medium">Ceilings:</span> {project.ceilingTexture || 'Not set'}</div>
                                                            <div><span className="font-medium">Corners:</span> {project.corners || 'Not set'}</div>
                                                            <div><span className="font-medium">Windows:</span> {project.windowWrap || 'Not set'}</div>
                                                        </div>
                                                        {project.notes && (
                                                            <div className="mt-2">
                                                                <span className="font-medium text-xs">Notes:</span>
                                                                <p className="text-xs text-gray-600 mt-1">{project.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;