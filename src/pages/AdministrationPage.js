import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { pages as pageConfig } from '../pagesConfig';
import { PlusIcon, DeleteIcon } from '../Icons.js';
import FinishesConfig from '../components/FinishesConfig';
import LaborRatesConfig from '../components/LaborRatesConfig';
import MarkupConfig from '../components/MarkupConfig';
import LaborCrewConfig from '../components/LaborCrewConfig'; 

const AdministrationPage = ({ db }) => {
    const [roles, setRoles] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const rolesPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/roles`;

    useEffect(() => {
        if (!db) return;
        const rolesCollection = collection(db, rolesPath);
        const unsubscribe = onSnapshot(rolesCollection, (snapshot) => {
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const adminRole = {
                id: 'admin',
                name: 'Admin',
                permissions: pageConfig.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
                isProtected: true
            };
            const dbRoles = rolesData.filter(r => r.id !== 'admin');
            setRoles([adminRole, ...dbRoles]);
        });
        return unsubscribe;
    }, [db, rolesPath]);

    const handlePermissionChange = async (roleId, pageId, hasPermission) => {
        if (roleId === 'admin') return;
        const roleDocRef = doc(db, rolesPath, roleId);
        await setDoc(roleDocRef, {
            permissions: {
                [pageId]: hasPermission
            }
        }, { merge: true });
    };

    const handleAddRole = async (e) => {
        e.preventDefault();
        const trimmedName = newRoleName.trim();
        if (!trimmedName || roles.some(r => r.name.toLowerCase() === trimmedName.toLowerCase())) {
            alert("Invalid or duplicate role name.");
            return;
        }
        const roleId = trimmedName.toLowerCase().replace(/\s+/g, '-');
        
        const defaultPermissions = pageConfig.reduce((acc, page) => {
            acc[page.id] = false;
            return acc;
        }, { home: true, profile: true });

        await setDoc(doc(db, rolesPath, roleId), {
            name: trimmedName,
            permissions: defaultPermissions
        });
        setNewRoleName('');
    };

    const handleDeleteRole = async (roleId) => {
        if (roleId === 'admin') {
            alert("Cannot delete the admin role.");
            return;
        }
        if (window.confirm(`Are you sure you want to delete the "${roles.find(r=>r.id === roleId)?.name}" role? This cannot be undone.`)) {
            await deleteDoc(doc(db, rolesPath, roleId));
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Administration</h1>

            <FinishesConfig db={db} />
            <LaborRatesConfig db={db} />
            <MarkupConfig db={db} />
            <LaborCrewConfig db={db} />

            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Role & Permission Management</h2>
                <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                    <h3 className="text-xl font-semibold text-gray-600 mb-3">Create New Role</h3>
                    <form onSubmit={handleAddRole} className="flex items-center space-x-4">
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Enter new role name"
                            className="flex-grow mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md"
                        >
                            <PlusIcon />
                            <span className="ml-2">Add Role</span>
                        </button>
                    </form>
                </div>

                <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                    <div className="p-6 border-b">
                        <h3 className="text-xl font-semibold text-gray-600">Permissions</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 sticky left-0 bg-gray-100 z-10">Role</th>
                                    {pageConfig.filter(p => !p.hidden).map(page => (
                                        <th key={page.id} scope="col" className="px-6 py-3 text-center whitespace-nowrap">{page.text}</th>
                                    ))}
                                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.sort((a, b) => a.isProtected ? -1 : b.isProtected ? 1 : a.name.localeCompare(b.name)).map(role => (
                                    <tr key={role.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900 capitalize sticky left-0 bg-white">{role.name}</td>
                                        {pageConfig.filter(p => !p.hidden).map(page => (
                                            <td key={page.id} className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                                    checked={role.permissions?.[page.id] || false}
                                                    disabled={role.isProtected}
                                                    onChange={(e) => handlePermissionChange(role.id, page.id, e.target.checked)}
                                                />
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right">
                                            {!role.isProtected && (
                                                <button onClick={() => handleDeleteRole(role.id)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full">
                                                    <DeleteIcon />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdministrationPage;