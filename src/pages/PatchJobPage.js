import React, { useState, useRef } from 'react';
import { collection, doc, addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LocationControls, useLocationServices } from '../components/LocationServices';
import Patch from '../components/patches/Patch';
import ProjectLinkModal from '../components/ProjectLinkModal';
import SignatureModal from '../components/SignatureModal';
import ConfirmationModal from '../components/ConfirmationModal';
import ChangeLog from '../components/bids/ChangeLog';
import { PlusIcon } from '../Icons';
import SignatureCanvas from 'react-signature-canvas';
// Switched PDF generation to Firebase Cloud Functions + Puppeteer

// Simple helper to inline logo for Cloud Function PDF generation
async function getLogoDataUrl() {
    const candidates = ['/FullCompanyLogo.png', '/newlogo512.png', '/logo512.png', '/logo.png'];
    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const blob = await res.blob();
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return dataUrl;
        } catch (_) {
            continue;
        }
    }
    return null;
}

const patchJobsPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/patchJobs`;

const PatchJobPage = ({ db, userData, patchJobId, setCurrentPage }) => {
    const [patchJob, setPatchJob] = useState({
        projectName: '',
        jobNumber: '',
        projectId: '',
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
    const [showReviewSendModal, setShowReviewSendModal] = useState(false);
    const [showUserSignatureModal, setShowUserSignatureModal] = useState(false);
    const [userSignatureData, setUserSignatureData] = useState(null);
    const userSignatureRef = useRef(null);
    const [patchGuys] = useState([]);
    // Adapter so LocationServices (which expects event-style input changes) can update our local state
    const handleLSInputChangeEvent = (e) => {
        const name = e?.target?.name;
        const value = e?.target?.value;
        if (name) handleInputChange(name, value);
    };
    const locationServices = useLocationServices(db, handleLSInputChangeEvent);

    // Patch Job pricing/signature config (live-updated from Firestore)
    const [patchJobConfig, setPatchJobConfig] = useState({
        signatureThreshold: 1000,
        hourlyRate: 75,
        minimumTotalCharge: 0,
    });

    // Track original total for signature removal warning
    const [originalTotal, setOriginalTotal] = useState(null);
    const [showSignatureRemovalWarning, setShowSignatureRemovalWarning] = useState(false);

    // Load Patch Job config from Firestore so hourlyRate matches admin settings
    React.useEffect(() => {
        if (!db) return;
        const configDoc = doc(db, `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`, 'patchJobSettings');
        const unsub = onSnapshot(configDoc, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                setPatchJobConfig(prev => ({
                    ...prev,
                    ...(['hourlyRate','signatureThreshold','minimumTotalCharge'].reduce((acc,k)=>{
                        if (k in data) acc[k] = Number(data[k]) || 0;
                        return acc;
                    }, {}))
                }));
            }
        });
        return () => unsub();
    }, [db]);

    const getUserDisplayName = () => {
        if (!userData) return 'Unknown';
        const name = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
        return name || userData.name || userData.email || 'Unknown';
    };

    const getEffectiveHourlyRate = () => {
        // Prefer frozen rate saved on the job; else use current config
        const saved = Number(patchJob.hourlyRate);
        if (!Number.isNaN(saved) && saved > 0) return saved;
        const cfg = Number(patchJobConfig.hourlyRate) || 0;
        return cfg;
    };

    const calculateTotal = () => {
        const rate = getEffectiveHourlyRate();
        const patches = patchJob.patches || [];
        const subtotal = patches.reduce((sum, p) => {
            const amt = parseFloat(p.amount || 0) || 0;
            if (p.amountType === 'hours') {
                return sum + amt * rate;
            }
            return sum + amt;
        }, 0);
        // Optional minimum total charge application (only if subtotal > 0)
        const min = Number(patchJobConfig.minimumTotalCharge) || 0;
        return subtotal > 0 && min > 0 ? Math.max(subtotal, min) : subtotal;
    };

    // Helper function to strip base64 photo data before saving to Firestore (prevents document size limit)
    const stripPhotoDataForFirestore = (patches) => {
        if (!patches || patches.length === 0) return patches;
        return patches.map(patch => ({
            ...patch,
            photos: (patch.photos || []).map(photo => {
                // Keep only the URL and metadata, remove the base64 data and uploading flag
                const { data, uploading, ...photoWithoutData } = photo;
                return photoWithoutData;
            })
        }));
    };

    const isAdmin = () => (userData?.role === 'admin');
    const isSignaturePresent = () => Boolean(patchJob.signature && String(patchJob.signature).length > 0);
    const isPatchesLocked = () => {
        // Lock patches if local signature exists OR if SignWell document is completed
        // Admins can still edit unless SignWell signature is received
        if (patchJob.signwellStatus === 'completed') {
            return true; // Lock for everyone including admins once SignWell signed
        }
        return isSignaturePresent() && !isAdmin();
    };

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

    // Show job link modal on new Patch Job creation to link or create a job
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
                // Store original total for signature removal check
                if (originalTotal === null) {
                    setOriginalTotal(data.totalAmount || 0);
                }
            }
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, patchJobId]);

    const generateChangeLogEntries = () => {
        if (!lastSavedPatchJob) return [];
        const changes = [];
        const fields = ['projectName', 'jobNumber', 'customer', 'customerPhone', 'customerEmail', 'address', 'notes', 'status'];
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

    // Job Link handlers
    const handleProjectSelection = (project) => {
        handleInputChange('projectId', project?.id || '');
        handleInputChange('projectName', project?.projectName ? `${project.projectName} - Patch Work` : '');
        handleInputChange('customer', project?.customer || '');
        handleInputChange('address', project?.address || '');
        handleInputChange('jobNumber', project?.jobNumber || '');
        // Set coordinates if available
        if (project?.coordinates) {
            handleInputChange('coordinates', project.coordinates);
        }
        setShowProjectLinkModal(false);
    };
    const handleCreateNew = () => {
        setShowProjectLinkModal(false);
    };

    // SignWell signature flow handlers
    const handleSaveUserSignature = async () => {
        if (userSignatureRef.current && !userSignatureRef.current.isEmpty()) {
            const signatureData = userSignatureRef.current.toDataURL();
            setUserSignatureData(signatureData);
            
            // Save to user profile
            const userDocRef = doc(db, `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users/${userData.uid}`);
            await updateDoc(userDocRef, { signature: signatureData });
            
            setShowUserSignatureModal(false);
            
            // Generate PDF automatically if none exists or if outdated
            if (generatedPDFs.length === 0 || isPDFOutdated()) {
                try {
                    await generateChangeOrderPDF();
                } catch (error) {
                    console.error('Error generating PDF:', error);
                    alert('Failed to generate PDF. Please try again.');
                    return;
                }
            }
            
            // Now show review modal
            setShowReviewSendModal(true);
        } else {
            alert("Please draw your signature first");
        }
    };

    const handleClearUserSignature = () => {
        if (userSignatureRef.current) {
            userSignatureRef.current.clear();
        }
    };

    const handleSendForSignature = async () => {
        try {
            setIsSaving(true);
            
            // First, ensure we have the latest PDF (may have just been generated)
            const latestPDF = generatedPDFs.length > 0 ? generatedPDFs[generatedPDFs.length - 1] : null;
            
            if (!latestPDF || !latestPDF.downloadUrl) {
                // Try to generate PDF if not available
                try {
                    await generateChangeOrderPDF();
                    // After generating, check again
                    const newLatestPDF = generatedPDFs.length > 0 ? generatedPDFs[generatedPDFs.length - 1] : null;
                    if (!newLatestPDF || !newLatestPDF.downloadUrl) {
                        alert('Failed to generate PDF. Please try again.');
                        setIsSaving(false);
                        return;
                    }
                } catch (error) {
                    console.error('Error generating PDF:', error);
                    alert('Failed to generate PDF. Please try again.');
                    setIsSaving(false);
                    return;
                }
            }

            // Validate contractor email
            if (!patchJob.customerEmail || !patchJob.customerEmail.includes('@')) {
                alert('Please enter a valid contractor email address');
                setIsSaving(false);
                return;
            }

            // Call Firebase Function to send to SignWell
            const functions = getFunctions();
            const sendForSignature = httpsCallable(functions, 'sendPatchJobForSignature');
            
            const result = await sendForSignature({
                pdfUrl: latestPDF.downloadUrl,
                patchJobId: patchJobId,
                contractorEmail: patchJob.customerEmail,
                contractorName: patchJob.customer,
                userEmail: userData.email,
                userName: `${userData.firstName} ${userData.lastName}`,
                userSignature: userSignatureData || userData.signature,
            });

            if (result.data.success) {
                alert('Document sent for signature successfully!');
                setShowReviewSendModal(false);
                // Reload the patch job to get updated status
                window.location.reload();
            } else {
                alert('Failed to send document for signature');
            }
        } catch (error) {
            console.error('Error sending for signature:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const generateChangeOrderPDF = async () => {
        // Prevent PDF generation if SignWell signature is received
        if (patchJob.signwellStatus === 'completed') {
            alert('This job has been signed via SignWell. No new PDFs can be generated.');
            return;
        }
        
        // Save the patch job first to prevent data loss
        setIsSaving(true);
        try {
            // Perform basic validation
            if (!patchJob.projectName.trim() || !patchJob.customer.trim() || !patchJob.address.trim()) {
                alert('Please fill in Job Name, Contractor, and Address before generating PDF');
                setIsSaving(false);
                return;
            }

            // Save current state
            const patchJobData = {
                ...patchJob,
                patches: stripPhotoDataForFirestore(patchJob.patches), // Strip photo data to stay under 1MB
                totalAmount: calculateTotal(),
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown'
            };

            if (patchJobId) {
                const patchJobRef = doc(db, patchJobsPath, patchJobId);
                await updateDoc(patchJobRef, patchJobData);
            }
        } catch (saveError) {
            console.error('Error saving before PDF generation:', saveError);
            alert('Failed to save patch job before generating PDF');
            setIsSaving(false);
            return;
        }
        setIsSaving(false);

        // Always generate a fresh PDF when the button is clicked
        setIsGeneratingPDF(true);
        try {
            const logoDataUrl = await getLogoDataUrl();
            const functions = getFunctions(undefined, 'us-central1');
            const generate = httpsCallable(functions, 'generatePatchOrderPdf');

            const payload = {
                artifactProjectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
                patchJobId: patchJobId || null,
                projectName: patchJob.projectName,
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
                    hourlyRate: getEffectiveHourlyRate(),
                    photos: (p.photos || []).map(ph => ({ data: ph.data, url: ph.url }))
                })),
                logoDataUrl: logoDataUrl,
                // Public URL fallback (served from Firebase Hosting)
                logoUrl: `https://${process.env.REACT_APP_FIREBASE_PROJECT_ID}.web.app/FullCompanyLogo.png`
            };

            const resp = await generate(payload);
            const { filename, storagePath, downloadUrl } = resp.data || {};

            const timestamp = new Date().toISOString();
            const minimalSnapshot = {
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

    // Debug function to show what changed (admin only)
    const getPDFChangesTooltip = () => {
        if (!isAdmin() || generatedPDFs.length === 0) return '';
        const latestPDF = generatedPDFs.find(pdf => !pdf.isOutdated);
        if (!latestPDF || !latestPDF.dataSnapshot) return 'No snapshot data available';
        
        const changes = [];
        const snapshot = latestPDF.dataSnapshot;
        
        // Check patches count
        if (patchJob.patches.length !== (snapshot.patches || []).length) {
            changes.push(`Patches count: ${snapshot.patches?.length || 0} → ${patchJob.patches.length}`);
        }
        
        // Check total
        const currentTotal = calculateTotal();
        if (currentTotal !== snapshot.totalAmount) {
            changes.push(`Total: $${snapshot.totalAmount?.toFixed(2) || '0.00'} → $${currentTotal.toFixed(2)}`);
        }
        
        // Check notes
        if ((patchJob.notes || '') !== (snapshot.notes || '')) {
            changes.push('Notes changed');
        }
        
        // Check contractor
        if ((patchJob.customer || '') !== (snapshot.customer || '')) {
            changes.push('Contractor changed');
        }
        
        // Check address
        if ((patchJob.address || '') !== (snapshot.address || '')) {
            changes.push('Address changed');
        }
        
        return changes.length > 0 ? changes.join('\n') : 'Data changed (detailed comparison needed)';
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
                patches: stripPhotoDataForFirestore(patchJob.patches), // Strip photo data to stay under 1MB
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
        // If over threshold and status is Scheduled, show "Review and Send"
        if (currentStatus === 'Scheduled' && calculateTotal() >= patchJobConfig.signatureThreshold) {
            return 'Review and Send for Signature';
        }
        
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

    const handleStatusButtonClick = async () => {
        const total = calculateTotal();
        const needsSignature = total >= patchJobConfig.signatureThreshold;
        
        // If Scheduled and over threshold, show review/send flow
        if (patchJob.status === 'Scheduled' && needsSignature) {
            // Check if user has a signature
            if (!userData.signature) {
                // Show user signature modal first
                setShowUserSignatureModal(true);
            } else {
                setUserSignatureData(userData.signature);
                
                // Generate PDF automatically if none exists or if outdated
                if (generatedPDFs.length === 0 || isPDFOutdated()) {
                    try {
                        await generateChangeOrderPDF();
                    } catch (error) {
                        console.error('Error generating PDF:', error);
                        alert('Failed to generate PDF. Please try again.');
                        return;
                    }
                }
                
                // Show review and send modal
                setShowReviewSendModal(true);
            }
        } else {
            // Regular status progression
            await submitPatchJob();
        }
    };

    const submitPatchJob = async () => {
        if (!patchJob.projectName.trim()) {
            alert('Please enter a job name');
            return;
        }

        if (!patchJob.customer.trim()) {
            alert('Please enter a contractor name');
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
            alert(`Contractor signature is required for amounts over $${patchJobConfig.signatureThreshold.toFixed(2)}`);
            return;
        }

        // Check if we need to warn about signature removal due to total change
        if (isSignaturePresent() && originalTotal !== null && Math.abs(total - originalTotal) > 0.01) {
            if (!showSignatureRemovalWarning) {
                setShowSignatureRemovalWarning(true);
                return;
            }
        }

        setIsSaving(true);

        try {
            const nextStatus = getNextStatus(patchJob.status);
            const currentTotal = calculateTotal();
            const needsSignature = currentTotal >= patchJobConfig.signatureThreshold;
            
            let patchJobData = {
                ...patchJob,
                totalAmount: currentTotal,
                updatedAt: new Date().toISOString(),
                updatedBy: userData?.email || 'Unknown',
                status: nextStatus
            };

            // Remove signature if total changed and user confirmed
            if (showSignatureRemovalWarning && isSignaturePresent()) {
                patchJobData.customerSignature = null;
                patchJobData.signature = '';
                setShowSignatureRemovalWarning(false);
            }

            // Check if we need to revert Done status due to missing signature
            if (nextStatus === 'Done' && needsSignature && !isSignaturePresent()) {
                patchJobData.status = 'Scheduled';
                alert('This job requires a contractor signature due to the total amount. Status has been changed back to Scheduled.');
            }

            // When marking as Done, freeze the hourly rate on the job so future config changes won't affect historical totals
            if (nextStatus === 'Done') {
                const rateToFreeze = getEffectiveHourlyRate();
                patchJobData.hourlyRate = rateToFreeze;
            }

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
                if (nextStatus === 'Done') {
                    patchJobData.hourlyRate = getEffectiveHourlyRate();
                }
                
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
                            onClick={handleStatusButtonClick}
                            disabled={isSaving || isGeneratingPDF}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isGeneratingPDF ? 'Generating PDF...' : (isSaving ? 'Processing...' : getStatusButtonText(patchJob.status))}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Form */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                {/* Job Name and Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Job Name *
                            </label>
                        </div>
                        <input
                            type="text"
                            value={patchJob.projectName}
                            onChange={(e) => handleInputChange('projectName', e.target.value)}
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
                            Contractor *
                        </label>
                        <input
                            type="text"
                            value={patchJob.customer}
                            onChange={(e) => handleInputChange('customer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Contractor name"
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
                {/* SignWell Signed Indicator */}
                {patchJob.signwellStatus === 'completed' && patchJob.signedPdfUrl && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-green-800">✅ Signed by Contractor</p>
                                <p className="text-sm text-green-700">
                                    This job has been signed via SignWell. No further edits or PDF generation allowed.
                                </p>
                            </div>
                            <a
                                href={patchJob.signedPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                                View Signed PDF
                            </a>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        Patches
                        {patchJob.signwellStatus === 'completed' ? (
                            <span className="text-sm text-green-600 ml-2">🔒 Locked (SignWell Signed)</span>
                        ) : isSignaturePresent() && !isAdmin() ? (
                            <span className="text-sm text-gray-500 ml-2">🔒 Locked (Signed)</span>
                        ) : null}
                    </h2>
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
                            patchJobId={patchJobId}
                            projectId={process.env.REACT_APP_FIREBASE_PROJECT_ID}
                        />
                    ))}
                </div>

                {/* Add Patch button below patches */}
                {(!isSignaturePresent() || isAdmin()) && (
                    <div className="mt-6">
                        <button
                            onClick={addPatch}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            title={isSignaturePresent() && isAdmin() ? "Admin: Add patch to signed job" : "Add Patch"}
                        >
                            <PlusIcon />
                            <span className="ml-2">Add Patch</span>
                        </button>
                    </div>
                )}

                {/* Total Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
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
                                                            <span 
                                                                className="ml-2 text-orange-600 cursor-help" 
                                                                title={isAdmin() ? getPDFChangesTooltip() : ''}
                                                            >
                                                                (Data changed)
                                                            </span>
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

            {/* Signature Removal Warning Modal */}
            <ConfirmationModal
                isOpen={showSignatureRemovalWarning}
                onClose={() => setShowSignatureRemovalWarning(false)}
                onConfirm={() => {
                    submitPatchJob();
                }}
                title="Remove Contractor Signature?"
                message={`The total amount has changed from $${(originalTotal || 0).toFixed(2)} to $${calculateTotal().toFixed(2)}. The contractor signature will be removed if you continue. Do you want to proceed?`}
                confirmText="Yes, Remove Signature"
                cancelText="Cancel"
                isDestructive={true}
            />

            {/* User Signature Modal */}
            {showUserSignatureModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Draw Your Signature</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Your signature will be saved to your profile and used for future patch jobs.
                        </p>
                        <div className="border-2 border-gray-300 rounded-md mb-4">
                            <SignatureCanvas
                                ref={userSignatureRef}
                                canvasProps={{
                                    width: 600,
                                    height: 200,
                                    className: 'signature-canvas w-full'
                                }}
                            />
                        </div>
                        <div className="flex justify-between">
                            <button
                                onClick={handleClearUserSignature}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                Clear
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowUserSignatureModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveUserSignature}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Save & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review and Send Modal */}
            {showReviewSendModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Review and Send for Signature</h3>
                        
                        {/* PDF Preview */}
                        <div className="mb-6">
                            <h4 className="font-medium text-gray-700 mb-2">Document Preview</h4>
                            {generatedPDFs.length > 0 && generatedPDFs[generatedPDFs.length - 1].downloadUrl ? (
                                <div className="border border-gray-300 rounded-md overflow-hidden bg-gray-100">
                                    <iframe
                                        src={`${generatedPDFs[generatedPDFs.length - 1].downloadUrl}#view=FitH`}
                                        className="w-full h-96"
                                        title="PDF Preview"
                                        style={{ border: 'none' }}
                                    />
                                </div>
                            ) : (
                                <div className="border border-gray-300 rounded-md p-8 text-center text-gray-500">
                                    {isGeneratingPDF ? 'Generating PDF...' : 'PDF will be generated automatically.'}
                                </div>
                            )}
                        </div>

                        {/* Recipient Information */}
                        <div className="mb-6">
                            <h4 className="font-medium text-gray-700 mb-3">Send to Contractor</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Name</label>
                                    <input
                                        type="text"
                                        value={patchJob.customer}
                                        onChange={(e) => handleInputChange('customer', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Email *</label>
                                    <input
                                        type="email"
                                        value={patchJob.customerEmail}
                                        onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder="contractor@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                                <strong>What happens next:</strong> The contractor will receive an email with a link to review and sign this document. 
                                Once signed, the document will be attached to this patch job and the job will automatically be marked as Done.
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowReviewSendModal(false)}
                                disabled={isSaving}
                                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendForSignature}
                                disabled={isSaving || !patchJob.customerEmail}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Sending...' : 'Send for Signature'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatchJobPage;