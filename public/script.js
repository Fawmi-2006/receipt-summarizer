let currentAnalysisResult = null;
let currentMultipleResults = null;

// Auth-related functions
function initAuth() {
    checkAuthState();
    setupUserProfile();
}

function checkAuthState() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        showLoginPrompt();
        return false;
    }
    
    showUserProfile(user);
    return true;
}

function showLoginPrompt() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <section class="login-prompt">
            <div class="login-prompt-content">
                <h2>Welcome to ReceiptAI</h2>
                <p>Please sign in to start analyzing your receipts with AI</p>
                <a href="/login" class="login-prompt-btn">
                    <i class="fas fa-sign-in-alt"></i>
                    Sign In to Continue
                </a>
            </div>
        </section>
    `;
    
    // Hide navbar actions that require auth
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
        navActions.innerHTML = `
            <a href="/login" class="auth-btn" style="padding: 0.5rem 1rem; background: var(--primary); color: white; text-decoration: none; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-sign-in-alt"></i>
                Sign In
            </a>
        `;
    }
}

function setupUserProfile() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
        navActions.innerHTML = `
            <div class="user-profile" id="userProfile">
                <div class="user-avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" style="width: 100%; height: 100%; border-radius: 50%;">` : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-info">
                    <span class="user-name">${user.name}</span>
                    <span class="user-email">${user.email}</span>
                </div>
                <div class="user-dropdown" id="userDropdown">
                    <div class="dropdown-item" onclick="handleProfile()">
                        <i class="fas fa-user"></i>
                        Profile
                    </div>
                    <div class="dropdown-item" onclick="handleSettings()">
                        <i class="fas fa-cog"></i>
                        Settings
                    </div>
                    <div class="dropdown-item logout" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </div>
                </div>
            </div>
        `;
        
        // Add dropdown toggle
        const userProfile = document.getElementById('userProfile');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userProfile && userDropdown) {
            userProfile.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.classList.remove('show');
            });
        }
    }
}

function showUserProfile(user) {
    // Update UI to show user is logged in
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = `
            <i class="fas fa-circle"></i>
            <span>Welcome, ${user.name}</span>
        `;
    }
}

function handleProfile() {
    alert('Profile feature coming soon!');
}

