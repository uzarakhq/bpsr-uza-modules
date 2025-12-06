/**
 * Star Resonance Monitor Core
 * JavaScript port of star_resonance_monitor_core.py
 */

const { getLogger } = require('./logger');
const { ModuleParser } = require('./moduleParser');
const { ModuleOptimizer } = require('./moduleOptimizer');
const { ModuleCategory, ModuleInfo, ModulePart, MODULE_NAMES, MODULE_ATTR_NAMES } = require('./moduleTypes');
const { PacketCapture } = require('./packetCapture');
const protobuf = require('protobufjs');
const path = require('path');

const logger = getLogger('StarResonanceMonitor');

// Load protobuf schema
let protoRoot = null;
let SyncContainerData = null;
let CharSerialize = null;
let protoLoadPromise = null;

function loadProtobufSchema() {
  if (protoLoadPromise) return protoLoadPromise;
  
  protoLoadPromise = (async () => {
    try {
      const protoPath = path.join(__dirname, 'proto', 'BlueProtobuf.proto');
      protoRoot = await protobuf.load(protoPath);
      SyncContainerData = protoRoot.lookupType('SyncContainerData');
      CharSerialize = protoRoot.lookupType('CharSerialize');
      // Protobuf schema loaded successfully
      return true;
    } catch (err) {
      logger.error(`Failed to load protobuf schema: ${err.message}`);
      logger.error(err.stack);
      return false;
    }
  })();
  
  return protoLoadPromise;
}

// Start loading immediately
loadProtobufSchema();

/**
 * Star Resonance Monitor class
 */
class StarResonanceMonitor {
  constructor(options = {}) {
    this.interfaceName = options.interfaceName;
    this.initialCategory = options.category || "Attack";
    this.initialAttributes = options.attributes || [];
    this.initialPrioritizedAttrs = options.prioritizedAttrs || [];
    this.initialPriorityOrderMode = options.priorityOrderMode || false;
    this.onDataCapturedCallback = options.onDataCapturedCallback || null;
    this.progressCallback = options.progressCallback || null;
    this.onResultsCallback = options.onResultsCallback || null;
    this.onStoppedCallback = options.onStoppedCallback || null;

    this.isRunning = false;
    this.capturedModules = null;

    this.packetCapture = new PacketCapture(this.interfaceName);
    this.moduleParser = new ModuleParser();
    this.moduleOptimizer = new ModuleOptimizer();
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    this.isRunning = true;

    this.packetCapture.startCapture(
      this._onSyncContainerData.bind(this),
      this._onStatusUpdate.bind(this)
    );
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.packetCapture.stopCapture();
    
    // Notify UI that monitoring has stopped
    if (this.onStoppedCallback) {
      this.onStoppedCallback();
    }
  }

  /**
   * Handle status update from packet capture
   * @private
   */
  _onStatusUpdate(status) {
    if (this.progressCallback) {
      this.progressCallback(status);
    }
  }

  /**
   * Parse raw protobuf data
   * @private
   * @param {Buffer} vData - Raw protobuf buffer
   * @returns {Array<ModuleInfo>|null} Parsed modules or null on failure
   */
  _parseRawProtobufData(vData) {
    if (this.progressCallback) {
      this.progressCallback("Parsing module data...");
    }
    
    const parsedData = this._parseProtobuf(vData);
    
    if (parsedData && parsedData.modules && parsedData.modules.length > 0) {
      return parsedData.modules;
    } else {
      const errorMsg = "No modules found in packet. Try changing channels or re-logging.";
      logger.warn(errorMsg);
      if (this.progressCallback) {
        this.progressCallback(errorMsg);
      }
      return null;
    }
  }

  /**
   * Parse object data using ModuleParser
   * @private
   * @param {Object} vData - Parsed object data
   * @returns {Array<ModuleInfo>|null} Parsed modules or null on failure
   */
  _parseObjectData(vData) {
    try {
      return this.moduleParser.parseModuleInfo(vData);
    } catch (parseErr) {
      logger.error(`ModuleParser failed: ${parseErr.message}`);
      if (this.progressCallback) {
        this.progressCallback(`Parse error: ${parseErr.message}`);
      }
      return null;
    }
  }

