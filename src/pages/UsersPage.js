import React, { useState, useEffect } from 'react';
import { 
    collection, 
    onSnapshot, 
    doc,
    setDoc
} from 'firebase/firestore';

const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const rolesPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/roles`;

const UsersPage = ({ db, currentUser }) => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    
    useEffect(() => {
        if (!db) return;
        const usersCollection = collection(db, usersPath);
        const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersData);
        }, (error) => {
            console.error("Error fetching users:", error);
        });

        const rolesCollection = collection(db, rolesPath);
        const rolesUnsubscribe = onSnapshot(rolesCollection, (snapshot) => {
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRoles(rolesData);
        });

        return () => { unsubscribe(); rolesUnsubscribe(); };
    }, [db]);

    const handleUpdateUserRole = async (userId, newRole) => {
        if(!db) return;
        const userDocRef = doc(db, usersPath, userId);
        await setDoc(userDocRef, { role: newRole }, { merge: true });
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">User Management</h1>
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3">User</th>
                                <th scope="col" className="px-6 py-3">Role</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className={`bg-white border-b hover:bg-gray-50 ${user.role === 'pending' ? 'bg-yellow-100' : ''} ${user.role === 'disabled' ? 'bg-red-100 opacity-60' : ''}`}>
                                    <td className="px-6 py-4 flex items-center">
                                        <img src={user.photoURL} onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/40x40/EBF4FF/76A9FA?text=U'; }} alt={user.displayName} className="w-8 h-8 rounded-full mr-3" />
                                        <div>
                                            <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                                            <div className="text-gray-500">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 capitalize">{user.role}</td>
                                    <td className="px-6 py-4 text-right">
                                        <select 
                                            value={user.role} 
                                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                            className="border rounded p-1 disabled:opacity-50"
                                            disabled={user.id === currentUser.uid}
                                        >
                                            {roles.map(role => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                            <option value="pending">Pending</option>
                                            <option value="disabled">Disabled</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    )
}

export default UsersPage;