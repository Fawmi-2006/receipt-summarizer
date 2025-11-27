const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const PDFService = require('./services/pdfService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/pdfs', express.static('pdfs'));

const directories = ['uploads', 'pdfs'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, JPG, and WebP images are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

function encodeImageToBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
}

function cleanSummary(summary) {
    if (typeof summary !== 'object' || summary === null) return summary;
    
    const cleaned = JSON.parse(JSON.stringify(summary));
    
    function removeNulls(obj) {
        for (let key in obj) {
            if (obj[key] === null || obj[key] === '' || obj[key] === undefined) {
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                removeNulls(obj[key]);
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        }
    }
    
    removeNulls(cleaned);
    return cleaned;
}

async function analyzeReceiptWithGemini(imagePath) {
    try {
        const base64Image = encodeImageToBase64(imagePath);
        
        const requestData = {
            contents: [
                {
                    parts: [
                        {
                            text: `Analyze this receipt image and extract ALL details. Return ONLY a valid JSON object with this structure:

{
  "merchant": {
    "name": "store name or null if not found",
    "address": "address or null if not found",
    "phone": "phone number or null if not found"
  },
  "transaction": {
    "date": "date or null",
    "time": "time or null", 
    "receipt_number": "receipt number or null",
    "cashier": "cashier name or null"
  },
  "items": [
    {
      "name": "item name",
      "quantity": 1,
      "price": 0.00,
      "total": 0.00
    }
  ],
  "totals": {
    "subtotal": 0.00,
    "tax_amount": 0.00,
    "tax_rate": 0.00,
    "total": 0.00,
    "discount": 0.00
  },
  "payment": {
    "method": "payment method or null",
    "amount_paid": 0.00,
    "change_given": 0.00
  },
  "additional_info": "any other relevant information"
}

If any information is not available, use null. Return ONLY the JSON, no other text.`
                        },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }
            ]
        };

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error calling Gemini API:', error.response?.data || error.message);
        throw new Error('Failed to analyze receipt with Gemini API');
    }
}

app.post('/api/analyze-receipt', upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Processing receipt:', req.file.filename);

        const geminiResponse = await analyzeReceiptWithGemini(req.file.path);
        
        if (!geminiResponse.candidates || !geminiResponse.candidates[0]) {
            throw new Error('Invalid response from Gemini API');
        }

        const summaryText = geminiResponse.candidates[0].content.parts[0].text;
        console.log('Raw Gemini response:', summaryText);
        
        let summary;
        try {
            const cleanedText = summaryText.replace(/```json|```/g, '').trim();
            const parsedSummary = JSON.parse(cleanedText);
            summary = cleanSummary(parsedSummary);
        } catch (parseError) {
            console.log('Could not parse JSON, using raw response');
            summary = { 
                raw_response: summaryText,
                error: "Could not parse AI response as JSON"
            };
        }

        const pdfFilename = `receipt-summary-${Date.now()}.pdf`;
        const pdfPath = await PDFService.createReceiptPDF(summary, pdfFilename);

        res.json({
            success: true,
            summary: summary,
            imageUrl: `/uploads/${req.file.filename}`,
            pdfUrl: `/pdfs/${pdfFilename}`,
            message: 'Receipt analyzed successfully'
        });

    } catch (error) {
        console.error('Error processing receipt:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/analyze-multiple-receipts', upload.array('receipts', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`Processing ${req.files.length} receipts`);

        const analysisResults = [];
        
        for (const file of req.files) {
            try {
                console.log('Processing receipt:', file.filename);
                const geminiResponse = await analyzeReceiptWithGemini(file.path);
                
                if (!geminiResponse.candidates || !geminiResponse.candidates[0]) {
                    throw new Error('Invalid response from Gemini API');
                }

                const summaryText = geminiResponse.candidates[0].content.parts[0].text;
                
                let summary;
                try {
                    const cleanedText = summaryText.replace(/```json|```/g, '').trim();
                    const parsedSummary = JSON.parse(cleanedText);
                    summary = cleanSummary(parsedSummary);
                } catch (parseError) {
                    summary = { 
                        raw_response: summaryText,
                        error: "Could not parse AI response as JSON"
                    };
                }

                analysisResults.push({
                    filename: file.filename,
                    summary: summary,
                    imageUrl: `/uploads/${file.filename}`
                });

            } catch (fileError) {
                console.error(`Error processing file ${file.filename}:`, fileError);
                analysisResults.push({
                    filename: file.filename,
                    error: fileError.message,
                    imageUrl: `/uploads/${file.filename}`
                });
            }
        }

        const combinedPdfFilename = `combined-receipts-${Date.now()}.pdf`;
        const successfulAnalyses = analysisResults.filter(result => !result.error);
        
        if (successfulAnalyses.length > 0) {
            await PDFService.createCombinedPDF(successfulAnalyses, combinedPdfFilename);
        }

        res.json({
            success: true,
            results: analysisResults,
            combinedPdfUrl: successfulAnalyses.length > 0 ? `/pdfs/${combinedPdfFilename}` : null,
            message: `Processed ${analysisResults.length} receipts, ${successfulAnalyses.length} successful`
        });

    } catch (error) {
        console.error('Error processing multiple receipts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Receipt Summarizer server running on http://localhost:${PORT}`);
    console.log('Upload your receipt images to get started!');
});