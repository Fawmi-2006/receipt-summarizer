let currentAnalysisResult = null;
let currentMultipleResults = null;

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
    document.getElementById('filesList').style.display = 'none';
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

async function analyzeReceipt() {
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
    document.getElementById('processingTitle').textContent = title;
    document.getElementById('processingMessage').textContent = message;
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function hideResults() {
    document.getElementById('results').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.scrollIntoView({ behavior: 'smooth' });
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

const uploadArea = document.getElementById('uploadArea');

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