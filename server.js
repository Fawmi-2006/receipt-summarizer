const express = require('express');
const multer = require('multer');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
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

function createPDF(summary, filename) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const pdfPath = path.join('pdfs', filename);
            const stream = fs.createWriteStream(pdfPath);
            
            doc.pipe(stream);

            doc.fontSize(20).font('Helvetica-Bold').fillColor('#2c3e50').text('Receipt Summary', 100, 100);
            doc.moveDown();
            
            const cleanedSummary = cleanSummary(summary);
            
            if (cleanedSummary.merchant && Object.keys(cleanedSummary.merchant).length > 0) {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#34495e').text('Merchant Information', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
                
                if (cleanedSummary.merchant.name) doc.text(`Name: ${cleanedSummary.merchant.name}`);
                if (cleanedSummary.merchant.address) doc.text(`Address: ${cleanedSummary.merchant.address}`);
                if (cleanedSummary.merchant.phone) doc.text(`Phone: ${cleanedSummary.merchant.phone}`);
                doc.moveDown();
            }

            if (cleanedSummary.transaction && Object.keys(cleanedSummary.transaction).length > 0) {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#34495e').text('Transaction Details', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
                
                if (cleanedSummary.transaction.date) doc.text(`Date: ${cleanedSummary.transaction.date}`);
                if (cleanedSummary.transaction.time) doc.text(`Time: ${cleanedSummary.transaction.time}`);
                if (cleanedSummary.transaction.receipt_number) doc.text(`Receipt #: ${cleanedSummary.transaction.receipt_number}`);
                if (cleanedSummary.transaction.cashier) doc.text(`Cashier: ${cleanedSummary.transaction.cashier}`);
                doc.moveDown();
            }

            if (cleanedSummary.items && cleanedSummary.items.length > 0) {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#34495e').text('Items Purchased', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
                
                cleanedSummary.items.forEach((item, index) => {
                    doc.text(`${index + 1}. ${item.name} - Qty: ${item.quantity} - Price: $${item.price} - Total: $${item.total}`);
                });
                doc.moveDown();
            }

            if (cleanedSummary.totals && Object.keys(cleanedSummary.totals).length > 0) {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#34495e').text('Totals', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
                
                if (cleanedSummary.totals.subtotal) doc.text(`Subtotal: $${cleanedSummary.totals.subtotal}`);
                if (cleanedSummary.totals.tax_amount) doc.text(`Tax Amount: $${cleanedSummary.totals.tax_amount}`);
                if (cleanedSummary.totals.tax_rate) doc.text(`Tax Rate: ${cleanedSummary.totals.tax_rate}%`);
                if (cleanedSummary.totals.discount) doc.text(`Discount: $${cleanedSummary.totals.discount}`);
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#e74c3c');
                if (cleanedSummary.totals.total) doc.text(`TOTAL: $${cleanedSummary.totals.total}`);
                doc.moveDown();
            }

            if (cleanedSummary.payment && Object.keys(cleanedSummary.payment).length > 0) {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#34495e').text('Payment', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
                
                if (cleanedSummary.payment.method) doc.text(`Method: ${cleanedSummary.payment.method}`);
                if (cleanedSummary.payment.amount_paid) doc.text(`Amount Paid: $${cleanedSummary.payment.amount_paid}`);
                if (cleanedSummary.payment.change_given) doc.text(`Change Given: $${cleanedSummary.payment.change_given}`);
            }

            if (cleanedSummary.additional_info) {
                doc.moveDown();
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#34495e').text('Additional Information', 100, doc.y);
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').fillColor('#2c3e50').text(cleanedSummary.additional_info);
            }

            doc.end();

            stream.on('finish', () => {
                resolve(pdfPath);
            });

            stream.on('error', (error) => {
                reject(error);
            });

        } catch (error) {
            reject(error);
        }
    });
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
        const pdfPath = await createPDF(summary, pdfFilename);

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Receipt Summarizer server running on http://localhost:${PORT}`);
    console.log('Upload your receipt images to get started!');
});