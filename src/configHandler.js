/**
 * Configuration Handler
 * Handles reading and writing config.ini file
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./logger');

const logger = getLogger('ConfigHandler');

// Store app instance for path resolution
let appInstance = null;

/**
 * Initialize config handler with Electron app instance
 * @param {Object} app - Electron app instance
 */
function initConfigHandler(app) {
  appInstance = app;
}

// Get config file path (in app root directory)
function getConfigPath() {
  // Try to use app instance if available
  if (appInstance) {
    if (appInstance.isPackaged) {
      // In packaged app, use the directory where the exe is located
      // For portable apps, this should be next to the executable
      // app.getPath('exe') returns the executable path
      const exePath = appInstance.getPath('exe');
      return path.join(path.dirname(exePath), 'config.ini');
    } else {
      // In development, use the project root
      return path.join(__dirname, '..', 'config.ini');
    }
  } else {
    // Fallback: use project root (for testing or when app not initialized)
    return path.join(__dirname, '..', 'config.ini');
  }
}

/**
 * Parse INI file content
 * @param {string} content - INI file content
 * @returns {Object} Parsed config object
 */
function parseINI(content) {
  const config = {};
  let currentSection = null;
  
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }
    
    // Check for section header [SectionName]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!config[currentSection]) {
        config[currentSection] = {};
      }
      continue;
    }
    
    // Check for key=value pairs
    const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();
      
      if (currentSection) {
        if (!config[currentSection]) {
          config[currentSection] = {};
        }
        config[currentSection][key] = value;
      } else {
        // If no section, add to root
        config[key] = value;
      }
    }
  }
  
  return config;
}

/**
 * Convert config object to INI format
 * @param {Object} config - Config object
 * @returns {string} INI file content
 */
function stringifyINI(config) {
  const lines = [];
  
  for (const [section, values] of Object.entries(config)) {
    if (typeof values === 'object' && !Array.isArray(values)) {
      // It's a section
      lines.push(`[${section}]`);
      for (const [key, value] of Object.entries(values)) {
        lines.push(`${key}=${value}`);
      }
      lines.push(''); // Empty line between sections
    } else {
      // It's a root-level key-value pair
      lines.push(`${section}=${values}`);
    }
  }
  
  return lines.join('\r\n');
}

/**
 * Load config from file
 * @returns {Object} Config object
 */
function loadConfig() {
  const configPath = getConfigPath();
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseINI(content);
      logger.info(`Loaded config from ${configPath}`);
      return config;
    } else {
      logger.info(`Config file not found at ${configPath}, using defaults`);
      return {};
    }
  } catch (err) {
    logger.error(`Failed to load config: ${err.message}`);
    return {};
  }
}

/**
 * Save config to file
 * @param {Object} config - Config object to save
 * @returns {boolean} Success status
 */
function saveConfig(config) {
  const configPath = getConfigPath();
  
  try {
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const content = stringifyINI(config);
    fs.writeFileSync(configPath, content, 'utf8');
    logger.info(`Saved config to ${configPath}`);
    return true;
  } catch (err) {
    logger.error(`Failed to save config: ${err.message}`);
    return false;
  }
}

/**
 * Get a config value
 * @param {string} section - Section name (e.g., 'SetUp')
 * @param {string} key - Key name (e.g., 'NetworkCard')
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Config value
 */
function getConfigValue(section, key, defaultValue = null) {
  const config = loadConfig();
  if (config[section] && config[section][key] !== undefined) {
    return config[section][key];
  }
  return defaultValue;
}

/**
 * Set a config value
 * @param {string} section - Section name (e.g., 'SetUp')
 * @param {string} key - Key name (e.g., 'NetworkCard')
 * @param {any} value - Value to set
 * @returns {boolean} Success status
 */
function setConfigValue(section, key, value) {
  const config = loadConfig();
  if (!config[section]) {
    config[section] = {};
  }
  config[section][key] = value;
  return saveConfig(config);
}

module.exports = {
  initConfigHandler,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  getConfigPath,
};

