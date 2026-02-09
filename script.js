const API_URL = window.API_URL || 'http://localhost:5000/api';
console.log('Status Drafter Script Loaded - v2.0 Task Architecture');

// --- Auth Utilities ---

function showLogin(role) {
    document.getElementById('landing-options').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');

    // Set UI for specific role
    const titleEl = document.getElementById('login-title');
    const roleInput = document.getElementById('selected-role');
    const submitBtn = document.getElementById('login-submit-btn');

    if (role === 'manager') {
        titleEl.textContent = 'Manager Login';
        titleEl.style.color = 'var(--secondary-color)';
        submitBtn.style.background = 'var(--secondary-color)';
        submitBtn.style.borderColor = 'var(--secondary-color)';
        roleInput.value = 'manager';
    } else {
        titleEl.textContent = 'Employee Login';
        titleEl.style.color = 'var(--primary-color)';
        submitBtn.style.background = 'var(--primary-color)';
        submitBtn.style.borderColor = 'var(--primary-color)';
        roleInput.value = 'employee';
    }
}

function backToLanding() {
    document.getElementById('landing-options').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
}

function toggleAuth(mode) {
    const landing = document.getElementById('landing-options');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (mode === 'signup') {
        landing.classList.add('hidden');
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    } else {
        // Default back to landing when cancelling signup
        landing.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const selectedRole = document.getElementById('selected-role').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Login failed');

        // Check against selected portal
        if (data.user.role !== selectedRole) {
            showToast(`Invalid access. Please use the ${data.user.role === 'manager' ? 'Manager' : 'Employee'} login.`, 'error');
            return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        showToast('Login successful!');

        setTimeout(() => {
            if (data.user.role === 'manager') window.location.href = 'manager.html';
            else window.location.href = 'employee.html';
        }, 1000);

    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const role = document.getElementById('signup-role').value;
    const password = document.getElementById('signup-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Signup failed');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        showToast('Account created! Redirecting...');

        setTimeout(() => {
            if (data.user.role === 'manager') window.location.href = 'manager.html';
            else window.location.href = 'employee.html';
        }, 1000);

    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function checkAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'index.html';
        return;
    }

    if (requiredRole && user.role !== requiredRole) {
        // Redirect if wrong role
        if (user.role === 'employee') window.location.href = 'employee.html';
        else if (user.role === 'manager') window.location.href = 'manager.html';
        return;
    }

    // Update UI if element exists
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl) greetingEl.textContent = `Hello, ${user.name.split(' ')[0]}`;

    // Request notification permissions
    requestNotificationPermission();
}

// --- Sidebar Toggle ---
function toggleSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
}


// --- Employee Features ---

async function loadEmployeeDashboard() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load dashboard');

        const tasks = await res.json();

        // Client-side filtering because API returns a flat list
        const pending = tasks.filter(t => t.status === 'pending');
        const waiting = tasks.filter(t => t.status === 'waiting');
        const completed = tasks.filter(t => t.status === 'completed');

        renderColumn('pending', pending);
        renderColumn('waiting', waiting);
        renderColumn('completed', completed);

    } catch (err) {
        console.error('Error loading dashboard:', err);
        showToast('Failed to load tasks', 'error');
    }
}

