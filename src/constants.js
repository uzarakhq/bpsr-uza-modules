/**
 * Constants and Enums
 * Centralized constants file for the BPSR Uza Modules application
 */

// ============================================================================
// Status Types Enum
// ============================================================================

/**
 * @enum {string}
 * Application status types
 */
const StatusType = {
  IDLE: 'idle',
  STARTING: 'starting',
  MONITORING: 'monitoring',
  CAPTURED: 'captured',
  CUSTOM: 'custom',
};

// ============================================================================
// Protocol Constants
// ============================================================================

/**
 * SyncContainerData method ID - main module data packet
 * @type {number}
 */
const SYNC_CONTAINER_DATA_METHOD = 21;

/**
 * Game service UUID for identifying game server packets
 * @type {bigint}
 */
const GAME_SERVICE_UUID = BigInt('0x0000000063335342');

/**
 * Module config ID range
 * @type {Object}
 */
const MODULE_CONFIG_ID_RANGE = {
  MIN: 5500000,
  MAX: 5600000,
};

/**
 * Attribute ID ranges
 * @type {Object}
 */
const ATTRIBUTE_ID_RANGES = {
  BASIC_MIN: 1100,
  BASIC_MAX: 1500,
  SPECIAL_MIN: 2100,
  SPECIAL_MAX: 2500,
};

// ============================================================================
// Status Messages
// ============================================================================

/**
 * Status message keys for translations
 * @type {Object}
 */
const STATUS_MESSAGE_KEYS = {
  IDLE: 'statusIdle',
  STARTING: 'statusStarting',
  MONITORING: 'statusMonitoring',
  CAPTURED: 'statusCaptured',
};

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Common error messages used throughout the application
 * @type {Object}
 */
const ERROR_MESSAGES = {
  PROTOBUF_SCHEMA_LOAD_FAILED: 'Failed to load protobuf schema. Cannot parse module data.',
  NO_MODULES_IN_PACKET: 'No modules found in packet. Try changing channels or re-logging.',
  NO_MODULES_EXTRACTED: 'No modules extracted from packet. Try changing channels or re-logging.',
  MODULE_PARSER_FAILED: 'ModuleParser failed',
  PROTOBUF_TYPES_NOT_LOADED: 'Protobuf types not loaded!',
  ALL_PARSING_METHODS_FAILED: 'All parsing methods failed. Packet may not contain module data.',
  NO_MODULE_DATA_AVAILABLE: 'No module data available for optimization.',
  NO_CAPTURED_DATA: 'No captured module data available',
  OPTIMIZATION_FAILED: 'Optimization failed.',
  PACKET_CAPTURE_UNAVAILABLE: 'Packet capture unavailable - Npcap is required for network capture.',
  NO_CAPTURE_DEVICE: 'No capture device found!',
  TCP_STREAM_REASSEMBLY_ERROR: 'TCP stream reassembly error: tcpNextSeq is -1',
  ZSTD_DECOMPRESSION_UNAVAILABLE: 'Zstd decompression not available. Install @mongodb-js/zstd: npm install @mongodb-js/zstd',
  ZSTD_DECOMPRESSION_FAILED: 'Zstd decompression failed',
  FRAME_DOWN_DECOMPRESSION_FAILED: 'FrameDown zstd decompression failed',
  INVALID_PACKET_SIZE: 'Invalid packet size',
  CANNOT_CAPTURE_NEXT_PACKET: 'Cannot capture next packet! Game may be closed or disconnected?',
  FAILED_TO_START_MONITORING: 'Failed to start monitoring',
  FAILED_TO_RESCREEN: 'Failed to rescreen',
  NO_ACTIVE_MONITOR: 'No active monitor',
};

// ============================================================================
// Info Messages
// ============================================================================

/**
 * Common info/status messages
 * @type {Object}
 */
