/**
 * Network Interface Utilities
 * JavaScript port of network_interface_util.py
 */

const os = require('os');
const { getLogger } = require('./logger');

const logger = getLogger('NetworkInterfaceUtil');

/**
 * Check if an interface is a virtual network or VPN
 * @param {string} name - Interface name
 * @param {string} description - Interface description
 * @returns {boolean} True if virtual/VPN
 */
function isVirtualOrVPN(name, description) {
  if (!name && !description) {
    return false;
  }
  
  const nameLower = (name || '').toLowerCase();
  const descLower = (description || '').toLowerCase();
  const combined = `${nameLower} ${descLower}`;
  
  // Only filter out clearly virtual/VPN interfaces
  // Be very conservative - only filter if we're certain it's virtual
  
  // 1. Filter loopback interfaces
  if (nameLower.startsWith('lo') && nameLower.length <= 3) {
    return true; // lo, lo0, etc.
  }
  if (nameLower === 'loopback' || descLower.includes('loopback')) {
    return true;
  }
  
  // 2. Filter known virtual machine adapters (very specific)
  if (combined.includes('virtualbox') || 
      combined.includes('vmware virtual ethernet') ||
      combined.includes('vmware network adapter') ||
      (combined.includes('hyper-v') && combined.includes('virtual')) ||
      combined.includes('vethernet')) {
    return true;
  }
  
  // 3. Filter known VPN services (very specific)
  if (combined.includes('hamachi') ||
      combined.includes('zerotier') ||
      combined.includes('tailscale') ||
      (combined.includes('wireguard') && combined.includes('tunnel')) ||
      (combined.includes('openvpn') && (combined.includes('tun') || combined.includes('tap')))) {
    return true;
  }
  
  // 4. Filter TUN/TAP adapters ONLY if they're explicitly VPN-related
  // Don't filter generic TUN/TAP as they might be legitimate
  if ((nameLower.startsWith('tun') || nameLower.startsWith('tap')) &&
      (combined.includes('vpn') || combined.includes('openvpn') || 
       combined.includes('wireguard') || combined.includes('softether'))) {
    return true;
  }
  
  // 5. Filter transition technologies (IPv6 transition)
  if (nameLower.includes('isatap') || 
      nameLower.includes('teredo') || 
      nameLower.includes('6to4')) {
    return true;
  }
  
  // Default: don't filter (be conservative)
  return false;
}

/**
 * Get friendly name for network interface
 * @param {string} name - Interface name
 * @param {string} description - Interface description
 * @returns {string} Friendly name
 */