function renderColumn(type, tasks) {
    const listEl = document.getElementById(`${type}-list`);
    const countEl = document.getElementById(`${type}-count`);

    if (countEl) countEl.textContent = tasks.length;
    if (!listEl) return;

    if (tasks.length === 0) {
        listEl.innerHTML = `<div class="text-center text-muted p-2" style="font-size: 0.85rem;">No tasks</div>`;
        return;
    }

    // specific check: if the list currently has the "No tasks" placeholder, clear it
    if (listEl.children.length > 0 && listEl.children[0].classList.contains('text-center')) {
        listEl.innerHTML = '';
    }

    // 1. Get existing task IDs in DOM
    const existingIds = new Set(Array.from(listEl.children).map(el => el.id.replace('task-', '')));

    // 2. Identify new tasks and tasks to remove
    const incomingIds = new Set(tasks.map(t => t._id));

    // Remove tasks that are no longer in this column
    Array.from(listEl.children).forEach(el => {
        const id = el.id.replace('task-', '');
        if (!incomingIds.has(id)) {
            el.remove();
        }
    });

    // 3. Add or Update tasks
    tasks.forEach(task => {
        const taskId = task._id;

        let actions = '';
        let extraInfo = '';

        // Assigned Task Badge construction
        if (task.isAssigned) {
            extraInfo += `
                <div class="mt-1 flex items-center gap-2">
                    <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.7rem;">
                        👤 Assigned by Manager
                    </span>
                    ${task.deadline ? `<span class="text-xs text-muted">🕒 ${new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                </div>`;
        }

        if (type === 'pending') {
            actions = `
                <button onclick="openBlockerModal('${task._id}')" class="btn btn-outline btn-xs" style="color: var(--warning-color); border-color: var(--warning-color);">Wait</button>
                <button onclick="updateTaskStatus('${task._id}', 'completed')" class="btn btn-outline btn-xs" style="color: var(--success-color); border-color: var(--success-color);">Done</button>
            `;
        } else if (type === 'waiting') {
            extraInfo += `<div class="text-muted" style="font-size: 0.75rem; font-style: italic;">(${task.blockerReason || 'Reason N/A'})</div>`;
            actions = `
                <button onclick="updateTaskStatus('${task._id}', 'pending')" class="btn btn-outline btn-xs">Unblock</button>
                <button onclick="updateTaskStatus('${task._id}', 'completed')" class="btn btn-outline btn-xs" style="color: var(--success-color); border-color: var(--success-color);">Done</button>
            `;
        } else if (type === 'completed') {
            actions = `<span class="text-muted" style="font-size: 0.75rem;">${new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        }

        // Manager Reply construction
        if (task.managerReply) {
            const replyDate = task.managerReplyAt || task.updatedAt;
            const cleanReply = task.managerReply.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const cleanDate = new Date(replyDate).toISOString();

            extraInfo += `
                <div class="mt-2">
                    <button onclick="openViewReplyModal('${cleanReply}', '${cleanDate}')" 
                        class="btn btn-xs btn-outline" 
                        style="color: ${task.isFeedbackEdited ? '#ea580c' : 'var(--primary-color)'}; border-color: ${task.isFeedbackEdited ? '#ea580c' : 'var(--primary-color)'}; background: ${task.isFeedbackEdited ? '#fff7ed' : '#f0f9ff'};">
                        ${task.isFeedbackEdited ? '📝 Feedback Updated' : '📩 View Manager Reply'}
                    </button>
                    ${task.isFeedbackEdited ? '<span class="text-xs text-muted ml-2">(Edited)</span>' : ''}
                </div>`;
        }

        // Check if exists
        let taskEl = document.getElementById(`task-${taskId}`);
        if (!taskEl) {
            taskEl = document.createElement('div');
            taskEl.id = `task-${taskId}`;
            taskEl.className = 'card p-2 mb-2 task-item flex justify-between items-center';
            taskEl.style.borderLeft = `4px solid ${getCategoryColor(type)}`;
            taskEl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            taskEl.style.animation = 'slideIn 0.3s ease-out';
            taskEl.innerHTML = `
                <div class="task-content" style="flex: 1; padding-right: 10px;">
                    <div class="task-text" style="font-weight: 500; font-size: 0.95rem; cursor: pointer;"></div>
                    <div class="task-extra"></div>
                </div>
                <div class="task-actions flex items-center gap-2"></div>
            `;
            listEl.appendChild(taskEl);
        }

        // Update Text
        const textEl = taskEl.querySelector('.task-text');
        if (textEl && textEl.textContent !== task.text) {
            textEl.textContent = task.text;
            textEl.onclick = () => openEditModal(task._id, task.text.replace(/'/g, "\\'"), type, (task.blockerReason || '').replace(/'/g, "\\'"));
        }

        // Update Extra Info (Badges, Replies) - Use simple HTML check for simplicity here but scoped
        const extraEl = taskEl.querySelector('.task-extra');
        if (extraEl && extraEl.innerHTML !== extraInfo) {
            extraEl.innerHTML = extraInfo;
        }

        // Update Actions
        const actionsEl = taskEl.querySelector('.task-actions');
        const deleteBtnHtml = `<button onclick="openDeleteModal('${task._id}', event)" class="btn btn-xs" style="background: none; border: none; color: var(--danger-color); font-size: 1.2rem; line-height: 1; cursor: pointer;">&times;</button>`;
        const finalActionsHtml = actions + deleteBtnHtml;
        if (actionsEl && actionsEl.innerHTML !== finalActionsHtml) {
            actionsEl.innerHTML = finalActionsHtml;
        }
    });
}

function getCategoryColor(type) {
    if (type === 'completed') return 'var(--success-color)';
    if (type === 'pending') return 'var(--primary-color)';
    if (type === 'waiting') return 'var(--danger-color)';
    return '#ccc';
}

async function checkAndAddTask() {
    const input = document.getElementById('new-task-input');
    const statusSelect = document.getElementById('new-task-status');
    const text = input.value.trim();
    const status = statusSelect.value;
    const token = localStorage.getItem('token');

    if (!text) return showToast('Please enter a task', 'error');

    let body = { text, status };

    // --- Optimistic UI ---
    const tempId = 'temp-' + Date.now();
    const listEl = document.getElementById(`${status}-list`);

    const ghostEl = document.createElement('div');
    ghostEl.id = `task-${tempId}`;
    ghostEl.className = 'card p-2 mb-2 task-item flex justify-between items-center opacity-50'; // Dimmed
    ghostEl.style.borderLeft = `4px solid ${getCategoryColor(status)}`;
    ghostEl.innerHTML = `
        <div style="flex: 1; padding-right: 10px;">
            <div style="font-weight: 500; font-size: 0.95rem;">${text} <span class="text-xs italic">(Saving...)</span></div>
        </div>
    `;

    if (status === 'waiting') {
        // Show modal instead of prompt
        openBlockerModal(tempId, true, body, ghostEl);
        input.value = '';
        return;
    }

    if (listEl) {
        if (listEl.children.length === 1 && listEl.children[0].classList.contains('text-center')) {
            listEl.innerHTML = '';
        }
    }
    listEl.prepend(ghostEl);
    input.value = '';

    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Failed to create task');

        ghostEl.remove();
        loadEmployeeDashboard(); // Final sync
        showToast('Task added');

    } catch (err) {
        ghostEl.remove();
        showToast(err.message, 'error');
    }
}

// Global variables for blocking/task planning
let currentBlockingTaskId = null;
let isAddingNewTask = false;
let pendingNewTaskBody = null;
let pendingNewTaskGhost = null;

function openBlockerModal(taskId, isNewTask = false, taskBody = null, ghostEl = null) {
    currentBlockingTaskId = taskId;
    isAddingNewTask = isNewTask;
    pendingNewTaskBody = taskBody;
    pendingNewTaskGhost = ghostEl;

    document.getElementById('blocker-modal').classList.remove('hidden');
    document.getElementById('blocker-reason').value = '';
    document.getElementById('blocker-reason').focus();
}

function closeBlockerModal() {
    document.getElementById('blocker-modal').classList.add('hidden');
    currentBlockingTaskId = null;
    isAddingNewTask = false; // Reset these when modal closes
    pendingNewTaskBody = null;
    pendingNewTaskGhost = null;
}

async function confirmBlocker() {
    const reason = document.getElementById('blocker-reason').value.trim();
    if (!reason) {
        showToast('Please enter a reason', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    const taskId = currentBlockingTaskId;

    if (isAddingNewTask) {
        // Handle logic for adding task with blocker
        const body = { ...pendingNewTaskBody, blockerReason: reason };
        const ghostEl = pendingNewTaskGhost;
        const listEl = document.getElementById(`waiting-list`);

        if (listEl) {
            if (listEl.children.length === 1 && listEl.children[0].classList.contains('text-center')) {
                listEl.innerHTML = '';
            }
        }
        listEl.prepend(ghostEl);
        closeBlockerModal();

        try {
            const res = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Failed to create task');
            ghostEl.remove();
            loadEmployeeDashboard();
            showToast('Task added');
        } catch (err) {
            ghostEl.remove();
            showToast(err.message, 'error');
        }
    } else {
        // Standard status update
        closeBlockerModal();
        updateTaskStatus(taskId, 'waiting', reason);
    }
}

async function updateTaskStatus(taskId, newStatus, reason = null) {
    const token = localStorage.getItem('token');
    const body = { status: newStatus };
    if (reason) body.blockerReason = reason;

    if (newStatus === 'waiting' && !reason) {
        openBlockerModal(taskId);
        return;
    }

    // --- Optimistic UI ---
    const taskEl = document.getElementById(`task-${taskId}`);
    const originalParent = taskEl ? taskEl.parentElement : null;
    const targetList = document.getElementById(`${newStatus}-list`);

    if (taskEl && targetList) {
        // Move it immediately
        targetList.appendChild(taskEl);
        // If "No tasks" placeholder exists in target, remove it
        if (targetList.children.length > 1 && targetList.querySelector('.text-center')) {
            targetList.querySelector('.text-center').remove();
        }
    }

    try {
        const res = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Failed to update task');

        // Refresh is silent now because DOM is already updated.
        // We still call it to sync with server just in case other things changed.
        const dashSec = document.getElementById('dashboard-section');
        if (!dashSec.classList.contains('hidden')) {
            // Quiet load (no spinner/reset)
            const tasksRes = await fetch(`${API_URL}/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
            const tasks = await tasksRes.json();
            const pending = tasks.filter(t => t.status === 'pending');
            const waiting = tasks.filter(t => t.status === 'waiting');
            const completed = tasks.filter(t => t.status === 'completed');
            renderColumn('pending', pending);
            renderColumn('waiting', waiting);
            renderColumn('completed', completed);
        } else {
            loadEmployeeHistory();
        }
        showToast('Task updated');

    } catch (err) {
        // Rollback
        if (taskEl && originalParent) {
            originalParent.appendChild(taskEl);
        }
        showToast(err.message, 'error');
    }
}

// --- Delete Modal Logic ---
let currentDeleteTaskId = null;

function openDeleteModal(taskId, event) {
    if (event) event.stopPropagation();
    currentDeleteTaskId = taskId;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    currentDeleteTaskId = null;
}

async function confirmDeleteTask() {
    if (!currentDeleteTaskId) return;

    const taskId = currentDeleteTaskId;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            // Handle "Already Deleted" case gracefully
            if (res.status === 404) {
                showToast('Task list synced');
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete task');
            }
        } else {
            showToast('Task deleted');
        }

        // Refresh based on which view is active
        const dashSec = document.getElementById('dashboard-section');
        if (!dashSec.classList.contains('hidden')) {
            loadEmployeeDashboard();
        } else {
            loadEmployeeHistory();
        }
        closeDeleteModal();

    } catch (err) {
        console.error('Delete error:', err);
        showToast(err.message, 'error');
        closeDeleteModal();
    }
}

function toggleHistory() {
    const dashSec = document.getElementById('dashboard-section');
    const histSec = document.getElementById('history-section');
    const btn = document.getElementById('history-btn');

    if (dashSec.classList.contains('hidden')) {
        dashSec.classList.remove('hidden');
        histSec.classList.add('hidden');
        btn.textContent = 'History';
        loadEmployeeDashboard();
    } else {
        dashSec.classList.add('hidden');
        histSec.classList.remove('hidden');
        btn.textContent = 'Back to Dashboard';
        loadEmployeeHistory();
    }
}

async function loadEmployeeHistory() {
    const listEl = document.getElementById('status-history');
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_URL}/tasks/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const history = await res.json();

        if (history.length === 0) {
            listEl.innerHTML = '<div class="card p-4 text-center text-muted">No history found.</div>';
            return;
        }

        listEl.innerHTML = history.map(day => `
            <div class="card p-4 status-card mb-4" style="border-left: 4px solid var(--primary-color);">
                <div class="flex justify-between mb-2">
                    <span style="font-weight: 600;">${new Date(day.date).toLocaleDateString()}</span>
                    <span class="badge" style="background: #ecfdf5; color: var(--success-color);">${day.completed.length} Completed</span>
                </div>
                <div class="text-sm text-muted mb-2">Click any item to edit it.</div>
                <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                    ${day.completed.map(item => `
                        <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span onclick="openEditModal('${item._id}', '${item.text.replace(/'/g, "\\'")}', 'completed', '')" style="cursor: pointer; text-decoration: underline dotted; flex: 1;">
                                ${item.text}
                                ${item.managerReply ? `<br><span class="text-xs text-primary" style="margin-left:10px;">↪ Manager: ${item.managerReply}</span>` : ''}
                            </span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button onclick="updateTaskStatus('${item._id}', 'pending')" class="btn btn-xs btn-outline" style="padding: 2px 6px; font-size: 0.75rem;" title="Move to Pending">Undo</button>
                                <button onclick="openDeleteModal('${item._id}', event)" style="background:none; border:none; color: var(--danger-color); cursor: pointer; font-size: 1.2rem;">&times;</button>
                            </div>
                        </li>`).join('')}
                    ${day.pending.map(item => `
                        <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span onclick="openEditModal('${item._id}', '${item.text.replace(/'/g, "\\'")}', 'pending', '')" style="cursor: pointer; text-decoration: underline dotted; color: var(--warning-color); flex: 1;">
                                ${item.text}
                                ${item.managerReply ? `<br><span class="text-xs text-primary" style="margin-left:10px;">↪ Manager: ${item.managerReply}</span>` : ''}
                            </span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button onclick="updateTaskStatus('${item._id}', 'completed')" class="btn btn-xs btn-outline" style="color: var(--success-color); border-color: var(--success-color); padding: 2px 6px; font-size: 0.75rem;" title="Mark as Done">Done</button>
                                <button onclick="openDeleteModal('${item._id}', event)" style="background:none; border:none; color: var(--danger-color); cursor: pointer; font-size: 1.2rem;">&times;</button>
                            </div>
                        </li>`).join('')}
                    ${day.blockers.map(item => `
                        <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span onclick="openEditModal('${item._id}', '${item.text.replace(/'/g, "\\'")}', 'waiting', '${(item.blockerReason || '').replace(/'/g, "\\'")}')" style="cursor: pointer; text-decoration: underline dotted; color: var(--danger-color); flex: 1;">
                                ${item.text}
                                ${item.managerReply ? `<br><span class="text-xs text-primary" style="margin-left:10px;">↪ Manager: ${item.managerReply}</span>` : ''}
                            </span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button onclick="updateTaskStatus('${item._id}', 'completed')" class="btn btn-xs btn-outline" style="color: var(--success-color); border-color: var(--success-color); padding: 2px 6px; font-size: 0.75rem;" title="Mark as Done">Done</button>
                                <button onclick="openDeleteModal('${item._id}', event)" style="background:none; border:none; color: var(--danger-color); cursor: pointer; font-size: 1.2rem;">&times;</button>
                            </div>
                        </li>`).join('')}
                </ul>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
    }
}


// --- Manager Features ---

async function loadManagerDashboard() {
    const token = localStorage.getItem('token');

    try {
        // Parallel fetch: team statuses and all employees
        const [statusRes, empRes] = await Promise.all([
            fetch(`${API_URL}/tasks/team`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/auth/employees`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const updates = await statusRes.json();
        const employees = await empRes.json();

        // Update total member count stat
        if (document.getElementById('total-members')) {
            document.getElementById('total-members').textContent = Array.isArray(employees) ? employees.length : 0;
        }

        // Render main views
        updateManagerView(updates);

    } catch (err) {
        console.error(err);
        const feedEl = document.getElementById('team-feed');
        if (feedEl) feedEl.innerHTML = '<div class="text-danger">Failed to load team data</div>';
    }
}

// Manager Reply Logic
let currentReplyTaskId = null;

function openReplyModal(taskId, text, existingReply = '') {
    currentReplyTaskId = taskId;
    document.getElementById('reply-modal').classList.remove('hidden');
    document.getElementById('reply-task-preview').textContent = text; // Show snippet
    document.getElementById('reply-text').value = existingReply; // Pre-fill if editing
    document.getElementById('reply-text').focus();
}

function closeReplyModal() {
    document.getElementById('reply-modal').classList.add('hidden');
    currentReplyTaskId = null;
}

async function sendReply() {
    const reply = document.getElementById('reply-text').value.trim();
    const token = localStorage.getItem('token');
    const taskId = currentReplyTaskId;

    if (!reply) return showToast('Please enter a reply', 'error');

    try {
        const res = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ managerReply: reply })
        });

        if (!res.ok) throw new Error('Failed to send reply');

        loadManagerDashboard(); // Refresh background feed

        // --- Optimistic UI Refined ---
        const modal = document.getElementById('report-modal');
        const taskCard = document.getElementById(`inbox-card-${taskId}`);

        if (taskCard && !modal.classList.contains('hidden')) {
            // Add fade out
            taskCard.classList.add('fade-out');

            setTimeout(() => {
                // Instead of just removing, we refresh the whole modal 
                // to move it to history section properly
                showRepliesModal();
            }, 400);
        }

        closeReplyModal();
        showToast('Reply processed');

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Helper
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

// --- Browser Notifications ---

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Notification permission granted.");
            }
        });
    }
}

function sendBrowserNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: '/favicon.ico' // Or any relevant icon
        });
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (type === 'error') {
        toast.style.background = 'var(--danger-color)';
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- View Reply Modal (Employee) ---
function openViewReplyModal(replyText, dateString) {
    const modal = document.getElementById('view-reply-modal');
    const content = document.getElementById('view-reply-content');
    modal.classList.remove('hidden');

    const date = new Date(dateString);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const fullDate = date.toLocaleDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    content.innerHTML = `
        <div class="mb-4">
            <div class="text-xs text-muted uppercase font-bold mb-1">Received On</div>
            <div class="flex items-center gap-2">
                <span class="badge" style="background: #e0f2fe; color: #0369a1;">${dayName}</span>
                <span class="text-sm font-medium">${fullDate} at ${time}</span>
            </div>
        </div>
        <div class="mb-2">
            <div class="text-xs text-muted uppercase font-bold mb-1">Message</div>
            <div class="p-3 bg-gray-50 rounded border" style="font-size: 0.95rem; line-height: 1.5;">
                ${replyText}
            </div>
        </div>
    `;
}

function closeViewReplyModal() {
    document.getElementById('view-reply-modal').classList.add('hidden');
}

// --- Manager Interactions ---

function showMembersModal() {
    const modal = document.getElementById('members-modal');
    const container = document.getElementById('members-table-container');

    modal.classList.remove('hidden');
    container.innerHTML = '<div class="text-center p-4">Loading members...</div>';

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/auth/employees`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(employees => {
            if (employees.length === 0) {
                container.innerHTML = '<div class="text-center text-muted p-4">No members found.</div>';
                return;
            }

            // User requested format: "1.name download button"
            container.innerHTML = `
                <div class="flex flex-col gap-3 p-2">
                    ${employees.map((emp, index) => `
                        <div class="card p-4 flex justify-between items-center hover-scale shadow-sm" style="border-left: 4px solid var(--secondary-color);">
                            <div class="flex items-center gap-4">
                                <div class="text-lg font-bold text-muted" style="width: 25px;">${index + 1}.</div>
                                <div>
                                    <div class="font-bold text-lg">${emp.name}</div>
                                    <div class="text-sm text-muted">${emp.email}</div>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="downloadEmployeeReport('${emp._id}', '${emp.name.replace(/'/g, "\\'")}')" class="btn btn-primary btn-sm flex items-center gap-1">
                                    Download Report
                                </button>
                                <button onclick="openDeleteUserModal('${emp._id}', '${emp.name.replace(/'/g, "\\'")}')" class="btn btn-outline btn-sm flex items-center gap-1" style="color: var(--danger-color); border-color: var(--danger-color);">
                                    Delete
                                </button>
                                <div class="dropdown-container">
                                    <button class="btn btn-outline btn-sm" onclick="this.nextElementSibling.classList.toggle('hidden')">View Stats ▼</button>
                                    <div class="hidden dropdown-menu bg-white border rounded shadow p-2 mt-1 absolute z-50">
                                         <button onclick="showEmployeeReport('${emp._id}', 'day', '${emp.name.replace(/'/g, "\\'")}')" class="sidebar-item p-1 text-xs">Today</button>
                                         <button onclick="showEmployeeReport('${emp._id}', 'week', '${emp.name.replace(/'/g, "\\'")}')" class="sidebar-item p-1 text-xs">Week</button>
                                         <button onclick="showEmployeeReport('${emp._id}', 'month', '${emp.name.replace(/'/g, "\\'")}')" class="sidebar-item p-1 text-xs">Month</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = '<div class="text-danger p-4">Failed to load members.</div>';
        });
}

function closeMembersModal() {
    document.getElementById('members-modal').classList.add('hidden');
}

// --- Delete User Logic ---
let currentDeleteUserId = null;

function openDeleteUserModal(userId, userName) {
    currentDeleteUserId = userId;
    document.getElementById('delete-user-name').textContent = userName;
    document.getElementById('delete-user-modal').classList.remove('hidden');
}

function closeDeleteUserModal() {
    document.getElementById('delete-user-modal').classList.add('hidden');
    currentDeleteUserId = null;
}

async function confirmDeleteUser() {
    if (!currentDeleteUserId) return;

    const userId = currentDeleteUserId;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_URL}/auth/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to delete user');

        showToast('Employee deleted successfully');
        closeDeleteUserModal();
        showMembersModal(); // Refresh list
        loadManagerDashboard(); // Refresh stats

    } catch (err) {
        showToast(err.message, 'error');
        closeDeleteUserModal();
    }
}

async function downloadEmployeeReport(employeeId, employeeName) {
    showToast(`Generating report for ${employeeName}...`);
    const token = localStorage.getItem('token');

    try {
        // Fetch ALL tasks for this user (or at least team data)
        const res = await fetch(`${API_URL}/tasks/team`, { headers: { 'Authorization': `Bearer ${token}` } });
        const allUpdates = await res.json();

        // Find specific user status (Backend currently returns latest statuses per user)
        // If we want FULL history, we'd need another endpoint. 
        // For now, we use the available team data which contains the user's current tasks.
        const userStatus = allUpdates.find(u => u.user._id === employeeId);

        if (!userStatus) throw new Error("No data found for this employee");

        // Stats Calculation
        const completed = userStatus.completed || [];
        const pending = userStatus.pending || [];
        const blockers = userStatus.blockers || [];
        const total = completed.length + pending.length + blockers.length;
        const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        // --- PDF GENERATION (jsPDF) ---
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Styling Constants
        const primaryColor = [255, 126, 95]; // Warm Orange
        const secondaryColor = [30, 41, 59]; // Dark Slate

        // 1. Header
        doc.setFillColor(...secondaryColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("PERFORMANCE REPORT", 20, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Status Drafter Enterprise v2.0", 150, 15);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 150, 22);

        // 2. Employee Info
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(14);
        doc.text("Employee Details", 20, 55);

        doc.line(20, 58, 190, 58); // Line

        doc.setFontSize(12);
        doc.text(`Name: ${employeeName}`, 20, 68);
        doc.text(`Email: ${userStatus.user.email}`, 20, 75);

        // 3. Statistics (The "Professional" part)
        doc.setFontSize(14);
        doc.text("Executive Summary", 20, 95);

        // Stats Boxes Backgrounds
        const drawStatBox = (x, y, label, value, color) => {
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(x, y, 40, 25, 3, 3, 'F');
            doc.setTextColor(...secondaryColor);
            doc.setFontSize(9);
            doc.text(label, x + 5, y + 8);
            doc.setTextColor(...color);
            doc.setFontSize(14);
            doc.text(value.toString(), x + 5, y + 18);
        };

        drawStatBox(20, 100, "TOTAL TASKS", total, [50, 50, 50]);
        drawStatBox(65, 100, "COMPLETION %", `${completionRate}%`, [34, 197, 94]);
        drawStatBox(110, 100, "PENDING", pending.length, [234, 179, 8]);
        drawStatBox(155, 100, "BLOCKERS", blockers.length, [239, 68, 68]);

        // 4. Task Table (using autoTable plugin)
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(14);
        doc.text("Detailed Task Log", 20, 145);

        const tableData = [
            ...completed.map(t => [t.text, 'COMPLETED', new Date(userStatus.date).toLocaleDateString()]),
            ...pending.map(t => [t.text, 'PENDING', '-']),
            ...blockers.map(t => [t.text, 'BLOCKED', '-'])
        ];

        doc.autoTable({
            startY: 150,
            head: [['Task Description', 'Status', 'Date Updated']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 110 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 }
            }
        });

        // 5. Footer
        const finalY = doc.lastAutoTable.finalY || 150;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("This is an automated performance report from Status Drafter.", 20, finalY + 20);
        doc.text("Confidential Information - For Management Use Only", 20, finalY + 25);

        // Save
        doc.save(`Performance_Report_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast("Report downloaded successfully!");

    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to generate report", "error");
    }
}

function showTodaysUpdates() {
    const modal = document.getElementById('report-modal');
    const title = document.getElementById('report-title');
    const content = document.getElementById('report-content');

    modal.classList.remove('hidden');
    title.textContent = "Updates Today (Completed Work)";
    content.innerHTML = '<div class="text-center p-4">Loading updates...</div>';

    const token = localStorage.getItem('token');

    // We need team updates
    fetch(`${API_URL}/tasks/team`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(updates => {
            const completedTasks = [];
            const today = new Date();

            updates.forEach(status => {
                // Filter for Today
                const statusDate = new Date(status.date);
                if (statusDate.getDate() === today.getDate() &&
                    statusDate.getMonth() === today.getMonth() &&
                    statusDate.getFullYear() === today.getFullYear()) {

                    if (status.completed && status.completed.length > 0) {
                        status.completed.forEach(task => {
                            completedTasks.push({
                                user: status.user.name,
                                text: task.text,
                                time: status.date
                            });
                        });
                    }
                }
            });

            if (completedTasks.length === 0) {
                content.innerHTML = '<div class="text-center text-muted p-4">No work completed yet today.</div>';
                return;
            }

            content.innerHTML = `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Task Completed</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${completedTasks.map(t => `
                            <tr>
                                <td style="font-weight: 500;">${t.user}</td>
                                <td>${t.text}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            content.innerHTML = '<div class="text-danger p-4">Failed to load updates.</div>';
        });
}

function showRepliesModal() {
    const modal = document.getElementById('report-modal');
    const title = document.getElementById('report-title');
    const content = document.getElementById('report-content');

    modal.classList.remove('hidden');
    title.textContent = "💬 Replies & Feedback";
    content.innerHTML = '<div class="text-center p-4">Loading replies...</div>';

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/tasks/team`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(updates => {
            const pending = [];
            const history = [];

            updates.forEach(status => {
                const allTasks = [...status.completed, ...status.pending, ...status.blockers];
                allTasks.forEach(task => {
                    const taskData = {
                        ...task,
                        userName: status.user.name,
                        date: status.date,
                        statusId: status.id
                    };
                    if (!task.managerReply) {
                        // Only blockers/waiting tasks usually need reply in "Inbox" context
                        // but let's show any pending that the manager might want to comment on
                        pending.push(taskData);
                    } else {
                        history.push(taskData);
                    }
                });
            });

            if (pending.length === 0 && history.length === 0) {
                content.innerHTML = '<div class="text-center text-muted p-4">No tasks or replies found.</div>';
                return;
            }

            // Sort history by reply date
            history.sort((a, b) => new Date(b.managerReplyAt || 0) - new Date(a.managerReplyAt || 0));

            content.innerHTML = `
                ${pending.length > 0 ? `
                    <div class="mb-4">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="p-1 px-2 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase">📥 Action Required</span>
                            <div class="h-px bg-red-100 flex-1"></div>
                        </div>
                        <div id="pending-replies-list"></div>
                    </div>
                ` : ''}
                
                ${history.length > 0 ? `
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="p-1 px-2 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">💬 Reply History</span>
                            <div class="h-px bg-blue-100 flex-1"></div>
                        </div>
                        <div id="history-replies-list" class="opacity-80"></div>
                    </div>
                ` : ''}
            `;

            if (pending.length > 0) renderInboxList(document.getElementById('pending-replies-list'), pending, false);
            if (history.length > 0) renderInboxList(document.getElementById('history-replies-list'), history, true);
        })
        .catch(err => {
            console.error(err);
            content.innerHTML = '<div class="text-danger p-4">Failed to load replies.</div>';
        });
}

function renderInboxList(container, tasks, isSentHistory) {
    container.innerHTML = tasks.map(task => {
        const taskId = task.id || task._id;
        return `
         <div id="inbox-card-${taskId}" class="card p-4 mb-3" style="border-left: 4px solid ${isSentHistory ? 'var(--primary-color)' : 'var(--danger-color)'}; transition: all 0.3s ease;">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="badge" style="background: ${isSentHistory ? '#e0f2fe' : '#fee2e2'}; color: ${isSentHistory ? '#0369a1' : '#991b1b'}; font-size: 0.8rem;">${task.userName}</span>
                    <span class="text-muted text-sm ml-2">${new Date(task.date || new Date()).toLocaleTimeString()}</span>
                </div>
                 <span class="text-muted text-sm">${new Date(task.date || new Date()).toLocaleDateString()}</span>
            </div>
            
            <div class="mb-3">
                <div class="text-xs text-muted uppercase font-bold mb-1">Task</div>
                <div class="font-medium p-2 bg-gray-50 rounded border">${task.rawText || task.text.replace(/\s*\(.*\)$/, '')}</div>
            </div>

            ${!isSentHistory ? `
            <div class="mb-3">
                 <div class="text-xs text-muted uppercase font-bold mb-1">Reason / Blocker</div>
                 <div class="text-danger italic bg-red-50 p-2 rounded border border-red-100">"${task.reason || task.blockerReason || 'Reason not available'}"</div>
            </div>` : ''}

             ${task.managerReply ? `
                 <div class="mb-3">
                    <div class="text-xs text-muted uppercase font-bold mb-1">Your Reply</div>
                    <div class="text-sm text-primary bg-blue-50 p-2 rounded border border-blue-100">
                        ${task.managerReply}
                        ${task.managerReplyAt ? `<br><span class="text-xs text-gray-400 text-right block mt-1">${new Date(task.managerReplyAt).toLocaleString()}</span>` : ''}
                    </div>
                 </div>`
                : ''}

            <div class="text-right">
                <button onclick="openReplyModal('${taskId}', '${task.text.replace(/'/g, "\\'")}', '${(task.managerReply || '').replace(/'/g, "\\'")}')" class="btn btn-primary btn-sm flex items-center gap-1">
                    ${task.managerReply ? '✏️ Edit Reply' : '💬 Reply'}
                </button>
            </div>
        </div>
    `}).join('');
}

function showEmployeeReport(userId, type, userName) {
    const modal = document.getElementById('report-modal');
    const title = document.getElementById('report-title');
    const content = document.getElementById('report-content');

    modal.classList.remove('hidden');

    let timeRange = "";
    if (type === 'day') timeRange = "Today";
    if (type === 'week') timeRange = "Last 7 Days";
    if (type === 'month') timeRange = "Last 30 Days";

    title.textContent = `Report: ${userName} (${timeRange})`;
    content.innerHTML = '<div class="text-center p-4">Loading report...</div>';

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/tasks/user/${userId}/history?range=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(history => {
            if (history.length === 0) {
                content.innerHTML = `<div class="text-center text-muted p-4">No activity found for this period.</div>`;
                return;
            }

            content.innerHTML = history.map(day => `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <span class="badge" style="background: var(--secondary-color); color: white;">${new Date(day.date).toLocaleDateString()}</span>
                    <div class="h-px bg-gray-100 flex-1"></div>
                </div>
                
                ${day.completed.length ? `
                <div class="mb-3" style="margin-left: 10px;">
                    <strong class="text-success text-sm block mb-1">✓ Work Done</strong>
                    <div class="grid grid-cols-1 gap-2">
                        ${day.completed.map(t => `
                            <div class="p-2 bg-green-50 rounded border border-green-100 text-sm">
                                ${t.text}
                                ${t.managerReply ? `<br><span class="text-xs text-primary" style="font-weight:600;">↪ Manager Feedback: ${t.managerReply}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                ${day.pending.length ? `
                <div class="mb-3" style="margin-left: 10px;">
                    <strong class="text-warning text-sm block mb-1">⧖ Pending Items</strong>
                    <div class="grid grid-cols-1 gap-2">
                        ${day.pending.map(t => `
                            <div class="p-2 bg-amber-50 rounded border border-amber-100 text-sm">
                                ${t.text}
                                ${t.managerReply ? `<br><span class="text-xs text-primary" style="font-weight:600;">↪ Manager Feedback: ${t.managerReply}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                ${day.blockers.length ? `
                <div class="mb-3" style="margin-left: 10px;">
                    <strong class="text-danger text-sm block mb-1">🚫 Waiting / Blocked</strong>
                    <div class="grid grid-cols-1 gap-2">
                        ${day.blockers.map(t => `
                            <div class="p-2 bg-red-50 rounded border border-red-100 text-sm">
                                <div class="font-medium">${t.text}</div>
                                <div class="text-xs text-danger italic mt-1 pb-1" style="border-bottom: 1px dashed #fecaca;">Reason: "${t.blockerReason}"</div>
                                ${t.managerReply ? `<div class="text-xs text-primary mt-1" style="font-weight:600;">↪ Manager Feedback: ${t.managerReply}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>
        `).join('');
        })
        .catch(err => {
            console.error(err);
            content.innerHTML = '<div class="text-danger p-4">Failed to load employee history.</div>';
        });
}

function showPendingReport(type) {
    const modal = document.getElementById('report-modal');
    const title = document.getElementById('report-title');
    const content = document.getElementById('report-content');

    modal.classList.remove('hidden');

    let label = "Pending Reports";
    if (type === 'day') label = "Daily Pending (Yesterday)";
    if (type === 'week') label = "Weekly Pending (Last 7 Days)";
    if (type === 'month') label = "Monthly Pending (Last 30 Days)";

    title.textContent = label;
    content.innerHTML = '<div class="text-center p-4">Loading report...</div>';

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/tasks/reports/pending?range=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(reportData => {
            if (reportData.length === 0) {
                content.innerHTML = '<div class="text-center text-muted p-4">No pending tasks found for this period.</div>';
                return;
            }

            content.innerHTML = reportData.map(group => `
            <div class="mb-4 border-bottom pb-2">
                <div class="flex justify-between items-center mb-2 bg-gray-50 p-2 rounded">
                    <strong>${group.user.name}</strong>
                    <span class="text-muted text-xs">${group.user.email}</span>
                </div>
                <table class="report-table" style="font-size: 0.9rem;">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.tasks.map(t => `
                            <tr>
                                <td>
                                    ${t.text}
                                    ${t.reason ? `<br><span class="text-xs text-danger italic">Reason: ${t.reason}</span>` : ''}
                                </td>
                                <td style="width: 120px; font-size: 0.8rem;">${new Date(t.date).toLocaleDateString()} ${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td style="width: 80px;">
                                    ${t.status === 'waiting'
                    ? '<span class="badge" style="background: #fee2e2; color: #991b1b;">Blocked</span>'
                    : '<span class="badge" style="background: #fef3c7; color: #92400e;">Pending</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
        })
        .catch(err => {
            console.error(err);
            content.innerHTML = '<div class="text-danger p-4">Failed to load report.</div>';
        });
}


function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

// --- Manager: Assign Task Features ---

let employeesCache = null;

function openAssignTaskModal() {
    const modal = document.getElementById('assign-task-modal');
    modal.classList.remove('hidden');

    const select = document.getElementById('assign-employee');

    // Use cached employees if available
    if (employeesCache && employeesCache.length > 0) {
        populateEmployeeSelect(select, employeesCache);
        return;
    }

    select.innerHTML = '<option value="">Loading...</option>';

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/auth/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(async res => {
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to load employees');
            }
            return res.json();
        })
        .then(employees => {
            employeesCache = employees; // Store in cache
            populateEmployeeSelect(select, employees);
        })
        .catch(err => {
            console.error('Error loading employees:', err);
            select.innerHTML = `<option value="">Error: ${err.message}</option>`;
        });
}

function populateEmployeeSelect(selectElement, employees) {
    selectElement.innerHTML = '<option value="">Select Employee</option>';
    if (employees.length === 0) {
        const option = document.createElement('option');
        option.textContent = "No employees found";
        option.disabled = true;
        selectElement.appendChild(option);
        return;
    }
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp._id;
        option.textContent = emp.name + ' (' + emp.email + ')';
        selectElement.appendChild(option);
    });
}

function closeAssignTaskModal() {
    document.getElementById('assign-task-modal').classList.add('hidden');
    document.getElementById('assign-text').value = '';
    document.getElementById('assign-deadline').value = '';
}

function submitAssignedTask(e) {
    e.preventDefault();

    const text = document.getElementById('assign-text').value;
    const userId = document.getElementById('assign-employee').value;
    const deadline = document.getElementById('assign-deadline').value;

    if (!userId) {
        showToast('Please select an employee', 'error');
        return;
    }

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/tasks/assign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, userId, deadline })
    })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to assign task');

            showToast('Task assigned successfully!', 'success');
            closeAssignTaskModal();
            // Force immediate reload
            // Clear cache so we can see updates if we view members
            // Actually loadManagerDashboard doesn't use cache, it fetches fresh
            loadManagerDashboard();
        })
        .catch(err => {
            console.error(err);
            showToast(err.message, 'error');
        });
}

// --- Auto-Refresh & Notification Logic ---

let lastTaskIds = new Set();
let lastReplyIds = new Set();
let lastBlockerIds = new Set();
let isFirstLoad = true;

// Poll every 5 seconds to keep data fresh and check for notifications
setInterval(() => {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;

    const user = JSON.parse(userJson);
    if (user.role === 'manager') {
        if (document.getElementById('team-grid')) {
            checkForManagerUpdates();
        }
    } else if (user.role === 'employee') {
        if (document.getElementById('dashboard-section') && !document.getElementById('dashboard-section').classList.contains('hidden')) {
            checkForEmployeeUpdates();
        }
    }
}, 5000);

async function checkForEmployeeUpdates() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const tasks = await res.json();

        if (!isFirstLoad) {
            tasks.forEach(t => {
                const taskId = t._id;

                // Case A: New Assigned Task
                if (t.isAssigned && !lastTaskIds.has(taskId)) {
                    showToast(`New Task Assigned: ${t.text.substring(0, 30)}...`, 'success');
                    sendBrowserNotification("🚀 New Task Assigned", t.text);
                }

                // Case B: New Manager Reply
                if (t.managerReply && !lastReplyIds.has(taskId)) {
                    showToast(`New Manager Feedback!`, 'success');
                    sendBrowserNotification("💬 Manager Feedback", t.managerReply);
                }
            });
        }

        lastTaskIds = new Set(tasks.map(t => t._id));
        lastReplyIds = new Set(tasks.filter(t => t.managerReply).map(t => t._id));

        const pending = tasks.filter(t => t.status === 'pending');
        const waiting = tasks.filter(t => t.status === 'waiting');
        const completed = tasks.filter(t => t.status === 'completed');

        renderColumn('pending', pending);
        renderColumn('waiting', waiting);
        renderColumn('completed', completed);

        isFirstLoad = false;
    } catch (e) {
        console.error("Employee polling error", e);
    }
}

async function checkForManagerUpdates() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tasks/team`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const updates = await res.json();

        if (!isFirstLoad) {
            updates.forEach(u => {
                u.blockers.forEach(b => {
                    if (!lastBlockerIds.has(b.id)) {
                        showToast(`New Blocker from ${u.user.name}`, 'error');
                        sendBrowserNotification(`🚫 New Blocker: ${u.user.name}`, b.text);
                    }
                });
            });
        }

        // Update tracking for manager
        let allBlockers = [];
        updates.forEach(u => allBlockers = [...allBlockers, ...u.blockers]);
        lastBlockerIds = new Set(allBlockers.map(t => t.id));

        // Use the existing function for rendering
        updateManagerView(updates);
        isFirstLoad = false;
    } catch (e) {
        console.error("Manager polling error", e);
    }
}

function updateManagerView(updates) {
    const feedEl = document.getElementById('team-feed');
    const missingEl = document.getElementById('missing-updates-list');

    // Update Stats (Surgical text update)
    const todaysUpdates = updates.filter(u => isToday(new Date(u.date)));
    if (document.getElementById('updates-today')) {
        const val = todaysUpdates.length.toString();
        if (document.getElementById('updates-today').textContent !== val) {
            document.getElementById('updates-today').textContent = val;
        }
    }

    const totalBlockers = updates.reduce((acc, curr) => acc + (curr.blockers ? curr.blockers.length : 0), 0);
    if (document.getElementById('pending-blockers')) {
        const val = totalBlockers.toString();
        if (document.getElementById('pending-blockers').textContent !== val) {
            document.getElementById('pending-blockers').textContent = val;
        }
    }

    // Render Feed (Surgical Card Updates)
    if (feedEl) {
        if (updates.length === 0) {
            feedEl.innerHTML = '<div class="text-center p-4">No updates found from the team.</div>';
        } else {
            // 1. Stable Sort by Name (Frontend)
            updates.sort((a, b) => a.user.name.localeCompare(b.user.name));

            const incomingIds = new Set(updates.map(u => `user-card-${u.user._id}`));

            // Remove old cards
            Array.from(feedEl.children).forEach(child => {
                if (child.id && !incomingIds.has(child.id)) child.remove();
            });

            updates.forEach((status, index) => {
                const cardId = `user-card-${status.user._id}`;
                let card = document.getElementById(cardId);

                if (!card) {
                    card = document.createElement('div');
                    card.id = cardId;
                    card.className = 'card p-4 relative mb-4';
                    card.style.animation = 'slideIn 0.3s ease-out';
                    // Initially append
                    feedEl.appendChild(card);
                }

                // 2. Ensure Correct Order (Position Shuffle Fix)
                if (feedEl.children[index] !== card) {
                    feedEl.insertBefore(card, feedEl.children[index]);
                }

                // Update Missing Badge
                let badge = card.querySelector('.missing-badge');
                if (status.isMissing) {
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.className = 'missing-badge absolute top-2 right-2 badge';
                        badge.style.cssText = 'background: #fee2e2; color: #991b1b; font-weight: bold; border: 1px solid #fecaca;';
                        badge.textContent = '❌ Missing Update';
                        card.appendChild(badge);
                    }
                } else if (badge) {
                    badge.remove();
                }

                // Update Layout if not present (Non-destructive)
                if (!card.querySelector('.card-header')) {
                    card.insertAdjacentHTML('beforeend', `
                        <div class="card-header flex justify-between items-start mb-3 border-bottom pb-2" style="border-bottom: 1px solid #eee;">
                            <div>
                                <h4 class="mb-0 flex items-center gap-2">
                                    <span class="employee-name">${status.user.name}</span>
                                    <span class="active-dot" style="color: #22c55e; font-size: 0.85rem; font-weight: 500; display: ${!status.isMissing ? 'inline' : 'none'};">● Active</span>
                                </h4>
                                <span class="text-muted employee-email" style="font-size: 0.8rem;">${status.user.email}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-muted text-xs block">Last Active</span>
                                <span class="last-active-time font-medium text-xs"></span>
                            </div>
                        </div>
                        <div class="card-body flex flex-col gap-2"></div>
                    `);
                }

                // Update Header Info
                const nameEl = card.querySelector('.employee-name');
                const dotEl = card.querySelector('.active-dot');
                const timeEl = card.querySelector('.last-active-time');
                const bodyEl = card.querySelector('.card-body');

                if (nameEl && nameEl.textContent !== status.user.name) nameEl.textContent = status.user.name;
                if (dotEl) dotEl.style.display = !status.isMissing ? 'inline' : 'none';

                const formattedTime = status.date ? new Date(status.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Never';
                if (timeEl && timeEl.textContent !== formattedTime) timeEl.textContent = formattedTime;

                // Update Card Style
                card.style.borderLeft = status.isMissing ? '4px solid #ef4444' : 'none';
                card.style.background = status.isMissing ? '#fffcfc' : 'white';

                // Render Task Body Surgically
                if (bodyEl) {
                    if (!status.date) {
                        if (bodyEl.innerHTML !== '<div class="text-center p-2 text-muted italic" style="font-size: 0.85rem;">No activity recorded yet</div>') {
                            bodyEl.innerHTML = '<div class="text-center p-2 text-muted italic" style="font-size: 0.85rem;">No activity recorded yet</div>';
                        }
                    } else {
                        // Surgical list updates for Completed, Pending, Blockers
                        renderSurgicalTaskList(bodyEl, 'Completed', status.completed, 'var(--success-color)', status.user._id);
                        renderSurgicalTaskList(bodyEl, 'Pending', status.pending, 'var(--text-color)', status.user._id);
                        renderSurgicalTaskList(bodyEl, 'Blockers', status.blockers, 'var(--danger-color)', status.user._id);
                    }
                }
            });
        }
    }

    // Attendance Sidebar (Surgical)
    const attentionList = [];
    updates.forEach(u => {
        if (u.isMissing) {
            attentionList.push({
                id: u.user._id,
                name: u.user.name,
                email: u.user.email,
                reason: 'No update today',
                type: 'missing'
            });
        } else if (u.pending.length > 0 || u.blockers.length > 0) {
            attentionList.push({
                id: u.user._id,
                name: u.user.name,
                email: u.user.email,
                reason: `${u.pending.length} Pending, ${u.blockers.length} Blocked`,
                type: 'active'
            });
        }
    });

    if (missingEl) {
        if (attentionList.length === 0) {
            missingEl.innerHTML = '<div class="text-center text-muted" style="color: var(--success-color);"><span style="font-size: 1.2rem;">🎉</span><br>All clear!</div>';
        } else {
            if (missingEl.querySelector('.text-center')) missingEl.innerHTML = '';

            const listIds = new Set(attentionList.map(i => `attention-${i.id}`));
            Array.from(missingEl.children).forEach(c => {
                if (!listIds.has(c.id)) c.remove();
            });

            attentionList.forEach(item => {
                const itemId = `attention-${item.id}`;
                let el = document.getElementById(itemId);
                const itemHtml = `
                    <div>
                        <div style="font-weight: 600;">${item.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${item.reason}</div>
                    </div>
                    ${item.type === 'missing' ? '<span class="badge" style="background: #fee2e2; color: #991b1b;">❌ Missing</span>' : '<span class="badge" style="background: #fef3c7; color: #92400e;">⚠️ Attention</span>'}
                `;

                if (!el) {
                    el = document.createElement('div');
                    el.id = itemId;
                    el.className = 'card p-3 flex justify-between items-center mb-2';
                    el.innerHTML = itemHtml;
                    missingEl.appendChild(el);
                } else if (el.innerHTML !== itemHtml) {
                    el.innerHTML = itemHtml;
                }
                el.style.borderLeft = `4px solid ${item.type === 'missing' ? '#ef4444' : 'var(--warning-color)'}`;
            });
        }
    }
}

/**
 * Surgically updates a task list within a card body.
 */
function renderSurgicalTaskList(container, title, tasks, titleColor, userId) {
    let section = container.querySelector(`.task-section-${title}`);
    if (!section) {
        section = document.createElement('div');
        section.className = `task-section-${title}`;
        section.innerHTML = `
            <strong style="color: ${titleColor}; font-size: 0.9rem;">${title === 'Completed' ? '✓' : title === 'Pending' ? '⧖' : '🚫'} ${title}</strong>
            <ul class="task-list pl-0 mt-1" style="list-style: none;"></ul>
            <p class="no-tasks-msg text-muted text-sm italic hidden">None</p>
        `;
        container.appendChild(section);
    }

    const listEl = section.querySelector('.task-list');
    const msgEl = section.querySelector('.no-tasks-msg');

    if (tasks.length === 0) {
        section.classList.add('hidden');
        listEl.innerHTML = '';
    } else {
        section.classList.remove('hidden');

        const incomingIds = new Set(tasks.map(t => `mgr-task-${t.id || t._id}`));

        // Remove old tasks
        Array.from(listEl.children).forEach(child => {
            if (!incomingIds.has(child.id)) child.remove();
        });

        tasks.forEach(t => {
            const taskId = `mgr-task-${t.id || t._id}`;
            let item = document.getElementById(taskId);

            const itemHtml = `
                ${t.text}
                ${t.managerReply ? `<br><span class="text-xs text-primary">↪ Manager: ${t.managerReply}</span>` : ''}
                ${title === 'Completed' ?
                    `<button onclick="openReplyModal('${t.id || t._id}', '${t.text.replace(/'/g, "\\'")}', '${(t.managerReply || '').replace(/'/g, "\\'")}')" class="btn btn-outline btn-xs ml-2" style="border: none; padding: 0 5px; font-size: 0.8rem; color: var(--primary-color);">
                        ${t.managerReply ? '✎ Edit Feedback' : '💬 Feedback'}
                    </button>`
                    : ''}
            `;

            if (!item) {
                item = document.createElement('li');
                item.id = taskId;
                item.className = 'mb-1';
                item.innerHTML = itemHtml;
                listEl.appendChild(item);
            } else if (item.innerHTML !== itemHtml) {
                item.innerHTML = itemHtml;
            }
        });
    }

    // Blockers specific styling
    if (title === 'Blockers') {
        section.style.background = tasks.length > 0 ? '#fef2f2' : 'transparent';
        section.style.padding = tasks.length > 0 ? '0.5rem' : '0';
        section.style.borderRadius = '4px';
    }
}

function playNotificationSound() {
    // beep
}
// --- Connectivity Check ---
(async function checkBackend() {
    try {
        const res = await fetch(`${API_URL}`);
        if (res.ok) {
            console.log('Backend connected');
        } else {
            showToast('Backend reachable but returned error', 'error');
        }
    } catch (e) {
        showToast('Cannot connect to server. Please ensure backend is running.', 'error');
        console.error('Backend connection failed:', e);
    }
})();