const INFO_MESSAGES = {
  PARSING_MODULE_DATA: 'Parsing module data...',
  OPTIMIZING_COMBINATIONS: 'Optimizing module combinations...',
  CONNECTED_TO_GAME_SERVER: 'Connected to game server',
  LISTENING_FOR_TRAFFIC: 'Listening for game traffic...',
  CHANGE_CHANNEL_OR_RELOGIN: 'Change channels or re-login to capture modules...',
  CHANGE_CHANNEL_TO_PROCESS: 'Change channels in-game to start processing modules.',
  WAITING_FOR_MODULES: 'Waiting for modules to be combined...',
  NO_NEW_MODULES: 'No new modules (all duplicates)',
};

// ============================================================================
// Module Categories
// ============================================================================

// Re-export ModuleCategory from moduleTypes for convenience
const { ModuleCategory } = require('./moduleTypes');

// ============================================================================
// Log Levels
// ============================================================================

// Re-export LogLevel from logger for convenience
const { LogLevel } = require('./logger');

// ============================================================================
// Protocol Signature Bytes
// ============================================================================

/**
 * Game server signature bytes for identification
 * @type {Buffer}
 */
const GAME_SERVER_SIGNATURE = Buffer.from([0x00, 0x63, 0x33, 0x53, 0x42, 0x00]);

/**
 * Login response signature bytes
 * @type {Object}
 */
const LOGIN_SIGNATURES = {
  LOGIN_SIG: Buffer.from([0x00, 0x00, 0x00, 0x62, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01]),
  ADDITIONAL_SIG: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x0a, 0x4e]),
};

// ============================================================================
// Packet Processing Constants
// ============================================================================

/**
 * Packet size limits
 * @type {Object}
 */
const PACKET_LIMITS = {
  MAX_PACKET_SIZE: 0x0fffff, // Maximum valid packet size
  MIN_PACKET_SIZE: 4, // Minimum packet size (for size header)
};

/**
 * Message type IDs
 * @type {Object}
 */
const MESSAGE_TYPES = {
  NOTIFY: 2,
  FRAME_DOWN: 6,
};

/**
 * Zstd compression flag mask
 * @type {number}
 */
const ZSTD_COMPRESSION_FLAG = 0x8000;

/**
 * Message type ID mask (without compression flag)
 * @type {number}
 */
const MESSAGE_TYPE_ID_MASK = 0x7fff;

// ============================================================================
// Category Name Mappings
// ============================================================================

/**
 * Category name to ModuleCategory enum mapping
 * Supports both English and Spanish category names
 * @type {Object}
 */
const CATEGORY_NAME_MAP = {
  'All': ModuleCategory.All,
  'Attack': ModuleCategory.ATTACK,
  'Guard': ModuleCategory.GUARDIAN,
  'Support': ModuleCategory.SUPPORT,
  'Todos': ModuleCategory.All,
  'Ataque': ModuleCategory.ATTACK,
  'Guardia': ModuleCategory.GUARDIAN,
  'Soporte': ModuleCategory.SUPPORT,
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Status Types
  StatusType,
  
  // Protocol Constants
  SYNC_CONTAINER_DATA_METHOD,
  GAME_SERVICE_UUID,
  MODULE_CONFIG_ID_RANGE,
  ATTRIBUTE_ID_RANGES,
  
  // Status Messages
  STATUS_MESSAGE_KEYS,
  
  // Error Messages
  ERROR_MESSAGES,
  
  // Info Messages
  INFO_MESSAGES,
  
  // Module Categories (re-exported)
  ModuleCategory,
  
  // Log Levels (re-exported)
  LogLevel,
  
  // Protocol Signatures
  GAME_SERVER_SIGNATURE,
  LOGIN_SIGNATURES,
  
  // Packet Processing
  PACKET_LIMITS,
  MESSAGE_TYPES,
  ZSTD_COMPRESSION_FLAG,
  MESSAGE_TYPE_ID_MASK,
  
  // Category Mappings
  CATEGORY_NAME_MAP,
};

