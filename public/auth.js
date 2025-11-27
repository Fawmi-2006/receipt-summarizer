class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthState();
    }

    bindEvents() {
        // Form submissions
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
        
        // Form switching
        document.getElementById('showRegister')?.addEventListener('click', (e) => this.showRegisterForm(e));
        document.getElementById('showLogin')?.addEventListener('click', (e) => this.showLoginForm(e));
        
        // Google auth
        document.getElementById('googleSignIn')?.addEventListener('click', () => this.handleGoogleAuth());
        document.getElementById('googleSignUp')?.addEventListener('click', () => this.handleGoogleAuth());
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        await this.authenticate('/api/auth/login', credentials);
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password')
        };

        await this.authenticate('/api/auth/register', userData);
    }

    async authenticate(endpoint, data) {
        const button = event.submitter;
        const originalText = button.innerHTML;
        
        try {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            button.disabled = true;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.setAuthToken(result.token);
                this.setUser(result.user);
                this.redirectToApp();
            } else {
                this.showError(result.error || 'Authentication failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    handleGoogleAuth() {
        // Redirect to Google OAuth - CORRECT URL
        console.log('Initiating Google OAuth...');
        window.location.href = '/api/auth/google';
    }

    setAuthToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    setUser(user) {
        this.user = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    checkAuthState() {
        // If we have a token in URL (Google OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const success = urlParams.get('success');
        
        if (token && success) {
            console.log('OAuth callback received token');
            this.setAuthToken(token);
            this.fetchUserProfile();
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // If already logged in and on login page, redirect to app
        if (this.token && window.location.pathname === '/login') {
            this.redirectToApp();
        }
    }

    async fetchUserProfile() {
        try {
            console.log('Fetching user profile...');
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const result = await response.json();
            if (result.success) {
                this.setUser(result.user);
                this.redirectToApp();
            } else {
                this.showError('Failed to load user profile');
            }
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            this.showError('Network error loading profile');
        }
    }

    redirectToApp() {
        console.log('Redirecting to app...');
        window.location.href = '/';
    }

    showLoginForm(e) {
        e.preventDefault();
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('registerSection').style.display = 'none';
    }

    showRegisterForm(e) {
        e.preventDefault();
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('registerSection').style.display = 'block';
    }

    showError(message) {
        // Simple error display
        alert('Error: ' + message);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});