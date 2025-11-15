let currentAnalysisResult = null;

document.getElementById('receiptInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        displayFileInfo(file);
        previewImage(file);
        document.getElementById('analyzeBtn').disabled = false;
    }
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function displayFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'flex';
}

function clearFile() {
    document.getElementById('receiptInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
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
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a receipt image first');
        return;
    }

    const formData = new FormData();
    formData.append('receipt', file);

    showLoading();
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
            displayResults(result);
        } else {
            showError(result.error || 'Failed to analyze receipt');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayResults(result) {
    const resultsDiv = document.getElementById('results');
    const summaryContent = document.getElementById('summaryContent');
    
    let formattedSummary;
    if (typeof result.summary === 'object') {
        formattedSummary = JSON.stringify(result.summary, null, 2);
    } else {
        formattedSummary = result.summary;
    }
    
    summaryContent.textContent = formattedSummary;
    resultsDiv.style.display = 'block';
    
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function downloadPDF() {
    if (currentAnalysisResult && currentAnalysisResult.pdfUrl) {
        window.open(currentAnalysisResult.pdfUrl, '_blank');
    }
}

function showLoading() {
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
        const file = files[0];
        if (file.type.startsWith('image/')) {
            document.getElementById('receiptInput').files = files;
            displayFileInfo(file);
            previewImage(file);
            document.getElementById('analyzeBtn').disabled = false;
        } else {
            showError('Please drop an image file');
        }
    }
});