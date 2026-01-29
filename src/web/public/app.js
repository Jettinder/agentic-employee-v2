// WebSocket connection
let ws;
const API_BASE = window.location.origin + '/api';
const WS_URL = `ws://${window.location.host}/ws`;

function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateWSStatus('🟢 Connected');
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleWSMessage(message);
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateWSStatus('🔴 Disconnected');
        setTimeout(connectWebSocket, 3000); // Reconnect after 3s
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateWSStatus('🟡 Error');
    };
}

function updateWSStatus(status) {
    document.getElementById('wsStatus').textContent = status;
}

function handleWSMessage(message) {
    const logStream = document.getElementById('logStream');

    if (message.type === 'connected') {
        addLog('System', message.message, 'info');
    } else if (message.type === 'log') {
        const data = message.data;
        if (data.event) {
            addLog(data.event, JSON.stringify(data, null, 2), 'event');
        } else if (data.message) {
            addLog('Log', data.message, 'info');
        }
    } else if (message.type === 'runner') {
        addLog('Runner', `Status: ${message.status}`, 'runner');
        updateRunnerStatus(message.status);
    } else if (message.type === 'error') {
        addLog('Error', message.message, 'error');
    }
}

function addLog(label, content, type = 'info') {
    const logStream = document.getElementById('logStream');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-label">${label}:</span>
        <span class="log-content">${content}</span>
    `;

    logStream.appendChild(entry);
    logStream.scrollTop = logStream.scrollHeight;
}

function updateRunnerStatus(status) {
    const statusEl = document.getElementById('runnerStatus');
    statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusEl.className = 'status-badge status-' + status;
}

// API calls
async function startRunner() {
    try {
        addLog('Runner', 'Starting demo...', 'info');
        const res = await fetch(`${API_BASE}/runner/start`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            addLog('Runner', 'Demo completed successfully', 'success');
        } else {
            addLog('Error', data.error, 'error');
        }
    } catch (error) {
        addLog('Error', error.message, 'error');
    }
}

async function loadAuditRuns() {
    try {
        const res = await fetch(`${API_BASE}/audit/runs`);
        const data = await res.json();

        if (data.success) {
            displayAuditRuns(data.runs);
        } else {
            console.error('Failed to load audit runs:', data.error);
        }
    } catch (error) {
        console.error('Error loading audit runs:', error);
    }
}

function displayAuditRuns(runs) {
    const container = document.getElementById('auditRuns');

    if (!runs || runs.length === 0) {
        container.innerHTML = '<p class="empty">No runs found</p>';
        return;
    }

    container.innerHTML = runs.map(runId => `
        <div class="audit-run-item" onclick="loadRunDetails('${runId}')">
            <div class="run-id">${runId}</div>
            <div class="run-link">View Details →</div>
        </div>
    `).join('');
}

async function loadRunDetails(runId) {
    try {
        const res = await fetch(`${API_BASE}/audit/run/${runId}`);
        const data = await res.json();

        if (data.success) {
            addLog('Audit', `Run ${runId} has ${data.events.length} events`, 'info');
            data.events.forEach(event => {
                addLog(event.event, JSON.stringify(event.data, null, 2), 'event');
            });
        }
    } catch (error) {
        addLog('Error', error.message, 'error');
    }
}

async function loadSecrets() {
    try {
        const res = await fetch(`${API_BASE}/vault/secrets`);
        const data = await res.json();

        if (data.success) {
            displaySecrets(data.secrets);
        } else {
            console.error('Failed to load secrets:', data.error);
        }
    } catch (error) {
        console.error('Error loading secrets:', error);
    }
}

function displaySecrets(secrets) {
    const container = document.getElementById('secretsList');

    if (!secrets || secrets.length === 0) {
        container.innerHTML = '<p class="empty">No secrets stored</p>';
        return;
    }

    container.innerHTML = secrets.map(secret => `
        <div class="secret-item">
            <div class="secret-info">
                <strong>${secret.name}</strong>
                <span class="secret-scopes">${secret.scopes.join(', ')}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="revokeSecret('${secret.id}')">Revoke</button>
        </div>
    `).join('');
}

async function addNewSecret() {
    const name = document.getElementById('secretName').value;
    const value = document.getElementById('secretValue').value;
    const scopes = document.getElementById('secretScopes').value;

    if (!name || !value || !scopes) {
        addLog('Error', 'Please fill all fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/vault/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, value, scopes })
        });

        const data = await res.json();

        if (data.success) {
            addLog('Vault', `Secret "${name}" added successfully`, 'success');
            document.getElementById('secretName').value = '';
            document.getElementById('secretValue').value = '';
            document.getElementById('secretScopes').value = '';
            loadSecrets();
        } else {
            addLog('Error', data.error, 'error');
        }
    } catch (error) {
        addLog('Error', error.message, 'error');
    }
}

async function revokeSecret(id) {
    if (!confirm('Are you sure you want to revoke this secret?')) return;

    try {
        const res = await fetch(`${API_BASE}/vault/secrets/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            addLog('Vault', data.message, 'success');
            loadSecrets();
        } else {
            addLog('Error', data.error, 'error');
        }
    } catch (error) {
        addLog('Error', error.message, 'error');
    }
}

// Event listeners
document.getElementById('startDemo').addEventListener('click', startRunner);
document.getElementById('clearLogs').addEventListener('click', () => {
    document.getElementById('logStream').innerHTML = '';
});
document.getElementById('refreshRuns').addEventListener('click', loadAuditRuns);
document.getElementById('refreshSecrets').addEventListener('click', loadSecrets);
document.getElementById('addSecret').addEventListener('click', addNewSecret);

// Initialize
connectWebSocket();
loadAuditRuns();
loadSecrets();
addLog('System', 'Dashboard initialized', 'info');
