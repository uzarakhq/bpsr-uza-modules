/**
 * Electron Preload Script
 * Exposes safe APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Network interfaces
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  
  // Attributes
  getAllAttributes: () => ipcRenderer.invoke('get-all-attributes'),
  
  // Monitoring
  startMonitoring: (options) => ipcRenderer.invoke('start-monitoring', options),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  rescreenModules: (options) => ipcRenderer.invoke('rescreen-modules', options),
  hasCapturedData: () => ipcRenderer.invoke('has-captured-data'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Npcap check
  checkNpcap: () => ipcRenderer.invoke('check-npcap'),
  
  // Event listeners
  onDataCaptured: (callback) => {
    ipcRenderer.on('data-captured', callback);
    return () => ipcRenderer.removeListener('data-captured', callback);
  },
  
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (event, message) => callback(message));
    return () => ipcRenderer.removeListener('progress-update', callback);
  },
  
  onResultsReady: (callback) => {
    ipcRenderer.on('results-ready', (event, results) => callback(results));
    return () => ipcRenderer.removeListener('results-ready', callback);
  },
  
  onMonitoringStopped: (callback) => {
    ipcRenderer.on('monitoring-stopped', callback);
    return () => ipcRenderer.removeListener('monitoring-stopped', callback);
  },
});

