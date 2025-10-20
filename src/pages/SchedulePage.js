import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { SortIcon, ExpandIcon, ShareIcon } from '../Icons.js';

const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const crewsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/crews`;

const SchedulePage = ({ db, userData, onEditProject }) => {
    const [projects, setProjects] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [crews, setCrews] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'jobNumber', direction: 'asc' });
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [qcModal, setQcModal] = useState({ isOpen: false, projectId: null, projectName: '' });
    const [editingCrewNotes, setEditingCrewNotes] = useState(new Set());
    const [tempCrewNotes, setTempCrewNotes] = useState({});
    const textareaRefs = useRef({});

    const getUserName = (userData) => {
        // Prioritize firstName + lastName combination for accuracy
        if (userData?.firstName && userData?.lastName) {
            return `${userData.firstName} ${userData.lastName}`;
        }
        // Fall back to other name fields
        return userData?.name || userData?.displayName || userData?.email || 'Unknown';
    };
    
    // Check permissions
    const canViewAllSupervisors = userData?.role === 'admin' || userData?.permissions?.schedule?.viewAllSupervisors;
    const currentUserSupervisorId = userData?.role === 'supervisor' ? userData.id : null;
    const canAccessPreLien = userData?.role === 'admin' || userData?.permissions?.preLien === true;

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
                .filter(project => !project.deleted && project.status !== 'QC\'d'); // Filter out deleted and QC'd projects
            setProjects(projectsData);
        });

        // Fetch supervisors
        const supervisorsQuery = query(collection(db, usersPath), where('role', '==', 'supervisor'));
        const unsubscribeSupervisors = onSnapshot(supervisorsQuery, (snapshot) => {
            const supervisorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supervisorsData);
        });

        // Fetch crews
        const crewsCollection = collection(db, crewsPath);
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
            
            // Calculate total square footage using actual dimensions
            let finishedSqFt = 0;
            let unfinishedSqFt = 0;
            
            project.areas?.forEach(area => {
                let areaSqFt = 0;
                
                area.materials?.forEach(areaMat => {
                    let materialSqFt = 0;
                    
                    if (areaMat.variants && areaMat.variants.length > 0) {
                        materialSqFt = areaMat.variants.reduce((total, variant) => {
                            const widthFt = parseFloat(variant.widthFt) || 0;
                            const widthIn = parseFloat(variant.widthIn) || 0;
                            const lengthFt = parseFloat(variant.lengthFt) || 0;
                            const lengthIn = parseFloat(variant.lengthIn) || 0;
                            const quantity = parseFloat(variant.quantity) || 0;
                            
                            const widthInches = (widthFt * 12) + widthIn;
                            const lengthInches = (lengthFt * 12) + lengthIn;
                            const sqFtPerPiece = (widthInches * lengthInches) / 144;
                            
                            return total + (sqFtPerPiece * quantity);
                        }, 0);
                    }
                    
                    // Only count drywall board for square footage
                    // For now, assume all materials in area contribute to square footage
                    if (materialSqFt > 0) {
                        areaSqFt += materialSqFt;
                    }
                });
                
                if (area.isFinished) {
                    finishedSqFt += areaSqFt;
                } else {
                    unfinishedSqFt += areaSqFt;
                }
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

        const project = projects.find(p => p.id === projectId);
        const oldCrewId = crewType === 'hang' ? project?.hangCrew : project?.tapeCrew;
        
        // Only update if crew assignment has actually changed
        if (oldCrewId === crewId) return;

        const updateData = {};
        const now = new Date().toISOString();

        // Get crew names for change log
        const oldCrew = crews.find(c => c.id === oldCrewId);
        const newCrew = crews.find(c => c.id === crewId);
        
        const oldCrewName = oldCrew?.name || 'None';
        const newCrewName = newCrew?.name || 'None';
        
        const crewTypeLabel = crewType === 'hang' ? 'Hang Crew' : 'Tape Crew';
        
        // Determine status changes
        const oldStatus = project?.status || 'Stocked';
        let newStatus = oldStatus;

        if (crewType === 'hang') {
            updateData.hangCrew = crewId;
            updateData.hangAssignedDate = crewId ? now : null;
            newStatus = crewId ? 'Production' : 'Stocked';
            updateData.status = newStatus;
        } else if (crewType === 'tape') {
            updateData.tapeCrew = crewId;
            updateData.tapeAssignedDate = crewId ? now : null;
            newStatus = crewId ? 'Production' : 'Production';
            updateData.status = newStatus;
        }

        // Create change log entries
        const changeLogEntries = [];
        
        // Crew assignment change log entry
        changeLogEntries.push({
            timestamp: now,
            change: `${crewTypeLabel} assignment: ${oldCrewName} → ${newCrewName}`,
            user: {
                name: getUserName(userData),
                email: userData?.email || 'Unknown'
            }
        });
        
        // Status change log entry (if status changed)
        if (oldStatus !== newStatus) {
            changeLogEntries.push({
                timestamp: now,
                change: `Status updated: ${oldStatus} → ${newStatus}`,
                user: {
                    name: getUserName(userData),
                    email: userData?.email || 'Unknown'
                }
            });
        }

        // Add change log entries to update data
        updateData.changeLog = [
            ...(project?.changeLog || []),
            ...changeLogEntries
        ];

        await updateDoc(doc(db, projectsPath, projectId), updateData);
    };

    const handleQCToggle = async (projectId, isQCd) => {
        if (!db) return;

        const project = projects.find(p => p.id === projectId);
        const now = new Date().toISOString();
        
        // Create change log entry for QC status change
        const changeLogEntry = {
            timestamp: now,
            change: isQCd ? 'Project marked as QC\'d (finished)' : 'QC status removed',
            user: {
                name: getUserName(userData),
                email: userData?.email || 'Unknown'
            }
        };

        const updateData = {
            qcd: isQCd,
            qcdDate: isQCd ? now : null,
            status: isQCd ? 'QC\'d' : 'Production',
            changeLog: [
                ...(project?.changeLog || []),
                changeLogEntry
            ]
        };

        await updateDoc(doc(db, projectsPath, projectId), updateData);
    };

    const handleCrewNotesUpdate = async (projectId, notes) => {
        if (!db) return;
        
        const project = projects.find(p => p.id === projectId);
        const oldNotes = project?.crewNotes || '';
        
        // Only update if notes have actually changed
        if (oldNotes === notes) return;
        
        // Create change log entry
        const changeLogEntry = {
            timestamp: new Date().toISOString(),
            change: `Crew Notes updated: ${oldNotes ? `"${oldNotes}"` : 'empty'} → "${notes}"`,
            user: {
                name: getUserName(userData),
                email: userData?.email || 'Unknown'
            }
        };
        
        // Update project with new notes and change log entry
        const updateData = {
            crewNotes: notes,
            changeLog: [
                ...(project?.changeLog || []),
                changeLogEntry
            ]
        };
        
        await updateDoc(doc(db, projectsPath, projectId), updateData);
    };

    const startEditingCrewNotes = (projectId) => {
        const project = projects.find(p => p.id === projectId);
        setTempCrewNotes(prev => ({
            ...prev,
            [projectId]: project?.crewNotes || ''
        }));
        setEditingCrewNotes(prev => new Set([...prev, projectId]));
        
        // Focus the textarea and position cursor at end after state update
        setTimeout(() => {
            // Try both desktop and mobile textareas
            const desktopTextarea = textareaRefs.current[projectId];
            const mobileTextarea = textareaRefs.current[`mobile-${projectId}`];
            const textarea = desktopTextarea || mobileTextarea;
            
            if (textarea) {
                textarea.focus();
                // Position cursor at end
                const length = textarea.value.length;
                textarea.setSelectionRange(length, length);
            }
        }, 0);
    };

    const cancelEditingCrewNotes = (projectId) => {
        setTempCrewNotes(prev => {
            const newTemp = { ...prev };
            delete newTemp[projectId];
            return newTemp;
        });
        setEditingCrewNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(projectId);
            return newSet;
        });
    };

    const saveCrewNotes = async (projectId) => {
        const notes = tempCrewNotes[projectId] || '';
        await handleCrewNotesUpdate(projectId, notes);
        cancelEditingCrewNotes(projectId);
    };

    const handleQCButtonClick = (project) => {
        if (project.qcd) {
            // If already QC'd, allow unchecking directly
            handleQCToggle(project.id, false);
        } else {
            // If not QC'd, show confirmation modal
            setQcModal({
                isOpen: true,
                projectId: project.id,
                projectName: project.projectName
            });
        }
    };

    const handleQCConfirm = () => {
        if (qcModal.projectId) {
            handleQCToggle(qcModal.projectId, true);
        }
        setQcModal({ isOpen: false, projectId: null, projectName: '' });
    };

    const handleQCCancel = () => {
        setQcModal({ isOpen: false, projectId: null, projectName: '' });
    };

    const generateMapsInfo = async (coordinates, address) => {
        // Generate both the display text and raw URL
        if (coordinates && coordinates.lat && coordinates.lng) {
            const url = `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
            return {
                displayText: `Maps: ${url}`,
                url: url
            };
        } else if (address) {
            // For addresses, use a simpler format that copies better
            const cleanAddress = address.replace(/\s+/g, '+').replace(/[,]/g, '');
            const url = `https://www.google.com/maps?q=${cleanAddress}`;
            return {
                displayText: `Maps: ${url}`,
                url: url
            };
        }
        return { displayText: '', url: '' };
    };

    const getStatusIndicators = (project) => {
        const indicators = [];
        
        // H - Not hung
        if (!project.hangCrew) {
            indicators.push({ code: 'H', label: 'Needs Hanging', color: 'bg-red-100 text-red-800' });
        }
        
        // T - Not taped  
        if (!project.tapeCrew) {
            indicators.push({ code: 'T', label: 'Needs Taping', color: 'bg-orange-100 text-orange-800' });
        }
        
        // QC - Not quality checked
        if (!project.qcd) {
            indicators.push({ code: 'QC', label: 'Needs QC', color: 'bg-yellow-100 text-yellow-800' });
        }
        
        return indicators;
    };

    const showShareNotification = (message, isError = false) => {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${isError ? '#fee2e2' : '#d1fae5'};
            color: ${isError ? '#dc2626' : '#065f46'};
            border: 1px solid ${isError ? '#fca5a5' : '#a7f3d0'};
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    };

    const shareJobInfo = async (project) => {
        // Generate Google Maps info using GPS coordinates if available
        const mapsInfo = await generateMapsInfo(project.coordinates, project.address);
        
        // Build areas text with proper square footage calculation
        let areasText = 'Areas:\n';
        project.areas?.forEach(area => {
            let areaSqFt = 0;
            
            area.materials?.forEach(areaMat => {
                if (areaMat.variants && areaMat.variants.length > 0) {
                    const materialSqFt = areaMat.variants.reduce((total, variant) => {
                        const widthFt = parseFloat(variant.widthFt) || 0;
                        const widthIn = parseFloat(variant.widthIn) || 0;
                        const lengthFt = parseFloat(variant.lengthFt) || 0;
                        const lengthIn = parseFloat(variant.lengthIn) || 0;
                        const quantity = parseFloat(variant.quantity) || 0;
                        
                        const widthInches = (widthFt * 12) + widthIn;
                        const lengthInches = (lengthFt * 12) + lengthIn;
                        const sqFtPerPiece = (widthInches * lengthInches) / 144;
                        
                        return total + (sqFtPerPiece * quantity);
                    }, 0);
                    areaSqFt += materialSqFt;
                }
            });

            const finishedText = area.isFinished ? '' : ' (unfinished)';
            const vaultText = area.vaultHeights ? ` (Vaults: ${area.vaultHeights})` : '';
            areasText += `  ${area.name} ${Math.round(areaSqFt)} sq ft${finishedText}${vaultText}\n`;
        });

        // Build finishes text
        const finishesText = [
            project.wallTexture ? `Walls: ${project.wallTexture}` : '',
            project.ceilingTexture ? `Ceilings: ${project.ceilingTexture}` : '',
            project.corners ? `Corners: ${project.corners}` : '',
            project.windowWrap ? `Windows: ${project.windowWrap}` : ''
        ].filter(Boolean).join('\n');

        // Create properly formatted text that works in all browsers
        const jobInfoParts = [
            `Job: ${project.projectName} (${project.jobNumber})`,
            `Customer: ${project.contractor}`,
            `Address: ${project.address || 'No address'}`
        ];
        
        // Add Maps URL if available
        if (mapsInfo.displayText) {
            jobInfoParts.push(mapsInfo.displayText);
        }
        
        // Add empty line before areas
        jobInfoParts.push('');
        
        // Add areas
        if (areasText.trim()) {
            jobInfoParts.push(areasText.trim());
        }
        
        // Add finishes
        if (finishesText) {
            jobInfoParts.push(finishesText);
        }
        
        // Add notes
        if (project.crewNotes) {
            jobInfoParts.push(`Notes: ${project.crewNotes}`);
        }
        
        const jobInfo = jobInfoParts.join('\n').trim();

        // Check if Web Share API is supported
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Job Info: ${project.projectName} (${project.jobNumber})`,
                    text: jobInfo,
                    // Include the Maps URL as a separate shareable link if available
                    ...(mapsInfo.url && { url: mapsInfo.url })
                });
                console.log('Job info shared successfully');
                return;
            } catch (err) {
                // User cancelled sharing or sharing failed
                if (err.name !== 'AbortError') {
                    console.error('Native sharing failed:', err);
                }
                // Fall through to clipboard copy
            }
        }

        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(jobInfo);
            console.log('Job info copied to clipboard (sharing not supported)');
            // Show a brief notification that it was copied
            showShareNotification('Job info copied to clipboard');
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for older browsers or permission issues
            try {
                const textArea = document.createElement('textarea');
                textArea.value = jobInfo;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                console.log('Job info copied using fallback method');
                showShareNotification('Job info copied to clipboard');
            } catch (fallbackErr) {
                console.error('All sharing methods failed:', fallbackErr);
                showShareNotification('Failed to share job info', true);
            }
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
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
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
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-center">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={canViewAllSupervisors ? "9" : "8"} className="px-6 py-12 text-center text-gray-500">
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
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {getStatusIndicators(project).map(indicator => (
                                                        <span key={indicator.code} className={`px-1.5 py-0.5 text-xs font-medium rounded ${indicator.color}`} title={indicator.label}>
                                                            {indicator.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center space-x-2">
                                                    <button
                                                        onClick={() => toggleExpanded(project.id)}
                                                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"
                                                        title={expandedRows.has(project.id) ? 'Collapse' : 'Expand'}
                                                    >
                                                        <ExpandIcon isExpanded={expandedRows.has(project.id)} />
                                                    </button>
                                                    <button
                                                        onClick={() => shareJobInfo(project)}
                                                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full"
                                                        title="Share job info"
                                                    >
                                                        <ShareIcon />
                                                    </button>
                                                    {(project.hangCrew && project.tapeCrew) ? (
                                                        <button
                                                            onClick={() => handleQCButtonClick(project)}
                                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                                project.qcd 
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                                                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                            }`}
                                                            title={project.qcd ? 'Mark as unfinished' : 'Mark as finished'}
                                                        >
                                                            {project.qcd ? 'Finished ✓' : 'Finished'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows.has(project.id) && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={canViewAllSupervisors ? "9" : "8"} className="px-6 py-4">
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
                                                                {crews.filter(crew => crew.crewTypes?.hanger).map(crew => (
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
                                                                {crews.filter(crew => crew.crewTypes?.taper).map(crew => (
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
                                                        {canAccessPreLien && (
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
                                                        )}
                                                    </div>

                                                    {/* Finishes Display */}
                                                    <div className="mt-4 p-3 bg-white rounded border">
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                            <div><span className="font-medium">Walls:</span> {project.wallTexture || 'Not set'}</div>
                                                            <div><span className="font-medium">Ceilings:</span> {project.ceilingTexture || 'Not set'}</div>
                                                            <div><span className="font-medium">Corners:</span> {project.corners || 'Not set'}</div>
                                                            <div><span className="font-medium">Windows:</span> {project.windowWrap || 'Not set'}</div>
                                                        </div>
                                                        
                                                        {/* Notes Section - Responsive Grid */}
                                                        <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                            {/* Bid Notes (read-only) */}
                                                            {project.notes && (
                                                                <div>
                                                                    <span className="font-medium text-xs">Bid Notes:</span>
                                                                    <p className="text-xs text-gray-600 mt-1">{project.notes}</p>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Crew Notes (editable) */}
                                                            <div className={project.notes ? '' : 'xl:col-span-2'}>
                                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                    Crew Notes:
                                                                </label>
                                                                {editingCrewNotes.has(project.id) ? (
                                                                    <div>
                                                                        <textarea
                                                                            ref={el => textareaRefs.current[project.id] = el}
                                                                            value={tempCrewNotes[project.id] || ''}
                                                                            onChange={(e) => setTempCrewNotes(prev => ({
                                                                                ...prev,
                                                                                [project.id]: e.target.value
                                                                            }))}
                                                                            placeholder="Enter notes for the crew..."
                                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                            rows="2"
                                                                        />
                                                                        <div className="flex gap-2 mt-2">
                                                                            <button
                                                                                onClick={() => saveCrewNotes(project.id)}
                                                                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                                                            >
                                                                                Save
                                                                            </button>
                                                                            <button
                                                                                onClick={() => cancelEditingCrewNotes(project.id)}
                                                                                className="px-3 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div 
                                                                        onClick={() => startEditingCrewNotes(project.id)}
                                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs cursor-pointer hover:bg-gray-50 min-h-[40px] flex items-start"
                                                                    >
                                                                        {project.crewNotes || 'Click to add crew notes...'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
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

                {/* Mobile Card View */}
                <div className="lg:hidden">
                    {sortedProjects.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No scheduled jobs found.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {sortedProjects.map(project => (
                                <div key={project.id} className="p-4">
                                    {/* Mobile Card Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="font-mono text-sm text-gray-500">{project.jobNumber}</span>
                                                <div className="flex space-x-1">
                                                    {getStatusIndicators(project).map(indicator => (
                                                        <span key={indicator.code} className={`px-1.5 py-0.5 text-xs font-medium rounded ${indicator.color}`} title={indicator.label}>
                                                            {indicator.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => onEditProject(project.id)} 
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                            >
                                                {project.projectName}
                                            </button>
                                            <div className="text-sm text-gray-600 mt-1">
                                                {project.contractor}
                                            </div>
                                            {canViewAllSupervisors && (
                                                <div className="text-sm text-gray-500">
                                                    Supervisor: {project.supervisorName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex space-x-2 ml-4">
                                            <button
                                                onClick={() => toggleExpanded(project.id)}
                                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"
                                                title={expandedRows.has(project.id) ? 'Collapse' : 'Expand'}
                                            >
                                                <ExpandIcon isExpanded={expandedRows.has(project.id)} />
                                            </button>
                                            <button
                                                onClick={() => shareJobInfo(project)}
                                                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full"
                                                title="Share job info"
                                            >
                                                <ShareIcon />
                                            </button>
                                            {(project.hangCrew && project.tapeCrew) ? (
                                                <button
                                                    onClick={() => handleQCButtonClick(project)}
                                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                        project.qcd 
                                                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                    }`}
                                                    title={project.qcd ? 'Mark as unfinished' : 'Mark as finished'}
                                                >
                                                    {project.qcd ? 'Finished ✓' : 'Finished'}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Mobile Card Details */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-500">Address:</span>
                                            <div className="text-gray-800 truncate">{project.address}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Stocked:</span>
                                            <div className="text-gray-800">
                                                {project.materialStockDate ? new Date(project.materialStockDate).toLocaleDateString() : 'Not set'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Finished Sq Ft:</span>
                                            <div className="text-green-600 font-medium">{project.finishedSqFt}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Unfinished Sq Ft:</span>
                                            <div className="text-orange-600 font-medium">{project.unfinishedSqFt}</div>
                                        </div>
                                    </div>

                                    {/* Mobile Expanded Details */}
                                    {expandedRows.has(project.id) && (
                                        <div className="mt-4 space-y-4">
                                            {/* Mobile Notes - Only in Expanded View */}
                                            {(project.notes || project.crewNotes) && (
                                                <div className="space-y-3">
                                                    {/* Bid Notes (read-only) */}
                                                    {project.notes && (
                                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                                            <div className="text-xs font-medium text-gray-700 mb-1">Bid Notes:</div>
                                                            <div className="text-sm text-gray-800">{project.notes}</div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Crew Notes (editable) */}
                                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Crew Notes:
                                                        </label>
                                                        {editingCrewNotes.has(project.id) ? (
                                                            <div>
                                                                <textarea
                                                                    ref={el => textareaRefs.current[`mobile-${project.id}`] = el}
                                                                    value={tempCrewNotes[project.id] || ''}
                                                                    onChange={(e) => setTempCrewNotes(prev => ({
                                                                        ...prev,
                                                                        [project.id]: e.target.value
                                                                    }))}
                                                                    placeholder="Enter notes for the crew..."
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    rows="3"
                                                                />
                                                                <div className="flex gap-2 mt-2">
                                                                    <button
                                                                        onClick={() => saveCrewNotes(project.id)}
                                                                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => cancelEditingCrewNotes(project.id)}
                                                                        className="px-3 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                onClick={() => startEditingCrewNotes(project.id)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-50 min-h-[60px] flex items-start"
                                                            >
                                                                {project.crewNotes || 'Click to add crew notes...'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Crew Assignment Section */}
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Hang Crew
                                                    </label>
                                                    <select
                                                        value={project.hangCrew || ''}
                                                        onChange={(e) => handleCrewAssignment(project.id, 'hang', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select crew...</option>
                                                        {crews.filter(crew => crew.crewTypes?.hanger).map(crew => (
                                                            <option key={crew.id} value={crew.id}>{crew.name}</option>
                                                        ))}
                                                    </select>
                                                    {project.hangAssignedDate && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Assigned: {new Date(project.hangAssignedDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Tape Crew
                                                    </label>
                                                    <select
                                                        value={project.tapeCrew || ''}
                                                        onChange={(e) => handleCrewAssignment(project.id, 'tape', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select crew...</option>
                                                        {crews.filter(crew => crew.crewTypes?.taper).map(crew => (
                                                            <option key={crew.id} value={crew.id}>{crew.name}</option>
                                                        ))}
                                                    </select>
                                                    {project.tapeAssignedDate && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Assigned: {new Date(project.tapeAssignedDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>

                                                {canAccessPreLien && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Pre-lien #
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={project.preLienNumber || ''}
                                                            onChange={(e) => updateDoc(doc(db, projectsPath, project.id), { preLienNumber: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="Enter pre-lien number"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Finishes Section */}
                                            <div className="p-3 bg-gray-50 rounded border">
                                                <div className="text-xs font-medium text-gray-700 mb-2">Finishes</div>
                                                <div className="grid grid-cols-1 gap-1 text-xs">
                                                    <div><span className="font-medium">Walls:</span> {project.wallTexture || 'Not set'}</div>
                                                    <div><span className="font-medium">Ceilings:</span> {project.ceilingTexture || 'Not set'}</div>
                                                    <div><span className="font-medium">Corners:</span> {project.corners || 'Not set'}</div>
                                                    <div><span className="font-medium">Windows:</span> {project.windowWrap || 'Not set'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* QC Confirmation Modal */}
            {qcModal.isOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                                            Quality Control Check
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                <strong>{qcModal.projectName}</strong>
                                            </p>
                                            <p className="text-sm text-gray-600 mt-2">
                                                Have you walked the job and approve of the quality of work?
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    onClick={handleQCConfirm}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Yes, Mark Finished
                                </button>
                                <button
                                    type="button"
                                    onClick={handleQCCancel}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    No, Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchedulePage;