const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log('🔑 API Key status:', process.env.ANTHROPIC_API_KEY ? 'Loaded ✓' : 'Missing ✗');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Split PDF into individual pages
async function splitPdfPages(pdfBase64) {
  try {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`📄 PDF has ${pageCount} page(s)`);
    
    const pages = [];
    
    for (let i = 0; i < pageCount; i++) {
      const singlePagePdf = await PDFDocument.create();
      const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
      singlePagePdf.addPage(copiedPage);
      
      const pdfBytes = await singlePagePdf.save();
      const pageBase64 = Buffer.from(pdfBytes).toString('base64');
      
      pages.push({
        pageNumber: i + 1,
        base64: pageBase64
      });
    }
    
    return pages;
  } catch (error) {
    console.error('Error splitting PDF:', error);
    throw error;
  }
}

// Process single page with Claude
async function processPage(pageBase64, pageNumber) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pageBase64,
              },
            },
            {
              type: 'text',
              text: `You are analyzing a Bill of Lading (BOL). Extract the following information with extreme precision:

**CRITICAL INSTRUCTIONS:**

1. PRO# (job number) - Look for "PRO#", "PRO NUMBER", or similar tracking number
   - This is the unique job identifier

2. ZONE - Single letter (A-L) indicating delivery zone location
   - **CRITICAL**: Look in the "Deliver To" section on the RIGHT side
   - Look for "Zone:" field in the delivery/consignee area
   - DO NOT use the pickup/shipper zone
   - Must be uppercase single letter from A through L

3. ACTUAL WEIGHT - Total weight in pounds (sum all line items if multiple)
   - Look for "Weight", "Wt", "LBS", "Pounds"

4. VOLUME - Total volume in cubic feet (ft³)
   - Look in measurements section for ft³ or cubic feet

5. LIFTGATE - String: "Yes" or blank ""
   - Look for ANY indication: printed text, handwritten notes, circled text, checkmarks
   - Keywords: "liftgate", "lift gate", "tailgate"
   - When in doubt, mark as "Yes"
   - Return "Yes" or "" (empty string)

6. INSIDE DELIVERY - String: "Yes" or blank ""
   - **CRITICAL**: Check BOTH printed text AND handwritten notes
   - Look in "Additional Information" section for ANY handwritten text
   - Common phrases: "inside delivery", "inside", "threshold", "room of choice", "I care"
   - Check both printed and handwritten areas
   - Even if just says "inside" or similar notation, mark as "Yes"
   - Return "Yes" or "" (empty string)

7. RESIDENTIAL - String: "Yes" or blank ""
   - ONLY mark "Yes" if you see explicit residential indicators
   - Look for: "residential", "res", "rsdl", residential checkbox marked
   - Do NOT assume based on address format alone
   - Return "Yes" or "" (empty string)

8. OVER LENGTH - String with INCHES range or blank ""
   - Look for dimension information in Length, Width, Height columns
   - **CRITICAL**: Return in INCHES, not feet
   - Return format: "97-144", "145-192", "193-240", "241 or more", or "" (empty string)
   - If longest dimension is 97-144 inches → "97-144"
   - If longest dimension is 145-192 inches → "145-192"
   - If longest dimension is 193-240 inches → "193-240"
   - If longest dimension is 241+ inches → "241 or more"
   - If all dimensions under 97 inches → "" (empty string)

9. DEBRIS REMOVAL - Critical for Lakeshore clients
   - palletCount: Count of pallets/skids (pieces)
   - hasDebrisSection: Boolean - Is there a "debris removal" section/checkbox on the BOL?
   - isLakeshore: Boolean - Does the client/shipper/consignee name contain "Lakeshore"?
   - RULE: Every pallet costs $3 if EITHER debris section exists OR client is Lakeshore

10. TIME SPECIFIC - String or blank ""
    - Look for time-sensitive delivery requirements
    - **CRITICAL**: Check for these indicators:
      - Handwritten or circled "T.S" or "TS" (means Time Specific)
      - "(DEL) APPOINTMENT DELIVERY Required"
      - "APPOINTMENT DELIVERY"
      - "AM DELIVERY", "AM SPECIAL"
      - "2 HOUR WINDOW", "15 MINUTE WINDOW"
    - Return exactly one of: "AM Special", "2 Hours", "15 Minutes", or "" (empty string)
    - If you see "T.S" or "APPOINTMENT DELIVERY" but no specific time window mentioned, return "2 Hours"
    - AM Special = M-F 0500-1159
    - 2 Hours = M-F 0500-2000 (2 hour time window)
    - 15 Minutes = M-F 0500-2000 (15 minute time window)

11. DETENTION - Number (minutes) or 0
    - Any detention/waiting time noted on BOL
    - Return total minutes waited as a number
    - If no detention, return 0 (not null)

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "pro": "string",
  "zone": "string (single letter A-L)",
  "weight": number,
  "volume": number or 0,
  "liftgate": "Yes" or "",
  "inside": "Yes" or "",
  "residential": "Yes" or "",
  "overLength": "97-144" or "145-192" or "193-240" or "241 or more" or "",
  "palletCount": number,
  "hasDebrisSection": boolean,
  "isLakeshore": boolean,
  "timeSpecific": "AM Special" or "2 Hours" or "15 Minutes" or "",
  "detention": number (minutes, 0 if none)
}

**EXAMPLES:**
- If delivery section shows "Zone: H" → return "H" (NOT the pickup zone)
- If you see "Lakeshore" as shipper and 5 pallets → "palletCount": 5, "isLakeshore": true
- If you see a "debris removal" checkbox marked → "hasDebrisSection": true
- If handwritten "inside" or "I care" in notes → "inside": "Yes"
- If no inside delivery mentioned → "inside": ""
- If handwritten/circled "T.S" or "TS" anywhere on BOL → "timeSpecific": "2 Hours"
- If "(DEL) APPOINTMENT DELIVERY Required" → "timeSpecific": "2 Hours"
- If no time-specific requirements → "timeSpecific": ""
- If longest dimension is 120 inches → "overLength": "97-144"
- If longest dimension is 180 inches → "overLength": "145-192"
- If longest dimension is 250 inches → "overLength": "241 or more"
- If all dimensions under 97 inches → "overLength": ""
- Volume shown as "44.44" in Volume-ft3 column → "volume": 44.44
- If no volume shown → "volume": 0
- If "Pallet" type with count of 1 → "palletCount": 1
- If 45 minutes detention → "detention": 45
- If no detention → "detention": 0
- If liftgate checkbox marked → "liftgate": "Yes"
- If no liftgate → "liftgate": ""`
            },
          ],
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === 'text')?.text;

    // Add logging to see what Claude returns
    console.log('  📝 Claude response:', textContent);

    return {
      pageNumber,
      data: textContent,
    };
  } catch (error) {
    console.error(`Error processing page ${pageNumber}:`, error);
    throw error;
  }
}