function getFriendlyName(name, description) {
  const descLower = (description || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();
  const combined = `${descLower} ${nameLower}`;
  
  // Check description first (usually more descriptive)
  // Order matters - check more specific patterns first
  
  // Virtual/VPN interfaces (check before generic Ethernet)
  if (descLower.includes('hyper-v') || descLower.includes('vethernet')) {
    return 'Hyper-V';
  }
  if (descLower.includes('virtualbox') || descLower.includes('vmware')) {
    return 'VirtualBox/VMware';
  }
  if (descLower.includes('hamachi')) {
    return 'Hamachi VPN';
  }
  if (descLower.includes('zerotier')) {
    return 'ZeroTier';
  }
  if (descLower.includes('tailscale')) {
    return 'Tailscale';
  }
  if (descLower.includes('wireguard')) {
    return 'WireGuard';
  }
  if (descLower.includes('openvpn')) {
    return 'OpenVPN';
  }
  if (descLower.includes('tun') || descLower.includes('tap')) {
    return 'TUN/TAP';
  }
  
  // Loopback (check before generic patterns)
  if (descLower.includes('loopback') || nameLower.startsWith('lo') && nameLower.length <= 3) {
    return 'Loopback';
  }
  
  // WiFi/Wireless
  if (descLower.includes('wi-fi') || descLower.includes('wifi') || descLower.includes('wireless') || descLower.includes('802.11') || descLower.includes('wlan')) {
    return 'WiFi';
  }
  
  // Bluetooth
  if (descLower.includes('bluetooth') || descLower.includes('pan')) {
    return 'Bluetooth';
  }
  
  // Ethernet (check last to avoid matching virtual adapters)
  if (descLower.includes('ethernet') || descLower.includes('gigabit') || descLower.includes('fast ethernet') || descLower.includes('lan')) {
    return 'Ethernet';
  }
  // Check name patterns (for cases where description wasn't helpful)
  // Order matters - check more specific patterns first
  if (nameLower.includes('vethernet') || nameLower.includes('hyper-v')) {
    return 'Hyper-V';
  }
  if (nameLower.startsWith('lo') && nameLower.length <= 3) {
    return 'Loopback';
  }
  if (nameLower.includes('wifi') || nameLower.includes('wlan') || nameLower.includes('wireless')) {
    return 'WiFi';
  }
  if (nameLower.includes('bluetooth') || nameLower.includes('pan')) {
    return 'Bluetooth';
  }
  if (nameLower.startsWith('tun') || nameLower.startsWith('tap')) {
    return 'TUN/TAP';
  }
  if (nameLower.includes('ethernet') || nameLower.startsWith('eth') || 
      (nameLower.startsWith('en') && !nameLower.includes('wifi') && !nameLower.includes('wlan'))) {
    return 'Ethernet';
  }
  
  // Try to extract a meaningful name from description
  // Remove common prefixes/suffixes and clean up
  if (description && description !== name) {
    let cleanDesc = description
      .replace(/^microsoft\s+/i, '')
      .replace(/^realtek\s+/i, '')
      .replace(/^intel\s+/i, '')
      .replace(/^qualcomm\s+/i, '')
      .replace(/^broadcom\s+/i, '')
      .replace(/\s+adapter$/i, '')
      .replace(/\s+network\s+adapter$/i, '')
      .trim();
    
    if (cleanDesc && cleanDesc.length > 0 && cleanDesc.length < 50) {
      return cleanDesc;
    }
  }
  
  // Fallback to description if available, otherwise name
  return description || name;
}

/**
 * Get all network interfaces using cap's device list for proper Windows support
 * @param {boolean} includeVirtual - Whether to include virtual/VPN interfaces (default: true)
 * @returns {Array} List of network interface information
 */
function getNetworkInterfaces(includeVirtual = true) {
  const interfaces = [];
  
  try {
    // Try to use cap's device list for proper device names
    const Cap = require('cap').Cap;
    const capDevices = Cap.deviceList();
    
    for (const device of capDevices) {
      // Optionally filter out virtual networks and VPNs
      if (!includeVirtual && isVirtualOrVPN(device.name, device.description)) {
        // Only log debug info in development mode
        if (logger.debug) {
          logger.debug(`Filtered out virtual/VPN interface: ${device.name} - ${device.description}`);
        }
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

      // Include interfaces with IPv4 addresses, or all interfaces if includeVirtual is true
      if (ipv4Addresses.length > 0 || includeVirtual) {
        const friendlyName = getFriendlyName(device.name, device.description);
        const isVirtual = isVirtualOrVPN(device.name, device.description);
        
        // Only log debug info in development mode
        if (logger.debug) {
          logger.debug(`Including interface: ${device.name} - ${device.description} -> ${friendlyName}${isVirtual ? ' (Virtual/VPN)' : ''}`);
        }
        interfaces.push({
          name: device.name, // This is the proper device name for cap
          description: device.description || device.name,
          friendlyName: friendlyName,
          addresses: ipv4Addresses.length > 0 ? ipv4Addresses : [],
          isUp: true,
          isVirtual: isVirtual,
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
        // Optionally filter out virtual networks and VPNs
        if (!includeVirtual && isVirtualOrVPN(name, name)) {
          // Only log debug info in development mode
          if (logger.debug) {
            logger.debug(`Filtered out virtual/VPN interface: ${name}`);
          }
          continue;
        }

        const ipv4Addresses = addresses
          .filter(addr => addr.family === 'IPv4')
          .map(addr => ({
            addr: addr.address,
            netmask: addr.netmask,
            internal: addr.internal,
          }));

        if (ipv4Addresses.length > 0 || includeVirtual) {
          const friendlyName = getFriendlyName(name, name);
          const isVirtual = isVirtualOrVPN(name, name);
          
          // Only log debug info in development mode
          if (logger.debug) {
            logger.debug(`Including interface: ${name} -> ${friendlyName}${isVirtual ? ' (Virtual/VPN)' : ''}`);
          }
          interfaces.push({
            name: name,
            description: name,
            friendlyName: friendlyName,
            addresses: ipv4Addresses.length > 0 ? ipv4Addresses : [],
            isUp: true,
            isVirtual: isVirtual,
          });
        }
      }
    } catch (osErr) {
      logger.error(`Failed to get network interfaces: ${osErr.message}`);
    }
  }

  logger.info(`Found ${interfaces.length} network interface(s)${includeVirtual ? ' (including virtual/VPN)' : ''}`);
  if (interfaces.length === 0) {
    logger.warn('No network interfaces found.');
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

