/**
 * Network Interface Utilities
 * JavaScript port of network_interface_util.py
 */

const os = require('os');
const { getLogger } = require('./logger');

const logger = getLogger('NetworkInterfaceUtil');

/**
 * Get all network interfaces using cap's device list for proper Windows support
 * @returns {Array} List of network interface information
 */
function getNetworkInterfaces() {
  const interfaces = [];
  
  try {
    // Try to use cap's device list for proper device names
    const Cap = require('cap').Cap;
    const capDevices = Cap.deviceList();
    
    for (const device of capDevices) {
      // Filter out loopback interfaces
      if (device.name.toLowerCase().includes('loopback') ||
          device.description?.toLowerCase().includes('loopback')) {
        continue;
      }

      // Get IPv4 addresses
      const ipv4Addresses = (device.addresses || [])
        .filter(addr => addr.addr && !addr.addr.includes(':')) // Filter IPv4 only
        .map(addr => ({
          addr: addr.addr,
          netmask: addr.netmask || '255.255.255.0',
          internal: false,
        }));

      // Only include interfaces with IPv4 addresses
      if (ipv4Addresses.length > 0) {
        interfaces.push({
          name: device.name, // This is the proper device name for cap
          description: device.description || device.name,
          addresses: ipv4Addresses,
          isUp: true,
        });
      }
    }
    
    // Found network interfaces via cap
  } catch (err) {
    logger.warn(`Cap device list failed, falling back to OS interfaces: ${err.message}`);
    
    // Fallback to OS network interfaces
    try {
      const netInterfaces = os.networkInterfaces();
      
      for (const [name, addresses] of Object.entries(netInterfaces)) {
        if (name.toLowerCase().startsWith('lo') || 
            name.toLowerCase().includes('loopback') ||
            name.toLowerCase().includes('vethernet') ||
            name.toLowerCase().includes('vmware')) {
          continue;
        }

        const ipv4Addresses = addresses
          .filter(addr => addr.family === 'IPv4')
          .map(addr => ({
            addr: addr.address,
            netmask: addr.netmask,
            internal: addr.internal,
          }));

        if (ipv4Addresses.length > 0) {
          interfaces.push({
            name: name,
            description: name,
            addresses: ipv4Addresses,
            isUp: true,
          });
        }
      }
    } catch (osErr) {
      logger.error(`Failed to get network interfaces: ${osErr.message}`);
    }
  }

  return interfaces;
}

/**
 * Find default network interface
 * Prioritizes Ethernet interfaces over WiFi/other interfaces
 * @param {Array} interfaces - List of network interfaces
 * @returns {number|null} Index of default interface or null
 */
function findDefaultNetworkInterface(interfaces) {
  if (!interfaces || interfaces.length === 0) {
    return null;
  }

  // First, try to find an Ethernet interface
  for (let i = 0; i < interfaces.length; i++) {
    const iface = interfaces[i];
    const name = (iface.name || '').toLowerCase();
    const desc = (iface.description || '').toLowerCase();
    
    // Check if it's an Ethernet interface
    const isEthernet = name.includes('ethernet') || 
                      desc.includes('ethernet') ||
                      name.startsWith('eth') ||
                      name.startsWith('en') && !name.includes('wifi') && !name.includes('wlan');
    
    if (isEthernet) {
      const hasNonInternalAddress = iface.addresses.some(addr => !addr.internal);
      if (hasNonInternalAddress) {
        return i;
      }
    }
  }
  
  // Fallback: Return the first active non-internal interface
  for (let i = 0; i < interfaces.length; i++) {
    const iface = interfaces[i];
    const hasNonInternalAddress = iface.addresses.some(addr => !addr.internal);
    if (hasNonInternalAddress) {
      return i;
    }
  }
  
  // Last resort: return first interface
  return 0;
}

/**
 * Display network interfaces
 * @param {Array} interfaces - List of network interfaces
 */
function displayNetworkInterfaces(interfaces) {
  // Display functionality removed - interfaces are shown in UI
}

/**
 * Select network interface
 * @param {Array} interfaces - List of network interfaces
 * @param {boolean} autoDetect - Auto-detect default interface
 * @returns {number|null} Selected interface index
 */
function selectNetworkInterface(interfaces, autoDetect = false) {
  if (!interfaces || interfaces.length === 0) {
    console.log("No available network interfaces found!");
    return null;
  }

  if (autoDetect) {
    const defaultIndex = findDefaultNetworkInterface(interfaces);
    if (defaultIndex !== null) {
      return defaultIndex;
    }
  }

  // Display interfaces for manual selection
  displayNetworkInterfaces(interfaces);
  return findDefaultNetworkInterface(interfaces);
}

/**
 * Get interface info by name for packet capture
 * @param {string} interfaceName - Interface name
 * @returns {Object|null} Interface info or null
 */
function getInterfaceByName(interfaceName) {
  const interfaces = getNetworkInterfaces();
  return interfaces.find(iface => iface.name === interfaceName) || null;
}

module.exports = {
  getNetworkInterfaces,
  findDefaultNetworkInterface,
  displayNetworkInterfaces,
  selectNetworkInterface,
  getInterfaceByName,
};