  /**
   * Accumulate modules, avoiding duplicates and triggering callbacks
   * @private
   * @param {Array<ModuleInfo>} allModules - Modules to accumulate
   */
  _accumulateModules(allModules) {
    if (allModules.length === 0) {
      const errorMsg = "No modules extracted from packet. Try changing channels or re-logging.";
      logger.warn(errorMsg);
      if (this.progressCallback) {
        this.progressCallback(errorMsg);
      }
      return;
    }

    // Accumulate modules instead of replacing
    if (this.capturedModules === null) {
      this.capturedModules = [];
    }
    
    // Add new modules, avoiding duplicates by UUID
    const existingUuids = new Set(this.capturedModules.map(m => m.uuid));
    const newModules = allModules.filter(m => !existingUuids.has(m.uuid));
    
    if (newModules.length > 0) {
      this.capturedModules.push(...newModules);

      // Notify GUI that data is captured
      if (this.onDataCapturedCallback) {
        this.onDataCapturedCallback();
      }

      // Auto-stop capture after successfully getting modules
      this.stopMonitoring();
      
      // Auto-run optimization
      if (this.progressCallback) {
        this.progressCallback("Optimizing module combinations...");
      }
      this.rescreenModules(
        this.initialCategory,
        this.initialAttributes,
        this.initialPrioritizedAttrs,
        this.initialPriorityOrderMode
      );
    } else {
      logger.warn("No new modules (all duplicates)");
    }
  }

  /**
   * Handle SyncContainerData callback
   * @private
   */
  async _onSyncContainerData(data) {
    try {
      const vData = data.vData;
      if (!vData) {
        logger.warn("Received data packet with no vData");
        return;
      }

      // Ensure protobuf schema is loaded
      if (!SyncContainerData || !CharSerialize) {
        const loaded = await loadProtobufSchema();
        if (!loaded) {
          const errorMsg = "Failed to load protobuf schema. Cannot parse module data.";
          logger.error(errorMsg);
          if (this.progressCallback) {
            this.progressCallback(errorMsg);
          }
          return;
        }
      }
      
      let allModules = [];
      
      // If raw protobuf data, we need to parse it first
      if (data.raw && Buffer.isBuffer(vData)) {
        allModules = this._parseRawProtobufData(vData);
        if (!allModules) {
          return;
        }
      } else if (typeof vData === 'object' && vData !== null) {
        // Already parsed object
        allModules = this._parseObjectData(vData);
        if (!allModules) {
          return;
        }
      } else {
        logger.warn(`Unexpected vData type: ${typeof vData}`);
        return;
      }

      this._accumulateModules(allModules);
    } catch (err) {
      logger.error(`Failed to process data packet: ${err.message}`);
      logger.error(err.stack);
      if (this.progressCallback) {
        this.progressCallback(`Error: ${err.message}`);
      }
    }
  }

  /**
   * Try parsing as SyncContainerData
   * @private
   * @param {Buffer} buffer - Buffer to parse
   * @returns {Object|null} Parsed result or null
   */
  _trySyncContainerData(buffer) {
    try {
      const syncData = SyncContainerData.decode(buffer);
      if (syncData && syncData.VData) {
        const result = this._extractModulesFromCharSerialize(syncData.VData);
        if (result && result.modules && result.modules.length > 0) {
          return result;
        }
      }
    } catch (err) {
      // Try next method
    }
    return null;
  }

  /**
   * Try parsing as CharSerialize directly
   * @private
   * @param {Buffer} buffer - Buffer to parse
   * @returns {Object|null} Parsed result or null
   */
  _tryCharSerialize(buffer) {
    try {
      const charData = CharSerialize.decode(buffer);
      if (charData) {
        const result = this._extractModulesFromCharSerialize(charData);
        if (result && result.modules && result.modules.length > 0) {
          return result;
        }
      }
    } catch (err) {
      // Try next method
    }
    return null;
  }

  /**
   * Try parsing with length prefix skipped
   * @private
   * @param {Buffer} buffer - Buffer to parse
   * @returns {Object|null} Parsed result or null
   */
  _tryLengthPrefixed(buffer) {
    if (buffer.length <= 4) {
      return null;
    }

    const possibleLen = buffer.readUInt32BE(0);
    if (possibleLen > 0 && possibleLen < buffer.length && possibleLen < 10 * 1024 * 1024) {
      const subBuffer = buffer.slice(4);
      try {
        const syncData = SyncContainerData.decode(subBuffer);
        if (syncData && syncData.VData) {
          const result = this._extractModulesFromCharSerialize(syncData.VData);
          if (result && result.modules && result.modules.length > 0) {
            return result;
          }
        }
      } catch (err) {
        // Continue to fallback
      }
    }
    return null;
  }

