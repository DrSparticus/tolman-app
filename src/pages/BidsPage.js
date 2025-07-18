import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import BidHeader from '../components/bids/BidHeader';
import Area from '../components/bids/Area';
import ChangeLog from '../components/bids/ChangeLog';
import { TaperCrew, getTaperRate } from '../Helpers';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;

export default function BidsPage({ db, setCurrentPage, editingProjectId, userData, onNewBid }) {
    const newBidState = {
        projectName: 'New Bid',
        contractor: '',
        address: '',
        supervisor: '',
        wallTexture: '',
        ceilingTexture: '',
        corners: '',
        finishedHangingRate: '',
        finishedTapingRate: '',
        unfinishedTapingRate: '',
        autoTapeRate: true, // Enable auto-calculation by default
        areas: [
            { id: crypto.randomUUID(), name: 'Main', materials: [], isFinished: true, useOverallFinishes: true, wallTexture: '', ceilingTexture: '', corners: '' },
            { id: crypto.randomUUID(), name: 'Garage', materials: [], isFinished: false, useOverallFinishes: true, wallTexture: '', ceilingTexture: '', corners: '' }
        ],
        changeLog: [],
    };

    const [bid, setBid] = useState(newBidState);
    const [loading, setLoading] = useState(false);
    const [supervisors, setSupervisors] = useState([]);
    const [finishes, setFinishes] = useState({ wallTextures: [], ceilingTextures: [], corners: [] });

    // --- Data Fetching Effects ---
    useEffect(() => {
        const fetchProject = async () => {
            if (editingProjectId) {
                setLoading(true);
                const projectDocRef = doc(db, projectsPath, editingProjectId);
                const docSnap = await getDoc(projectDocRef);
                if (docSnap.exists()) {
                    setBid({ id: docSnap.id, ...docSnap.data() });
                } else {
                    console.error("No such document to edit!");
                    setCurrentPage('projects');
                }
                setLoading(false);
            } else {
                setBid(newBidState);
            }
        };
        fetchProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingProjectId, db, setCurrentPage]);
    
    useEffect(() => {
        if (!db) return;
        const usersCollection = collection(db, usersPath);
        const q = query(usersCollection, where('role', '==', 'supervisor'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const supervisorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supervisorData);
        });
        return unsubscribe;
    }, [db]);

    useEffect(() => {
        if (!db) return;
        const finishesDocRef = doc(db, configPath, 'finishes');
        const unsubscribe = onSnapshot(finishesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const finishesData = docSnap.data();
                setFinishes(finishesData);
                if (!editingProjectId) {
                    setBid(prev => ({
                        ...prev,
                        wallTexture: finishesData.wallTextures?.[0]?.name || '',
                        ceilingTexture: finishesData.ceilingTextures?.[0]?.name || '',
                        corners: finishesData.corners?.[0]?.name || '',
                    }));
                }
            }
        });
        return unsubscribe;
    }, [db, editingProjectId]);

    useEffect(() => {
        if (!db || editingProjectId) return;
        const ratesDocRef = doc(db, configPath, 'laborRates');
        const unsub = onSnapshot(ratesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const ratesData = docSnap.data();
                const mappedRates = {
                    finishedHangingRate: String(ratesData.finishedHanging || ''),
                    finishedTapingRate: String(ratesData.finishedTaping || ''),
                    unfinishedHangingRate: String(ratesData.unfinishedHanging || ''),
                    unfinishedTapingRate: String(ratesData.unfinishedTaping || ''), // Corrected here
                };
                setBid(prev => ({ ...prev, ...mappedRates }));
            }
        });
        return unsub;
    }, [db, editingProjectId]);

    useEffect(() => {
        // Calculate tape rate whenever relevant state changes
        if (bid.autoTapeRate && finishes && finishes.wallTextures && finishes.ceilingTextures && finishes.corners && bid.finishedHangingRate) {
            const taperFinishesPayRate = getTaperRate(bid, finishes);
            const calculatedTapeRate = parseFloat(bid.finishedHangingRate) + 0.04 + taperFinishesPayRate;
            setBid(prev => ({
                ...prev, finishedTapingRate: calculatedTapeRate.toFixed(3) // Update tape rate
            }));
        }
    }, [bid.autoTapeRate, bid.finishedHangingRate, finishes]);

    // --- State Update Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setBid(prev => ({ ...prev, [name]: value }));
    };

    const addArea = () => {
        setBid(prev => ({
            ...prev,
            areas: [...prev.areas, { id: crypto.randomUUID(), name: `Area ${prev.areas.length + 1}`, materials: [], isFinished: true, useOverallFinishes: true, wallTexture: '', ceilingTexture: '', corners: '' }]
        }));
    };

    const updateArea = (areaId, updatedArea) => {
        setBid(prev => ({
            ...prev,
            areas: prev.areas.map(area => area.id === areaId ? updatedArea : area)
        }));
    };

    const removeArea = (areaId) => {
        setBid(prev => ({
            ...prev,
            areas: prev.areas.filter(area => area.id !== areaId)
        }));
    };

    // --- Save Logic ---
    const handleSave = async () => {
        if (!db) return alert("Database connection not available.");

        const getChanges = (original, updated) => {
            // This function would contain the detailed comparison logic
            // For brevity, we'll just create a summary message.
            return 'Project details updated.';
        };

        const logChange = (changeText) => ({
            change: changeText,
            user: { id: userData.id, name: `${userData.firstName} ${userData.lastName}` },
            timestamp: new Date()
        });

        if (bid.id) { // Update existing project
            const projectDocRef = doc(db, projectsPath, bid.id);
            const originalDoc = await getDoc(projectDocRef);
            const changes = getChanges(originalDoc.data(), bid);
            await updateDoc(projectDocRef, { ...bid, changeLog: arrayUnion(logChange(changes)) });
            alert("Project updated successfully!");
        } else { // Create new bid
            const newJobNumber = await generateJobNumber('B');
            await addDoc(collection(db, projectsPath), {
                ...bid,
                jobNumber: newJobNumber,
                status: 'bid',
                createdAt: new Date(),
                changeLog: [logChange("Bid created.")]
            });
            alert(`Bid saved with job number ${newJobNumber}!`);
        }
        setCurrentPage('projects');
    };

    const generateJobNumber = async (prefixChar) => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `${prefixChar}${year}${month}-`;

        const q = query(collection(db, projectsPath), where('jobNumber', '>=', prefix), where('jobNumber', '<', prefix + 'z'), orderBy('jobNumber', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        let nextNumber = 1;
        if (!querySnapshot.empty) {
            const lastJobNumber = querySnapshot.docs[0].data().jobNumber;
            const lastNumber = parseInt(lastJobNumber.split('-')[1], 10);
            nextNumber = lastNumber + 1;
        }
        return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
    };

    if (loading) return <div className="text-center p-10">Loading project...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{bid.id ? `Editing: ${bid.projectName} (${bid.jobNumber})` : "Bid Sheet Editor"}</h1>
                <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => setCurrentPage('projects')} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
                    {bid.id && <button type="button" onClick={onNewBid} className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">New Bid</button>}
                    <button onClick={handleSave} className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">{bid.id ? 'Save Changes' : 'Save Bid'}</button>
                </div>
            </div>

            <BidHeader bid={bid} handleInputChange={handleInputChange} supervisors={supervisors} finishes={finishes} />

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {bid.areas.map((area) => (
                    <Area key={area.id} area={area} onUpdate={updateArea} onRemove={() => removeArea(area.id)} finishes={finishes} db={db} isOnlyArea={bid.areas.length === 1} />
                ))}
            </div>

            <button onClick={addArea} className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg">Add Area</button>

            <ChangeLog log={bid.changeLog} hasLogAccess={userData?.role === 'admin'} />
        </div>
    );
}
