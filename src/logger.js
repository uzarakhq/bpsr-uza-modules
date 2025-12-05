/**
 * Logger Configuration
 * JavaScript port of logging_config.py
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Log levels
const LogLevel = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
};

// Format timestamp
function formatTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Global log file stream
let logFileStream = null;
let currentLogLevel = LogLevel.INFO;

/**
 * Setup logging
 * @param {Object} options - Configuration options
 * @param {boolean} options.debugMode - Enable debug mode
 */
function setupLogging({ debugMode = false } = {}) {
  if (logFileStream) return; // Already configured

  currentLogLevel = debugMode ? LogLevel.DEBUG : LogLevel.INFO;

  // Create log directory
  const logDir = path.join(os.homedir(), '.star_resonance_logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Generate log file name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const logFile = path.join(logDir, `star_resonance_${timestamp}.log`);

  // Create log file stream
  logFileStream = fs.createWriteStream(logFile, { flags: 'a' });

  const logger = getLogger('logger');
  logger.info(`Logging system initialized - Level: ${debugMode ? 'DEBUG' : 'INFO'}`);
  logger.info(`Log file: ${logFile}`);
}

/**
 * Create a logger instance
 * @param {string} name - Logger name
 * @returns {Object} Logger instance
 */
function getLogger(name) {
  const formatMessage = (level, message) => {
    return `[${formatTimestamp()}] [${name}] [${level}] ${message}`;
  };

  const log = (level, levelName, message) => {
    if (level < currentLogLevel) return;

    const formattedMessage = formatMessage(levelName, message);
    
    // Only output to console in development mode or for errors/warnings
    // In production, only log errors and warnings to console
    let isProduction = false;
    try {
      const electron = require('electron');
      isProduction = electron.app?.isPackaged || false;
    } catch (e) {
      // Electron not available yet, check env
      isProduction = process.env.NODE_ENV === 'production';
    }
    
    const shouldLogToConsole = !isProduction || level >= LogLevel.WARNING;
    
    if (shouldLogToConsole) {
      const colors = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARNING: '\x1b[33m', // Yellow
        ERROR: '\x1b[31m', // Red
        RESET: '\x1b[0m',
      };

      console.log(`${colors[levelName]}${formattedMessage}${colors.RESET}`);
    }

    // Always write to file (for debugging production issues)
    if (logFileStream) {
      logFileStream.write(formattedMessage + '\n');
    }
  };

  return {
    debug: (message) => log(LogLevel.DEBUG, 'DEBUG', message),
    info: (message) => log(LogLevel.INFO, 'INFO', message),
    warn: (message) => log(LogLevel.WARNING, 'WARNING', message),
    warning: (message) => log(LogLevel.WARNING, 'WARNING', message),
    error: (message) => log(LogLevel.ERROR, 'ERROR', message),
  };
}

module.exports = { setupLogging, getLogger, LogLevel };

