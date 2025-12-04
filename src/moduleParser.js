/**
 * Module Parser
 * JavaScript port of module_parser.py
 */

const { ModuleInfo, ModulePart, MODULE_NAMES, MODULE_ATTR_NAMES } = require('./moduleTypes');
const { getLogger } = require('./logger');

const logger = getLogger('ModuleParser');

/**
 * Helper function: check if an object is iterable (but not a string)
 */
function isIterable(obj) {
  if (typeof obj === 'string') return false;
  return obj != null && typeof obj[Symbol.iterator] === 'function';
}

/**
 * Module Parser class
 */
class ModuleParser {
  constructor() {
    this.logger = logger;
  }

  /**
   * Parse module info from the protobuf data
   * @param {Object} vData - CharSerialize protobuf object
   * @param {string[]} attributes - Attributes to filter for
   * @param {string[]} excludeAttributes - Attributes to exclude
   * @param {number} matchCount - Minimum number of attributes to match
   * @returns {ModuleInfo[]} List of parsed modules
   */
  parseModuleInfo(vData, attributes = null, excludeAttributes = null, matchCount = 1) {
    // Starting module parsing
    
    const modInfos = vData.Mod?.ModInfos || {};
    const modules = [];

    const packages = vData.ItemPackage?.Packages || {};
    
    for (const [packageType, pkg] of Object.entries(packages)) {
      const items = pkg.Items || {};
      const itemValues = Object.values(items);
      
      // Check if this is a module package
      const firstItem = itemValues[0];
      if (!firstItem || !firstItem.ModNewAttr) {
        continue; // Not a module package, skip
      }

      for (const [key, item] of Object.entries(items)) {
        if (item.ModNewAttr && item.ModNewAttr.ModParts && item.ModNewAttr.ModParts.length > 0) {
          const configId = item.ConfigId;
          const modInfoDetails = modInfos[key];
          if (!modInfoDetails) continue;

          const moduleInfo = new ModuleInfo(
            MODULE_NAMES[configId] || `Unknown Module(${configId})`,
            configId,
            item.Uuid,
            item.Quality,
            []
          );

          // Handle raw mod parts - could be a single integer or an array
          let rawModParts = item.ModNewAttr.ModParts;
          let modParts = isIterable(rawModParts) ? [...rawModParts] : [rawModParts];

          let rawInitLinkNums = modInfoDetails.InitLinkNums;
          let initLinkNums = isIterable(rawInitLinkNums) ? [...rawInitLinkNums] : [rawInitLinkNums];

          for (let i = 0; i < modParts.length; i++) {
            const partId = modParts[i];
            if (i < initLinkNums.length) {
              moduleInfo.parts.push(new ModulePart(
                partId,
                MODULE_ATTR_NAMES[partId] || `Unknown Attribute(${partId})`,
                initLinkNums[i]
              ));
            }
          }
          
          modules.push(moduleInfo);
        }
      }
    }

    // Parsed modules

    if (attributes || excludeAttributes) {
      const filteredModules = this._filterModulesByAttributes(modules, attributes, excludeAttributes, matchCount);
      // After basic attribute filtering
      return filteredModules;
    }

    return modules;
  }

  /**
   * Filter modules by attributes (private helper method)
   * @private
   */
  _filterModulesByAttributes(modules, attributes = null, excludeAttributes = null, matchCount = 1) {
    if (!attributes && !excludeAttributes) {
      return modules;
    }

    const filteredModules = [];
    
    for (const module of modules) {
      const moduleAttrs = new Set(module.parts.map(p => p.name));

      // Check for excluded attributes
      if (excludeAttributes && excludeAttributes.some(attr => moduleAttrs.has(attr))) {
        continue;
      }

      // Check for required attributes
      if (attributes) {
        const matchingAttrsCount = attributes.filter(attr => moduleAttrs.has(attr)).length;
        if (matchingAttrsCount >= matchCount) {
          filteredModules.push(module);
        }
      } else {
        filteredModules.push(module);
      }
    }

    return filteredModules;
  }
}

module.exports = { ModuleParser };

