import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';

import BidHeader from '../components/bids/BidHeader';
import Area from '../components/bids/Area';
import ChangeLog from '../components/bids/ChangeLog';
import BidPricingSummary from '../components/bids/BidPricingSummary';
import AreaNameModal from '../components/bids/AreaNameModal';
import { getTaperRate } from '../Helpers';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;
const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;
const projectsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/projects`;
const materialsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/public/data/materials`;

// Job number generation functions
const generateJobNumber = async (db, type = 'B') => {
    try {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
        const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
        const yearMonth = `${year}${month}`;
        
        // Query for existing job numbers with the same year/month and type
        const jobNumberQuery = query(
            collection(db, projectsPath),
            where('jobNumber', '>=', `${type}${yearMonth}-`),
            where('jobNumber', '<', `${type}${yearMonth}.`),
            orderBy('jobNumber', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(jobNumberQuery);
        let nextNumber = 1;
        
        if (!snapshot.empty) {
            const lastJob = snapshot.docs[0].data();
            const lastJobNumber = lastJob.jobNumber;
            const match = lastJobNumber.match(new RegExp(`${type}${yearMonth}-(\\d+)`));
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        
        return `${type}${yearMonth}-${nextNumber}`;
    } catch (error) {
        console.error('Error generating job number:', error);
        // Fallback to timestamp-based job number
        return `${type}${Date.now()}`;
    }
};

export default function BidsPage({ db, setCurrentPage, editingProjectId, userData, onNewBid }) {
    const newBidState = {
        projectName: 'New Bid',
        contractor: '',
        address: '',
        coordinates: null,
        salesTaxRate: null,
        supervisor: '',
        wallTexture: '',
        ceilingTexture: '',
        corners: '',
        windowWrap: '',
        finishedHangingRate: '',
        finishedTapeRate: '',
        unfinishedTapingRate: '',
        autoTapeRate: true,
        notes: '',
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
                windowWrap: '',
                hangRate: '',
                tapeRate: '',
                autoTapeRate: true,
                vaultHeights: ''
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
                windowWrap: '',
                hangRate: '',
                tapeRate: '',
                autoTapeRate: true,
                vaultHeights: ''
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
    const [originalBid, setOriginalBid] = useState(null);
    const [loading, setLoading] = useState(false);
    const [supervisors, setSupervisors] = useState([]);
    const [finishes, setFinishes] = useState({ wallTextures: [], ceilingTextures: [], corners: [], windowWrap: [] });
    const [materials, setMaterials] = useState([]);
    const [crewTypes, setCrewTypes] = useState([]);
    const [laborBreakdown, setLaborBreakdown] = useState({ hanging: { labor: 0, sqFt: 0 }, taping: { labor: 0, sqFt: 0 } });
    const [totalMaterialCost, setTotalMaterialCost] = useState(0);
    const [showAreaNameModal, setShowAreaNameModal] = useState(false);
    const [locationSettings, setLocationSettings] = useState({
        reverseGeocodeAccuracy: 50,
        enableAutoAddressFill: true,
        enableLocationServices: true
    });

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

    // Load location settings from Firebase
    useEffect(() => {
        if (!db) return;
        const locationConfigRef = doc(db, configPath, 'locationSettings');
        const unsubscribe = onSnapshot(locationConfigRef, (docSnap) => {
            if (docSnap.exists()) {
                setLocationSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        });
        return unsubscribe;
    }, [db]);

    // Populate default labor rates when crew types load
    useEffect(() => {
        if (crewTypes.length > 0 && !bid.id && (bid.finishedHangingRate === '' || bid.finishedTapeRate === '' || bid.unfinishedTapingRate === '')) {
            const hangerCrew = crewTypes.find(crew => crew.name.toLowerCase().includes('hang'));
            const taperCrew = crewTypes.find(crew => crew.name.toLowerCase().includes('tap'));

            const updates = {};
            
            if (hangerCrew && hangerCrew.rates && hangerCrew.rates.hang && bid.finishedHangingRate === '') {
                updates.finishedHangingRate = hangerCrew.rates.hang;
            }
            
            if (taperCrew && taperCrew.rates) {
                if (taperCrew.rates.finishedTape && bid.finishedTapeRate === '') {
                    updates.finishedTapeRate = taperCrew.rates.finishedTape;
                }
                if (taperCrew.rates.unfinishedTape && bid.unfinishedTapingRate === '') {
                    updates.unfinishedTapingRate = taperCrew.rates.unfinishedTape;
                }
            }

            if (Object.keys(updates).length > 0) {
                setBid(prev => ({ ...prev, ...updates }));
            }
        }
    }, [crewTypes, bid.id, bid.finishedHangingRate, bid.finishedTapeRate, bid.unfinishedTapingRate]);

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
                const finishesData = docSnap.data();
                setFinishes({
                    wallTextures: finishesData.wallTextures || [],
                    ceilingTextures: finishesData.ceilingTextures || [],
                    corners: finishesData.corners || [],
                    windowWrap: finishesData.windowWrap || [],
                    miscellaneous: finishesData.miscellaneous || []
                });
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
                        const loadedBid = { id: editingProjectId, ...projectData };
                        setBid(loadedBid);
                        // Capture the original bid state from Firebase data (before any form processing)
                        setOriginalBid(JSON.parse(JSON.stringify(loadedBid)));
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
    const handleInputChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setBid(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const updateArea = useCallback((updatedArea) => {
        setBid(prev => ({
            ...prev,
            areas: prev.areas.map(area => area.id === updatedArea.id ? updatedArea : area)
        }));
    }, []);

    const addArea = () => {
        setShowAreaNameModal(true);
    };

    const handleAreaNameConfirm = (areaName) => {
        const regularMaterial = materials.find(m => m.name === '1/2" Regular');
        
        const newArea = {
            id: crypto.randomUUID(),
            name: areaName,
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
            windowWrap: '',
            hangRate: '',
            tapeRate: '',
            autoTapeRate: true,
            vaultHeights: ''
        };
        setBid(prev => ({ ...prev, areas: [...prev.areas, newArea] }));
        setShowAreaNameModal(false);
    };

    const removeArea = (areaId) => {
        setBid(prev => ({ ...prev, areas: prev.areas.filter(area => area.id !== areaId) }));
    };

    // --- Save Logic ---
    
    // Function to resolve user name consistently
    const getUserName = (userData) => {
        // Prioritize firstName + lastName combination for accuracy
        if (userData?.firstName && userData?.lastName) {
            return `${userData.firstName} ${userData.lastName}`;
        }
        // Fall back to other name fields
        return userData?.name || userData?.displayName || userData?.email || 'Unknown';
    };

    // Helper function to format material dimensions
    const formatDimensions = (variant) => {
        if (!variant) return 'N/A';
        
        const widthFtStr = (variant.widthFt && variant.widthFt > 0) ? `${variant.widthFt}'` : '';
        const widthInStr = (variant.widthIn && variant.widthIn > 0) ? `${variant.widthIn}"` : '';
        const widthParts = [widthFtStr, widthInStr].filter(Boolean);
        const width = widthParts.join(' ');

        const lengthFtStr = (variant.lengthFt && variant.lengthFt > 0) ? `${variant.lengthFt}'` : '';
        const lengthInStr = (variant.lengthIn && variant.lengthIn > 0) ? `${variant.lengthIn}"` : '';
        const lengthParts = [lengthFtStr, lengthInStr].filter(Boolean);
        const length = lengthParts.join(' ');

        if (width && length) {
            return `${width} x ${length}`;
        } else if (width) {
            return width;
        } else if (length) {
            return length;
        }
        
        return 'N/A';
    };

    // Function to generate detailed change descriptions
    const generateChangeLog = (oldBid, newBid, materials, finishes, supervisors) => {
        console.log('=== GENERATE CHANGE LOG CALLED ===');
        console.log('Function parameters received:', {
            oldBid: !!oldBid,
            newBid: !!newBid,
            materials: !!materials,
            finishes: !!finishes,
            supervisors: !!supervisors
        });
        
        const changes = [];
        
        console.log('=== GENERATE CHANGE LOG DEBUG ===');
        console.log('Old bid sample:', {
            projectName: oldBid.projectName,
            contractor: oldBid.contractor,
            notes: oldBid.notes
        });
        console.log('New bid sample:', {
            projectName: newBid.projectName,
            contractor: newBid.contractor,
            notes: newBid.notes
        });
        
        // Track basic field changes
        const basicFields = {
            projectName: 'Project Name',
            contractor: 'Customer',
            address: 'Address',
            coordinates: 'Location Coordinates',
            supervisor: 'Supervisor',
            wallTexture: 'Wall Texture',
            ceilingTexture: 'Ceiling Texture',
            corners: 'Corners',
            finishedHangingRate: 'Hang Labor Rate',
            finishedTapeRate: 'Tape Labor Rate',
            unfinishedTapingRate: 'Unfinished Tape Rate',
            notes: 'Notes',
            materialStockDate: 'Material Stock Date'
        };
        
        // Check basic field changes
        console.log('🔍 FIELD-BY-FIELD COMPARISON:');
        Object.entries(basicFields).forEach(([field, displayName]) => {
            const oldValue = oldBid[field];
            const newValue = newBid[field];
            
            // Special comparison for coordinates object and numeric fields
            let hasChanged = false;
            if (field === 'coordinates') {
                const oldExists = oldValue && oldValue.lat !== undefined && oldValue.lng !== undefined;
                const newExists = newValue && newValue.lat !== undefined && newValue.lng !== undefined;
                hasChanged = oldExists !== newExists || (oldExists && newExists && (oldValue.lat !== newValue.lat || oldValue.lng !== newValue.lng));
                
                console.log(`🔍 Field ${field}:`, { 
                    oldValue, 
                    newValue, 
                    oldExists,
                    newExists,
                    hasChanged
                });
            } else {
                // Normalize values for comparison (handle string vs number)
                let normalizedOld = oldValue;
                let normalizedNew = newValue;
                
                // For numeric fields, convert strings to numbers for comparison
                const numericFields = ['finishedHangingRate', 'finishedTapeRate', 'unfinishedTapingRate'];
                if (numericFields.includes(field)) {
                    normalizedOld = typeof oldValue === 'string' ? parseFloat(oldValue) || 0 : oldValue;
                    normalizedNew = typeof newValue === 'string' ? parseFloat(newValue) || 0 : newValue;
                }
                
                hasChanged = normalizedOld !== normalizedNew;
                
                console.log(`🔍 Field ${field}:`, { 
                    oldValue, 
                    newValue, 
                    normalizedOld, 
                    normalizedNew,
                    oldType: typeof oldValue,
                    newType: typeof newValue,
                    hasChanged,
                    isNaN: {
                        old: isNaN(normalizedOld),
                        new: isNaN(normalizedNew)
                    }
                });
            }
            
            if (hasChanged) {
                console.log(`✅ CHANGE DETECTED in ${field}:`, { 
                    oldValue, 
                    newValue, 
                    oldType: typeof oldValue, 
                    newType: typeof newValue,
                    strictEqual: oldValue === newValue,
                    looseEqual: oldValue === newValue
                });
                
                // Special handling for different field types
                if (field === 'supervisor') {
                    const oldSupervisor = supervisors?.find(s => s.id === oldValue);
                    const newSupervisor = supervisors?.find(s => s.id === newValue);
                    const oldName = oldSupervisor ? `${oldSupervisor.firstName} ${oldSupervisor.lastName}` : oldValue;
                    const newName = newSupervisor ? `${newSupervisor.firstName} ${newSupervisor.lastName}` : newValue;
                    
                    let changeMessage;
                    if (!oldValue && newValue) {
                        changeMessage = `Set ${displayName} to "${newName}"`;
                        changes.push(changeMessage);
                    } else if (oldValue && !newValue) {
                        changeMessage = `Cleared ${displayName} (was "${oldName}")`;
                        changes.push(changeMessage);
                    } else if (oldValue && newValue) {
                        changeMessage = `Changed ${displayName} from "${oldName}" to "${newName}"`;
                        changes.push(changeMessage);
                    }
                    console.log(`📝 Added supervisor change: "${changeMessage}"`);
                } else if (field === 'coordinates') {
                    // Special handling for coordinates object
                    const oldCoords = oldValue ? `${oldValue.lat?.toFixed(6)}, ${oldValue.lng?.toFixed(6)}` : null;
                    const newCoords = newValue ? `${newValue.lat?.toFixed(6)}, ${newValue.lng?.toFixed(6)}` : null;
                    
                    let changeMessage;
                    if (!oldValue && newValue) {
                        changeMessage = `Set ${displayName} to "${newCoords}"`;
                        changes.push(changeMessage);
                    } else if (oldValue && !newValue) {
                        changeMessage = `Cleared ${displayName} (was "${oldCoords}")`;
                        changes.push(changeMessage);
                    } else if (oldValue && newValue && (oldValue.lat !== newValue.lat || oldValue.lng !== newValue.lng)) {
                        changeMessage = `Changed ${displayName} from "${oldCoords}" to "${newCoords}"`;
                        changes.push(changeMessage);
                    }
                    if (changeMessage) console.log(`📝 Added coordinates change: "${changeMessage}"`);
                } else {
                    let changeMessage;
                    if (!oldValue && newValue) {
                        changeMessage = `Set ${displayName} to "${newValue}"`;
                        changes.push(changeMessage);
                    } else if (oldValue && !newValue) {
                        changeMessage = `Cleared ${displayName} (was "${oldValue}")`;
                        changes.push(changeMessage);
                    } else if (oldValue && newValue) {
                        changeMessage = `Changed ${displayName} from "${oldValue}" to "${newValue}"`;
                        changes.push(changeMessage);
                    }
                    console.log(`📝 Added change: "${changeMessage}"`);
                }
            }
        });
        
        // Check miscellaneous items changes
        if (finishes?.miscellaneous) {
            finishes.miscellaneous.forEach(misc => {
                const fieldName = `misc_${misc.name.toLowerCase().replace(/\s+/g, '_')}`;
                const oldValue = parseInt(oldBid[fieldName] || 0, 10);
                const newValue = parseInt(newBid[fieldName] || 0, 10);
                
                if (oldValue !== newValue) {
                    if (oldValue === 0 && newValue > 0) {
                        changes.push(`Added ${newValue} ${misc.name}`);
                    } else if (oldValue > 0 && newValue === 0) {
                        changes.push(`Removed ${oldValue} ${misc.name}`);
                    } else {
                        changes.push(`Changed ${misc.name} from ${oldValue} to ${newValue}`);
                    }
                }
            });
        }
        
        // Check area changes
        const oldAreas = oldBid.areas || [];
        const newAreas = newBid.areas || [];
        
        // Track area additions/removals
        const oldAreaIds = new Set(oldAreas.map(a => a.id));
        const newAreaIds = new Set(newAreas.map(a => a.id));
        
        // Added areas
        newAreas.forEach(area => {
            if (!oldAreaIds.has(area.id)) {
                changes.push(`Added area "${area.name}"`);
            }
        });
        
        // Removed areas
        oldAreas.forEach(area => {
            if (!newAreaIds.has(area.id)) {
                changes.push(`Removed area "${area.name}"`);
            }
        });
        
        // Track material changes within areas
        newAreas.forEach(newArea => {
            const oldArea = oldAreas.find(a => a.id === newArea.id);
            if (!oldArea) return; // New area, already handled above
            
            // Check area name changes
            if (oldArea.name !== newArea.name) {
                changes.push(`Renamed area from "${oldArea.name}" to "${newArea.name}"`);
            }
            
            // Check vault heights changes
            if (oldArea.vaultHeights !== newArea.vaultHeights) {
                if (!oldArea.vaultHeights && newArea.vaultHeights) {
                    changes.push(`Added vault heights "${newArea.vaultHeights}" to ${newArea.name}`);
                } else if (oldArea.vaultHeights && !newArea.vaultHeights) {
                    changes.push(`Removed vault heights from ${newArea.name}`);
                } else {
                    changes.push(`Changed vault heights in ${newArea.name} from "${oldArea.vaultHeights}" to "${newArea.vaultHeights}"`);
                }
            }
            
            // Track material changes
            const oldMaterials = oldArea.materials || [];
            const newMaterials = newArea.materials || [];
            
            // Compare materials by materialId and variants
            oldMaterials.forEach(oldMat => {
                const newMat = newMaterials.find(m => m.materialId === oldMat.materialId);
                const material = materials?.find(m => m.id === oldMat.materialId);
                const materialName = material?.name || 'Unknown Material';
                
                if (!newMat) {
                    // Material removed entirely
                    const totalOldQuantity = (oldMat.variants || []).reduce((sum, v) => sum + (parseInt(v.quantity || 0, 10)), 0);
                    if (totalOldQuantity > 0) {
                        changes.push(`Removed ${totalOldQuantity} - ${materialName} from ${newArea.name}`);
                    }
                } else {
                    // Compare variants
                    const oldVariants = oldMat.variants || [];
                    const newVariants = newMat.variants || [];
                    
                    // Track variant changes
                    const variantChanges = {};
                    
                    // Check old variants
                    oldVariants.forEach(oldVariant => {
                        const dimensions = formatDimensions(oldVariant);
                        const key = dimensions;
                        variantChanges[key] = (variantChanges[key] || 0) - (parseInt(oldVariant.quantity || 0, 10));
                    });
                    
                    // Check new variants
                    newVariants.forEach(newVariant => {
                        const dimensions = formatDimensions(newVariant);
                        const key = dimensions;
                        variantChanges[key] = (variantChanges[key] || 0) + (parseInt(newVariant.quantity || 0, 10));
                    });
                    
                    // Generate change descriptions for variants
                    Object.entries(variantChanges).forEach(([variant, diff]) => {
                        if (diff !== 0) {
                            const sizeStr = variant !== 'N/A' ? ` ${variant}` : '';
                            if (diff > 0) {
                                changes.push(`Added ${diff} -${sizeStr} ${materialName} to ${newArea.name}`);
                            } else {
                                changes.push(`Removed ${Math.abs(diff)} -${sizeStr} ${materialName} from ${newArea.name}`);
                            }
                        }
                    });
                }
            });
            
            // Check for completely new materials
            newMaterials.forEach(newMat => {
                const oldMat = oldMaterials.find(m => m.materialId === newMat.materialId);
                if (!oldMat) {
                    const material = materials?.find(m => m.id === newMat.materialId);
                    const materialName = material?.name || 'Unknown Material';
                    const totalQuantity = (newMat.variants || []).reduce((sum, v) => sum + (parseInt(v.quantity || 0, 10)), 0);
                    if (totalQuantity > 0) {
                        changes.push(`Added ${totalQuantity} - ${materialName} to ${newArea.name}`);
                    }
                }
            });
        });
        
        console.log('🔍 FINAL CHANGES ARRAY:', changes);
        console.log('🔍 Total changes found:', changes.length);
        return changes;
    };

    const handleSave = async () => {
        if (!db) return;
        setLoading(true);
        try {
            console.log('=== SAVE DEBUG ===');
            console.log('Original bid from state (Firebase data):', originalBid ? {
                projectName: originalBid.projectName,
                contractor: originalBid.contractor,
                notes: originalBid.notes,
                finishedHangingRate: originalBid.finishedHangingRate,
                wallTexture: originalBid.wallTexture,
                corners: originalBid.corners
            } : null);
            
            const taperRate = getTaperRate(bid.finishedHangingRate, bid, finishes, materials, crewTypes);
            const bidData = {
                ...bid,
                finishedTapeRate: bid.autoTapeRate ? taperRate : bid.finishedTapeRate,
                updatedAt: new Date().toISOString(),
            };

            // Normalize numeric fields to numbers for consistent storage and comparison
            const numericFields = ['finishedHangingRate', 'finishedTapeRate', 'unfinishedTapingRate', 'salesTaxRate'];
            numericFields.forEach(field => {
                if (bidData[field] !== undefined && bidData[field] !== '') {
                    const numValue = parseFloat(bidData[field]);
                    if (!isNaN(numValue)) {
                        bidData[field] = numValue;
                    }
                }
            });

            // Fix the original bid's auto-calculated fields for proper comparison
            if (originalBid && originalBid.autoTapeRate) {
                const originalTaperRate = getTaperRate(originalBid.finishedHangingRate, originalBid, finishes, materials, crewTypes);
                originalBid.finishedTapeRate = originalTaperRate;
            }

            // Normalize original bid numeric fields to match bidData normalization
            if (originalBid) {
                numericFields.forEach(field => {
                    if (originalBid[field] !== undefined && originalBid[field] !== '') {
                        const numValue = parseFloat(originalBid[field]);
                        if (!isNaN(numValue)) {
                            originalBid[field] = numValue;
                        }
                    }
                });
            }
            
            console.log('New bid data snapshot:', {
                projectName: bidData.projectName,
                contractor: bidData.contractor,
                notes: bidData.notes,
                finishedHangingRate: bidData.finishedHangingRate,
                wallTexture: bidData.wallTexture,
                corners: bidData.corners
            });

            // On first save, capture material pricing snapshot
            if (!bid.id && !bid.materialPricing) {
                bidData.materialPricing = await captureMaterialPricing();
                bidData.materialPricingDate = new Date().toISOString();
            }

            if (bid.materialStockDate && bid.status === 'bid') {
                // Convert bid to project with T-series job number when material stock date is set
                const projectJobNumber = await generateJobNumber(db, 'T');
                bidData.jobNumber = projectJobNumber;
                bidData.status = 'stocked';
            }

            if (bid.id && originalBid) {
                // Generate detailed change log for existing bids using original Firebase data
                console.log('Calling generateChangeLog with:', {
                    hasOriginalBid: !!originalBid,
                    hasBidData: !!bidData,
                    hasMaterials: !!materials,
                    hasFinishes: !!finishes,
                    hasSupervisors: !!supervisors,
                    originalBidSource: 'Firebase state capture'
                });
                const changes = generateChangeLog(originalBid, bidData, materials, finishes, supervisors);
                
                // Debug logging
                console.log('=== CHANGE LOG DEBUG ===');
                console.log('Original bid keys:', Object.keys(originalBid));
                console.log('New bid data keys:', Object.keys(bidData));
                console.log('Generated changes:', changes);
                console.log('Changes length:', changes.length);
                
                let changeDescription = 'Bid updated';
                
                if (changes.length > 0) {
                    changeDescription = changes.length === 1 ? changes[0] : `${changes.length} changes made:\n${changes.map(c => `- ${c}`).join('\n')}`;
                }
                
                console.log('Final change description:', changeDescription);
                
                // Debug user data structure
                console.log('User data structure:', userData);
                
                // Add the change log entry to bidData before saving
                const newChangeLogEntry = {
                    timestamp: new Date().toISOString(), 
                    change: changeDescription, 
                    user: { 
                        name: getUserName(userData),
                        email: userData?.email || 'Unknown'
                    }
                };
                
                console.log('New change log entry:', newChangeLogEntry);
                
                bidData.changeLog = [
                    ...(bid.changeLog || []), 
                    newChangeLogEntry
                ];
                
                await updateDoc(doc(db, projectsPath, bid.id), bidData);
                setBid(prev => ({ 
                    ...prev,
                    ...bidData,
                    changeLog: bidData.changeLog
                }));
                
                // Update originalBid state to reflect the new saved state for future comparisons
                setOriginalBid(JSON.parse(JSON.stringify({
                    ...bid,
                    ...bidData,
                    changeLog: bidData.changeLog
                })));
            } else {
                const initialChangeLogEntry = {
                    timestamp: new Date().toISOString(), 
                    change: 'Bid created', 
                    user: { 
                        name: getUserName(userData),
                        email: userData?.email || 'Unknown'
                    }
                };
                
                bidData.changeLog = [initialChangeLogEntry];
                
                // Generate job number for new bid
                const jobNumber = await generateJobNumber(db, 'B');
                bidData.jobNumber = jobNumber;
                
                const docRef = await addDoc(collection(db, projectsPath), { ...bidData, createdAt: new Date().toISOString(), status: 'bid' });
                const newBidState = { 
                    ...bid, 
                    id: docRef.id, 
                    materialPricing: bidData.materialPricing, 
                    materialPricingDate: bidData.materialPricingDate,
                    changeLog: bidData.changeLog,
                    ...bidData
                };
                setBid(newBidState);
                
                // Set original state for newly created bid
                setOriginalBid(JSON.parse(JSON.stringify(newBidState)));
            }
        } catch (error) {
            console.error("Error saving bid:", error);
        } finally {
            setLoading(false);
        }
    };

    // Capture current material pricing for the bid
    const captureMaterialPricing = async () => {
        if (!materials || materials.length === 0) return {};
        
        const materialPricing = {};
        materials.forEach(material => {
            materialPricing[material.id] = {
                id: material.id,
                name: material.name,
                price: material.price,
                category: material.category,
                unit: material.unit
            };
        });
        
        return materialPricing;
    };

    // Update material pricing for existing bid (requires permission)
    const handleUpdateMaterialPricing = async () => {
        if (!bid.id || !db) return;
        
        const hasPermission = userData?.role === 'admin' || 
                             (userData?.permissions?.materials?.updatePricing === true);
        
        if (!hasPermission) {
            alert('You do not have permission to update material pricing.');
            return;
        }

        if (!window.confirm('This will update the material pricing for this bid to current market rates. This action cannot be undone. Continue?')) {
            return;
        }

        setLoading(true);
        try {
            const newMaterialPricing = await captureMaterialPricing();
            
            const bidData = {
                materialPricing: newMaterialPricing,
                materialPricingDate: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await updateDoc(doc(db, projectsPath, bid.id), bidData);
            
            setBid(prev => ({ 
                ...prev, 
                materialPricing: newMaterialPricing,
                materialPricingDate: bidData.materialPricingDate,
                changeLog: [
                    ...(prev.changeLog || []), 
                    { 
                        timestamp: new Date().toISOString(), 
                        change: 'Material pricing updated to current rates', 
                        user: { 
                            name: userData?.name || 
                                  (userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
                                  userData?.displayName || 
                                  userData?.email || 'Unknown',
                            email: userData?.email || 'Unknown'
                        }
                    }
                ] 
            }));
            
            alert('Material pricing has been updated successfully.');
            
        } catch (error) {
            console.error("Error updating material pricing:", error);
            alert('Error updating material pricing. Please try again.');
        } finally {
            setLoading(false);
        }
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

            <BidHeader 
                bid={bid} 
                handleInputChange={handleInputChange} 
                supervisors={supervisors} 
                finishes={finishes}
                materials={materials}
                crewTypes={crewTypes}
                userPermissions={userData}
                db={db}
                locationSettings={locationSettings}
                onUpdateMaterialPricing={handleUpdateMaterialPricing}
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

            <AreaNameModal
                isOpen={showAreaNameModal}
                onClose={() => setShowAreaNameModal(false)}
                onConfirm={handleAreaNameConfirm}
            />
        </div>
    );
}
