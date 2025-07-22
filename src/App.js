import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getStorage } from "firebase/storage";
import { setLogLevel } from "firebase/app";

// Import pages and components
import LoginPage from './pages/LoginPage';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import MaterialsPage from './pages/MaterialsPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import BidsPage from './pages/BidsPage';
import SchedulePage from './pages/SchedulePage';
import ChangeOrdersPage from './pages/ChangeOrdersPage';
import AdministrationPage from './pages/AdministrationPage';
import CustomersPage from './pages/CustomersPage';
import ProjectsPage from './pages/ProjectsPage';
import SuppliersPage from './pages/SuppliersPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import AccountDisabledPage from './pages/AccountDisabledPage';

// --- Helper Functions & Configuration ---

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const appId = firebaseConfig.projectId;
const usersPath = `artifacts/${appId}/users`;
const rolesPath = `artifacts/${appId}/roles`;

// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [storage, setStorage] = useState(null);
    const [error, setError] = useState(null);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [currentPage, setCurrentPage] = useState('home');

    // Initialize Firebase
    useEffect(() => {
        setLogLevel('debug');
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        const storageInstance = getStorage(app);
        setAuth(authInstance);
        setDb(dbInstance);
        setStorage(storageInstance);

        let userDocUnsubscribe = () => {};

        const authListenerUnsub = onAuthStateChanged(authInstance, (currentUser) => {
            userDocUnsubscribe(); // Unsubscribe from previous user doc listener
            if (currentUser) {
                const userDocRef = doc(dbInstance, usersPath, currentUser.uid);
                userDocUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const uData = { id: docSnap.id, ...docSnap.data() };
                        if (uData.role && uData.role !== 'admin') {
                            const roleDocRef = doc(dbInstance, rolesPath, uData.role);
                            const roleSnap = await getDoc(roleDocRef);
                            if (roleSnap.exists()) {
                                uData.permissions = roleSnap.data().permissions;
                            }
                        }
                        setUserData(uData);
                    } else {
                        // Create user document if it doesn't exist
                        const isAdminEmail = currentUser.email === 'brett@tolmandrywall.com';
                        const nameParts = currentUser.displayName?.split(' ') || ['New', 'User'];
                        const firstName = nameParts[0];
                        const lastName = nameParts.slice(1).join(' ');

                        const newUserDoc = {
                            email: currentUser.email,
                            firstName: firstName,
                            lastName: lastName,
                            photoURL: currentUser.photoURL || '',
                            role: isAdminEmail ? 'admin' : 'pending',
                        };
                        setDoc(userDocRef, newUserDoc)
                            .then(() => setUserData(newUserDoc))
                            .catch(err => console.warn("Could not create user document", err));
                    }
                    setUser(currentUser);
                    if (loading) setLoading(false);
                }, (err) => {
                    console.error("Error fetching user data:", err);
                    setError("Could not fetch user data.");
                    if (loading) setLoading(false);
                });
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            authListenerUnsub();
            userDocUnsubscribe();
        };
    }, []); // This effect should only run once on mount.

    // Simple history management
    useEffect(() => {
        // Read initial state from URL
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page');
        const projectId = urlParams.get('project');
        
        if (page) {
            setCurrentPage(page);
        }
        if (projectId) {
            setEditingProjectId(projectId);
        }

        // Handle browser back/forward
        const handlePopState = (event) => {
            if (event.state) {
                setCurrentPage(event.state.page || 'home');
                setEditingProjectId(event.state.projectId || null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Update URL when page changes
    useEffect(() => {
        const params = new URLSearchParams();
        if (currentPage !== 'home') {
            params.set('page', currentPage);
        }
        if (editingProjectId) {
            params.set('project', editingProjectId);
        }

        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        const state = { page: currentPage, projectId: editingProjectId };
        
        // Only push state if it's different from current
        if (window.location.search !== ('?' + params.toString())) {
            window.history.pushState(state, '', newUrl);
        }
    }, [currentPage, editingProjectId]);

    // Navigation functions
    const navigateToPage = (page, projectId = null) => {
        setCurrentPage(page);
        setEditingProjectId(projectId);
    };

    const handleEditProject = (projectId) => {
        navigateToPage('bids', projectId);
    };

    const handleNewBid = () => {
        navigateToPage('bids', null);
    };

    const handleGoogleSignIn = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error during sign-in:", error);
            setError("Sign-in failed. Please try again.");
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setCurrentPage('home');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // Access control
    const hasAccess = (pageId) => {
        if (pageId === 'profile') return true; // All authenticated users can access their profile
        if (userData?.role === 'admin') return true;
        return !!userData?.permissions?.[pageId];
    };

    const AccessDeniedPage = () => (
        <div className="text-center p-10 bg-white rounded-lg shadow">
            <h1 className="text-2xl font-bold text-gray-700">Access Denied</h1>
            <p className="text-gray-500 mt-2">You do not have permission to view this page.</p>
        </div>
    );

    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomePage setCurrentPage={setCurrentPage} userData={userData} />;
            case 'materials':
                return hasAccess('materials') ? <MaterialsPage db={db} /> : <AccessDeniedPage />;
            case 'users':
                return hasAccess('users') ? <UsersPage db={db} currentUser={user} /> : <AccessDeniedPage />;
            case 'profile':
                return hasAccess('profile') ? <ProfilePage db={db} user={user} userData={userData} storage={storage} appId={appId} /> : <AccessDeniedPage />;
            case 'bids':
                return hasAccess('bids') ? <BidsPage db={db} setCurrentPage={navigateToPage} editingProjectId={editingProjectId} userData={userData} onNewBid={handleNewBid} /> : <AccessDeniedPage />;
            case 'schedule':
                return hasAccess('schedule') ? <SchedulePage /> : <AccessDeniedPage />;
            case 'change-orders':
                return hasAccess('change-orders') ? <ChangeOrdersPage /> : <AccessDeniedPage />;
            case 'customers':
                return hasAccess('customers') ? <CustomersPage /> : <AccessDeniedPage />;
            case 'projects':
                return hasAccess('projects') ? <ProjectsPage db={db} onNewBid={handleNewBid} onEditProject={handleEditProject} /> : <AccessDeniedPage />;
            case 'suppliers':
                return hasAccess('suppliers') ? <SuppliersPage /> : <AccessDeniedPage />;
            case 'administration':
                return hasAccess('administration') ? <AdministrationPage db={db} /> : <AccessDeniedPage />;
            default:
                return <HomePage setCurrentPage={setCurrentPage} userData={userData} />;
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-100"><div className="text-xl font-semibold">Authenticating...</div></div>;
    }
    
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-red-100 text-red-700 p-4 text-center"><div className="text-xl font-semibold">{error}</div></div>;
    }

    if (!user) {
        return <LoginPage onSignIn={handleGoogleSignIn} />;
    }
    
    if (userData?.role === 'pending') {
        return <PendingApprovalPage onSignOut={handleSignOut} />;
    }

    if (userData?.role === 'disabled') {
        return <AccountDisabledPage onSignOut={handleSignOut} />;
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            <Header
                userData={userData}
                onSignOut={handleSignOut}
                setCurrentPage={setCurrentPage}
                currentPage={currentPage}
            />
            <div className="md:pl-72">
                <main className="p-4 sm:p-6 lg:p-8">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
}