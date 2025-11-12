const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const Handlebars = require('handlebars');
const { createDocument, createDocumentWithFields, getDocumentStatus, downloadCompletedDocument, signwellApiKey } = require('./signwell');

setGlobalOptions({ region: 'us-central1', memory: '1GiB', timeoutSeconds: 120 });

// Initialize Admin SDK without explicit bucket (will use default from project config)
admin.initializeApp();

const { getStorage } = require('firebase-admin/storage');

// Simple HTML template for Patch Work Order
const templateSource = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Patch Work Order</title>
<style>
  body { 
    font-family: Arial, Helvetica, sans-serif; 
    color: #111;
    margin: 0;
    padding: 0;
  }
  
  .title { text-align: center; font-size: 20px; font-weight: 700; margin: 8px 0 14px; }
  
  .two-col { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; row-gap: 8px; margin-bottom: 10px; }
  .row { display: grid; grid-template-columns: 140px 1fr; align-items: baseline; }
  .label { text-align: right; font-weight: 700; padding-right: 6px; }
  .value { text-align: left; }
  .box { border: 3px solid #111; min-height: 420px; padding: 14px; margin-top: 12px; }
  .section-title { font-weight: 700; margin-bottom: 8px; }
  .patch { margin: 10px 0; display: grid; grid-template-columns: 2fr 1fr; gap: 14px; align-items: start; page-break-inside: avoid; }
  .patch-content { }
  .patch-photos { display: flex; flex-direction: column; gap: 6px; }
  .amount { margin-left: 14px; margin-top: 4px; }
  .photo { max-height: 100px; max-width: 100%; border: 1px solid #ccc; object-fit: contain; }
  .patch-separator { border-top: 1px solid #999; margin: 14px auto; width: 75%; }
  .accept { font-size: 11px; text-align: center; margin: 12px 50px 4px; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; margin-top: 10px; page-break-inside: avoid; }
  .sign-col { text-align: center; }
  .sign-area { min-height: 50px; margin-bottom: 6px; position: relative; }
  .sign-values { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 11px; font-weight: 600; position: absolute; bottom: 4px; width: 100%; text-align: center; }
  .sign-line { border-bottom: 2px solid #111; position: absolute; bottom: 0; width: 100%; }
  .sign-img { position: absolute; bottom: 8px; left: 0; height: 45px; max-width: 33%; }
  .sign-labels { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 11px; gap: 8px; margin-top: 2px; }
  .muted { color: #333; }
  
</style>
</head>
<body>
  <div class="title">Patch Work Order</div>
  <div class="two-col">
      <div class="row"><div class="label">Project Name:</div><div class="value">{{projectName}}</div></div>
      <div class="row"><div class="label">Contractor:</div><div class="value">{{customer}}</div></div>
      <div class="row"><div class="label">Address:</div><div class="value">{{address}}</div></div>
      <div class="row"><div class="label">Requested by:</div><div class="value">{{requestedBy}}</div></div>
      <div class="row"><div class="label">Price:</div><div class="value">&#36;{{total}}</div></div>
    </div>
  </div>

  <div class="box">
    <div class="section-title">WORK PERFORMED:</div>
    {{#each patches}}
      <div class="patch">
        <div class="patch-content">
          <div><strong>Patch {{number}}:</strong> {{description}}</div>
          <div class="amount">{{amountText}}</div>
        </div>
        {{#if images}}
        <div class="patch-photos">
          {{#each images}}
            <img class="photo" src="{{this}}" />
          {{/each}}
        </div>
        {{else}}
        <div></div>
        {{/if}}
      </div>
      {{#unless @last}}<div class="patch-separator"></div>{{/unless}}
    {{/each}}
  </div>

  <div class="accept">The above prices, specifications and conditions are satisfactory and are hereby accepted. You are authorized to do the work as specified. Payment will be made in full at completion of job. After 30 days from completion interest will be added to the unpaid balance at the rate of 0.5% per month (18% per year). If legal action is required, you agree to pay collection and attorney fees.</div>

  <div class="sign-row">
    <div class="sign-col">
      <div class="muted">Job Manager</div>
      <div class="sign-area">
        <div class="sign-line"></div>
        <div style="position: absolute; bottom: 25px; left: 0; color: transparent; font-size: 1px;">[[sig|req|signer1]]</div>
      </div>
      <div class="sign-labels">
        <div>Signature</div>
        <div>Print</div>
        <div>Date</div>
      </div>
    </div>
    <div class="sign-col">
      <div class="muted">Tolman Construction</div>
      <div class="sign-area">
        {{#if userSignature}}
        <img src="{{userSignature}}" alt="Signature" class="sign-img" />
        {{/if}}
        <div class="sign-values">
          <div>&nbsp;</div>
          <div>{{userName}}</div>
          <div>{{generatedDate}}</div>
        </div>
        <div class="sign-line"></div>
      </div>
      <div class="sign-labels">
        <div>Signature</div>
        <div>Print</div>
        <div>Date</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const template = Handlebars.compile(templateSource);

exports.generatePatchOrderPdf = onCall(async (request) => {
  const data = request.data || {};
  let step = 'start';
  try {
    const {
      artifactProjectId,
      patchJobId,
      projectName,
      customer,
      address,
      requestedBy,
      total,
      notes,
      patches = [],
      logoDataUrl,
      logoUrl
    } = data;

  // Prepare template model
  step = 'prepare-template-model';
  const patchModels = (patches || []).map((p) => {
    let amountText = '';
    if (p.amountType === 'hours') {
      const rate = Number(p.hourlyRate || 0);
      const hours = Number(p.amount || 0);
      const cost = (hours * rate).toFixed(2);
      amountText = `${hours} hours × $${rate}/hr = $${cost}`;
    } else {
      const cost = Number(p.amount || 0).toFixed(2);
      amountText = `Fixed charge: $${cost}`;
    }
    // Prefer URL over base64 data for photos (URLs are stored in Firebase Storage)
    const images = (p.photos || []).slice(0, 3).map(ph => ph.url || ph.data).filter(Boolean);
    return { number: p.number, description: p.description, amountText, images };
  });

  // Resolve logo
  let finalLogoDataUrl = logoDataUrl || undefined;
  step = 'resolve-logo';
  if (!finalLogoDataUrl && logoUrl && /^https?:\/\//i.test(logoUrl) && !/localhost|127\.0\.0\.1/i.test(logoUrl)) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') || 'image/png';
        finalLogoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      } else {
        console.warn('Logo fetch non-OK status', res.status);
      }
    } catch (e) {
      console.warn('Logo fetch failed:', e?.message || e);
    }
  }

  step = 'render-html';
  const html = template({
    logoDataUrl: finalLogoDataUrl,
    projectName: projectName || '',
    address: address || '',
    customer: customer || '',
    requestedBy: requestedBy || '',
    total: Number(total || 0).toFixed(2),
    notes: notes || '',
    patches: patchModels,
    userName: data.userName || '',
    userSignature: data.userSignature || '',
    generatedDate: new Date().toLocaleDateString('en-US')
  });

  // Launch headless Chromium
  step = 'launch-browser';
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    step = 'render-page';
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    step = 'generate-pdf';
    // Create header template with 3-column layout: Project Name | Logo | Address
    // Note: Header margins respect page margins (20px left/right)
    const headerTemplate = `
      <div style="width: calc(100% - 40px); margin: 0 20px; padding: 8px 0 12px; border-bottom: 2px solid #111; display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; font-size: 10px; -webkit-print-color-adjust: exact;">
        <div style="text-align: left; font-weight: 700; font-size: 12px;">${projectName || ''}</div>
        <div style="text-align: center;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="max-width: 300px; max-height: 60px;" />` : ''}
        </div>
        <div style="text-align: right; font-size: 11px; color: #333;">${address || ''}</div>
      </div>
    `;

    // Create footer template with centered/bold company info and page numbers on right
    const footerTemplate = `
      <div style="width: 100%; padding: 4px 20px; font-size: 10px; display: flex; justify-content: center; align-items: center; position: relative; -webkit-print-color-adjust: exact;">
        <div style="font-weight: 700; text-align: center;">1758 S 1900 W, Suite B6, West Haven, UT 84401 • (801) 444-9600</div>
        <div style="position: absolute; right: 20px; color: #666; font-weight: normal; font-size: 9px;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    `;

    const pdfBuffer = await page.pdf({ 
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: '110px', right: '20px', bottom: '50px', left: '20px' }
    });    step = 'save-to-storage';
    // Use the Firebase Storage bucket (shown in Firebase Console)
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'tolmantest';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = getStorage().bucket(bucketName);
    console.log('Using bucket:', bucketName, '(project:', projectId, ')');
    
    const safeName = (projectName || 'PatchJob').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Change_Order_${safeName}_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.pdf`;
    const storagePath = `artifacts/${artifactProjectId}/patchJobs/${patchJobId || 'unknown'}/pdfs/${filename}`;

    console.log('[save-to-storage] Debug info:', {
      bucketName,
      storagePath,
      filename,
      pdfBufferSize: pdfBuffer.length,
      projectId
    });

    const file = bucket.file(storagePath);
    
    // Save with metadata including download token for public access
    const downloadToken = require('crypto').randomUUID();
    try {
      await file.save(pdfBuffer, { 
        contentType: 'application/pdf', 
        resumable: false,
        metadata: { 
          cacheControl: 'no-store',
          metadata: {
            firebaseStorageDownloadTokens: downloadToken
          }
        }
      });
      console.log('[save-to-storage] File saved successfully to:', storagePath);
    } catch (saveError) {
      console.error('[save-to-storage] File save failed:', {
        errorMessage: saveError.message,
        errorCode: saveError.code,
        errorStack: saveError.stack,
        bucketName: bucket.name,
        storagePath
      });
      throw saveError;
    }

    step = 'generate-download-url';
    // Use Firebase's token-based download URL instead of signed URL (no IAM role required)
    const encodedPath = encodeURIComponent(storagePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return { filename, storagePath, downloadUrl };
  } finally {
    await browser.close();
  }
  } catch (err) {
    console.error('generatePatchOrderPdf failed at step:', step, '\nError:', err);
    throw new HttpsError('internal', `PDF generation failed at step: ${step}`, { message: err?.message || String(err) });
  }
});

/**
 * Send a patch job PDF to SignWell for signature
 */
exports.sendPatchJobForSignature = onCall({ secrets: [signwellApiKey] }, async (request) => {
  try {
    const { pdfUrl, patchJobId, contractorEmail, contractorName, userEmail, userName, userSignature } = request.data;
    
    if (!pdfUrl || !patchJobId || !contractorEmail || !contractorName || !userEmail || !userName) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }
    
    if (!userSignature) {
      throw new HttpsError('invalid-argument', 'User signature required');
    }

    // Get Firestore references
    const db = admin.firestore();
    const patchJobRef = db.doc(`artifacts/${process.env.GCLOUD_PROJECT}/patchJobs/${patchJobId}`);

    // Create SignWell document with signature fields
    const documentName = `Patch Work Order - ${patchJobId}`;
    
    // Check if document already exists in Firestore
    const patchJobSnapshot = await patchJobRef.get();
    const existingDocId = patchJobSnapshot.data()?.signwellDocumentId;
    
    let signWellDoc;
    if (existingDocId) {
      // Try to get existing document
      try {
        signWellDoc = await getDocumentStatus(existingDocId);
        console.log('Found existing SignWell document:', existingDocId);
        
        // If document is completed, archived, or declined, create a new one
        if (['completed', 'archived', 'declined'].includes(signWellDoc.status.toLowerCase())) {
          console.log('Existing document is finalized, creating new one');
          signWellDoc = await createDocument(pdfUrl, documentName, [
            { email: contractorEmail, name: contractorName, order: 1 }
          ]);
        }
      } catch (error) {
        // Document doesn't exist anymore, create new one
        console.log('Existing document not found, creating new one');
        signWellDoc = await createDocument(pdfUrl, documentName, [
          { email: contractorEmail, name: contractorName, order: 1 }
        ]);
      }
    } else {
      // No existing document, create new one
      signWellDoc = await createDocument(pdfUrl, documentName, [
        { email: contractorEmail, name: contractorName, order: 1 }
      ]);
    }

    // Store SignWell document ID in Firestore
    await patchJobRef.update({
      signwellDocumentId: signWellDoc.id,
      signwellStatus: 'pending',
      signwellSentAt: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: userEmail,
    });

    return {
      success: true,
      documentId: signWellDoc.id,
      editUrl: signWellDoc.embedded_edit_url,
      signingUrl: signWellDoc.recipients?.[0]?.signing_url,
      needsFields: signWellDoc.fields?.length === 0,
      message: signWellDoc.fields?.length === 0 
        ? 'Document created - please add signature fields and send'
        : 'Document sent for signature',
    };
  } catch (error) {
    console.error('sendPatchJobForSignature error:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Webhook handler for SignWell document completion
 */
exports.signwellWebhook = onCall({ secrets: [signwellApiKey] }, async (request) => {
  try {
    const { event_type, document_id, document } = request.data;
    
    console.log('SignWell webhook received:', { event_type, document_id });

    if (event_type !== 'document_completed') {
      return { success: true, message: 'Event ignored' };
    }

    // Find the patch job by SignWell document ID
    const db = admin.firestore();
    const patchJobsRef = db.collection(`artifacts/${process.env.GCLOUD_PROJECT}/patchJobs`);
    const querySnapshot = await patchJobsRef.where('signwellDocumentId', '==', document_id).limit(1).get();

    if (querySnapshot.empty) {
      console.error('No patch job found for SignWell document:', document_id);
      return { success: false, error: 'Patch job not found' };
    }

    const patchJobDoc = querySnapshot.docs[0];
    const patchJobId = patchJobDoc.id;

    // Download the completed signed PDF
    const signedPdfBuffer = await downloadCompletedDocument(document_id);

    // Upload signed PDF to Firebase Storage
    const bucket = getStorage().bucket();
    const signedPdfPath = `artifacts/${process.env.GCLOUD_PROJECT}/patchJobs/${patchJobId}/signed-patch-order.pdf`;
    const file = bucket.file(signedPdfPath);

    await file.save(signedPdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          signwellDocumentId: document_id,
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Get download URL
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future date
    });

    // Update patch job in Firestore
    await patchJobDoc.ref.update({
      signwellStatus: 'completed',
      signwellCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      signedPdfUrl: signedUrl,
      status: 'Done',
      patchesLocked: true, // Lock patches from further editing
    });

    console.log('Patch job updated with signed PDF:', patchJobId);

    return {
      success: true,
      patchJobId,
      message: 'Signed PDF uploaded and patch job updated',
    };
  } catch (error) {
    console.error('signwellWebhook error:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * HTTP Webhook endpoint for SignWell to call when documents are completed
 * This is the URL you should add to SignWell's Event Callback URL
 */
exports.signwellWebhookHttp = onRequest(async (req, res) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { event_type, document_id, document } = req.body;
    
    console.log('SignWell webhook received:', { event_type, document_id });

    // Only process completed documents
    if (event_type !== 'document_completed') {
      res.status(200).json({ success: true, message: 'Event ignored' });
      return;
    }

    // Find the patch job by SignWell document ID
    const db = admin.firestore();
    const patchJobsRef = db.collection(`artifacts/${process.env.GCLOUD_PROJECT}/patchJobs`);
    const querySnapshot = await patchJobsRef.where('signwellDocumentId', '==', document_id).limit(1).get();

    if (querySnapshot.empty) {
      console.error('No patch job found for SignWell document:', document_id);
      res.status(404).json({ success: false, error: 'Patch job not found' });
      return;
    }

    const patchJobDoc = querySnapshot.docs[0];
    const patchJobId = patchJobDoc.id;

    // Download the completed signed PDF
    const signedPdfBuffer = await downloadCompletedDocument(document_id);

    // Upload signed PDF to Firebase Storage
    const bucket = getStorage().bucket();
    const signedPdfPath = `artifacts/${process.env.GCLOUD_PROJECT}/patchJobs/${patchJobId}/signed-patch-order.pdf`;
    const file = bucket.file(signedPdfPath);

    await file.save(signedPdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          signwellDocumentId: document_id,
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Get download URL
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future date
    });

    // Update patch job in Firestore
    await patchJobDoc.ref.update({
      signwellStatus: 'completed',
      signwellCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      signedPdfUrl: signedUrl,
      status: 'Done',
      patchesLocked: true, // Lock patches from further editing
    });

    console.log('Patch job updated with signed PDF:', patchJobId);

    res.status(200).json({
      success: true,
      patchJobId,
      message: 'Signed PDF uploaded and patch job updated',
    });
  } catch (error) {
    console.error('signwellWebhookHttp error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Permanently delete a patch job including all associated storage files
 */
exports.deletePatchJobPermanently = onCall(async (request) => {
  try {
    const { patchJobId } = request.data;
    
    if (!patchJobId) {
      throw new HttpsError('invalid-argument', 'patchJobId is required');
    }

    console.log('Permanently deleting patch job:', patchJobId);

    const db = admin.firestore();
    const bucket = getStorage().bucket();
    
    // Delete all files in the patch job's storage folder
    const storagePrefix = `artifacts/${process.env.GCLOUD_PROJECT}/patchJobs/${patchJobId}/`;
    
    try {
      const [files] = await bucket.getFiles({ prefix: storagePrefix });
      
      if (files.length > 0) {
        console.log(`Deleting ${files.length} storage files for patch job ${patchJobId}`);
        
        // Delete all files
        await Promise.all(files.map(file => file.delete()));
        
        console.log('Storage files deleted successfully');
      } else {
        console.log('No storage files found for this patch job');
      }
    } catch (storageError) {
      console.error('Error deleting storage files:', storageError);
      // Continue with Firestore deletion even if storage deletion fails
    }

    // Delete the Firestore document
    const patchJobRef = db.doc(`artifacts/${process.env.GCLOUD_PROJECT}/patchJobs/${patchJobId}`);
    await patchJobRef.delete();
    
    console.log('Patch job deleted from Firestore:', patchJobId);

    return {
      success: true,
      message: 'Patch job and associated files deleted permanently',
    };
  } catch (error) {
    console.error('deletePatchJobPermanently error:', error);
    throw new HttpsError('internal', error.message);
  }
});
