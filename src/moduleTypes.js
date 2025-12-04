/**
 * Module Type Definitions
 * JavaScript port of module_types.py
 */

// Module Type Enum
const ModuleType = {
  BASIC_ATTACK: 5500101,
  HIGH_PERFORMANCE_ATTACK: 5500102,
  EXCELLENT_ATTACK: 5500103,
  EXCELLENT_ATTACK_PREFERRED: 5500104,
  BASIC_HEALING: 5500201,
  HIGH_PERFORMANCE_HEALING: 5500202,
  EXCELLENT_HEALING: 5500203,
  EXCELLENT_HEALING_PREFERRED: 5500204,
  BASIC_PROTECTION: 5500301,
  HIGH_PERFORMANCE_PROTECTION: 5500302,
  EXCELLENT_PROTECTION: 5500303,
  EXCELLENT_PROTECTION_PREFERRED: 5500304,
};

// Module Attribute Type Enum
const ModuleAttrType = {
  STRENGTH_BOOST: 1110,
  AGILITY_BOOST: 1111,
  INTELLIGENCE_BOOST: 1112,
  SPECIAL_ATTACK_DAMAGE: 1113,
  ELITE_STRIKE: 1114,
  SPECIAL_HEALING_BOOST: 1205,
  EXPERT_HEALING_BOOST: 1206,
  CASTING_FOCUS: 1407,
  ATTACK_SPEED_FOCUS: 1408,
  CRITICAL_FOCUS: 1409,
  LUCK_FOCUS: 1410,
  MAGIC_RESISTANCE: 1307,
  PHYSICAL_RESISTANCE: 1308,
  EXTREME_DAMAGE_STACK: 2104,
  EXTREME_FLEXIBLE_MOVEMENT: 2105,
  EXTREME_LIFE_CONVERGENCE: 2204,
  EXTREME_EMERGENCY_MEASURES: 2205,
  EXTREME_LIFE_FLUCTUATION: 2404,
  EXTREME_LIFE_DRAIN: 2405,
  EXTREME_TEAM_CRIT: 2406,
  EXTREME_DESPERATE_GUARDIAN: 2304,
};

// Module Category Enum
const ModuleCategory = {
  ATTACK: "Attack",
  GUARDIAN: "Guard",
  SUPPORT: "Support",
  All: "All",
};

// Module Names Mapping
const MODULE_NAMES = {
  [ModuleType.BASIC_ATTACK]: "Rare Attack",
  [ModuleType.HIGH_PERFORMANCE_ATTACK]: "Epic Attack",
  [ModuleType.EXCELLENT_ATTACK]: "Legendary Attack",
  [ModuleType.EXCELLENT_ATTACK_PREFERRED]: "Legendary Attack-Preferred",
  [ModuleType.BASIC_HEALING]: "Rare Support",
  [ModuleType.HIGH_PERFORMANCE_HEALING]: "Epic Support",
  [ModuleType.EXCELLENT_HEALING]: "Legendary Support",
  [ModuleType.EXCELLENT_HEALING_PREFERRED]: "Legendary Support-Preferred",
  [ModuleType.BASIC_PROTECTION]: "Rare Guard",
  [ModuleType.HIGH_PERFORMANCE_PROTECTION]: "Epic Guard",
  [ModuleType.EXCELLENT_PROTECTION]: "Legendary Guard",
  [ModuleType.EXCELLENT_PROTECTION_PREFERRED]: "Legendary Guard-Preferred",
};

// Module Attribute Names Mapping
const MODULE_ATTR_NAMES = {
  [ModuleAttrType.STRENGTH_BOOST]: "Strength Boost",
  [ModuleAttrType.AGILITY_BOOST]: "Agility Boost",
  [ModuleAttrType.INTELLIGENCE_BOOST]: "Intellect Boost",
  [ModuleAttrType.SPECIAL_ATTACK_DAMAGE]: "Special Attack",
  [ModuleAttrType.ELITE_STRIKE]: "Elite Strike",
  [ModuleAttrType.SPECIAL_HEALING_BOOST]: "Healing Boost",
  [ModuleAttrType.EXPERT_HEALING_BOOST]: "Healing Enhance",
  [ModuleAttrType.CASTING_FOCUS]: "Cast Focus",
  [ModuleAttrType.ATTACK_SPEED_FOCUS]: "Attack SPD",
  [ModuleAttrType.CRITICAL_FOCUS]: "Crit Focus",
  [ModuleAttrType.LUCK_FOCUS]: "Luck Focus",
  [ModuleAttrType.MAGIC_RESISTANCE]: "Resistance",
  [ModuleAttrType.PHYSICAL_RESISTANCE]: "Armor",
  [ModuleAttrType.EXTREME_DAMAGE_STACK]: "DMG Stack",
  [ModuleAttrType.EXTREME_FLEXIBLE_MOVEMENT]: "Agile",
  [ModuleAttrType.EXTREME_LIFE_CONVERGENCE]: "Life Condense",
  [ModuleAttrType.EXTREME_EMERGENCY_MEASURES]: "First Aid",
  [ModuleAttrType.EXTREME_LIFE_FLUCTUATION]: "Life Wave",
  [ModuleAttrType.EXTREME_LIFE_DRAIN]: "Life Steal",
  [ModuleAttrType.EXTREME_TEAM_CRIT]: "Team Luck & Crit",
  [ModuleAttrType.EXTREME_DESPERATE_GUARDIAN]: "Final Protection",
};