  /**
   * Parse raw protobuf data to extract module information
   * @private
   */
  _parseProtobuf(buffer) {
    // Ensure protobuf types are available
    if (!SyncContainerData || !CharSerialize) {
      logger.error('Protobuf types not loaded!');
      return null;
    }
    
    // Try proper protobuf parsing first
    let result = this._trySyncContainerData(buffer);
    if (result) {
      return result;
    }

    result = this._tryCharSerialize(buffer);
    if (result) {
      return result;
    }
    
    // The protobuf data might have a length prefix - try skipping it
    result = this._tryLengthPrefixed(buffer);
    if (result) {
      return result;
    }

    // Fallback: scan for module data patterns (heuristic)
    try {
      const modules = this._parseModulesFromWireFormat(buffer);
      if (modules && modules.length > 0) {
        return { modules };
      }
    } catch (err) {
      // All methods failed
    }
    
    logger.error('All parsing methods failed. Packet may not contain module data.');
    return null;
  }

  /**
   * Extract modules from parsed CharSerialize data
   * @private
   */
  _extractModulesFromCharSerialize(charData) {
    const modules = [];
    
    try {
      if (!charData) {
        logger.warn('CharSerialize data is null or undefined');
        return null;
      }

      const itemPackage = charData.ItemPackage;
      const modContainer = charData.Mod;
      
      if (!itemPackage) {
        logger.warn('No ItemPackage found in CharSerialize');
        return null;
      }

      if (!itemPackage.Packages) {
        logger.warn('ItemPackage.Packages is missing');
        return null;
      }

      const modInfos = modContainer?.ModInfos || {};
      
      // Diagnostic: log what we found
      const packageCount = Object.keys(itemPackage.Packages).length;
      const modInfoCount = Object.keys(modInfos).length;
      let itemsWithModNewAttr = 0;
      let itemsWithModInfo = 0;
      
      // Iterate through all packages
      for (const [pkgType, pkg] of Object.entries(itemPackage.Packages)) {
        if (!pkg || !pkg.Items) {
          continue;
        }
        
        for (const [itemKey, item] of Object.entries(pkg.Items)) {
          // Check if this item is a module
          if (!item || !item.ModNewAttr) {
            continue;
          }
          
          itemsWithModNewAttr++;

          const modParts = item.ModNewAttr.ModParts;
          if (!modParts || (Array.isArray(modParts) && modParts.length === 0)) {
            continue;
          }

          const configId = item.ConfigId;
          if (!configId) {
            continue;
          }

          const moduleName = MODULE_NAMES[configId] || `Module(${configId})`;
          const quality = item.Quality || 3;
          const uuid = item.Uuid;

          // Get attribute values from ModInfos
          // Try both itemKey (string) and uuid (number) as keys
          const modInfo = modInfos[itemKey] || modInfos[uuid] || modInfos[String(uuid)];
          
          if (!modInfo) {
            continue;
          }
          
          itemsWithModInfo++;

          const initLinkNums = modInfo.InitLinkNums || [];
          if (initLinkNums.length === 0) {
            continue;
          }

          const parts = [];
          // Handle both array and single value cases
          const modPartsArray = Array.isArray(modParts) ? modParts : [modParts];

          for (let i = 0; i < modPartsArray.length; i++) {
            const partId = modPartsArray[i];
            const value = i < initLinkNums.length ? initLinkNums[i] : 1;
            const attrName = MODULE_ATTR_NAMES[partId] || `Attr(${partId})`;
            parts.push(new ModulePart(partId, attrName, value));
          }

          if (parts.length > 0) {
            const moduleInfo = new ModuleInfo(moduleName, configId, uuid, quality, parts);
            modules.push(moduleInfo);
          }
        }
      }
      
      // Diagnostic summary if no modules found
      if (modules.length === 0) {
        logger.warn(`No modules extracted. Found: ${packageCount} packages, ${modInfoCount} ModInfos, ${itemsWithModNewAttr} items with ModNewAttr, ${itemsWithModInfo} items with matching ModInfo`);
      }
    } catch (err) {
      logger.error(`Error extracting modules: ${err.message}`);
      logger.error(err.stack);
    }

    return modules.length > 0 ? { modules } : null;
  }

