import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import ExpandableBidHeader from '../components/bids/ExpandableBidHeader';
import Area from '../components/bids/Area';
import ChangeLog from '../components/bids/ChangeLog';
import BidPricingSummary from '../components/bids/BidPricingSummary';
import { TaperCrew, getTaperRate } from '../Helpers';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;

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
        finishedTapeRate: '',
        unfinishedTapingRate: '',
        autoTapeRate: true,
        areas: [
            { 
                id: crypto.randomUUID(), 
                name: 'Main', 
                materials: [], // Will be populated when materials load
                isFinished: true, 
                useOverallFinishes: true, 
                useOverallLabor: true,
                wallTexture: '', 
                ceilingTexture: '', 
                corners: '',
                hangRate: '',
                tapeRate: '',
                autoTapeRate: true
            },
            { 
                id: crypto.randomUUID(), 
                name: 'Garage', 
                materials: [], // Will be populated when materials load
                isFinished: false, 
                useOverallFinishes: true,
                useOverallLabor: true,
                wallTexture: '', 
                ceilingTexture: '', 
                corners: '',
                hangRate: '',
                tapeRate: '',
                autoTapeRate: true
            }
        ],
        changeLog: [],
        totalMaterialCost: 0,
        totalHangingLabor: 0,
        totalTapingLabor: 0,
        totalHangingSqFt: 0,
        totalTapingSqFt: 0
    };

    const [bid, setBid] = useState(newBidState);
    const [loading, setLoading] = useState(false);
    const [supervisors, setSupervisors] = useState([]);
    const [finishes, setFinishes] = useState({ wallTextures: [], ceilingTextures: [], corners: [] });
    const [materials, setMaterials] = useState([]);
    const [crewTypes, setCrewTypes] = useState([]);
    const [laborBreakdown, setLaborBreakdown] = useState({ hanging: { labor: 0, sqFt: 0 }, taping: { labor: 0, sqFt: 0 } });
    const [totalMaterialCost, setTotalMaterialCost] = useState(0);

    // Fetch crew types
    useEffect(() => {
        if (!db) return;
        const crewCollectionRef = collection(db, configPath, 'labor', 'crewTypes');
        const unsubscribe = onSnapshot(crewCollectionRef, (snapshot) => {
            const crewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCrewTypes(crewsData);
        });
        return unsubscribe;
    }, [db]);

    // Fetch materials
    useEffect(() => {
        if (!db) return;
        const materialsCollection = collection(db, materialsPath);
        const unsubscribe = onSnapshot(materialsCollection, (snapshot) => {
            const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(materialsData);
        });
        return unsubscribe;
    }, [db]);

    // Populate default material IDs when materials load
    useEffect(() => {
        if (materials.length > 0 && !bid.id) {
            const regularMaterial = materials.find(m => m.name === '1/2" Regular');
            const typeXMaterial = materials.find(m => m.name === '5/8" Type X');

            if (regularMaterial || typeXMaterial) {
                setBid(prev => ({
                    ...prev,
                    areas: prev.areas.map(area => {
                        if (area.name === 'Main' && regularMaterial) {
                            return {
                                ...area,
                                materials: [{
                                    materialId: regularMaterial.id,
                                    materialName: regularMaterial.name,
                                    quantity: 0,
                                    laborType: 'finished'
                            }]
                        };
                        } else if (area.name === 'Garage') {
                            const areaMaterials = [];
                            if (regularMaterial) {
                                areaMaterials.push({
                                    materialId: regularMaterial.id,
                                    materialName: regularMaterial.name,
                                    quantity: 0,
                                    laborType: 'unfinished'
                            });
                        }
                        if (typeXMaterial) {
                            areaMaterials.push({
                                materialId: typeXMaterial.id,
                                materialName: typeXMaterial.name,
                                quantity: 0,
                                laborType: 'unfinished'
                            });
                        }
                        return { ...area, materials: areaMaterials };
                    }
                    return area;
                })
            }));
            }
        }
    }, [materials, bid.id]);

    // Calculate totals and labor breakdown from all areas
    useEffect(() => {
        let totalMaterialCostCalc = 0;
        let totalHangingLabor = 0;
        let totalTapingLabor = 0;
        let totalHangingSqFt = 0;
        let totalTapingSqFt = 0;

        const hangingCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('hang'))?.id;
        const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;

        bid.areas?.forEach(area => {
            area.materials?.forEach(areaMat => {
                const material = materials.find(m => m.id === areaMat.materialId);
                if (material) {
                    // Calculate total quantity from variants
                    let quantity = 0;
                    if (areaMat.variants && areaMat.variants.length > 0) {
                        quantity = areaMat.variants.reduce((total, variant) => {
                            return total + (parseFloat(variant.quantity) || 0);
                        }, 0);
                    } else {
                        quantity = parseFloat(areaMat.quantity) || 0;
                    }
                    
                    const price = parseFloat(material.price) || 0;
                    totalMaterialCostCalc += quantity * price;

                    // Calculate labor rates (area-specific or overall)
                    const hangRate = area.useOverallLabor 
                        ? parseFloat(bid.finishedHangingRate) || 0 
                        : parseFloat(area.hangRate) || 0;
                    const tapeRate = area.useOverallLabor 
                        ? parseFloat(bid.finishedTapeRate) || 0 
                        : parseFloat(area.tapeRate) || 0;

                    if (material.category === 'drywall-board' || material.category === '2nd-layer-board') {
                        totalHangingLabor += quantity * hangRate;
                        totalHangingSqFt += quantity;
                        
                        if (areaMat.laborType === 'finished') {
                            totalTapingLabor += quantity * tapeRate;
                            totalTapingSqFt += quantity;
                        }
                    }

                    // Add extra labor costs
                    if (material.extraLabor) {
                        material.extraLabor.forEach(extra => {
                            if (extra.crewType === hangingCrewId) {
                                totalHangingLabor += quantity * (parseFloat(extra.extraPay) || 0);
                            } else if (extra.crewType === taperCrewId) {
                                totalTapingLabor += quantity * (parseFloat(extra.extraPay) || 0);
                            }
                        });
                    }
                }
            });
        });

        setTotalMaterialCost(totalMaterialCostCalc);
        setLaborBreakdown({
            hanging: { labor: totalHangingLabor, sqFt: totalHangingSqFt, crewId: hangingCrewId },
            taping: { labor: totalTapingLabor, sqFt: totalTapingSqFt, crewId: taperCrewId }
        });

        setBid(prev => ({
            ...prev,
            totalMaterialCost: totalMaterialCostCalc,
            totalHangingLabor,
            totalTapingLabor,
            totalHangingSqFt,
            totalTapingSqFt
        }));
    }, [bid.areas, materials, crewTypes, bid.finishedHangingRate, bid.finishedTapeRate]);

    // --- Data Fetching Effects ---
    useEffect(() => {
        if (!db) return;
        const supervisorsCollection = collection(db, usersPath);
        const q = query(supervisorsCollection, where('role', '==', 'supervisor'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const supervisorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supervisorsData);
        });
        return unsubscribe;
    }, [db]);

    useEffect(() => {
        if (!db) return;
        const finishesDocRef = doc(db, configPath, 'finishes');
        const unsubscribe = onSnapshot(finishesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setFinishes(docSnap.data());
            }
        });
        return unsubscribe;
    }, [db]);

    useEffect(() => {
        if (editingProjectId && db) {
            const fetchProject = async () => {
                setLoading(true);
                try {
                    const projectDoc = await getDoc(doc(db, projectsPath, editingProjectId));
                    if (projectDoc.exists()) {
                        const projectData = projectDoc.data();
                        setBid({ id: editingProjectId, ...projectData });
                    }
                } catch (error) {
                    console.error("Error fetching project:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchProject();
        }
    }, [editingProjectId, db]);

    // --- State Update Handlers ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setBid(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const updateArea = (updatedArea) => {
        setBid(prev => ({
            ...prev,
            areas: prev.areas.map(area => area.id === updatedArea.id ? updatedArea : area)
        }));
    };

    const addArea = () => {
        const regularMaterial = materials.find(m => m.name === '1/2" Regular');
        
        const newArea = {
            id: crypto.randomUUID(),
            name: `Area ${bid.areas.length + 1}`,
            materials: regularMaterial ? [{
                materialId: regularMaterial.id,
                materialName: regularMaterial.name,
                laborType: 'finished',
                variants: [] // Will be populated when user starts counting
            }] : [],
            isFinished: true,
            useOverallFinishes: true,
            useOverallLabor: true,
            wallTexture: '',
            ceilingTexture: '',
            corners: '',
            hangRate: '',
            tapeRate: '',
            autoTapeRate: true
        };
        setBid(prev => ({ ...prev, areas: [...prev.areas, newArea] }));
    };

    const removeArea = (areaId) => {
        setBid(prev => ({ ...prev, areas: prev.areas.filter(area => area.id !== areaId) }));
    };

    // --- Save Logic ---
    const handleSave = async () => {
        if (!db) return;
        setLoading(true);
        try {
            const taperRate = getTaperRate(bid.finishedHangingRate);
            const bidData = {
                ...bid,
                finishedTapeRate: bid.autoTapeRate ? taperRate : bid.finishedTapeRate,
                updatedAt: new Date().toISOString(),
            };

            if (bid.materialStockDate && bid.status === 'bid') {
                const nextJobNumber = await getNextJobNumber();
                bidData.jobNumber = nextJobNumber;
                bidData.status = 'project';
            }

            if (bid.id) {
                await updateDoc(doc(db, projectsPath, bid.id), bidData);
                setBid(prev => ({ ...prev, changeLog: [...(prev.changeLog || []), { date: new Date().toISOString(), change: 'Bid updated', user: userData?.email || 'Unknown' }] }));
            } else {
                const docRef = await addDoc(collection(db, projectsPath), { ...bidData, createdAt: new Date().toISOString(), status: 'bid' });
                setBid(prev => ({ ...prev, id: docRef.id }));
            }
        } catch (error) {
            console.error("Error saving bid:", error);
        } finally {
            setLoading(false);
        }
    };

    const getNextJobNumber = async () => {
        const currentYear = new Date().getFullYear();
        const q = query(
            collection(db, projectsPath),
            where('jobNumber', '>=', `${currentYear}-001`),
            where('jobNumber', '<', `${currentYear + 1}-001`),
            orderBy('jobNumber', 'desc'),
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return `${currentYear}-001`;
        }
        const lastJobNumber = querySnapshot.docs[0].data().jobNumber;
        const lastNumber = parseInt(lastJobNumber.split('-')[1]);
        return `${currentYear}-${String(lastNumber + 1).padStart(3, '0')}`;
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{bid.id ? `Editing: ${bid.projectName} (${bid.jobNumber})` : "Bid Sheet Editor"}</h1>
                <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => setCurrentPage('projects')} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
                    {bid.id && <button type="button" onClick={onNewBid} className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">New Bid</button>}
                    <button onClick={handleSave} className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">{bid.id ? 'Save Changes' : 'Save Bid'}</button>
                </div>
            </div>

            <ExpandableBidHeader 
                bid={bid} 
                handleInputChange={handleInputChange} 
                supervisors={supervisors} 
                finishes={finishes}
                db={db}
                userData={userData}
                materials={materials}
                crewTypes={crewTypes}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {bid.areas.map((area) => (
                    <Area 
                        key={area.id} 
                        area={area} 
                        onUpdate={updateArea} 
                        onRemove={() => removeArea(area.id)} 
                        finishes={finishes} 
                        db={db} 
                        isOnlyArea={bid.areas.length === 1}
                        bid={bid}
                        crewTypes={crewTypes}
                        materials={materials}
                    />
                ))}
            </div>

            <button onClick={addArea} className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg">Add Area</button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <ChangeLog log={bid.changeLog} hasLogAccess={userData?.role === 'admin'} />
                <BidPricingSummary 
                    bid={bid} 
                    laborBreakdown={laborBreakdown} 
                    totalMaterialCost={totalMaterialCost} 
                    userData={userData}
                    db={db}
                    materials={materials}
                    finishes={finishes}
                />
            </div>
        </div>
    );
}