function handleSettings() {
    alert('Settings feature coming soon!');
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

// File handling functions
document.getElementById('receiptInput').addEventListener('change', function(e) {
    const files = e.target.files;
    if (files.length > 0) {
        displayFilesInfo(files);
        document.getElementById('analyzeSingleBtn').disabled = false;
        document.getElementById('analyzeMultipleBtn').disabled = false;
        
        if (files.length === 1) {
            previewImage(files[0]);
        }
    }
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function displayFilesInfo(files) {
    const filesList = document.getElementById('filesList');
    const filesContainer = document.getElementById('filesContainer');
    const filesCount = document.getElementById('filesCount');
    
    if (!filesList || !filesContainer || !filesCount) return;
    
    filesContainer.innerHTML = '';
    filesCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''}`;
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-details">
                <div class="file-icon">
                    <i class="fas fa-file-image"></i>
                </div>
                <div class="file-meta">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
            </div>
            <button type="button" class="clear-file" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        filesContainer.appendChild(fileItem);
    });
    
    filesList.style.display = 'block';
}

function removeFile(index) {
    const input = document.getElementById('receiptInput');
    const files = Array.from(input.files);
    files.splice(index, 1);
    
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    input.files = dt.files;
    
    if (files.length === 0) {
        clearFile();
    } else {
        displayFilesInfo(input.files);
        if (files.length === 1) {
            previewImage(files[0]);
        }
    }
}

function clearFile() {
    document.getElementById('receiptInput').value = '';
    const filesList = document.getElementById('filesList');
    if (filesList) filesList.style.display = 'none';
    document.getElementById('analyzeSingleBtn').disabled = true;
    document.getElementById('analyzeMultipleBtn').disabled = true;
    document.getElementById('receiptImage').src = '';
    hideResults();
    hideError();
}

function previewImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('receiptImage').src = e.target.result;
        document.getElementById('fullscreenImage').src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function openFullscreen() {
    const modal = document.getElementById('fullscreenModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    const modal = document.getElementById('fullscreenModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

document.getElementById('fullscreenModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFullscreen();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeFullscreen();
    }
});

// Analysis functions with authentication
async function analyzeReceipt() {
    if (!checkAuthState()) return;
    
    const token = localStorage.getItem('authToken');
    const fileInput = document.getElementById('receiptInput');
    const files = fileInput.files;
    
    if (!files || files.length === 0) {
        showError('Please select at least one receipt image');
        return;
    }

    const formData = new FormData();
    formData.append('receipt', files[0]);

    showLoading('Analyzing Receipt', 'Extracting data using Gemini AI...');
    hideResults();
    hideError();

    try {
        const response = await fetch('/api/analyze-receipt', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            currentAnalysisResult = result;
            displaySingleResult(result);
        } else {
            showError(result.error || 'Failed to analyze receipt');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function analyzeMultipleReceipts() {
    if (!checkAuthState()) return;
    
    const token = localStorage.getItem('authToken');
    const fileInput = document.getElementById('receiptInput');
    const files = fileInput.files;
    
    if (!files || files.length === 0) {
        showError('Please select at least one receipt image');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('receipts', files[i]);
    }

    showLoading('Analyzing Multiple Receipts', `Processing ${files.length} receipts using Gemini AI...`);
    hideResults();
    hideError();

    try {
        const response = await fetch('/api/analyze-multiple-receipts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            currentMultipleResults = result;
            displayMultipleResults(result);
        } else {
            showError(result.error || 'Failed to analyze receipts');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displaySingleResult(result) {
    const resultsDiv = document.getElementById('results');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsSubtitle = document.getElementById('resultsSubtitle');
    const summaryContent = document.getElementById('summaryContent');
    const singleResults = document.getElementById('singleResults');
    const multipleResults = document.getElementById('multipleResults');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadCombinedPdfBtn = document.getElementById('downloadCombinedPdfBtn');
    
    if (!resultsDiv) return;
    
    resultsTitle.textContent = 'Analysis Complete';
    resultsSubtitle.textContent = 'Receipt data successfully extracted and structured';
    
    let formattedSummary;
    if (typeof result.summary === 'object') {
        formattedSummary = JSON.stringify(result.summary, null, 2);
    } else {
        formattedSummary = result.summary;
    }
    
    summaryContent.textContent = formattedSummary;
    
    singleResults.style.display = 'grid';
    multipleResults.style.display = 'none';
    downloadPdfBtn.style.display = 'flex';
    downloadCombinedPdfBtn.style.display = 'none';
    resultsDiv.style.display = 'block';
    
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayMultipleResults(result) {
    const resultsDiv = document.getElementById('results');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsSubtitle = document.getElementById('resultsSubtitle');
    const singleResults = document.getElementById('singleResults');
    const multipleResults = document.getElementById('multipleResults');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadCombinedPdfBtn = document.getElementById('downloadCombinedPdfBtn');
    const totalReceipts = document.getElementById('totalReceipts');
    const successfulReceipts = document.getElementById('successfulReceipts');
    const grandTotal = document.getElementById('grandTotal');
    const receiptsGrid = document.getElementById('receiptsGrid');
    
    if (!resultsDiv) return;
    
    resultsTitle.textContent = 'Multiple Receipts Analysis Complete';
    resultsSubtitle.textContent = result.message;
    
    const successfulResults = result.results.filter(r => !r.error);
    const totalAmount = successfulResults.reduce((sum, r) => {
        return sum + (parseFloat(r.summary.totals?.total) || 0);
    }, 0);
    
    totalReceipts.textContent = result.results.length;
    successfulReceipts.textContent = successfulResults.length;
    grandTotal.textContent = `$${totalAmount.toFixed(2)}`;
    
    receiptsGrid.innerHTML = '';
    
    result.results.forEach((receiptResult, index) => {
        const receiptCard = document.createElement('div');
        receiptCard.className = 'receipt-card';
        
        let summaryContent;
        if (receiptResult.error) {
            summaryContent = `Error: ${receiptResult.error}`;
        } else if (typeof receiptResult.summary === 'object') {
            summaryContent = JSON.stringify(receiptResult.summary, null, 2);
        } else {
            summaryContent = receiptResult.summary;
        }
        
        const merchantName = receiptResult.summary?.merchant?.name || 'Unknown Merchant';
        const totalAmount = receiptResult.summary?.totals?.total ? `$${receiptResult.summary.totals.total}` : 'N/A';
        
        receiptCard.innerHTML = `
            <div class="receipt-card-header">
                <span class="receipt-card-title">Receipt ${index + 1}</span>
                <span class="receipt-card-total">${totalAmount}</span>
            </div>
            <div class="receipt-card-content">
                <div class="receipt-merchant" style="margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary);">
                    ${merchantName}
                </div>
                <div class="receipt-card-data">
                    ${summaryContent}
                </div>
            </div>
        `;
        
        receiptsGrid.appendChild(receiptCard);
    });
    
    singleResults.style.display = 'none';
    multipleResults.style.display = 'block';
    downloadPdfBtn.style.display = 'none';
    downloadCombinedPdfBtn.style.display = result.combinedPdfUrl ? 'flex' : 'none';
    resultsDiv.style.display = 'block';
    
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function downloadPDF() {
    if (currentAnalysisResult && currentAnalysisResult.pdfUrl) {
        window.open(currentAnalysisResult.pdfUrl, '_blank');
    }
}

function downloadCombinedPDF() {
    if (currentMultipleResults && currentMultipleResults.combinedPdfUrl) {
        window.open(currentMultipleResults.combinedPdfUrl, '_blank');
    }
}

function showLoading(title, message) {
    const processingTitle = document.getElementById('processingTitle');
    const processingMessage = document.getElementById('processingMessage');
    const loading = document.getElementById('loading');
    
    if (processingTitle) processingTitle.textContent = title;
    if (processingMessage) processingMessage.textContent = message;
    if (loading) loading.style.display = 'block';
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
}

function hideResults() {
    const results = document.getElementById('results');
    if (results) results.style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    if (!errorDiv || !errorMessage) return;
    
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.scrollIntoView({ behavior: 'smooth' });
}

function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) errorDiv.style.display = 'none';
}

// Drag and drop functionality
const uploadArea = document.getElementById('uploadArea');

if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
        uploadArea.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-light)';
        uploadArea.style.background = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-light)';
        uploadArea.style.background = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                const dt = new DataTransfer();
                imageFiles.forEach(file => dt.items.add(file));
                document.getElementById('receiptInput').files = dt.files;
                displayFilesInfo(dt.files);
                document.getElementById('analyzeSingleBtn').disabled = false;
                document.getElementById('analyzeMultipleBtn').disabled = false;
                
                if (imageFiles.length === 1) {
                    previewImage(imageFiles[0]);
                }
            } else {
                showError('Please drop image files only');
            }
        }
    });
}

// Check for OAuth token in URL (Google login callback)
function checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        localStorage.setItem('authToken', token);
        // Fetch user profile
        fetchUserProfile();
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function fetchUserProfile() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        if (result.success) {
            localStorage.setItem('user', JSON.stringify(result.user));
            window.location.reload(); // Refresh to show authenticated state
        }
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check for OAuth callback first
    checkOAuthCallback();
    
    // Initialize authentication
    initAuth();
    
    // Only initialize file handling if user is authenticated
    if (checkAuthState()) {
        // File input event listener is already set up above
        console.log('ReceiptAI initialized successfully');
    }
});