  /**
   * Parse modules directly from protobuf wire format (fallback)
   * @private
   */
  _parseModulesFromWireFormat(buffer) {
    const modules = [];
    
    try {
      // Scan buffer for module configId patterns
      let offset = 0;
      while (offset < buffer.length - 8) {
        const val = buffer.readUInt32LE(offset);
        if (val >= 5500000 && val <= 5600000) {
          const moduleData = this._extractModuleAtOffset(buffer, offset);
          if (moduleData) {
            modules.push(moduleData);
          }
        }
        offset++;
      }
    } catch (err) {
      // Silent fail for fallback parser
    }
    
    return modules;
  }

  /**
   * Extract module data at a specific buffer offset (fallback heuristic)
   * @private
   */
  _extractModuleAtOffset(buffer, configIdOffset) {
    try {
      const configId = buffer.readUInt32LE(configIdOffset);
      const moduleName = MODULE_NAMES[configId] || `Module(${configId})`;
      const parts = [];
      
      for (let i = configIdOffset; i < Math.min(configIdOffset + 100, buffer.length - 4); i++) {
        const attrId = buffer.readUInt32LE(i);
        if (attrId >= 1100 && attrId <= 2500 && MODULE_ATTR_NAMES[attrId]) {
          if (i + 5 < buffer.length) {
            const value = buffer.readUInt8(i + 4);
            if (value > 0 && value <= 10) {
              parts.push(new ModulePart(attrId, MODULE_ATTR_NAMES[attrId], value));
            }
          }
        }
      }
      
      if (parts.length > 0) {
        const quality = Math.min(5, Math.max(3, (configId % 10)));
        return new ModuleInfo(moduleName, configId, Date.now(), quality, parts);
      }
    } catch (err) {
      // Module extraction error
    }
    
    return null;
  }

  /**
   * Check if module data has been captured
   */
  hasCapturedData() {
    return this.capturedModules !== null;
  }

  /**
   * Run optimization in background
   * @private
   */
  async _runOptimizationInBackground(category, attributes, prioritizedAttrs, priorityOrderMode) {
    if (!this.hasCapturedData()) {
      logger.error("Error: No module data available for optimization.");
      return;
    }

    const categoryMap = {
      "All": ModuleCategory.All,
      "Attack": ModuleCategory.ATTACK,
      "Guard": ModuleCategory.GUARDIAN,
      "Support": ModuleCategory.SUPPORT,
      "Todos": ModuleCategory.All,
      "Ataque": ModuleCategory.ATTACK,
      "Guardia": ModuleCategory.GUARDIAN,
      "Soporte": ModuleCategory.SUPPORT,
    };
    const targetCategory = categoryMap[category] || ModuleCategory.All;

    try {
      const solutions = await this.moduleOptimizer.getOptimalSolutions(
        this.capturedModules,
        targetCategory,
        20,
        priorityOrderMode ? prioritizedAttrs : attributes,
        priorityOrderMode,
        this.progressCallback
      );

      if (this.onResultsCallback && solutions.length > 0) {
        this.onResultsCallback(solutions);
      }
    } catch (err) {
      logger.error(`Optimization process failed: ${err.message}`);
      if (this.progressCallback) {
        this.progressCallback("Optimization failed.");
      }
    }
  }

  /**
   * Rescreen modules with new filter conditions
   */
  rescreenModules(category, attributes, prioritizedAttrs = null, priorityOrderMode = false) {
    if (!this.hasCapturedData()) {
      logger.error("Error: No module data available for rescreening.");
      return;
    }

    // Start optimization asynchronously
    this._runOptimizationInBackground(category, attributes, prioritizedAttrs || [], priorityOrderMode);
  }

  /**
   * Load modules from JSON data (for testing/demo)
   */
  loadModulesFromJson(jsonData) {
    const { ModuleInfo, ModulePart } = require('./moduleTypes');
    
    this.capturedModules = jsonData.map(item => {
      const module = new ModuleInfo(
        item.name,
        item.configId,
        item.uuid,
        item.quality,
        item.parts.map(p => new ModulePart(p.id, p.name, p.value))
      );
      return module;
    });

    if (this.onDataCapturedCallback) {
      this.onDataCapturedCallback();
    }

    return this.capturedModules;
  }
}

module.exports = { StarResonanceMonitor };