// Process BOL endpoint
app.post('/api/process-bol', async (req, res) => {
  try {
    const { pdfBase64, filename } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    console.log(`\n🔄 Processing: ${filename}`);
    
    const pages = await splitPdfPages(pdfBase64);
    
    const results = [];
    for (const page of pages) {
      try {
        console.log(`  ⏳ Processing page ${page.pageNumber}/${pages.length}...`);
        const result = await processPage(page.base64, page.pageNumber);
        results.push({
          ...result,
          success: true,
          error: null
        });
        console.log(`  ✅ Page ${page.pageNumber} completed`);
      } catch (error) {
        console.error(`  ❌ Page ${page.pageNumber} failed:`, error.message);
        results.push({
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          data: null
        });
      }
    }

    console.log(`  📊 Summary: ${results.filter(r => r.success).length}/${results.length} pages successful`);
    
    res.json({
      success: true,
      filename: filename,
      pageCount: pages.length,
      results: results,
    });
  } catch (error) {
    console.error('Error processing BOL:', error);
    res.status(500).json({
      error: error.message || 'Failed to process BOL',
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Extraction includes:`);
  console.log(`   ✓ PRO# and Zone`);
  console.log(`   ✓ Debris removal (Lakeshore special rule)`);
  console.log(`   ✓ Inside delivery (handwriting + additional info)`);
  console.log(`   ✓ Over length (inch ranges)`);
  console.log(`   ✓ Time-specific windows`);
  console.log(`   ✓ Detention tracking\n`);
});