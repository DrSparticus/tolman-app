const axios = require('axios');
const { defineSecret } = require('firebase-functions/params');

// Define the secret parameter
const signwellApiKey = defineSecret('SIGNWELL_API_KEY');

const SIGNWELL_API_URL = 'https://www.signwell.com/api/v1';

/**
 * Create a SignWell document from a PDF URL with signature fields
 * @param {string} pdfUrl - URL to the PDF file
 * @param {string} documentName - Name for the document
 * @param {Object} contractorInfo - Contractor signer info {email, name}
 * @param {Object} tolmanInfo - Tolman employee info {email, name, signatureData}
 * @returns {Promise<Object>} SignWell document response
 */
async function createDocumentWithFields(pdfUrl, documentName, contractorInfo, tolmanInfo) {
  const apiKey = signwellApiKey.value();
  
  if (!apiKey) {
    throw new Error('SignWell API key not configured');
  }

  try {
    const response = await axios.post(
      `${SIGNWELL_API_URL}/documents`,
      {
        name: documentName,
        files: [{ file_url: pdfUrl }],
        test_mode: false,
        draft: false,
        recipients: [
          // Contractor (Job Manager) - signs first
          {
            id: '1',
            name: contractorInfo.name,
            email: contractorInfo.email,
            order: 1,
          },
          // Tolman employee - signs second (you'll need to manually sign or use a template)
          {
            id: '2',
            name: tolmanInfo.name,
            email: tolmanInfo.email,
            order: 2,
          },
        ],
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('SignWell API Error:', error.response?.data || error.message);
    throw new Error(`Failed to create SignWell document: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Create a SignWell document from a PDF URL
 * @param {string} pdfUrl - URL to the PDF file
 * @param {string} documentName - Name for the document
 * @param {Array} signers - Array of signer objects with email, name, and fields
 * @returns {Promise<Object>} SignWell document response
 */
async function createDocument(pdfUrl, documentName, signers) {
  const apiKey = signwellApiKey.value();
  
  if (!apiKey) {
    throw new Error('SignWell API key not configured');
  }

  // Format recipients according to SignWell API requirements
  const recipients = signers.map((signer, index) => ({
    name: signer.name,
    email: signer.email,
    // Use 1-indexed role_id
    role_id: signer.order || (index + 1)
  }));

  try {
    const response = await axios.post(
      `${SIGNWELL_API_URL}/documents`,
      {
        name: documentName,
        files: [{ name: documentName, file_url: pdfUrl }],
        recipients: recipients,
        test_mode: false
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('SignWell API Error:', JSON.stringify(error.response?.data, null, 2) || error.message);
    console.error('Request payload:', JSON.stringify({
      name: documentName,
      files: [{ name: documentName, file_url: pdfUrl }],
      recipients: recipients
    }, null, 2));
    throw new Error(`Failed to create SignWell document: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get document status from SignWell
 * @param {string} documentId - SignWell document ID
 * @returns {Promise<Object>} Document status
 */
async function getDocumentStatus(documentId) {
  const apiKey = signwellApiKey.value();
  
  try {
    const response = await axios.get(
      `${SIGNWELL_API_URL}/documents/${documentId}`,
      {
        headers: {
          'X-Api-Key': apiKey
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('SignWell API Error:', error.response?.data || error.message);
    throw new Error(`Failed to get SignWell document: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Download completed document from SignWell
 * @param {string} documentId - SignWell document ID
 * @returns {Promise<Buffer>} PDF buffer
 */
async function downloadCompletedDocument(documentId) {
  const apiKey = signwellApiKey.value();
  
  try {
    const response = await axios.get(
      `${SIGNWELL_API_URL}/documents/${documentId}/completed_pdf`,
      {
        headers: {
          'X-Api-Key': apiKey
        },
        responseType: 'arraybuffer'
      }
    );
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('SignWell API Error:', error.response?.data || error.message);
    throw new Error(`Failed to download SignWell document: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = {
  createDocument,
  createDocumentWithFields,
  getDocumentStatus,
  downloadCompletedDocument,
  signwellApiKey, // Export the secret for function declaration
};
