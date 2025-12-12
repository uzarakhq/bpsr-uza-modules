/**
 * Script to display all network interfaces with friendly names
 */

const { getNetworkInterfaces } = require('./src/networkInterfaceUtil');

console.log('Fetching all network interfaces...\n');

try {
  const interfaces = getNetworkInterfaces(true); // Include all interfaces
  
  if (interfaces.length === 0) {
    console.log('No network interfaces found.');
    process.exit(0);
  }
  
  console.log(`Found ${interfaces.length} network interface(s):\n`);
  console.log('='.repeat(80));
  
  interfaces.forEach((iface, index) => {
    console.log(`\n[${index}] ${iface.friendlyName}`);
    console.log(`    Name: ${iface.name}`);
    console.log(`    Description: ${iface.description}`);
    if (iface.isVirtual) {
      console.log(`    Type: Virtual/VPN`);
    }
    if (iface.addresses && iface.addresses.length > 0) {
      console.log(`    IPv4 Addresses:`);
      iface.addresses.forEach(addr => {
        console.log(`      - ${addr.addr} (Netmask: ${addr.netmask})`);
      });
    } else {
      console.log(`    IPv4 Addresses: None`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\nDone!');
  
} catch (error) {
  console.error('Error fetching network interfaces:', error.message);
  process.exit(1);
}

