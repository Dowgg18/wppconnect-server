class WPPConnectDashboard {
    constructor() {
        this.apiUrl = localStorage.getItem('wpp_api_url') || 'http://localhost:21465';
        this.secretKey = localStorage.getItem('wpp_secret_key') || 'THISISMYSECURETOKEN';
        this.sessions = [];
        this.currentSection = 'sessions';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.checkApiStatus();
        this.loadSessions();
        
        // Auto refresh sessions every 30 seconds
        setInterval(() => {
            if (this.currentSection === 'sessions') {
                this.loadSessions();
            }
        }, 30000);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });

        // Session management
        document.getElementById('create-session-btn').addEventListener('click', () => {
            this.showModal('create-session-modal');
        });

        document.getElementById('refresh-sessions-btn').addEventListener('click', () => {
            this.loadSessions();
        });

        document.getElementById('create-session-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createSession();
        });

        // Message form
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Settings
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Modal controls
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.hideModal(e.target.closest('.modal').id);
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        // Update page title
        const titles = {
            sessions: 'Gerenciar Sessões',
            messages: 'Enviar Mensagens',
            contacts: 'Contatos',
            groups: 'Grupos',
            settings: 'Configurações'
        };
        document.getElementById('page-title').textContent = titles[section];

        this.currentSection = section;

        // Load section-specific data
        switch (section) {
            case 'messages':
                this.loadSessionsForSelect();
                break;
            case 'contacts':
                this.loadContacts();
                break;
            case 'groups':
                this.loadGroups();
                break;
        }
    }

    async checkApiStatus() {
        try {
            const response = await fetch(`${this.apiUrl}/healthz`);
            const statusIndicator = document.getElementById('api-status');
            
            if (response.ok) {
                statusIndicator.innerHTML = '<span class="status-dot online"></span><span>API Online</span>';
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            const statusIndicator = document.getElementById('api-status');
            statusIndicator.innerHTML = '<span class="status-dot offline"></span><span>API Offline</span>';
        }
    }

    async loadSessions() {
        try {
            const response = await fetch(`${this.apiUrl}/api/${this.secretKey}/show-all-sessions`);
            const data = await response.json();
            
            if (data.response) {
                this.sessions = data.response;
                this.renderSessions();
            }
        } catch (error) {
            this.showToast('Erro ao carregar sessões', 'error');
            console.error('Error loading sessions:', error);
        }
    }

    renderSessions() {
        const grid = document.getElementById('sessions-grid');
        
        if (this.sessions.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plug" style="font-size: 48px; color: #a0aec0; margin-bottom: 16px;"></i>
                    <h3>Nenhuma sessão encontrada</h3>
                    <p>Crie uma nova sessão para começar</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.sessions.map(session => `
            <div class="session-card">
                <div class="session-header">
                    <div class="session-name">${session}</div>
                    <div class="session-status disconnected" id="status-${session}">
                        Desconectado
                    </div>
                </div>
                <div class="session-info">
                    <p><strong>Nome:</strong> ${session}</p>
                    <p><strong>Status:</strong> <span id="status-text-${session}">Verificando...</span></p>
                </div>
                <div class="session-actions">
                    <button class="btn btn-success" onclick="dashboard.startSession('${session}')">
                        <i class="fas fa-play"></i>
                        Iniciar
                    </button>
                    <button class="btn btn-warning" onclick="dashboard.getQRCode('${session}')">
                        <i class="fas fa-qrcode"></i>
                        QR Code
                    </button>
                    <button class="btn btn-danger" onclick="dashboard.closeSession('${session}')">
                        <i class="fas fa-stop"></i>
                        Parar
                    </button>
                </div>
            </div>
        `).join('');

        // Check status for each session
        this.sessions.forEach(session => {
            this.checkSessionStatus(session);
        });
    }

    async checkSessionStatus(sessionName) {
        try {
            // Generate token for this session
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                const token = tokenData.token;
                
                // Check session status
                const statusResponse = await fetch(`${this.apiUrl}/api/${sessionName}/status-session`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const statusData = await statusResponse.json();
                
                const statusElement = document.getElementById(`status-${sessionName}`);
                const statusTextElement = document.getElementById(`status-text-${sessionName}`);
                
                if (statusData.status === 'CONNECTED') {
                    statusElement.className = 'session-status connected';
                    statusElement.textContent = 'Conectado';
                    statusTextElement.textContent = 'Conectado e funcionando';
                } else if (statusData.status === 'QRCODE') {
                    statusElement.className = 'session-status qrcode';
                    statusElement.textContent = 'QR Code';
                    statusTextElement.textContent = 'Aguardando leitura do QR Code';
                } else {
                    statusElement.className = 'session-status disconnected';
                    statusElement.textContent = 'Desconectado';
                    statusTextElement.textContent = 'Sessão não iniciada';
                }
            }
        } catch (error) {
            console.error(`Error checking status for ${sessionName}:`, error);
            const statusElement = document.getElementById(`status-${sessionName}`);
            const statusTextElement = document.getElementById(`status-text-${sessionName}`);
            
            if (statusElement && statusTextElement) {
                statusElement.className = 'session-status disconnected';
                statusElement.textContent = 'Erro';
                statusTextElement.textContent = 'Erro ao verificar status';
            }
        }
    }

    async createSession() {
        const sessionName = document.getElementById('session-name').value.trim();
        
        if (!sessionName) {
            this.showToast('Nome da sessão é obrigatório', 'error');
            return;
        }

        try {
            // Generate token for new session
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                this.showToast('Sessão criada com sucesso!', 'success');
                this.hideModal('create-session-modal');
                document.getElementById('create-session-form').reset();
                this.loadSessions();
            } else {
                throw new Error(tokenData.message || 'Erro ao criar sessão');
            }
        } catch (error) {
            this.showToast('Erro ao criar sessão: ' + error.message, 'error');
        }
    }

    async startSession(sessionName) {
        try {
            // Generate token
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                const token = tokenData.token;
                
                // Start session
                const startResponse = await fetch(`${this.apiUrl}/api/${sessionName}/start-session`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
                
                const startData = await startResponse.json();
                
                if (startData.status === 'qrcode') {
                    this.showQRCode(startData.qrcode);
                    this.showToast('Sessão iniciada! Escaneie o QR Code', 'success');
                } else {
                    this.showToast('Sessão iniciada com sucesso!', 'success');
                }
                
                // Refresh session status
                setTimeout(() => {
                    this.checkSessionStatus(sessionName);
                }, 2000);
            }
        } catch (error) {
            this.showToast('Erro ao iniciar sessão: ' + error.message, 'error');
        }
    }

    async closeSession(sessionName) {
        try {
            // Generate token
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                const token = tokenData.token;
                
                // Close session
                const closeResponse = await fetch(`${this.apiUrl}/api/${sessionName}/close-session`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (closeResponse.ok) {
                    this.showToast('Sessão encerrada com sucesso!', 'success');
                    this.checkSessionStatus(sessionName);
                }
            }
        } catch (error) {
            this.showToast('Erro ao encerrar sessão: ' + error.message, 'error');
        }
    }

    async getQRCode(sessionName) {
        try {
            // Generate token
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                const token = tokenData.token;
                
                // Get QR Code
                const qrResponse = await fetch(`${this.apiUrl}/api/${sessionName}/qrcode-session`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (qrResponse.ok) {
                    const blob = await qrResponse.blob();
                    const qrUrl = URL.createObjectURL(blob);
                    this.showQRCode(qrUrl);
                } else {
                    this.showToast('QR Code não disponível. Inicie a sessão primeiro.', 'warning');
                }
            }
        } catch (error) {
            this.showToast('Erro ao obter QR Code: ' + error.message, 'error');
        }
    }

    showQRCode(qrData) {
        const qrImage = document.getElementById('qr-image');
        
        if (qrData.startsWith('data:image')) {
            qrImage.src = qrData;
        } else if (qrData.startsWith('blob:')) {
            qrImage.src = qrData;
        } else {
            qrImage.src = `data:image/png;base64,${qrData}`;
        }
        
        this.showModal('qr-modal');
    }

    async loadSessionsForSelect() {
        const select = document.getElementById('session-select');
        select.innerHTML = '<option value="">Selecione uma sessão</option>';
        
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session;
            option.textContent = session;
            select.appendChild(option);
        });
    }

    async sendMessage() {
        const sessionName = document.getElementById('session-select').value;
        const phone = document.getElementById('phone-input').value;
        const message = document.getElementById('message-input').value;
        
        if (!sessionName || !phone || !message) {
            this.showToast('Todos os campos são obrigatórios', 'error');
            return;
        }

        try {
            // Generate token
            const tokenResponse = await fetch(`${this.apiUrl}/api/${sessionName}/${this.secretKey}/generate-token`, {
                method: 'POST'
            });
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status === 'success') {
                const token = tokenData.token;
                
                // Send message
                const messageResponse = await fetch(`${this.apiUrl}/api/${sessionName}/send-message`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: [phone],
                        message: message
                    })
                });
                
                const messageData = await messageResponse.json();
                
                if (messageData.status === 'success') {
                    this.showToast('Mensagem enviada com sucesso!', 'success');
                    document.getElementById('message-form').reset();
                } else {
                    throw new Error(messageData.message || 'Erro ao enviar mensagem');
                }
            }
        } catch (error) {
            this.showToast('Erro ao enviar mensagem: ' + error.message, 'error');
        }
    }

    loadContacts() {
        const contactsList = document.getElementById('contacts-list');
        contactsList.innerHTML = `
            <div class="list-item">
                <div class="list-item-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="list-item-content">
                    <div class="list-item-name">Funcionalidade em desenvolvimento</div>
                    <div class="list-item-info">Os contatos serão carregados aqui</div>
                </div>
            </div>
        `;
    }

    loadGroups() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = `
            <div class="list-item">
                <div class="list-item-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="list-item-content">
                    <div class="list-item-name">Funcionalidade em desenvolvimento</div>
                    <div class="list-item-info">Os grupos serão carregados aqui</div>
                </div>
            </div>
        `;
    }

    loadSettings() {
        document.getElementById('api-url').value = this.apiUrl;
        document.getElementById('secret-key').value = this.secretKey;
    }

    saveSettings() {
        const apiUrl = document.getElementById('api-url').value.trim();
        const secretKey = document.getElementById('secret-key').value.trim();
        
        if (!apiUrl || !secretKey) {
            this.showToast('URL da API e chave secreta são obrigatórios', 'error');
            return;
        }
        
        this.apiUrl = apiUrl;
        this.secretKey = secretKey;
        
        localStorage.setItem('wpp_api_url', apiUrl);
        localStorage.setItem('wpp_secret_key', secretKey);
        
        this.showToast('Configurações salvas com sucesso!', 'success');
        this.checkApiStatus();
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Remove on click
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new WPPConnectDashboard();
});