/**
 * Network Packet Capture
 * JavaScript port of packet_capture.py
 * Uses the 'cap' library for packet capture (requires npcap/winpcap on Windows)
 */

const { getLogger } = require('./logger');
const { ModuleParser } = require('./moduleParser');

const logger = getLogger('PacketCapture');

// Use @mongodb-js/zstd library (similar to Python's zstandard library)
let zstdDecompress = null;
let zstdIsAsync = false;

function initZstd() {
  try {
    // Try to use @mongodb-js/zstd (better than zstd-codec)
    const zstd = require('@mongodb-js/zstd');
    zstdDecompress = zstd.decompress;
    // @mongodb-js/zstd.decompress is async (returns Promise)
    zstdIsAsync = true;
    return true;
  } catch (err) {
    logger.warn(`@mongodb-js/zstd not available: ${err.message}`);
    logger.error('Please install @mongodb-js/zstd: npm install @mongodb-js/zstd');
    return false;
  }
}

// Initialize on load
const zstdAvailable = initZstd();

async function decompressZstd(data) {
  if (!zstdDecompress) {
    throw new Error('Zstd decompression not available. Install @mongodb-js/zstd: npm install @mongodb-js/zstd');
  }
  
  try {
    const result = zstdDecompress(data);
    if (result instanceof Promise) {
      return await result;
    }
    return result;
  } catch (err) {
    throw new Error(`Zstd decompression failed: ${err.message}`);
  }
}

/**
 * Binary Reader utility for parsing binary data
 */