// Reverse mapping: name -> id
const MODULE_ATTR_IDS = Object.fromEntries(
  Object.entries(MODULE_ATTR_NAMES).map(([id, name]) => [name, parseInt(id)])
);

// Module Type to Category Mapping
const MODULE_CATEGORY_MAP = {
  [ModuleType.BASIC_ATTACK]: ModuleCategory.ATTACK,
  [ModuleType.HIGH_PERFORMANCE_ATTACK]: ModuleCategory.ATTACK,
  [ModuleType.EXCELLENT_ATTACK]: ModuleCategory.ATTACK,
  [ModuleType.EXCELLENT_ATTACK_PREFERRED]: ModuleCategory.ATTACK,
  [ModuleType.BASIC_PROTECTION]: ModuleCategory.GUARDIAN,
  [ModuleType.HIGH_PERFORMANCE_PROTECTION]: ModuleCategory.GUARDIAN,
  [ModuleType.EXCELLENT_PROTECTION]: ModuleCategory.GUARDIAN,
  [ModuleType.EXCELLENT_PROTECTION_PREFERRED]: ModuleCategory.GUARDIAN,
  [ModuleType.BASIC_HEALING]: ModuleCategory.SUPPORT,
  [ModuleType.HIGH_PERFORMANCE_HEALING]: ModuleCategory.SUPPORT,
  [ModuleType.EXCELLENT_HEALING]: ModuleCategory.SUPPORT,
  [ModuleType.EXCELLENT_HEALING_PREFERRED]: ModuleCategory.SUPPORT,
};

// Attribute Thresholds and Effect Levels
const ATTR_THRESHOLDS = [1, 4, 8, 12, 16, 20];

// Basic Attribute Power Mapping
const BASIC_ATTR_POWER_MAP = {
  1: 7,
  2: 14,
  3: 29,
  4: 44,
  5: 167,
  6: 254,
};

// Special Attribute Power Mapping
const SPECIAL_ATTR_POWER_MAP = {
  1: 14,
  2: 29,
  3: 59,
  4: 89,
  5: 298,
  6: 448,
};

// Module Total Attribute Value Power Mapping
const TOTAL_ATTR_POWER_MAP = {
  0: 0, 1: 5, 2: 11, 3: 17, 4: 23, 5: 29, 6: 34, 7: 40, 8: 46,
  18: 104, 19: 110, 20: 116, 21: 122, 22: 128, 23: 133, 24: 139, 25: 145,
  26: 151, 27: 157, 28: 163, 29: 168, 30: 174, 31: 180, 32: 186, 33: 192,
  34: 198, 35: 203, 36: 209, 37: 215, 38: 221, 39: 227, 40: 233, 41: 238,
  42: 244, 43: 250, 44: 256, 45: 262, 46: 267, 47: 273, 48: 279, 49: 285,
  50: 291, 51: 297, 52: 302, 53: 308, 54: 314, 55: 320, 56: 326, 57: 332,
  58: 337, 59: 343, 60: 349, 61: 355, 62: 361, 63: 366, 64: 372, 65: 378,
  66: 384, 67: 390, 68: 396, 69: 401, 70: 407, 71: 413, 72: 419, 73: 425,
  74: 431, 75: 436, 76: 442, 77: 448, 78: 454, 79: 460, 80: 466, 81: 471,
  82: 477, 83: 489, 84: 489, 85: 495, 86: 500, 87: 506, 88: 512, 89: 518,
  90: 524, 91: 530, 92: 535, 93: 541, 94: 547, 95: 553, 96: 559, 97: 565,
  98: 570, 99: 576, 100: 582, 101: 588, 102: 594, 103: 599, 104: 605, 105: 611,
  106: 617, 113: 658, 114: 664, 115: 669, 116: 675, 117: 681, 118: 687, 119: 693, 120: 699,
};

