// p2p-final.js - Solución final práctica y funcional

class PWAOfflineSync {
    constructor() {
        this.deviceId = this.generateDeviceId();
        this.isOnline = navigator.onLine;
        this.syncChannel = null;
        this.heartbeatInterval = null;
        this.connectedDevices = new Set();
        this.syncEnabled = false;
        
        this.init();
    }

    generateDeviceId() {
        // ID único basado en características del dispositivo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        
        const fingerprint = canvas.toDataURL().slice(-50);
        return `device_${Date.now()}_${fingerprint.slice(-8)}`;
    }

    init() {
        // Detectar cambios de conectividad
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.stopOfflineMode();
            this.showConnectionStatus('🌐 Conectado a Internet');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.startOfflineMode();
        });

        // Cleanup al cerrar
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Inicializar según estado actual
        if (!this.isOnline) {
            this.startOfflineMode();
        }
    }

    startOfflineMode() {
        this.syncEnabled = true;
        this.showOfflineUI();
        this.initSyncChannel();
        this.startDeviceDiscovery();
        this.showConnectionStatus('📡 Modo offline - Buscando dispositivos...');
    }

    stopOfflineMode() {
        this.syncEnabled = false;
        this.hideOfflineUI();
        this.cleanup();
    }

    initSyncChannel() {
        try {
            // Canal para comunicación directa entre dispositivos
            this.syncChannel = new BroadcastChannel('pwa_device_sync');
            
            this.syncChannel.onmessage = (event) => {
                this.handleSyncMessage(event.data);
            };

            // Anunciar presencia inmediatamente
            this.announcePresence();
            
        } catch (error) {
            console.log('BroadcastChannel no disponible');
            this.showConnectionStatus('❌ Sincronización no disponible en este navegador');
        }
    }

    startDeviceDiscovery() {
        // Sistema de heartbeat para descubrir dispositivos
        this.heartbeatInterval = setInterval(() => {
            this.updateDeviceRegistry();
            this.announcePresence();
            this.cleanupInactiveDevices();
        }, 3000);

        // Escuchar cambios en el registro de dispositivos
        window.addEventListener('storage', (event) => {
            if (event.key === 'pwa_device_registry') {
                this.updateConnectedDevices();
            }
        });
    }

    announcePresence() {
        const registry = this.getDeviceRegistry();
        registry[this.deviceId] = {
            lastSeen: Date.now(),
            userAgent: navigator.userAgent.slice(0, 50),
            status: 'active'
        };
        
        localStorage.setItem('pwa_device_registry', JSON.stringify(registry));

        // También anunciar por BroadcastChannel
        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'DEVICE_ANNOUNCE',
                deviceId: this.deviceId,
                timestamp: Date.now()
            });
        }
    }

    getDeviceRegistry() {
        try {
            return JSON.parse(localStorage.getItem('pwa_device_registry') || '{}');
        } catch {
            return {};
        }
    }

    updateDeviceRegistry() {
        const registry = this.getDeviceRegistry();
        registry[this.deviceId] = {
            lastSeen: Date.now(),
            userAgent: navigator.userAgent.slice(0, 50),
            status: 'active'
        };
        localStorage.setItem('pwa_device_registry', JSON.stringify(registry));
    }

    cleanupInactiveDevices() {
        const registry = this.getDeviceRegistry();
        const now = Date.now();
        const timeout = 15000; // 15 segundos
        
        let cleaned = false;
        Object.keys(registry).forEach(deviceId => {
            if (now - registry[deviceId].lastSeen > timeout) {
                delete registry[deviceId];
                cleaned = true;
            }
        });
        
        if (cleaned) {
            localStorage.setItem('pwa_device_registry', JSON.stringify(registry));
        }
    }

    updateConnectedDevices() {
        const registry = this.getDeviceRegistry();
        const activeDevices = Object.keys(registry).filter(id => id !== this.deviceId);
        
        // Detectar nuevos dispositivos
        activeDevices.forEach(deviceId => {
            if (!this.connectedDevices.has(deviceId)) {
                this.connectedDevices.add(deviceId);
                this.onDeviceConnected(deviceId);
            }
        });

        // Detectar dispositivos desconectados
        this.connectedDevices.forEach(deviceId => {
            if (!activeDevices.includes(deviceId)) {
                this.connectedDevices.delete(deviceId);
                this.onDeviceDisconnected(deviceId);
            }
        });

        this.updateConnectionStatus();
    }

    onDeviceConnected(deviceId) {
        console.log('Dispositivo conectado:', deviceId);
        this.showNotification(`📱 Dispositivo conectado`);
        
        // Solicitar sincronización completa
        setTimeout(() => {
            this.requestFullSync();
        }, 1000);
    }

    onDeviceDisconnected(deviceId) {
        console.log('Dispositivo desconectado:', deviceId);
        this.updateConnectionStatus();
    }

    // Métodos de sincronización
    syncNewEntry(entry) {
        if (!this.syncEnabled || !this.syncChannel) return;

        const syncMessage = {
            type: 'NEW_ENTRY',
            deviceId: this.deviceId,
            data: entry,
            timestamp: Date.now()
        };

        this.syncChannel.postMessage(syncMessage);
        this.showNotification(`📤 Entrada enviada a ${this.connectedDevices.size} dispositivos`);
    }

    requestFullSync() {
        if (!this.syncChannel) return;

        this.syncChannel.postMessage({
            type: 'SYNC_REQUEST',
            deviceId: this.deviceId,
            timestamp: Date.now()
        });
    }

    sendFullData() {
        if (!this.syncChannel) return;

        const entries = JSON.parse(localStorage.getItem('entries') || '[]');
        
        this.syncChannel.postMessage({
            type: 'FULL_SYNC',
            deviceId: this.deviceId,
            data: entries,
            timestamp: Date.now()
        });
    }

    handleSyncMessage(message) {
        if (message.deviceId === this.deviceId) return; // Ignorar propios mensajes

        switch (message.type) {
            case 'DEVICE_ANNOUNCE':
                // Dispositivo se anunció, será detectado por updateConnectedDevices
                break;

            case 'NEW_ENTRY':
                this.receiveNewEntry(message.data);
                break;

            case 'SYNC_REQUEST':
                // Otro dispositivo pide sincronización completa
                this.sendFullData();
                break;

            case 'FULL_SYNC':
                this.receiveFullData(message.data);
                break;
        }
    }

    receiveNewEntry(entry) {
        const entries = JSON.parse(localStorage.getItem('entries') || '[]');
        
        // Verificar si ya existe
        const exists = entries.some(e => 
            e.text === entry.text && e.date === entry.date
        );
        
        if (!exists) {
            entries.push(entry);
            localStorage.setItem('entries', JSON.stringify(entries));
            renderTable();
            this.showNotification('📥 Nueva entrada recibida');
        }
    }

    receiveFullData(newEntries) {
        const currentEntries = JSON.parse(localStorage.getItem('entries') || '[]');
        const existingEntries = new Set(
            currentEntries.map(e => `${e.text}|${e.date}`)
        );
        
        const uniqueNewEntries = newEntries.filter(entry => 
            !existingEntries.has(`${entry.text}|${entry.date}`)
        );
        
        if (uniqueNewEntries.length > 0) {
            const mergedEntries = [...currentEntries, ...uniqueNewEntries];
            
            // Ordenar por fecha
            mergedEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            localStorage.setItem('entries', JSON.stringify(mergedEntries));
            renderTable();
            this.showNotification(`📥 ${uniqueNewEntries.length} entradas sincronizadas`);
        }
    }

    // Métodos UI
    showOfflineUI() {
        if (document.getElementById('offline-sync-ui')) return;

        const offlineUI = document.createElement('div');
        offlineUI.id = 'offline-sync-ui';
        offlineUI.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                padding: 20px;
                margin-bottom: 20px;
                border-radius: 12px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                position: relative;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, white, transparent);
                    animation: pulse 2s infinite;
                "></div>
                
                <h3 style="margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                    📡 Modo Offline Activo
                    <span id="device-counter" style="
                        background: rgba(255,255,255,0.2);
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        margin-left: 10px;
                    ">0 dispositivos</span>
                </h3>
                
                <div id="connection-status" style="
                    background: rgba(255,255,255,0.1);
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    font-size: 14px;
                    font-family: monospace;
                ">
                    Inicializando sistema de sincronización...
                </div>
                
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="pwaSyncManager.manualSync()" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 10px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        🔄 Sincronizar Ahora
                    </button>
                    
                    <button onclick="pwaSyncManager.showDeviceInfo()" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 10px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        📱 Ver Dispositivos
                    </button>
                </div>
            </div>
        `;

        // Agregar estilos de animación
        this.addAnimationStyles();

        const main = document.querySelector('main');
        main.insertBefore(offlineUI, main.firstChild);
    }

    hideOfflineUI() {
        const offlineUI = document.getElementById('offline-sync-ui');
        if (offlineUI) {
            offlineUI.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => offlineUI.remove(), 300);
        }
    }

    addAnimationStyles() {
        if (document.getElementById('sync-animations')) return;

        const style = document.createElement('style');
        style.id = 'sync-animations';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 0.5; transform: translateX(-100%); }
                50% { opacity: 1; transform: translateX(100%); }
            }
            
            @keyframes slideOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
            
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        const counterEl = document.getElementById('device-counter');
        
        if (statusEl && counterEl) {
            const deviceCount = this.connectedDevices.size;
            
            counterEl.textContent = `${deviceCount} dispositivo${deviceCount !== 1 ? 's' : ''}`;
            
            if (deviceCount === 0) {
                statusEl.textContent = '🔍 Buscando dispositivos en la red local...';
                statusEl.style.background = 'rgba(255,255,255,0.1)';
            } else {
                statusEl.textContent = `✅ Conectado con ${deviceCount} dispositivo${deviceCount !== 1 ? 's' : ''}`;
                statusEl.style.background = 'rgba(76, 175, 80, 0.3)';
            }
        }
    }

    showConnectionStatus(message) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1002;
            font-size: 14px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Métodos públicos
    manualSync() {
        this.showNotification('🔄 Sincronización manual iniciada...');
        this.requestFullSync();
        
        // También enviar nuestros datos
        setTimeout(() => {
            this.sendFullData();
        }, 500);
    }

    showDeviceInfo() {
        const registry = this.getDeviceRegistry();
        const deviceList = Object.entries(registry)
            .filter(([id]) => id !== this.deviceId)
            .map(([id, info]) => {
                const lastSeenAgo = Math.floor((Date.now() - info.lastSeen) / 1000);
                return `• ${id.slice(-8)}: ${lastSeenAgo}s ago`;
            })
            .join('\n');

        const message = deviceList || 'No hay otros dispositivos detectados';
        alert(`Dispositivos detectados:\n\n${message}\n\nTu ID: ${this.deviceId.slice(-8)}`);
    }

    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.syncChannel) {
            this.syncChannel.close();
        }
        
        // Marcar dispositivo como inactivo
        try {
            const registry = this.getDeviceRegistry();
            if (registry[this.deviceId]) {
                registry[this.deviceId].status = 'inactive';
                localStorage.setItem('pwa_device_registry', JSON.stringify(registry));
            }
        } catch (error) {
            console.log('Error during cleanup:', error);
        }
    }
}

// Inicializar el sistema de sincronización
const pwaSyncManager = new PWAOfflineSync();

// Modificar función saveData original para incluir sincronización
const originalSaveData = window.saveData;
window.saveData = function(text) {
    const entry = { text, date: new Date().toLocaleString() };
    const data = JSON.parse(localStorage.getItem('entries') || '[]');
    data.push(entry);
    localStorage.setItem('entries', JSON.stringify(data));
    renderTable();
    
    // Sincronizar nueva entrada si estamos offline
    if (pwaSyncManager.syncEnabled) {
        pwaSyncManager.syncNewEntry(entry);
    }
};