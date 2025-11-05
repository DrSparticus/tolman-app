import React, { useState } from 'react';
import { collection, doc, addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { LocationControls, useLocationServices } from '../components/LocationServices';
import Patch from '../components/patches/Patch';
import ProjectLinkModal from '../components/ProjectLinkModal';
import SignatureModal from '../components/SignatureModal';
import ChangeLog from '../components/bids/ChangeLog';
import { PlusIcon } from '../Icons';
// Switched PDF generation to Firebase Cloud Functions + Puppeteer
import { getFunctions, httpsCallable } from 'firebase/functions';

// Helpers: load logo and images with natural dimensions to preserve aspect ratio
let CACHED_LOGO_INFO = null;
const LOGO_CANDIDATES = ['/FullCompanyLogo.png', '/newlogo512.png', '/logo512.png', '/logo.png'];

//

async function fetchAsDataURL(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

async function getImageInfoFromDataURL(dataUrl) {
    return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ dataUrl, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

async function getLogoInfo() {
    if (CACHED_LOGO_INFO) return CACHED_LOGO_INFO;
    for (const candidate of LOGO_CANDIDATES) {
        const dataUrl = await fetchAsDataURL(candidate);
        if (dataUrl) {
            const info = await getImageInfoFromDataURL(dataUrl);
            CACHED_LOGO_INFO = info;
            return info;
        }
    }
    // Fallback: if an embedded constant exists
    try {
        // eslint-disable-next-line no-undef
        if (typeof TOLMAN_LOGO_BASE64 !== 'undefined' && TOLMAN_LOGO_BASE64) {
            const info = await getImageInfoFromDataURL(TOLMAN_LOGO_BASE64);
            CACHED_LOGO_INFO = info;
            return info;
        }
    } catch (_) {}
    return null;
}

//

// Tolman Construction logo as base64 (will need to be replaced with actual logo data)
// Tolman Construction logo - Professional company branding
const TOLMAN_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACSCAMAAABhGRSUAAAAM1BMVEUAAAD////+/v78/Pz5+fn09PT29vbw8PDy8vLq6urm5ubl5eXh4eHe3t7Z2dnV1dXR0dHNzc24Pi3mAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGvklEQVR4nO2d23LjIAxAMZf2//+5k3SSNk7sGEsC3Jk9b+0mjgVHQhJgGMbj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6Px+PxeDwej8fj8Xg8Ho/H4/F4PB6P5/8C8H8KnQFBhsAAAAASUVORK5CYII=';

const patchJobsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/patchJobs`;

const PatchJobPage = ({ db, userData, patchJobId, setCurrentPage }) => {
    const [patchJob, setPatchJob] = useState({
        jobName: '',
        jobNumber: '',
        projectId: '',
        projectName: '',
        customer: '',
        customerEmail: '',
        customerPhone: '',
        address: '',
        coordinates: null,
        status: 'Draft',
        assignedTo: '',
        assignedToName: '',
        notes: '',
        patches: [],
        signature: '',
        changeLog: []
    });
    const [generatedPDFs, setGeneratedPDFs] = useState([]);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const isNewPatchJob = !patchJobId || patchJobId.startsWith('new-');
    const [lastSavedPatchJob, setLastSavedPatchJob] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [showProjectLinkModal, setShowProjectLinkModal] = useState(false);
    const [patchGuys] = useState([]);
    // Adapter so LocationServices (which expects event-style input changes) can update our local state
    const handleLSInputChangeEvent = (e) => {
        const name = e?.target?.name;
        const value = e?.target?.value;
        if (name) handleInputChange(name, value);
    };
    const locationServices = useLocationServices(db, handleLSInputChangeEvent);

    // Basic config defaults; adjust if you have centralized settings elsewhere
    const patchJobConfig = {
        signatureThreshold: 1000,
        hourlyRate: 75,
    };

    const getUserDisplayName = () => {
        if (!userData) return 'Unknown';
        const name = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
        return name || userData.name || userData.email || 'Unknown';
    };

    const calculateTotal = () => {
        const patches = patchJob.patches || [];
        return patches.reduce((sum, p) => {
            const amt = parseFloat(p.amount || 0) || 0;
            if (p.amountType === 'hours') {
                return sum + amt * patchJobConfig.hourlyRate;
            }
            return sum + amt;
        }, 0);
    };

    const isAdmin = () => (userData?.role === 'admin');
    const isSignaturePresent = () => Boolean(patchJob.signature && String(patchJob.signature).length > 0);
    const isPatchesLocked = () => isSignaturePresent() && !isAdmin();

    const handleInputChange = (field, value) => {
        setPatchJob(prev => ({ ...prev, [field]: value }));
    };

    const addPatch = () => {
        setPatchJob(prev => ({
            ...prev,
            patches: [
                ...prev.patches,
                { id: crypto.randomUUID(), number: (prev.patches.length + 1), description: '', amountType: 'charge', amount: 0, photos: [] }
            ]
        }));
    };
    const updatePatch = (id, updated) => {
        setPatchJob(prev => ({
            ...prev,
            patches: prev.patches.map(p => p.id === id ? updated : p)
        }));
    };
    const removePatch = (id) => {
        setPatchJob(prev => ({
            ...prev,
            patches: prev.patches.filter(p => p.id !== id).map((p, idx) => ({ ...p, number: idx + 1 }))
        }));
    };

    const handleSignatureChange = (sig) => {
        handleInputChange('signature', sig);
    };

    // Ensure a default Patch 1 is present for new Patch Jobs
    React.useEffect(() => {
        if (isNewPatchJob && (patchJob.patches?.length || 0) === 0) {
            addPatch();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isNewPatchJob]);

    // Show project link modal on new Patch Job creation to link or create a project
    React.useEffect(() => {
        if (isNewPatchJob && !showProjectLinkModal && !patchJob.projectId) {
            setShowProjectLinkModal(true);
        }
    }, [isNewPatchJob, showProjectLinkModal, patchJob.projectId]);

    // Load existing Patch Job from Firestore when editing
    React.useEffect(() => {
        if (!db || !patchJobId || patchJobId.startsWith('new-')) return;
        const ref = doc(db, patchJobsPath, patchJobId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                setPatchJob(prev => ({
                    ...prev,
                    ...data,
                    patches: Array.isArray(data.patches) ? data.patches : [],
                    changeLog: Array.isArray(data.changeLog) ? data.changeLog : [],
                    signature: data.signature || ''
                }));
                setGeneratedPDFs(Array.isArray(data.generatedPDFs) ? data.generatedPDFs : []);
                setLastSavedPatchJob({ ...data });
            }
        });
        return () => unsub();
    }, [db, patchJobId]);

    const generateChangeLogEntries = () => {
        if (!lastSavedPatchJob) return [];
        const changes = [];
        const fields = ['jobName', 'jobNumber', 'customer', 'customerPhone', 'customerEmail', 'address', 'notes', 'status'];
        fields.forEach(f => {
            if ((lastSavedPatchJob[f] || '') !== (patchJob[f] || '')) {
                changes.push(`${f} updated`);
            }
        });
        if (JSON.stringify(lastSavedPatchJob.patches || []) !== JSON.stringify(patchJob.patches || [])) {
            changes.push('patches updated');
        }
        return changes;
    };

    // Project Link handlers (stubs)
    const handleProjectSelection = (project) => {
        handleInputChange('projectId', project?.id || '');
        handleInputChange('projectName', project?.name || '');
        setShowProjectLinkModal(false);
    };
    const handleCreateNew = () => {
        setShowProjectLinkModal(false);
    };

    const generateChangeOrderPDF = async () => {
        // If current PDF exists and is not outdated, open it directly
        const latestCurrent = (generatedPDFs || []).find(p => !p.isOutdated) || (generatedPDFs || [])[generatedPDFs.length - 1];
        if (latestCurrent && !isPDFOutdated() && latestCurrent.downloadUrl) {
            try { window.open(latestCurrent.downloadUrl, '_blank', 'noopener'); } catch (_) {}
            return;
        }

        setIsGeneratingPDF(true);
        try {
            const logoInfo = await getLogoInfo();
            const functions = getFunctions(undefined, 'us-central1');
            const generate = httpsCallable(functions, 'generatePatchOrderPdf');

            const payload = {
                artifactProjectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
                patchJobId: patchJobId || null,
                projectName: patchJob.projectName,
                jobName: patchJob.jobName,
                customer: patchJob.customer,
                address: patchJob.address,
                requestedBy: patchJob.customerPhone,
                total: calculateTotal(),
                notes: patchJob.notes,
                patches: (patchJob.patches || []).map(p => ({
                    number: p.number,
                    description: p.description,
                    amountType: p.amountType,
                    amount: p.amount,
                    hourlyRate: patchJobConfig.hourlyRate,
                    photos: (p.photos || []).map(ph => ({ data: ph.data, url: ph.url }))
                })),
                logoDataUrl: logoInfo?.dataUrl || null,
                // Optional: provide a public URL fallback (served from Hosting)
                logoUrl: `${window.location.origin}/FullCompanyLogo.png`
            };

            const resp = await generate(payload);
            const { filename, storagePath, downloadUrl } = resp.data || {};

            const timestamp = new Date().toISOString();
            const minimalSnapshot = {
                jobName: patchJob.jobName,
                projectName: patchJob.projectName,
                customer: patchJob.customer,
                address: patchJob.address,
                requestedBy: patchJob.customerPhone,
                notes: patchJob.notes,
                totalAmount: calculateTotal(),
                patches: (patchJob.patches || []).map(p => ({
                    number: p.number,
                    description: p.description,
                    amountType: p.amountType,
                    amount: p.amount,
                    photosCount: (p.photos || []).length
                }))
            };
            const pdfRecord = {
                id: Date.now().toString(),
                filename: filename || 'PatchOrder.pdf',
                storagePath: storagePath || '',
                downloadUrl: downloadUrl || '',
                generatedAt: timestamp,
                generatedBy: getUserDisplayName(),
                dataSnapshot: minimalSnapshot,
                isOutdated: false
            };
            const MAX_PDF_HISTORY = 10;
            const normalizedOld = (generatedPDFs || []).map(pdf => ({
                id: pdf.id,
                filename: pdf.filename,
                storagePath: pdf.storagePath,
                downloadUrl: pdf.downloadUrl,
                generatedAt: pdf.generatedAt,
                generatedBy: pdf.generatedBy,
                isOutdated: true
            }));
            const updatedPDFs = [...normalizedOld, pdfRecord].slice(-MAX_PDF_HISTORY);
            setGeneratedPDFs(updatedPDFs);

            if (patchJobId && !patchJobId.startsWith('new-')) {
                await updateDoc(doc(db, patchJobsPath, patchJobId), {
                    generatedPDFs: updatedPDFs,
                    updatedAt: timestamp,
                    updatedBy: userData?.email || 'Unknown'
                });
            }

            try { if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener'); } catch (_) {}

            const changeEntry = {
                timestamp,
                user: { name: getUserDisplayName(), email: userData?.email || 'Unknown' },
                change: `Change Order PDF generated: ${pdfRecord.filename}`
            };
            const updatedChangeLog = [...(patchJob.changeLog || []), changeEntry];
            setPatchJob(prev => ({ ...prev, changeLog: updatedChangeLog }));
            if (patchJobId && !patchJobId.startsWith('new-')) {
                await updateDoc(doc(db, patchJobsPath, patchJobId), { changeLog: updatedChangeLog });
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF via Cloud Function. Please try again.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Check if current data differs from last PDF snapshot
    const isPDFOutdated = () => {
        if (generatedPDFs.length === 0) return false;
        const latestPDF = generatedPDFs.find(pdf => !pdf.isOutdated);
        if (!latestPDF) return false;
        
        // Compare current data with PDF snapshot (simplified comparison)
        const current = JSON.stringify({
            patches: patchJob.patches,
            totalAmount: calculateTotal(),
            notes: patchJob.notes,
            customer: patchJob.customer,
            address: patchJob.address
        });
        
        const snapshot = latestPDF.dataSnapshot
            ? JSON.stringify({
                patches: latestPDF.dataSnapshot.patches || [],
                totalAmount: latestPDF.dataSnapshot.totalAmount || 0,
                notes: latestPDF.dataSnapshot.notes || '',
                customer: latestPDF.dataSnapshot.customer || '',
                address: latestPDF.dataSnapshot.address || ''
              })
            : '';
        
        return snapshot === '' ? true : current !== snapshot;
    };

    const handleClearSignature = () => {
        if (isAdmin()) {
            handleInputChange('signature', '');
        }
    };

    // Save function - minimal validation, allows saving drafts
    const savePatchJob = async (shouldNavigateAway = true) => {
        setIsSaving(true);

        try {
            let patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: patchJob.status || 'Draft'
            };

            // Auto-assign patch-guy users to their own jobs if no assignment is set
            if (userData?.role === 'patch-guy' && (!patchJob.assignedTo || patchJob.assignedTo === '')) {
                patchJobData = {
                    ...patchJobData,
                    assignedTo: userData.uid || userData.id,
                    assignedToName: userData.name || userData.email
                };
            }

            if (patchJobId && !patchJobId.startsWith('new-')) {
                // Updating existing patch job - generate change log entries
                const changesList = generateChangeLogEntries();
                const newChangeEntries = [];
                
                if (changesList.length > 0) {
                    const changeDescription = changesList.length === 1 
                        ? `${changesList[0]} (saved as draft)`
                        : `${changesList.length} changes made (saved as draft):\n${changesList.map(c => `- ${c}`).join('\n')}`;
                    
                    newChangeEntries.push({
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: changeDescription
                    });
                } else if (!lastSavedPatchJob) {
                    // Only add a "saved" entry for the very first save when no changes are detected
                    newChangeEntries.push({
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: 'Patch job saved as draft'
                    });
                }
                // If there are no changes and this isn't the first save, don't log anything
                
                patchJobData.changeLog = [...(patchJob.changeLog || []), ...newChangeEntries];
                
                // Mark existing PDFs as outdated if there are changes
                if (changesList.length > 0 && generatedPDFs.length > 0) {
                    const updatedPDFs = generatedPDFs.map(pdf => ({ ...pdf, isOutdated: true }));
                    patchJobData.generatedPDFs = updatedPDFs;
                    setGeneratedPDFs(updatedPDFs);
                }
                
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
                
                // Update the last saved state
                setLastSavedPatchJob({...patchJobData});
            } else {
                // Creating new patch job (either no ID or temporary ID)
                const initialChangeLog = {
                    timestamp: new Date().toISOString(),
                    user: {
                        name: getUserDisplayName(),
                        email: userData?.email || 'Unknown'
                    },
                    change: 'Patch job created'
                };
                
                patchJobData.changeLog = [initialChangeLog];
                
                const docRef = await addDoc(collection(db, patchJobsPath), patchJobData);
                
                // Set the last saved state for new patch jobs
                setLastSavedPatchJob({...patchJobData});
                
                // If this was a temporary ID, clean up sessionStorage and update URL
                if (patchJobId && patchJobId.startsWith('new-')) {
                    sessionStorage.removeItem(`patchJob_${patchJobId}`);
                    // Update the URL with the real ID using the parent's navigation function
                    // This will be handled by updating the parent state
                    window.history.replaceState(
                        { page: 'patch-job-edit', patchJobId: docRef.id }, 
                        '', 
                        `?page=patch-job-edit&patchJobId=${docRef.id}`
                    );
                }
            }

            if (shouldNavigateAway) {
                alert('Patch job saved successfully!');
                setCurrentPage('patch-jobs');
            }
        } catch (error) {
            console.error('Error saving patch job:', error);
            if (shouldNavigateAway) {
                alert('Error saving patch job. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Submit function - full validation required
    // Define workflow progression
    const getNextStatus = (currentStatus) => {
        switch (currentStatus) {
            case 'Scheduled':
                return 'Done';
            case 'Done':
                return 'Billed';
            case 'Billed':
                return 'Archived';
            default:
                return 'Done'; // Default for any unknown status
        }
    };

    const getStatusButtonText = (currentStatus) => {
        switch (currentStatus) {
            case 'Scheduled':
                return 'Finish Job';
            case 'Done':
                return 'Mark as Billed';
            case 'Billed':
                return 'Archive Job';
            default:
                return 'Complete Job';
        }
    };

    const shouldShowStatusButton = (currentStatus) => {
        return currentStatus !== 'Archived';
    };

    const submitPatchJob = async () => {
        if (!patchJob.jobName.trim()) {
            alert('Please enter a job name');
            return;
        }

        if (!patchJob.customer.trim()) {
            alert('Please enter a customer name');
            return;
        }

        if (!patchJob.address.trim()) {
            alert('Please enter an address');
            return;
        }

        if (!patchJob.customerPhone?.trim()) {
            alert('Please enter who requested this patch job');
            return;
        }

        // Note: customerEmail (Requester's contact) is now optional

        if (patchJob.patches.length === 0) {
            alert('Please add at least one patch');
            return;
        }

        // Validate patches
        for (const patch of patchJob.patches) {
            if (!patch.description.trim()) {
                alert('Please enter a description for all patches');
                return;
            }
            if (!patch.amount || patch.amount <= 0) {
                alert('Please enter an amount for all patches');
                return;
            }
            if (!patch.photos || patch.photos.length === 0) {
                alert(`Patch ${patch.number} requires at least one photo`);
                return;
            }
        }

        // Validate signature if required
        const total = calculateTotal();
        if (total >= patchJobConfig.signatureThreshold && !isSignaturePresent()) {
            alert(`Customer signature is required for amounts over $${patchJobConfig.signatureThreshold.toFixed(2)}`);
            return;
        }

        setIsSaving(true);

        try {
            const nextStatus = getNextStatus(patchJob.status);
            let patchJobData = {
                ...patchJob,
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: nextStatus
            };

            // Auto-assign patch-guy users to their own jobs if no assignment is set
            if (userData?.role === 'patch-guy' && (!patchJob.assignedTo || patchJob.assignedTo === '')) {
                patchJobData = {
                    ...patchJobData,
                    assignedTo: userData.uid || userData.id,
                    assignedToName: userData.name || userData.email
                };
            }

            if (patchJobId && !patchJobId.startsWith('new-')) {
                // Updating existing patch job - generate change log entries
                const changesList = generateChangeLogEntries();
                const newChangeEntries = [];
                
                // Combine changes with submission info in a single entry
                const getStatusActionText = (status) => {
                    switch (status) {
                        case 'Done':
                            return 'marked as complete';
                        case 'Billed':
                            return 'marked as billed';
                        case 'Archived':
                            return 'archived';
                        default:
                            return 'status updated';
                    }
                };
                
                let changeDescription;
                if (changesList.length > 0) {
                    const changesText = changesList.length === 1 
                        ? changesList[0] 
                        : `${changesList.length} changes made:\n${changesList.map(c => `- ${c}`).join('\n')}`;
                    changeDescription = `${changesText}\n\nPatch job ${getStatusActionText(nextStatus)} (Total: $${calculateTotal().toFixed(2)})`;
                } else {
                    changeDescription = `Patch job ${getStatusActionText(nextStatus)} (Total: $${calculateTotal().toFixed(2)})`;
                }
                
                newChangeEntries.push({
                    timestamp: new Date().toISOString(),
                    user: {
                        name: getUserDisplayName(),
                        email: userData?.email || 'Unknown'
                    },
                    change: changeDescription
                });
                
                patchJobData.changeLog = [...(patchJob.changeLog || []), ...newChangeEntries];
                
                // Mark existing PDFs as outdated when submitting changes
                if (generatedPDFs.length > 0) {
                    const updatedPDFs = generatedPDFs.map(pdf => ({ ...pdf, isOutdated: true }));
                    patchJobData.generatedPDFs = updatedPDFs;
                    setGeneratedPDFs(updatedPDFs);
                }
                
                await updateDoc(doc(db, patchJobsPath, patchJobId), patchJobData);
            } else {
                // Creating new patch job (either no ID or temporary ID)
                const initialChanges = [
                    {
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: 'Patch job created'
                    },
                    {
                        timestamp: new Date().toISOString(),
                        user: {
                            name: getUserDisplayName(),
                            email: userData?.email || 'Unknown'
                        },
                        change: `Patch job submitted (Total: $${calculateTotal().toFixed(2)})`
                    }
                ];
                
                patchJobData.changeLog = [...initialChanges, ...(patchJob.changeLog || [])];
                
                await addDoc(collection(db, patchJobsPath), patchJobData);
                
                // If this was a temporary ID, clean up sessionStorage
                if (patchJobId && patchJobId.startsWith('new-')) {
                    sessionStorage.removeItem(`patchJob_${patchJobId}`);
                }
            }

            alert('Patch job submitted successfully!');
            setCurrentPage('patch-jobs');
        } catch (error) {
            console.error('Error submitting patch job:', error);
            alert('Error submitting patch job. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    //

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">
                    {isNewPatchJob ? 'New Patch Job' : 'Edit Patch Job'}
                </h1>
                <div className="flex space-x-4">
                    <button
                        onClick={() => setCurrentPage('patch-jobs')}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={savePatchJob}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    {shouldShowStatusButton(patchJob.status) && (
                        <button
                            onClick={submitPatchJob}
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Processing...' : getStatusButtonText(patchJob.status)}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Form */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                {/* Job Name and Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Job Name *
                            </label>
                        </div>
                        <input
                            type="text"
                            value={patchJob.jobName}
                            onChange={(e) => handleInputChange('jobName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter job name"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Address *
                            </label>
                            <LocationControls
                                bid={patchJob}
                                locationSettings={{ enableLocationServices: true }}
                                locationServices={locationServices}
                                showButtonOnly={true}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={patchJob.address || ''}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter address or use current location"
                            />
                            {patchJob.coordinates && (
                                <div className="mt-2 text-xs text-gray-600">
                                    <div className="flex items-center justify-between">
                                        <span>Coordinates: {patchJob.coordinates.lat.toFixed(6)}, {patchJob.coordinates.lng.toFixed(6)}</span>
                                        <div className="flex space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => locationServices.openInMaps(patchJob.coordinates)}
                                                className="text-blue-600 hover:text-blue-800 underline"
                                            >
                                                Map
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Advanced View: Job Number, Status, and Assignment - Only show for users with advanced view permission */}
                {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Job Number
                            </label>
                            <input
                                type="text"
                                value={patchJob.jobNumber}
                                onChange={(e) => handleInputChange('jobNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Optional - for linking to existing project"
                            />
                            {patchJob.projectId && (
                                <p className="mt-1 text-sm text-green-600">
                                    Linked to: {patchJob.projectName}
                                </p>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={patchJob.status}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Done">Done</option>
                                <option value="Billed">Billed</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Assign To
                            </label>
                            <select
                                value={patchJob.assignedTo}
                                onChange={(e) => {
                                    const selectedPatchGuy = patchGuys.find(pg => pg.id === e.target.value);
                                    handleInputChange('assignedTo', e.target.value);
                                    handleInputChange('assignedToName', selectedPatchGuy ? (selectedPatchGuy.name || selectedPatchGuy.email) : '');
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Unassigned</option>
                                {patchGuys.map(patchGuy => (
                                    <option key={patchGuy.id} value={patchGuy.id}>
                                        {patchGuy.name || patchGuy.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Customer Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name *
                        </label>
                        <input
                            type="text"
                            value={patchJob.customer}
                            onChange={(e) => handleInputChange('customer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Customer name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Requested by: *
                        </label>
                        <input
                            type="text"
                            value={patchJob.customerPhone}
                            onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Who requested this patch job"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Requester's contact
                        </label>
                        <input
                            type="text"
                            value={patchJob.customerEmail}
                            onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Phone number or email address"
                        />
                    </div>
                </div>

                {/* Notes Section - Moved up */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                    </label>
                    <textarea
                        value={patchJob.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Any additional notes or special instructions..."
                    />
                </div>
            </div>

            {/* Patches Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        Patches
                        {isSignaturePresent() && !isAdmin() && (
                            <span className="text-sm text-gray-500 ml-2">🔒 Locked (Signed)</span>
                        )}
                    </h2>
                    {(!isSignaturePresent() || isAdmin()) && (
                        <button
                            onClick={addPatch}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            title={isSignaturePresent() && isAdmin() ? "Admin: Add patch to signed job" : "Add Patch"}
                        >
                            <PlusIcon />
                            <span className="ml-2">Add Patch</span>
                        </button>
                    )}
                </div>

                <div className="space-y-6">
                    {patchJob.patches.map((patch, index) => (
                        <Patch
                            key={patch.id}
                            patch={patch}
                            onUpdate={updatePatch}
                            onRemove={removePatch}
                            canRemove={patchJob.patches.length > 1}
                            disabled={isSignaturePresent()}
                            isAdmin={isAdmin()}
                        />
                    ))}
                </div>

                {/* Signature and Total Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                        {/* Signature Button */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Signature {calculateTotal() >= patchJobConfig.signatureThreshold && '*'}
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowSignatureModal(true)}
                                className={`w-full px-4 py-2 rounded-md border text-sm font-medium ${
                                    isSignaturePresent()
                                        ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                        : calculateTotal() >= patchJobConfig.signatureThreshold
                                        ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {isSignaturePresent() ? (
                                    <span>✅ Signed {isSignaturePresent() && isPatchesLocked() && '🔒'}</span>
                                ) : (
                                    <span>📝 Click to Sign</span>
                                )}
                            </button>
                            {calculateTotal() >= patchJobConfig.signatureThreshold && !isSignaturePresent() && (
                                <p className="text-xs text-red-600 mt-1">
                                    * Signature required for amounts over ${patchJobConfig.signatureThreshold.toFixed(2)}
                                </p>
                            )}
                        </div>

                        {/* Total and PDF Generation */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Total Charge
                            </label>
                            <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                <div className="text-2xl font-bold text-green-600">
                                    ${calculateTotal().toFixed(2)}
                                </div>
                                
                                {/* PDF Generation - Only show for Done status */}
                                {patchJob.status === 'Done' && (
                                    <div className="mt-4 space-y-2">
                                        {generatedPDFs.length > 0 && (
                                            <div className="text-xs text-gray-600 mb-2">
                                                {generatedPDFs.filter(pdf => !pdf.isOutdated).length > 0 ? (
                                                    <div className="flex items-center justify-center">
                                                        <span className="text-green-600">✓ Current PDF available</span>
                                                        {isPDFOutdated() && (
                                                            <span className="ml-2 text-orange-600">(Data changed)</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-orange-600">⚠ PDF outdated</span>
                                                )}
                                                <div className="mt-1">
                                                    Last generated: {new Date(generatedPDFs[generatedPDFs.length - 1]?.generatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button
                                            type="button"
                                            onClick={generateChangeOrderPDF}
                                            disabled={isGeneratingPDF}
                                            className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
                                                isGeneratingPDF
                                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                    : isPDFOutdated() || generatedPDFs.length === 0
                                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                        >
                                            {isGeneratingPDF
                                                ? 'Generating...'
                                                : generatedPDFs.length === 0
                                                ? 'Generate Change Order PDF'
                                                : isPDFOutdated()
                                                ? 'Generate Updated PDF'
                                                : 'Download Current PDF'
                                            }
                                        </button>
                                        
                                        {generatedPDFs.length > 1 && (
                                            <details className="mt-2">
                                                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                                    View PDF History ({generatedPDFs.length} generated)
                                                </summary>
                                                <div className="mt-1 space-y-1 text-xs">
                                                    {generatedPDFs.slice().reverse().map((pdf, index) => (
                                                        <div key={pdf.id} className="flex justify-between items-center p-1 bg-gray-50 rounded">
                                                            <span className={pdf.isOutdated ? 'text-gray-500' : 'text-gray-800'}>
                                                                {new Date(pdf.generatedAt).toLocaleString()}
                                                                {pdf.isOutdated && ' (outdated)'}
                                                            </span>
                                                            <span className="text-gray-600 text-xs">{pdf.generatedBy}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}

                                        {/* Quick link to latest PDF if available */}
                                        {generatedPDFs.length > 0 && generatedPDFs[generatedPDFs.length - 1]?.downloadUrl && (
                                            <a
                                                href={generatedPDFs[generatedPDFs.length - 1].downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full text-center text-blue-600 hover:text-blue-800 text-xs underline mt-1"
                                            >
                                                View latest generated PDF
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Log - Only visible to Advanced View users */}
            {(userData?.role === 'admin' || userData?.permissions?.['patch-jobs']?.advancedView) && (
                <ChangeLog 
                    log={patchJob.changeLog || []} 
                    hasLogAccess={true}
                />
            )}

            {/* Project Link Modal */}
            <ProjectLinkModal
                isOpen={showProjectLinkModal}
                onClose={() => setShowProjectLinkModal(false)}
                onSelectProject={handleProjectSelection}
                onCreateNew={handleCreateNew}
                db={db}
            />

            {/* Location Services */}
            {locationServices.mapModal}

            {/* Signature Modal */}
            <SignatureModal
                isOpen={showSignatureModal}
                onClose={() => setShowSignatureModal(false)}
                signature={patchJob.signature || ''}
                onSignatureChange={handleSignatureChange}
                required={calculateTotal() >= patchJobConfig.signatureThreshold}
                isAdmin={isAdmin()}
                onClear={handleClearSignature}
                patchesLocked={isPatchesLocked()}
            />
        </div>
    );
};

export default PatchJobPage;