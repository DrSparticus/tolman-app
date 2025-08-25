import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { pages as pageConfig } from '../pagesConfig';
import FinishesConfig from '../components/FinishesConfig';
import LaborConfig from '../components/LaborConfig';
import MarkupConfig from '../components/MarkupConfig'; 

const AdministrationPage = ({ db }) => {
    const [roles, setRoles] = useState([]);
    const [expandedRole, setExpandedRole] = useState(null);
    const rolesPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/roles`;

    // Predefined roles that should always exist
    const predefinedRoles = [
        { id: 'admin', name: 'Admin', isProtected: true },
        { id: 'office', name: 'Office', isProtected: true },
        { id: 'salesman', name: 'Salesman', isProtected: true },
        { id: 'supplier', name: 'Supplier', isProtected: true },
        { id: 'supervisor', name: 'Supervisor', isProtected: true },
        { id: 'crew', name: 'Crew', isProtected: true }
    ];

    // Define specific permissions for each page
    const permissions = {
        home: [
            { id: 'view', name: 'View Dashboard' }
        ],
        bids: [
            { id: 'view', name: 'View Bids' },
            { id: 'create', name: 'Create Bids' },
            { id: 'edit', name: 'Edit Bids' },
            { id: 'delete', name: 'Delete Bids' },
            { id: 'advancedPricing', name: 'Advanced Pricing View' },
            { id: 'convertToProject', name: 'Convert to Project' }
        ],
        customers: [
            { id: 'view', name: 'View Customers' },
            { id: 'create', name: 'Create Customers' },
            { id: 'edit', name: 'Edit Customers' },
            { id: 'delete', name: 'Delete Customers' }
        ],
        suppliers: [
            { id: 'view', name: 'View Suppliers' },
            { id: 'create', name: 'Create Suppliers' },
            { id: 'edit', name: 'Edit Suppliers' },
            { id: 'delete', name: 'Delete Suppliers' }
        ],
        materials: [
            { id: 'view', name: 'View Materials' },
            { id: 'create', name: 'Create Materials' },
            { id: 'edit', name: 'Edit Materials' },
            { id: 'delete', name: 'Delete Materials' },
            { id: 'pricing', name: 'View/Edit Pricing' }
        ],
        projects: [
            { id: 'view', name: 'View Projects' },
            { id: 'edit', name: 'Edit Projects' },
            { id: 'schedule', name: 'Edit Schedule' },
            { id: 'complete', name: 'Mark Complete' }
        ],
        changeOrders: [
            { id: 'view', name: 'View Change Orders' },
            { id: 'create', name: 'Create Change Orders' },
            { id: 'approve', name: 'Approve Change Orders' }
        ],
        schedule: [
            { id: 'view', name: 'View Schedule' },
            { id: 'edit', name: 'Edit Schedule' },
            { id: 'assign', name: 'Assign Crews' }
        ],
        users: [
            { id: 'view', name: 'View Users' },
            { id: 'create', name: 'Create Users' },
            { id: 'edit', name: 'Edit Users' },
            { id: 'delete', name: 'Delete Users' },
            { id: 'roles', name: 'Manage Roles' }
        ],
        administration: [
            { id: 'view', name: 'View Admin Panel' },
            { id: 'finishes', name: 'Manage Finishes' },
            { id: 'labor', name: 'Manage Labor Config' },
            { id: 'markup', name: 'Manage Markup Config' },
            { id: 'roles', name: 'Manage Roles & Permissions' }
        ]
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!db) return;
        console.log('AdministrationPage: Loading roles from:', rolesPath);
        const rolesCollection = collection(db, rolesPath);
        const unsubscribe = onSnapshot(rolesCollection, (snapshot) => {
            console.log('AdministrationPage: Roles snapshot received, docs count:', snapshot.docs.length);
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('AdministrationPage: Roles data:', rolesData);
            
            // Merge predefined roles with database roles
            const allRoles = predefinedRoles.map(predefined => {
                const dbRole = rolesData.find(r => r.id === predefined.id);
                if (dbRole) {
                    console.log(`Found existing role: ${predefined.id}`, dbRole);
                    return { ...predefined, ...dbRole };
                } else {
                    // Create default permissions for new predefined roles
                    console.log(`Creating default role: ${predefined.id}`);
                    const defaultPermissions = getDefaultPermissions(predefined.id);
                    setDoc(doc(db, rolesPath, predefined.id), {
                        name: predefined.name,
                        permissions: defaultPermissions
                    });
                    return { ...predefined, permissions: defaultPermissions };
                }
            });
            
            console.log('AdministrationPage: Final roles array:', allRoles);
            setRoles(allRoles);
        });
        return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, rolesPath]);

    const getDefaultPermissions = (roleId) => {
        const defaults = {};
        Object.keys(permissions).forEach(pageId => {
            defaults[pageId] = {};
            permissions[pageId].forEach(perm => {
                // Set default permissions based on role
                switch (roleId) {
                    case 'admin':
                        defaults[pageId][perm.id] = true;
                        break;
                    case 'office':
                        defaults[pageId][perm.id] = ['view', 'create', 'edit'].includes(perm.id);
                        break;
                    case 'salesman':
                        defaults[pageId][perm.id] = pageId === 'bids' && ['view', 'create', 'edit'].includes(perm.id);
                        break;
                    case 'supplier':
                        defaults[pageId][perm.id] = pageId === 'materials' && perm.id === 'view';
                        break;
                    case 'supervisor':
                        // Supervisors should have access to home, projects, and schedule
                        if (pageId === 'home') {
                            defaults[pageId][perm.id] = perm.id === 'view';
                        } else {
                            defaults[pageId][perm.id] = ['projects', 'schedule'].includes(pageId) && ['view', 'edit'].includes(perm.id);
                        }
                        break;
                    case 'crew':
                        defaults[pageId][perm.id] = pageId === 'schedule' && perm.id === 'view';
                        break;
                    default:
                        defaults[pageId][perm.id] = false;
                }
            });
        });
        return defaults;
    };

    const handlePermissionChange = async (roleId, pageId, permissionId, hasPermission) => {
        if (predefinedRoles.find(r => r.id === roleId)?.isProtected && roleId === 'admin') return;
        
        const roleDocRef = doc(db, rolesPath, roleId);
        await setDoc(roleDocRef, {
            permissions: {
                [pageId]: {
                    [permissionId]: hasPermission
                }
            }
        }, { merge: true });
    };

    const RolePermissions = ({ role }) => {
        const isExpanded = expandedRole === role.id;
        
        return (
            <div className="border border-gray-200 rounded-lg mb-4">
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                >
                    <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-800 capitalize">{role.name}</span>
                        {role.isProtected && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Protected</span>
                        )}
                    </div>
                    <svg
                        className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                
                {isExpanded && (
                    <div className="p-4 border-t bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(permissions).map(([pageId, pagePermissions]) => {
                                const page = pageConfig.find(p => p.id === pageId);
                                if (!page || page.hidden) return null;
                                
                                return (
                                    <div key={pageId} className="bg-white p-3 rounded-lg border">
                                        <h4 className="font-medium text-gray-800 mb-3">{page.text}</h4>
                                        <div className="space-y-2">
                                            {pagePermissions.map(permission => (
                                                <label key={permission.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        checked={role.permissions?.[pageId]?.[permission.id] || false}
                                                        disabled={role.id === 'admin'}
                                                        onChange={(e) => handlePermissionChange(role.id, pageId, permission.id, e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">{permission.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Administration</h1>

            <FinishesConfig db={db} />
            <LaborConfig db={db} />
            <MarkupConfig db={db} />

            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Role & Permission Management</h2>
                
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <p className="text-gray-600 mb-4">
                        Configure permissions for each role. Admin role has all permissions by default and cannot be modified.
                    </p>
                    
                    <div className="space-y-4">
                        {roles.map(role => (
                            <RolePermissions key={role.id} role={role} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdministrationPage;