class BinaryReader {
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
  }

  readUInt64() {
    const value = this.buffer.readBigUInt64BE(this.offset);
    this.offset += 8;
    return value;
  }

  readUInt32() {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  peekUInt32() {
    return this.buffer.readUInt32BE(this.offset);
  }

  readUInt16() {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readBytes(length) {
    // Create a copy (like Python bytes), not a slice view
    const value = Buffer.from(this.buffer.slice(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }

  remaining() {
    return this.buffer.length - this.offset;
  }

  readRemaining() {
    // Create a copy (like Python bytes), not a slice view
    const value = Buffer.from(this.buffer.slice(this.offset));
    this.offset = this.buffer.length;
    return value;
  }
}

/**
 * Packet Capture class
 */
class PacketCapture {
  constructor(interfaceName = null) {
    this.interfaceName = interfaceName;
    this.isRunning = false;
    this.callback = null;
    this.statusCallback = null;
    this.packetCount = 0;
    this.syncContainerCount = 0;
    this.lastStatusTime = 0;
    
    this.currentServer = '';
    // TCP cache with LRU eviction - stores {seq: {payload, lastAccess}}
    this.tcpCache = new Map();
    this.tcpNextSeq = -1;
    this.tcpLastTime = 0;
    this._data = Buffer.alloc(0);
    this.serverIdentifiedTime = 0;

    // Memory management settings
    this.maxCacheSize = 1000; // Maximum number of cached packets
    this.maxDataBufferSize = 10 * 1024 * 1024; // 10MB max for _data buffer

    this.moduleParser = new ModuleParser();
    this.cap = null;
    this.cleanupInterval = null;
    this.statusInterval = null;
  }

  /**
   * Start packet capture
   * @param {Function} callback - Data packet handler callback
   * @param {Function} statusCallback - Status update callback (optional)
   */
  async startCapture(callback = null, statusCallback = null) {
    this.callback = callback;
    this.statusCallback = statusCallback;
    this.isRunning = true;

    // Node.js zlib zstd support is always available, no initialization needed

    // Try to load 'cap' library dynamically
    try {
      const Cap = require('cap').Cap;
      const decoders = require('cap').decoders;
      
      this.cap = new Cap();
      const device = this.interfaceName || Cap.findDevice();
      
      if (!device) {
        logger.error('No capture device found!');
        return;
      }

      const filter = 'tcp';
      const bufSize = 10 * 1024 * 1024;
      const buffer = Buffer.alloc(65535);

      const linkType = this.cap.open(device, filter, bufSize, buffer);
      
      this.cap.on('packet', (nbytes, trunc) => {
        if (!this.isRunning) return;
        this.packetCount++;
        
        try {
          // Parse ethernet frame
          if (linkType === 'ETHERNET') {
            const ret = decoders.Ethernet(buffer);
            
            if (ret.info.type === decoders.PROTOCOL.ETHERNET.IPV4) {
              const ipv4 = decoders.IPV4(buffer, ret.offset);
              
              if (ipv4.info.protocol === decoders.PROTOCOL.IP.TCP) {
                const tcp = decoders.TCP(buffer, ipv4.offset);
                const payload = buffer.slice(tcp.offset, tcp.offset + (ipv4.info.totallen - ipv4.hdrlen - tcp.hdrlen));
                
                if (payload.length > 0) {
                  const srcServer = `${ipv4.info.srcaddr}:${tcp.info.srcport} -> ${ipv4.info.dstaddr}:${tcp.info.dstport}`;
                  
                  // Convert seqno to unsigned 32-bit (TCP sequence numbers are unsigned)
                  const seqno = tcp.info.seqno >>> 0;
                  
                  // Only process packets from the identified server
                  if (this.currentServer && srcServer === this.currentServer) {
                    this._processTcpStream(srcServer, seqno, payload);
                  } else if (!this.currentServer) {
                    // Try to identify server
                    this._processTcpStream(srcServer, seqno, payload);
                  }
                }
              }
            }
          }
        } catch (err) {
          // Error processing packet
        }
      });

      // Start cleanup interval
      this.cleanupInterval = setInterval(() => this._cleanupExpiredCache(), 10000);
      
      // Start status update interval to inform user
      this.statusInterval = setInterval(() => this._sendStatusUpdate(), 5000);
    } catch (err) {
      logger.warn(`Could not load native packet capture library: ${err.message}`);
      logger.info('Running in simulated mode - packet capture will not work without Npcap');
      
      // In simulated mode, we just keep running without actual capture
      this._simulatedMode = true;
      
      // Still start status updates so UI knows it's running
      this.statusInterval = setInterval(() => {
        if (this.statusCallback) {
          this.statusCallback('Packet capture unavailable - Npcap is required for network capture. App is running in simulated mode.');
        }
      }, 5000);
    }
  }

  /**
   * Stop packet capture and clean up all resources
   */
  stopCapture() {
    this.isRunning = false;
    
    if (this.cap) {
      try {
        this.cap.close();
      } catch (err) {
        // Ignore close errors
      }
      this.cap = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    // Explicitly clear all state to free memory
    this._clearTcpCache();
    this._data = Buffer.alloc(0); // Clear data buffer
    this.currentServer = ''; // Clear server state
    this.packetCount = 0;
    this.syncContainerCount = 0;
    this.tcpNextSeq = -1;
    this.tcpLastTime = 0;
    this.serverIdentifiedTime = 0;

    // Force garbage collection hint in development mode
    if (process.env.NODE_ENV !== 'production' && global.gc) {
      try {
        global.gc();
      } catch (err) {
        // GC not available or failed
      }
    }
  }

  /**
   * Send status update to UI
   */
  _sendStatusUpdate() {
    if (!this.isRunning || !this.statusCallback) return;
    
    // If in simulated mode (no Npcap), show appropriate message
    if (this._simulatedMode) {
      this.statusCallback('Packet capture unavailable - Npcap is required for network capture. Install Npcap to capture game packets.');
      return;
    }
    
    let status = '';
    if (this.currentServer) {
      if (this.syncContainerCount === 0) {
        status = `Connected to game server (${this.packetCount} packets). Change channels or re-login to capture modules...`;
      } else {
        status = `Connected. Found ${this.syncContainerCount} SyncContainerData packet(s). Packets: ${this.packetCount}`;
      }
    } else {
      status = `Listening for game traffic... (${this.packetCount} packets captured)`;
    }
    
    this.statusCallback(status);
  }

  /**
   * Identify and cache server if not already identified
   * @private
   * @param {string} srcServer - Source server identifier
   * @param {number} seq - TCP sequence number
   * @param {Buffer} payload - Packet payload
   * @returns {boolean} True if server was identified or already known
   */
  _identifyAndCacheServer(srcServer, seq, payload) {
    // Server identification logic
    if (this.currentServer !== srcServer) {
      if (this._identifyGameServer(payload)) {
        this.currentServer = srcServer;
        this.serverIdentifiedTime = Date.now(); // Track when server was identified
        this._clearTcpCache();
        // Use unsigned 32-bit arithmetic: (seq + payload.length) >>> 0
        this.tcpNextSeq = ((seq + payload.length) >>> 0);
        return true;
      } else {
        return false; // Not game server, skip
      }
    }
    return true; // Server already identified
  }

  /**
   * Evict oldest cache entry (LRU policy)
   * @private
   */
  _evictOldestCacheEntry() {
    if (this.tcpCache.size === 0) return;
    
    let oldestSeq = null;
    let oldestTime = Infinity;
    
    // Find the least recently used entry
    for (const [seq, entry] of this.tcpCache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestSeq = seq;
      }
    }
    
    if (oldestSeq !== null) {
      this.tcpCache.delete(oldestSeq);
    }
  }

  /**
   * Reassemble TCP stream from cached packets
   * @private
   */
  _reassembleTcpStream() {
    // TCP stream reassembly
    if (this.tcpNextSeq === -1) {
      logger.error('TCP stream reassembly error: tcpNextSeq is -1');
      return false;
    }

    // Ensure tcpNextSeq is unsigned 32-bit
    this.tcpNextSeq = this.tcpNextSeq >>> 0;

    // Process packets in order
    while (this.tcpCache.has(this.tcpNextSeq)) {
      const currentSeq = this.tcpNextSeq;
      const cacheEntry = this.tcpCache.get(currentSeq);
      const cachedData = cacheEntry.payload;
      
      // Check data buffer size limit
      if (this._data.length + cachedData.length > this.maxDataBufferSize) {
        logger.warn(`Data buffer size limit reached (${this.maxDataBufferSize} bytes). Clearing buffer.`);
        this._data = Buffer.alloc(0);
        // Clear cache to prevent further accumulation
        this.tcpCache.clear();
        break;
      }
      
      this._data = Buffer.concat([this._data, cachedData]);
      this.tcpNextSeq = ((currentSeq + cachedData.length) >>> 0);
      this.tcpCache.delete(currentSeq);
      this.tcpLastTime = Date.now();
    }

    return true;
  }

  /**
   * Process TCP stream data
   * @private
   */
  _processTcpStream(srcServer, seq, payload) {
    // Convert seq to unsigned 32-bit (handle JavaScript signed number issue)
    seq = seq >>> 0;
    
    // Identify and cache server if needed
    if (!this._identifyAndCacheServer(srcServer, seq, payload)) {
      return; // Not game server, skip
    }

    if (!this.currentServer) return;

    // Handle initial sequence number if not set
    if (this.tcpNextSeq === -1) {
      if (payload.length > 4 && payload.readUInt32BE(0) < 0x0fffff) {
        this.tcpNextSeq = seq;
      } else {
        return;
      }
    }

    // Ensure tcpNextSeq is unsigned 32-bit
    this.tcpNextSeq = this.tcpNextSeq >>> 0;

    // Cache packet - Python: if (self.tcp_next_seq - seq) <= 0
    // This means: cache if seq >= tcp_next_seq (packet is at or after expected position)
    // For unsigned 32-bit: if tcpNextSeq <= seq, cache it
    // Handle wrap-around: if seq is much smaller, it might have wrapped
    const shouldCache = (seq >= this.tcpNextSeq) || 
                        (this.tcpNextSeq > 0x7fffffff && seq < 0x80000000); // Handle wrap-around
    
    if (shouldCache) {
      // Enforce cache size limit with LRU eviction
      if (this.tcpCache.size >= this.maxCacheSize) {
        this._evictOldestCacheEntry();
      }
      
      // Store with access time for LRU tracking
      this.tcpCache.set(seq, {
        payload: payload,
        lastAccess: Date.now()
      });
    }

    // Reassemble TCP stream
    this._reassembleTcpStream();

    // Process complete packets (async, but don't await to avoid blocking)
    this._processCompletePackets().catch(err => {
      logger.debug(`Error in _processCompletePackets: ${err.message}`);
    });
  }

  /**
   * Identify game server signature
   */
  _identifyGameServer(payload) {
    if (payload.length < 10) return false;

    try {
      if (payload[4] === 0) {
        const data = payload.slice(10);
        if (data.length >= 11) {
          // Check game server signature: \x00\x63\x33\x53\x42\x00
          const signature = Buffer.from([0x00, 0x63, 0x33, 0x53, 0x42, 0x00]);
          if (data.slice(5, 11).equals(signature)) {
            return true;
          }
        }
      }

      if (payload.length === 0x62) {
        // Check login response signature
        const loginSig = Buffer.from([0x00, 0x00, 0x00, 0x62, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01]);
        const additionalSig = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x0a, 0x4e]);
        if (payload.slice(0, 10).equals(loginSig) && payload.slice(14, 20).equals(additionalSig)) {
          return true;
        }
      }
    } catch (err) {
        // Server identification failed silently
    }

    return false;
  }

  /**
   * Clear TCP cache and free memory
   */
  _clearTcpCache() {
    // Explicitly nullify payloads to help GC
    for (const entry of this.tcpCache.values()) {
      if (entry && entry.payload) {
        entry.payload = null;
      }
    }
    this.tcpCache.clear();
    this._data = Buffer.alloc(0);
    this.tcpNextSeq = -1;
    this.tcpLastTime = 0;
  }

  /**
   * Process complete packets
   */
  async _processCompletePackets() {
    while (this._data.length > 4) {
      try {
        const packetSize = this._data.readUInt32BE(0);

        if (this._data.length < packetSize) break;
        if (packetSize > 0x0fffff) {
          logger.error(`Invalid packet size: ${packetSize}`);
          break;
        }

        const packet = this._data.slice(0, packetSize);
        this._data = this._data.slice(packetSize);

        await this._analyzePayload(packet);
      } catch (err) {
        // Failed to process packet
        break;
      }
    }
  }

  /**
   * Process parsed packet data
   * @private
   * @param {Object} parsedData - Parsed packet data
   */
  _processPacket(parsedData) {
    if (!parsedData) {
      return;
    }

    this.syncContainerCount++;
    // Found SyncContainerData packet

    if (this.callback) {
      // Callback may be async, handle it properly
      const result = this.callback(parsedData);
      // If it returns a promise and fails, log the error
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          logger.error(`Callback error: ${err.message}`);
        });
      }
    }
  }

  /**
   * Analyze packet payload
   * @private
   */
  async _analyzePayload(payload) {
    if (payload.length < 4) return;

    try {
      const parsedData = await this._parseSyncContainerData(payload);
      this._processPacket(parsedData);
    } catch (err) {
      // Failed to parse packet
    }
  }

  /**
   * Parse SyncContainerData packet
   */
  async _parseSyncContainerData(payload) {
    try {
      const packetsReader = new BinaryReader(payload);

      while (packetsReader.remaining() > 0) {
        const packetSize = packetsReader.peekUInt32();
        if (packetSize < 6) {
          // Invalid packet
          return null;
        }

        const packetData = packetsReader.readBytes(packetSize);
        const packetReader = new BinaryReader(packetData);

        packetReader.readUInt32(); // packet size
        const packetType = packetReader.readUInt16();

        const isZstdCompressed = (packetType & 0x8000) !== 0;
        const msgTypeId = packetType & 0x7fff;
        
        // Process large packets

        // Process message types
        if (msgTypeId === 2) { // Notify
          const result = await this._processNotifyMsg(packetReader, isZstdCompressed);
          if (result) {
            return result;
          }
        } else if (msgTypeId === 6) { // FrameDown - contains nested packets
          const result = await this._processFrameDownMsg(packetReader, isZstdCompressed);
          if (result) {
            return result;
          }
        }
        // Silently skip other message types (they're normal game packets)
      }
      } catch (err) {
        // Failed to parse SyncContainerData
      }

    return null;
  }

  /**
   * Process Notify message
   */
  async _processNotifyMsg(reader, isZstdCompressed) {
    try {
      const serviceUuid = reader.readUInt64();
      reader.readUInt32(); // stubId
      const methodId = reader.readUInt32();

      const GAME_SERVICE_UUID = BigInt('0x0000000063335342');
      
      if (serviceUuid !== GAME_SERVICE_UUID) {
        return null;
      }

      // Log all methodIds for the first 60 seconds after server identification to diagnose
      const timeSinceServerId = Date.now() - (this.serverIdentifiedTime || 0);
      const isEarlyPhase = timeSinceServerId < 60000; // First 60 seconds
      
      // Process methodId messages

      let msgPayload = reader.readRemaining();

      // Decompress if needed
      // Python: dctx.decompress(msg_payload, max_output_size=1024*1024)
      if (isZstdCompressed && msgPayload && msgPayload.length > 0) {
        try {
          msgPayload = await decompressZstd(msgPayload);
        } catch (err) {
          logger.warn(`Zstd decompression failed for methodId=${methodId}: ${err.message}`);
          // Continue with original payload
        }
      }

      // SyncContainerData methodId = 21 (0x15) - main module data packet
      const SYNC_CONTAINER_DATA_METHOD = 21;
      
      if (methodId === SYNC_CONTAINER_DATA_METHOD) {
        return { vData: msgPayload, raw: true, methodId };
      }
    } catch (err) {
      // Failed to process Notify message
    }

    return null;
  }

  /**
   * Process FrameDown message
   */
  async _processFrameDownMsg(reader, isZstdCompressed) {
    try {
      const serverSequenceId = reader.readUInt32();

      if (reader.remaining() === 0) return null;

      let nestedPacket = reader.readRemaining();
      const originalSize = nestedPacket.length;

      // Decompress if needed - FrameDown often contains compressed data
      // Python: dctx.decompress(nested_packet, max_output_size=1024*1024)
      if (isZstdCompressed && nestedPacket && nestedPacket.length > 0) {
        try {
          nestedPacket = await decompressZstd(nestedPacket);
          // FrameDown decompressed
        } catch (err) {
          logger.error(`FrameDown zstd decompression failed: ${err.message}, originalSize=${originalSize}`);
          // Can't process compressed data without decompression
          return null;
        }
      }

      // Recursively process nested packet - this should find Notify messages with methodId=21
      return await this._parseSyncContainerData(nestedPacket);
    } catch (err) {
      // Failed to process FrameDown message
    }

    return null;
  }

  /**
   * Check if payload contains module data
   * Look for module config IDs (55xxxxx pattern) in both LE and BE formats
   */
  _containsModuleData(payload) {
    if (payload.length < 20) return false;
    
    try {
      // Module configIds are typically 5500xxx (e.g., 5500101, 5500201, etc.)
      // Check both little-endian and big-endian since protobuf uses varint encoding
      
      if (payload.length > 50) {
        for (let i = 0; i < payload.length - 4; i++) {
          // Check LE format
          const valLE = payload.readUInt32LE(i);
          if (valLE >= 5500000 && valLE <= 5600000) {
            return true;
          }
          
          // Check BE format  
          const valBE = payload.readUInt32BE(i);
          if (valBE >= 5500000 && valBE <= 5600000) {
            return true;
          }
        }
        
        // Also check for varint encoded configIds
        // 5500000 in varint would be: A0 F0 CF 02 (approximately)
        // Let's also check for attribute IDs which are more common (1xxx, 2xxx range)
        for (let i = 0; i < payload.length - 2; i++) {
          const val16LE = payload.readUInt16LE(i);
          // Common attribute ID ranges
          if ((val16LE >= 1100 && val16LE <= 1500) || (val16LE >= 2100 && val16LE <= 2500)) {
            // If we find multiple attribute IDs, this is likely module data
            let attrCount = 0;
            for (let j = i; j < Math.min(i + 200, payload.length - 2); j += 2) {
              const v = payload.readUInt16LE(j);
              if ((v >= 1100 && v <= 1500) || (v >= 2100 && v <= 2500)) {
                attrCount++;
              }
            }
            if (attrCount >= 3) {
              return true;
            }
          }
        }
      }
    } catch (err) {
        // Error checking for module data
    }
    
    return false;
  }

  /**
   * Cleanup expired cache entries and old data buffers
   */
  _cleanupExpiredCache() {
    const FRAGMENT_TIMEOUT = 30000; // 30 seconds
    const CACHE_ENTRY_TIMEOUT = 60000; // 60 seconds for individual cache entries
    const currentTime = Date.now();

    // Clear expired TCP cache entries (LRU cleanup)
    let cleanedCount = 0;
    for (const [seq, entry] of this.tcpCache.entries()) {
      if (currentTime - entry.lastAccess > CACHE_ENTRY_TIMEOUT) {
        this.tcpCache.delete(seq);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned ${cleanedCount} expired TCP cache entries`);
    }

    // Clear expired TCP cache if stream is stale
    if (this.tcpLastTime && currentTime - this.tcpLastTime > FRAGMENT_TIMEOUT) {
      const expiredCount = this.tcpCache.size;
      if (expiredCount > 0) {
        // Clear old data buffers before clearing cache
        for (const entry of this.tcpCache.values()) {
          // Explicitly nullify payload to help GC
          entry.payload = null;
        }
        this.tcpCache.clear();
        logger.debug(`Cleaned ${expiredCount} expired TCP cache entries due to stale stream`);
      }

      // Clear large data buffer if it's been stale
      if (this._data.length > 1024 * 1024) { // If buffer > 1MB
        const oldSize = this._data.length;
        this._data = Buffer.alloc(0);
        logger.debug(`Cleared large stale data buffer (${oldSize} bytes)`);
      }

      logger.warn('Cannot capture next packet! Game may be closed or disconnected? seq: ' + this.tcpNextSeq);
      this.currentServer = '';
      this._clearTcpCache();
    }

    // Force garbage collection hint for large buffers in development mode
    if (process.env.NODE_ENV !== 'production' && global.gc) {
      const totalCacheSize = Array.from(this.tcpCache.values())
        .reduce((sum, entry) => sum + (entry.payload ? entry.payload.length : 0), 0);
      
      if (totalCacheSize > 5 * 1024 * 1024 || this._data.length > 5 * 1024 * 1024) {
        // Large buffers detected, suggest GC
        try {
          global.gc();
        } catch (err) {
          // GC not available or failed
        }
      }
    }
  }

  /**
   * For simulated/test mode - inject data manually
   */
  injectData(data) {
    if (this.callback && data) {
      this.callback(data);
    }
  }
}

module.exports = { PacketCapture, BinaryReader };

