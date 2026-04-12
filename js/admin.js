// J7 Creations - Admin JavaScript

let authToken = localStorage.getItem('j7_admin_token');

// Check if already logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showSubmissions();
    }
});

// Login Form Handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        
        try {
            // Test the password by fetching submissions
            const response = await fetch('/api/admin/submissions', {
                headers: {
                    'Authorization': `Bearer ${password}`
                }
            });
            
            if (response.ok) {
                authToken = password;
                localStorage.setItem('j7_admin_token', password);
                showSubmissions();
            } else {
                alert('Invalid password');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });
}

// Logout Handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('j7_admin_token');
        authToken = null;
        window.location.reload();
    });
}

// Refresh Handler
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', showSubmissions);
}

// Show Submissions
async function showSubmissions() {
    const loginSection = document.getElementById('login-section');
    const submissionsSection = document.getElementById('submissions-section');
    
    if (loginSection) loginSection.style.display = 'none';
    if (submissionsSection) submissionsSection.style.display = 'block';
    
    const submissionsList = document.getElementById('submissions-list');
    if (!submissionsList) return;
    
    submissionsList.innerHTML = '<div class="loading">Loading submissions...</div>';
    
    try {
        const response = await fetch('/api/admin/submissions', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Unauthorized');
        }
        
        const data = await response.json();
        
        if (data.submissions && data.submissions.length > 0) {
            submissionsList.innerHTML = data.submissions.map(sub => createSubmissionCard(sub)).join('');
            
            // Add delete event listeners
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm('Are you sure you want to delete this submission?')) {
                        await deleteSubmission(id);
                    }
                });
            });
        } else {
            submissionsList.innerHTML = '<div class="no-submissions">No submissions yet.</div>';
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsList.innerHTML = '<div class="no-submissions">Error loading submissions. Please refresh.</div>';
    }
}

// Create Submission Card HTML
function createSubmissionCard(sub) {
    const date = new Date(sub.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div>
                    <h3>${escapeHtml(sub.name)}</h3>
                    <p class="submission-date">${date}</p>
                </div>
                <div class="submission-actions">
                    <span class="status-badge status-${sub.status || 'new'}">${sub.status || 'New'}</span>
                    <a href="mailto:${escapeHtml(sub.email)}" class="btn btn-secondary">Email</a>
                    ${sub.phone ? `<a href="tel:${escapeHtml(sub.phone)}" class="btn btn-secondary">Call</a>` : ''}
                    <button class="btn btn-secondary delete-btn" data-id="${sub.id}">Delete</button>
                </div>
            </div>
            <div class="submission-meta">
                <div class="meta-item">
                    <strong>Email</strong>
                    <a href="mailto:${escapeHtml(sub.email)}">${escapeHtml(sub.email)}</a>
                </div>
                ${sub.phone ? `
                <div class="meta-item">
                    <strong>Phone</strong>
                    <a href="tel:${escapeHtml(sub.phone)}">${escapeHtml(sub.phone)}</a>
                </div>
                ` : ''}
                <div class="meta-item">
                    <strong>Service</strong>
                    <span>${formatService(sub.service)}</span>
                </div>
            </div>
            <div class="submission-message">
                ${escapeHtml(sub.message)}
            </div>
        </div>
    `;
}

// Delete Submission
async function deleteSubmission(id) {
    try {
        const response = await fetch(`/api/admin/submissions/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showSubmissions(); // Refresh list
        } else {
            alert('Failed to delete submission');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete submission');
    }
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Format service name
function formatService(service) {
    const services = {
        '3d-printing': '3D Printing',
        'network-infrastructure': 'Network Infrastructure',
        'fabrication': 'Fabrication',
        'installation': 'Installation',
        'other': 'Other'
    };
    return services[service] || service;
}
