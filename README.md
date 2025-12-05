# BPSR Uza Modules - JS Version

A JavaScript/Electron port of the original Python BPSR Module Optimizer tool.

## Features

- **Network Packet Capture**: Captures game data packets in real-time
- **Module Parsing**: Parses protobuf data to extract module information
- **Genetic Algorithm Optimization**: Finds optimal module combinations using parallel genetic algorithms
- **Modern Dark UI**: Beautiful Electron-based desktop application
- **Multi-language Support**: English and Spanish translations

## Project Structure

```
bpsr-uzamodules/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload script
│   ├── moduleTypes.js       # Type definitions and constants
│   ├── moduleParser.js      # Module data parser
│   ├── moduleOptimizer.js   # Genetic algorithm optimizer
│   ├── packetCapture.js     # Network packet capture
│   ├── starResonanceMonitor.js  # Core monitoring logic
│   ├── networkInterfaceUtil.js  # Network utilities
│   └── logger.js            # Logging configuration
├── ui/
│   ├── index.html           # Main HTML file
│   ├── styles.css           # Modern dark theme styles
│   └── renderer.js          # Renderer process (UI logic)
├── Icons/                   # UI icons
├── Attributes/              # Attribute effect images
├── Modules/                  # Module images
├── package.json             # Node.js dependencies
└── README_JS.md            # This file
```

## Requirements

- Node.js 18+ 
- npm or yarn
- Windows (for packet capture functionality)
- Npcap or WinPcap (for network packet capture)

## Installation

1. **Install Npcap** (Windows):
   - Download from https://npcap.com/
   - Install with "WinPcap API-compatible Mode" enabled

2. **Install dependencies**:
   ```bash
   cd bpsr-uzamodules
   npm install
   ```

3. **Build native modules** (if needed):
   ```bash
   npm rebuild cap
   ```

## Running the Application

```bash
# Normal mode
npm start

# Development mode (with debug logging)
npm run dev
```

## How It Works

1. **Start Monitoring**: Select your network interface and click "Start Monitoring"
2. **Capture Data**: Change channels in-game or re-login to trigger module data capture
3. **View Results**: The optimizer will automatically find the best module combinations
4. **Refilter**: Change attributes and click "Refilter" to re-optimize with different criteria

## Key Differences from Python Version

| Feature | Python | JavaScript |
|---------|--------|------------|
| GUI Framework | CustomTkinter | Electron |
| Packet Capture | Scapy | cap (libpcap) |
| Protobuf | protobuf | protobufjs |
| Multi-processing | multiprocessing | Single-threaded (async) |

## Development Notes

### Packet Capture
The `cap` library requires native compilation. If you encounter issues:
- Ensure Npcap is installed with WinPcap compatibility
- Run `npm rebuild cap` after installation
- The app includes a fallback mode for development/testing without actual packet capture

### Testing Without Packet Capture
You can load test data using the IPC handler:
```javascript
await window.electronAPI.loadTestData(jsonModuleArray);
```

## Known Limitations

1. **Windows Only**: The packet capture library works best on Windows
2. **Admin Rights**: May require administrator privileges for packet capture
3. **Single-threaded Optimization**: Unlike the Python version, optimization runs in a single thread (but still performs well due to V8 optimization)

## License

MIT License - See LICENSE file for details

## Credits

- Original Python version by MrSnake
- JavaScript port maintains the same functionality and visual style

