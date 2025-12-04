/**
 * Electron Main Process
 * BPSR Module Optimizer
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { setupLogging, getLogger } = require('./logger');
const { getNetworkInterfaces } = require('./networkInterfaceUtil');
const { StarResonanceMonitor } = require('./starResonanceMonitor');
const { ModuleCategory, ALL_ATTRIBUTES } = require('./moduleTypes');

// Initialize logging
setupLogging({ debugMode: process.argv.includes('--dev') });
const logger = getLogger('Main');

let mainWindow = null;
let monitor = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#202124',
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    if (monitor) {
      monitor.stopMonitoring();
    }
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Get network interfaces
ipcMain.handle('get-network-interfaces', async () => {
  const interfaces = getNetworkInterfaces();
  return interfaces.map((iface, index) => ({
    index,
    name: iface.name,
    description: iface.description,
    addresses: iface.addresses.map(a => a.addr),
  }));
});

// Get all attributes
ipcMain.handle('get-all-attributes', async () => {
  return ALL_ATTRIBUTES;
});

// Start monitoring
ipcMain.handle('start-monitoring', async (event, options) => {
  try {
    const { interfaceName, category, attributes, prioritizedAttrs, priorityOrderMode } = options;

    if (monitor) {
      monitor.stopMonitoring();
    }

    monitor = new StarResonanceMonitor({
      interfaceName,
      category,
      attributes,
      prioritizedAttrs,
      priorityOrderMode,
      onDataCapturedCallback: () => {
        if (mainWindow) {
          mainWindow.webContents.send('data-captured');
        }
      },
      progressCallback: (message) => {
        if (mainWindow) {
          mainWindow.webContents.send('progress-update', message);
        }
      },
      onResultsCallback: (results) => {
        if (mainWindow) {
          // Serialize results for IPC
          const serializedResults = results.map(sol => ({
            modules: sol.modules.map(m => ({
              name: m.name,
              configId: m.configId,
              uuid: m.uuid,
              quality: m.quality,
              parts: m.parts.map(p => ({
                id: p.id,
                name: p.name,
                value: p.value,
              })),
            })),
            attrBreakdown: sol.attrBreakdown,
            score: sol.score,
            optimizationScore: sol.optimizationScore,
          }));
          mainWindow.webContents.send('results-ready', serializedResults);
        }
      },
      onStoppedCallback: () => {
        if (mainWindow) {
          mainWindow.webContents.send('monitoring-stopped');
        }
      },
    });

    monitor.startMonitoring();
    return { success: true };
  } catch (err) {
    logger.error(`Failed to start monitoring: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// Stop monitoring
ipcMain.handle('stop-monitoring', async () => {
  if (monitor) {
    monitor.stopMonitoring();
    return { success: true };
  }
  return { success: false, error: 'No active monitor' };
});

// Rescreen modules
ipcMain.handle('rescreen-modules', async (event, options) => {
  try {
    if (!monitor || !monitor.hasCapturedData()) {
      return { success: false, error: 'No captured module data available' };
    }

    const { category, attributes, prioritizedAttrs, priorityOrderMode } = options;
    monitor.rescreenModules(category, attributes, prioritizedAttrs, priorityOrderMode);
    return { success: true };
  } catch (err) {
    logger.error(`Failed to rescreen: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// Check if data is captured
ipcMain.handle('has-captured-data', async () => {
  return monitor ? monitor.hasCapturedData() : false;
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});

