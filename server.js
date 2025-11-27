const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const PDFService = require('./services/pdfService');
require('dotenv').config();

// Import database and auth
const connectDB = require('./config/database');
require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/pdfs', express.static('pdfs'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.path.includes('auth')) {
    console.log(`[AUTH DEBUG] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log(`[AUTH DEBUG] Query:`, req.query);
    console.log(`[AUTH DEBUG] Body:`, req.body);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);

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

// Import auth middleware
const auth = require('./middleware/auth');


// Protected routes - require authentication
app.post('/api/analyze-receipt', auth, upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Processing receipt for user:', req.user.email, 'File:', req.file.filename);

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

app.post('/api/analyze-multiple-receipts', auth, upload.array('receipts', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`Processing ${req.files.length} receipts for user:`, req.user.email);

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

// Public route for checking server status
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login page (you might want to create this)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle Google OAuth callback
app.get('/auth/google/callback', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'oauth-callback.html'));
});

app.get('/oauth-callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'oauth-callback.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  console.error('Error stack:', error.stack);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    // Only show details in development
    ...(process.env.NODE_ENV === 'development' && {
      details: error.message,
      stack: error.stack
    })
  });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

app.use((req, res, next) => {
  if (req.path.includes('auth')) {
    console.log(`[AUTH] ${req.method} ${req.path}`);
  }
  next();
});

app.listen(PORT, () => {
    console.log(`Receipt Summarizer server running on http://localhost:${PORT}`);
    console.log('Database connected successfully');
    console.log('Authentication system ready');
});