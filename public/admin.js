class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
        this.currentPage = 1;
        this.currentTab = 'dashboard';
        this.init();
    }

    init() {
        this.checkAdminAccess();
        this.bindEvents();
        this.loadDashboard();
        this.setupUserProfile();
    }

    async checkAdminAccess() {
        if (!this.token || !this.currentUser) {
            window.location.href = '/login';
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();
            
            if (!result.success || result.user.role !== 'admin') {
                window.location.href = '/';
                return;
            }

            this.currentUser = result.user;
        } catch (error) {
            console.error('Admin access check failed:', error);
            window.location.href = '/';
        }
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // User search
        document.getElementById('userSearch')?.addEventListener('input', (e) => {
            this.debounce(() => this.searchUsers(e.target.value), 300);
        });

        // Filters
        document.getElementById('roleFilter')?.addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('statusFilter')?.addEventListener('change', () => {
            this.loadUsers();
        });
    }

    setupUserProfile() {
        const navActions = document.querySelector('.nav-actions');
        if (navActions && this.currentUser) {
            navActions.innerHTML = `
                <div class="user-profile" id="userProfile">
                    <div class="user-avatar">
                        ${this.currentUser.avatar ? 
                            `<img src="${this.currentUser.avatar}" alt="${this.currentUser.name}" style="width: 100%; height: 100%; border-radius: 50%;">` : 
                            this.currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <span class="user-name">${this.currentUser.name} (Admin)</span>
                        <span class="user-email">${this.currentUser.email}</span>
                    </div>
                    <div class="user-dropdown" id="userDropdown">
                        <div class="dropdown-item" onclick="adminPanel.goToApp()">
                            <i class="fas fa-home"></i>
                            Go to App
                        </div>
                        <div class="dropdown-item" onclick="adminPanel.handleLogout()">
                            <i class="fas fa-sign-out-alt"></i>
                            Logout
                        </div>
                    </div>
                </div>
            `;

            // Setup dropdown toggle
            const userProfile = document.getElementById('userProfile');
            const userDropdown = document.getElementById('userDropdown');
            
            if (userProfile && userDropdown) {
                userProfile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    userDropdown.classList.toggle('show');
                });

                document.addEventListener('click', () => {
                    userDropdown.classList.remove('show');
                });
            }
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active content
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab content
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderDashboard(result.stats, result.recentUsers);
            } else {
                this.showError('Failed to load dashboard');
            }
        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('Failed to load dashboard');
        }
    }

    renderDashboard(stats, recentUsers) {
        // Render stats
        const statsGrid = document.getElementById('statsGrid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon total-users">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${stats.totalUsers}</h3>
                        <p>Total Users</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon active-users">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${stats.activeUsers}</h3>
                        <p>Active Users</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon new-users">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${stats.newUsers}</h3>
                        <p>New Users (30d)</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon admin-users">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${stats.adminUsers}</h3>
                        <p>Admin Users</p>
                    </div>
                </div>
            `;
        }

        // Render recent users
        const recentUsersTable = document.getElementById('recentUsersTable');
        if (recentUsersTable) {
            if (recentUsers.length === 0) {
                recentUsersTable.innerHTML = '<p class="no-data">No users found</p>';
                return;
            }

            recentUsersTable.innerHTML = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentUsers.map(user => `
                            <tr>
                                <td>
                                    <div class="user-cell">
                                        <div class="user-avatar-small">
                                            ${user.avatar ? 
                                                `<img src="${user.avatar}" alt="${user.name}">` : 
                                                user.name.charAt(0).toUpperCase()}
                                        </div>
                                        ${user.name}
                                    </div>
                                </td>
                                <td>${user.email}</td>
                                <td>
                                    <span class="role-badge ${user.role}">
                                        ${user.role}
                                    </span>
                                </td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    async loadUsers(page = 1) {
        this.currentPage = page;
        
        const roleFilter = document.getElementById('roleFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        
        let url = `/api/admin/users?page=${page}&limit=10`;
        if (roleFilter) url += `&role=${roleFilter}`;
        if (statusFilter) url += `&status=${statusFilter}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderUsers(result.users, result.pagination);
            } else {
                this.showError('Failed to load users');
            }
        } catch (error) {
            console.error('Users load error:', error);
            this.showError('Failed to load users');
        }
    }

    renderUsers(users, pagination) {
        const tableBody = document.getElementById('usersTableBody');
        const paginationEl = document.getElementById('usersPagination');

        if (!tableBody) return;

        if (users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">No users found</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-small">
                            ${user.avatar ? 
                                `<img src="${user.avatar}" alt="${user.name}">` : 
                                user.name.charAt(0).toUpperCase()}
                        </div>
                        ${user.name}
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="role-badge ${user.role}">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="adminPanel.viewUser('${user._id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn ${user.role === 'admin' ? 'demote' : 'promote'}" 
                                onclick="adminPanel.toggleRole('${user._id}', '${user.role}')"
                                title="${user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}">
                            <i class="fas ${user.role === 'admin' ? 'fa-user' : 'fa-shield-alt'}"></i>
                        </button>
                        <button class="action-btn ${user.isActive ? 'deactivate' : 'activate'}" 
                                onclick="adminPanel.toggleStatus('${user._id}', ${user.isActive})"
                                title="${user.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${user.isActive ? 'fa-user-slash' : 'fa-user-check'}"></i>
                        </button>
                        <button class="action-btn delete" onclick="adminPanel.deleteUser('${user._id}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Render pagination
        if (paginationEl) {
            let paginationHTML = '';

            if (pagination.hasPrev) {
                paginationHTML += `<button class="pagination-btn" onclick="adminPanel.loadUsers(${pagination.currentPage - 1})">Previous</button>`;
            }

            paginationHTML += `<span class="pagination-info">Page ${pagination.currentPage} of ${pagination.totalPages}</span>`;

            if (pagination.hasNext) {
                paginationHTML += `<button class="pagination-btn" onclick="adminPanel.loadUsers(${pagination.currentPage + 1})">Next</button>`;
            }

            paginationEl.innerHTML = paginationHTML;
        }
    }

    async searchUsers(query) {
        if (!query.trim()) {
            this.loadUsers();
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderSearchResults(result.users);
            } else {
                this.showError('Search failed');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed');
        }
    }

    renderSearchResults(users) {
        const tableBody = document.getElementById('usersTableBody');
        const paginationEl = document.getElementById('usersPagination');

        if (!tableBody) return;

        if (users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">No users found matching your search</td>
                </tr>
            `;
            paginationEl.innerHTML = '';
            return;
        }

        this.renderUsers(users, { currentPage: 1, totalPages: 1 });
    }

    async viewUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showUserModal(result.user);
            } else {
                this.showError('Failed to load user details');
            }
        } catch (error) {
            console.error('View user error:', error);
            this.showError('Failed to load user details');
        }
    }

    showUserModal(user) {
        const modal = document.getElementById('userModal');
        const modalBody = document.getElementById('userModalBody');

        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="user-details">
                    <div class="user-detail-header">
                        <div class="user-avatar-large">
                            ${user.avatar ? 
                                `<img src="${user.avatar}" alt="${user.name}">` : 
                                user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="user-detail-info">
                            <h4>${user.name}</h4>
                            <p>${user.email}</p>
                            <div class="user-tags">
                                <span class="role-badge ${user.role}">${user.role}</span>
                                <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                                    ${user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="user-detail-stats">
                        <div class="detail-stat">
                            <label>Joined</label>
                            <span>${new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div class="detail-stat">
                            <label>Last Updated</label>
                            <span>${new Date(user.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div class="detail-stat">
                            <label>Last Login</label>
                            <span>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</span>
                        </div>
                        <div class="detail-stat">
                            <label>Login Count</label>
                            <span>${user.loginCount || 0}</span>
                        </div>
                    </div>

                    ${user.googleId ? `
                        <div class="user-auth-info">
                            <h5>Authentication</h5>
                            <p><i class="fab fa-google"></i> Google OAuth User</p>
                            <small>Google ID: ${user.googleId}</small>
                        </div>
                    ` : ''}
                </div>
            `;

            modal.style.display = 'flex';
        }
    }

    closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async toggleRole(userId, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        
        if (!confirm(`Are you sure you want to ${newRole === 'admin' ? 'promote' : 'demote'} this user to ${newRole}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.message);
                this.loadUsers(this.currentPage);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Toggle role error:', error);
            this.showError('Failed to update user role');
        }
    }

    async toggleStatus(userId, isCurrentlyActive) {
        const action = isCurrentlyActive ? 'deactivate' : 'activate';
        
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.message);
                this.loadUsers(this.currentPage);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Toggle status error:', error);
            this.showError('Failed to update user status');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.message);
                this.loadUsers(this.currentPage);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Delete user error:', error);
            this.showError('Failed to delete user');
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/admin/analytics', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderAnalytics(result.analytics);
            } else {
                this.showError('Failed to load analytics');
            }
        } catch (error) {
            console.error('Analytics load error:', error);
            this.showError('Failed to load analytics');
        }
    }

    renderAnalytics(analytics) {
        const analyticsGrid = document.getElementById('analyticsGrid');
        if (!analyticsGrid) return;

        analyticsGrid.innerHTML = `
            <div class="analytics-section">
                <h3>User Growth (Last 7 Days)</h3>
                <div class="growth-chart">
                    ${analytics.userGrowth.length > 0 ? 
                        analytics.userGrowth.map(day => `
                            <div class="growth-bar">
                                <div class="bar" style="height: ${(day.count / Math.max(...analytics.userGrowth.map(d => d.count))) * 100}%"></div>
                                <span class="bar-label">${day._id}</span>
                                <span class="bar-value">${day.count}</span>
                            </div>
                        `).join('') :
                        '<p class="no-data">No data available</p>'
                    }
                </div>
            </div>

            <div class="analytics-section">
                <h3>User Role Distribution</h3>
                <div class="role-distribution">
                    ${analytics.roleDistribution.map(role => `
                        <div class="role-item">
                            <span class="role-name">${role._id}</span>
                            <span class="role-count">${role.count} users</span>
                            <div class="role-bar" style="width: ${(role.count / analytics.roleDistribution.reduce((sum, r) => sum + r.count, 0)) * 100}%"></div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="analytics-section">
                <h3>User Status Distribution</h3>
                <div class="status-distribution">
                    ${analytics.statusDistribution.map(status => `
                        <div class="status-item">
                            <span class="status-name">${status._id ? 'Active' : 'Inactive'}</span>
                            <span class="status-count">${status.count} users</span>
                            <div class="status-bar ${status._id ? 'active' : 'inactive'}" 
                                 style="width: ${(status.count / analytics.statusDistribution.reduce((sum, s) => sum + s.count, 0)) * 100}%"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    goToApp() {
        window.location.href = '/';
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }

    showSuccess(message) {
        // Simple success notification
        alert('Success: ' + message);
    }

    showError(message) {
        // Simple error notification
        alert('Error: ' + message);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize admin panel when DOM is loaded
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('userModal');
    if (e.target === modal) {
        adminPanel.closeUserModal();
    }
});

// Add global function to close modal with escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        adminPanel.closeUserModal();
    }
});