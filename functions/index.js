const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const Handlebars = require('handlebars');

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
  @page { size: Letter; margin: 28px; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; }
  .header { text-align: center; margin-bottom: 10px; }
  .logo { max-width: 520px; max-height: 110px; margin: 0 auto; display: block; }
  .divider { border-top: 3px solid #111; margin: 8px 0 12px; }
  .title { text-align: center; font-size: 20px; font-weight: 700; margin: 8px 0 14px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; row-gap: 8px; margin-bottom: 10px; }
  .row { display: grid; grid-template-columns: 140px 1fr; align-items: baseline; }
  .label { text-align: right; font-weight: 700; padding-right: 6px; }
  .value { text-align: left; }
  .box { border: 3px solid #111; min-height: 420px; padding: 14px; margin-top: 12px; }
  .section-title { font-weight: 700; margin-bottom: 8px; }
  .patch { margin: 10px 0; }
  .amount { margin-left: 14px; }
  .photos { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
  .photo { max-height: 120px; max-width: 160px; border: 1px solid #ccc; object-fit: contain; }
  .accept { font-size: 11px; text-align: center; margin: 12px 50px 4px; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; margin-top: 10px; }
  .sign-col { text-align: center; }
  .sign-line { border-top: 2px solid #111; margin: 24px 0 4px; }
  .sign-foot { display: grid; grid-template-columns: 1fr 1fr; font-size: 11px; }
  .footer { text-align: center; font-weight: 700; margin-top: 12px; }
  .muted { color: #333; }
</style>
</head>
<body>
  <div class="header">
    {{#if logoDataUrl}}<img class="logo" src="{{logoDataUrl}}" />{{/if}}
  </div>
  <div class="divider"></div>
  <div class="title">Patch Work Order</div>
  <div class="two-col">
    <div class="row"><div class="label">Project Name:</div><div class="value">{{projectName}}</div></div>
    <div class="row"><div class="label">Address:</div><div class="value">{{address}}</div></div>
    <div class="row"><div class="label">Contractor:</div><div class="value">{{customer}}</div></div>
    <div class="row"><div class="label">Requested by:</div><div class="value">{{requestedBy}}</div></div>
  <div class="row"><div class="label">Price:</div><div class="value">&#36;{{total}}</div></div>
  </div>

  <div class="box">
    <div class="section-title">WORK PERFORMED:</div>
    {{#each patches}}
      <div class="patch">
        <div><strong>Patch {{number}}:</strong> {{description}}</div>
        <div class="amount">{{amountText}}</div>
        {{#if images}}
        <div class="photos">
          {{#each images}}
            <img class="photo" src="{{this}}" />
          {{/each}}
        </div>
        {{/if}}
      </div>
    {{/each}}
  </div>

  <div class="accept">The above prices, specifications and conditions are satisfactory and are hereby accepted. You are authorized to do the work as specified. Payment will be made in full at completion of job. After 30 days from completion interest will be added to the unpaid balance at the rate of 0.5% per month (18% per year). If legal action is required, you agree to pay collection and attorney fees.</div>

  <div class="sign-row">
    <div class="sign-col">
      <div class="muted">Job Manager</div>
      <div class="sign-line"></div>
      <div class="muted">Signature</div>
      <div class="sign-foot"><div>Print</div><div>Date</div></div>
    </div>
    <div class="sign-col">
      <div class="muted">Tolman Construction</div>
      <div class="sign-line"></div>
      <div class="muted">Signature</div>
      <div class="sign-foot"><div>Print</div><div>Date</div></div>
    </div>
  </div>

  <div class="footer">1758 S 1900 W, Suite B6, West Haven, UT 84401   •   (801) 444-9600</div>
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
      jobName,
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
    const images = (p.photos || []).slice(0, 3).map(ph => ph.data || ph.url).filter(Boolean);
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
    projectName: projectName || jobName || '',
    address: address || '',
    customer: customer || '',
    requestedBy: requestedBy || '',
    total: Number(total || 0).toFixed(2),
    notes: notes || '',
    patches: patchModels
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
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    step = 'save-to-storage';
    // Use the Firebase Storage bucket (shown in Firebase Console)
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'tolmantest';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = getStorage().bucket(bucketName);
    console.log('Using bucket:', bucketName, '(project:', projectId, ')');
    
    const safeName = (jobName || projectName || 'PatchJob').replace(/[^a-zA-Z0-9]/g, '_');
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