// Basic Attribute IDs Set
const BASIC_ATTR_IDS = new Set([
  ModuleAttrType.STRENGTH_BOOST,
  ModuleAttrType.AGILITY_BOOST,
  ModuleAttrType.INTELLIGENCE_BOOST,
  ModuleAttrType.SPECIAL_ATTACK_DAMAGE,
  ModuleAttrType.ELITE_STRIKE,
  ModuleAttrType.SPECIAL_HEALING_BOOST,
  ModuleAttrType.EXPERT_HEALING_BOOST,
  ModuleAttrType.CASTING_FOCUS,
  ModuleAttrType.ATTACK_SPEED_FOCUS,
  ModuleAttrType.CRITICAL_FOCUS,
  ModuleAttrType.LUCK_FOCUS,
  ModuleAttrType.MAGIC_RESISTANCE,
  ModuleAttrType.PHYSICAL_RESISTANCE,
]);

// Special Attribute IDs Set
const SPECIAL_ATTR_IDS = new Set([
  ModuleAttrType.EXTREME_DAMAGE_STACK,
  ModuleAttrType.EXTREME_FLEXIBLE_MOVEMENT,
  ModuleAttrType.EXTREME_LIFE_CONVERGENCE,
  ModuleAttrType.EXTREME_EMERGENCY_MEASURES,
  ModuleAttrType.EXTREME_LIFE_FLUCTUATION,
  ModuleAttrType.EXTREME_LIFE_DRAIN,
  ModuleAttrType.EXTREME_TEAM_CRIT,
  ModuleAttrType.EXTREME_DESPERATE_GUARDIAN,
]);

// Attribute Name to Type Mapping
const ATTR_NAME_TYPE_MAP = {
  "Strength Boost": "basic",
  "Agility Boost": "basic",
  "Intellect Boost": "basic",
  "Special Attack": "basic",
  "Elite Strike": "basic",
  "Healing Boost": "basic",
  "Healing Enhance": "basic",
  "Cast Focus": "basic",
  "Attack SPD": "basic",
  "Crit Focus": "basic",
  "Luck Focus": "basic",
  "Resistance": "basic",
  "Armor": "basic",
  "DMG Stack": "special",
  "Agile": "special",
  "Life Condense": "special",
  "First Aid": "special",
  "Life Wave": "special",
  "Life Steal": "special",
  "Team Luck & Crit": "special",
  "Final Protection": "special",
};

/**
 * Module Part class
 */
class ModulePart {
  constructor(id, name, value) {
    this.id = id;
    this.name = name;
    this.value = value;
  }
}

/**
 * Module Info class
 */
class ModuleInfo {
  constructor(name, configId, uuid, quality, parts = []) {
    this.name = name;
    this.configId = configId;
    this.uuid = uuid;
    this.quality = quality;
    this.parts = parts;
  }

  /**
   * Compare modules by UUID for sorting
   */
  compareTo(other) {
    return this.uuid - other.uuid;
  }
}

// Attribute Category Definitions
const PHYSICAL_ATTRIBUTES = new Set(["Strength Boost", "Agility Boost", "Attack SPD"]);
const MAGIC_ATTRIBUTES = new Set(["Intellect Boost", "Cast Focus"]);
const ATTACK_ATTRIBUTES = new Set(["Special Attack", "Elite Strike", "Strength Boost", "Agility Boost", "Intellect Boost"]);
const GUARDIAN_ATTRIBUTES = new Set(["Resistance", "Armor"]);
const SUPPORT_ATTRIBUTES = new Set(["Healing Boost", "Healing Enhance"]);

// All attributes list
const ALL_ATTRIBUTES = [
  "DMG Stack", "Agile", "Life Condense", "First Aid", "Life Wave", "Life Steal",
  "Team Luck & Crit", "Final Protection", "Strength Boost", "Agility Boost",
  "Intellect Boost", "Special Attack", "Elite Strike", "Healing Boost",
  "Healing Enhance", "Cast Focus", "Attack SPD", "Crit Focus", "Luck Focus",
  "Resistance", "Armor"
];

module.exports = {
  ModuleType,
  ModuleAttrType,
  ModuleCategory,
  MODULE_NAMES,
  MODULE_ATTR_NAMES,
  MODULE_ATTR_IDS,
  MODULE_CATEGORY_MAP,
  ATTR_THRESHOLDS,
  BASIC_ATTR_POWER_MAP,
  SPECIAL_ATTR_POWER_MAP,
  TOTAL_ATTR_POWER_MAP,
  BASIC_ATTR_IDS,
  SPECIAL_ATTR_IDS,
  ATTR_NAME_TYPE_MAP,
  ModulePart,
  ModuleInfo,
  PHYSICAL_ATTRIBUTES,
  MAGIC_ATTRIBUTES,
  ATTACK_ATTRIBUTES,
  GUARDIAN_ATTRIBUTES,
  SUPPORT_ATTRIBUTES,
  ALL_ATTRIBUTES,
};

