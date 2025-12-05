/**
 * BPSR Module Optimizer - Renderer Process
 */

// Translations
const translations = {
  en: {
    moduleType: "Module Type:",
    networkInterface: "Network Interface:",
    selectAttributes: "Select Attributes:",
    all: "All",
    priorityMode: "Enable Priority Ordering Mode (max 6 attributes)",
    startMonitoring: "Capture Modules",
    stopMonitoring: "Stop Capturing",
    refilter: "Filter and Optimize",
    instruction: "Before pressing Start, move your character to a location with few players around.",
    waitingModules: "Waiting for modules to be combined...",
    changeChannel: "Change channels in-game to start processing modules.",
    attrDistribution: "Attr. Distribution:",
    combinations: "Optimizations",
    noResults: "Start capturing to capture module data.",
    statusIdle: "Status: Idle",
    statusStarting: "Status: Starting capturing...",
    statusMonitoring: "Status: Capturing game data...",
    statusCaptured: "Status: Data captured, ready to optimize.",
    generating: "Optimizing combinations, please wait...",
  },
  es: {
    moduleType: "Tipo de Módulo:",
    networkInterface: "Interfaz de Red:",
    selectAttributes: "Seleccionar Atributos:",
    all: "Todos",
    priorityMode: "Activar Modo de Ordenamiento por Prioridad (máx. 6 atributos)",
    startMonitoring: "Iniciar Captura",
    stopMonitoring: "Detener Captura",
    refilter: "Filtrar y Optimizar",
    instruction: "Antes de presionar Iniciar, mueve tu personaje a un lugar con pocos jugadores.",
    waitingModules: "Esperando a que se optimicen los módulos...",
    changeChannel: "Cambia de canal en el juego para comenzar a procesar módulos.",
    attrDistribution: "Distribución de Attr.:",
    combinations: "Optimizaciones",
    noResults: "Inicia la captura para capturar datos de módulos.",
    statusIdle: "Estado: Inactivo",
    statusStarting: "Estado: Iniciando captura...",
    statusMonitoring: "Estado: Capturando datos del juego...",
    statusCaptured: "Estado: Datos capturados, listo para optimizar.",
    generating: "Generando optimizaciones, por favor espera...",
  },
};

// State
let currentLanguage = 'en';
let allAttributes = [];
let selectedAttributes = new Set();
let prioritizedAttrs = [];
let networkInterfaces = [];
let allResults = [];
let filteredResults = [];
let currentDistFilter = 'All';

// DOM Elements
const elements = {
  languageSelect: document.getElementById('language-select'),
  moduleType: document.getElementById('module-type'),
  networkInterface: document.getElementById('network-interface'),
  attributesContainer: document.getElementById('attributes-container'),
  selectAllBtn: document.getElementById('select-all-btn'),
  priorityModeCheckbox: document.getElementById('priority-mode-checkbox'),
  priorityList: document.getElementById('priority-list'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  refilterBtn: document.getElementById('refilter-btn'),
  instructionBox: document.getElementById('instruction-box'),
  instructionText: document.getElementById('instruction-text'),
  distributionFilter: document.getElementById('distribution-filter'),
  statusText: document.getElementById('status-text'),
  resultsContainer: document.getElementById('results-container'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingStatus: document.getElementById('loading-status'),
  progressBar: document.getElementById('progress-bar'),
  npcapModal: document.getElementById('npcap-modal'),
  npcapDownloadBtn: document.getElementById('npcap-download-btn'),
  npcapCloseBtn: document.getElementById('npcap-close-btn'),
};

// Initialize
async function init() {
  // Check for Npcap first
  await checkNpcap();

  // Load network interfaces
  networkInterfaces = await window.electronAPI.getNetworkInterfaces();
  populateNetworkInterfaces();

  // Load all attributes
  allAttributes = await window.electronAPI.getAllAttributes();
  createAttributeButtons();

  // Setup event listeners
  setupEventListeners();

  // Setup IPC listeners
  setupIPCListeners();

  // Apply initial language
  applyLanguage(currentLanguage);
}

// Check if Npcap is installed
async function checkNpcap() {
  try {
    const result = await window.electronAPI.checkNpcap();
    if (!result.available) {
      showNpcapModal();
    }
  } catch (err) {
    console.error('Failed to check Npcap:', err);
    // Show modal on error to be safe
    showNpcapModal();
  }
}

// Show Npcap modal
function showNpcapModal() {
  elements.npcapModal.classList.remove('hidden');
}

// Hide Npcap modal
function hideNpcapModal() {
  elements.npcapModal.classList.add('hidden');
}

// Populate network interfaces dropdown (optimized with DocumentFragment)
function populateNetworkInterfaces() {
  elements.networkInterface.innerHTML = '';
  
  if (networkInterfaces.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No interfaces available';
    elements.networkInterface.appendChild(option);
    return;
  }
  
  // Find default (Ethernet) interface index
  let defaultIndex = 0;
  for (let i = 0; i < networkInterfaces.length; i++) {
    const iface = networkInterfaces[i];
    const name = (iface.name || '').toLowerCase();
    const desc = (iface.description || '').toLowerCase();
    
    // Check if it's an Ethernet interface
    const isEthernet = name.includes('ethernet') || 
                      desc.includes('ethernet') ||
                      name.startsWith('eth') ||
                      (name.startsWith('en') && !name.includes('wifi') && !name.includes('wlan'));
    
    if (isEthernet) {
      // Prefer interfaces with non-loopback IPv4 addresses
      const hasValidAddress = iface.addresses && iface.addresses.some(addr => {
        return addr && !addr.includes(':') && !addr.startsWith('127.');
      });
      
      if (hasValidAddress || (iface.addresses && iface.addresses.length > 0)) {
        defaultIndex = i;
        break;
      }
    }
  }
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  networkInterfaces.forEach((iface, index) => {
    const option = document.createElement('option');
    option.value = iface.name;
    // Use friendly name if available, otherwise fall back to description
    const displayName = iface.friendlyName || iface.description || iface.name;
    // Show friendly name with IP address if available
    const ipAddresses = iface.addresses && iface.addresses.length > 0 
      ? iface.addresses.join(', ')
      : '';
    option.textContent = ipAddresses ? `${displayName} (${ipAddresses})` : displayName;
    if (index === defaultIndex) {
      option.selected = true;
    }
    fragment.appendChild(option);
  });
  
  elements.networkInterface.appendChild(fragment);
}

// Create attribute buttons (optimized with DocumentFragment)
function createAttributeButtons() {
  elements.attributesContainer.innerHTML = '';
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  allAttributes.forEach(attr => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.dataset.attr = attr;
    
    // Add attribute image with lazy loading
    const img = document.createElement('img');
    img.src = `../Attributes/${attr}.webp`;
    img.className = 'attr-icon';
    img.alt = attr;
    img.loading = 'lazy'; // Lazy load images
    img.onerror = function() { this.style.display = 'none'; };
    
    const text = document.createElement('span');
    text.textContent = attr;
    
    btn.appendChild(img);
    btn.appendChild(text);
    btn.addEventListener('click', () => toggleAttribute(attr, btn));
    fragment.appendChild(btn);
  });
  
  elements.attributesContainer.appendChild(fragment);
}

// Toggle attribute selection
function toggleAttribute(attr, btn) {
  if (selectedAttributes.has(attr)) {
    selectedAttributes.delete(attr);
    btn.classList.remove('active');
    // Remove from prioritized list
    prioritizedAttrs = prioritizedAttrs.filter(a => a !== attr);
  } else {
    if (elements.priorityModeCheckbox.checked && prioritizedAttrs.length >= 6) {
      alert('Cannot add more than 6 prioritized attributes.');
      return;
    }
    selectedAttributes.add(attr);
    btn.classList.add('active');
    if (elements.priorityModeCheckbox.checked) {
      prioritizedAttrs.push(attr);
    }
  }
  updateSelectAllBtn();
  updatePriorityList();
}

// Toggle all attributes
function toggleAllAttributes() {
  if (selectedAttributes.size === allAttributes.length) {
    // Deselect all
    selectedAttributes.clear();
    prioritizedAttrs = [];
    document.querySelectorAll('#attributes-container .pill-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  } else {
    // Select all
    selectedAttributes = new Set(allAttributes);
    document.querySelectorAll('#attributes-container .pill-btn').forEach(btn => {
      btn.classList.add('active');
    });
    if (elements.priorityModeCheckbox.checked) {
      prioritizedAttrs = allAttributes.slice(0, 6);
    }
  }
  updateSelectAllBtn();
  updatePriorityList();
}

// Update select all button state
function updateSelectAllBtn() {
  elements.selectAllBtn.classList.toggle('active', selectedAttributes.size === allAttributes.length);
}

// Update priority list display
function updatePriorityList() {
  if (!elements.priorityModeCheckbox.checked) {
    elements.priorityList.classList.add('hidden');
    return;
  }

  elements.priorityList.classList.remove('hidden');
  elements.priorityList.innerHTML = '';

  if (prioritizedAttrs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Select attributes to prioritize (max 6).';
    elements.priorityList.appendChild(emptyState);
    return;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  prioritizedAttrs.forEach((attr, index) => {
    const item = document.createElement('div');
    item.className = 'priority-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'priority-item-name';
    nameSpan.textContent = `${index + 1}. ${attr}`;
    item.appendChild(nameSpan);
    
    const upBtn = document.createElement('button');
    upBtn.className = 'priority-item-btn';
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.onclick = () => movePriorityAttr(attr, -1);
    item.appendChild(upBtn);
    
    const downBtn = document.createElement('button');
    downBtn.className = 'priority-item-btn';
    downBtn.textContent = '▼';
    downBtn.disabled = index === prioritizedAttrs.length - 1;
    downBtn.onclick = () => movePriorityAttr(attr, 1);
    item.appendChild(downBtn);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'priority-item-btn remove';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => removePriorityAttr(attr);
    item.appendChild(removeBtn);
    
    fragment.appendChild(item);
  });
  
  elements.priorityList.appendChild(fragment);
}

// Move priority attribute up/down
window.movePriorityAttr = function(attr, direction) {
  const index = prioritizedAttrs.indexOf(attr);
  if (index === -1) return;
  
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= prioritizedAttrs.length) return;
  
  [prioritizedAttrs[index], prioritizedAttrs[newIndex]] = [prioritizedAttrs[newIndex], prioritizedAttrs[index]];
  updatePriorityList();
};

// Remove from priority list
window.removePriorityAttr = function(attr) {
  prioritizedAttrs = prioritizedAttrs.filter(a => a !== attr);
  selectedAttributes.delete(attr);
  const btn = document.querySelector(`#attributes-container .pill-btn[data-attr="${attr}"]`);
  if (btn) btn.classList.remove('active');
  updatePriorityList();
  updateSelectAllBtn();
};

// Setup event listeners
function setupEventListeners() {
  // Language change
  elements.languageSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    applyLanguage(currentLanguage);
  });

  // Select all button
  elements.selectAllBtn.addEventListener('click', toggleAllAttributes);

  // Priority mode checkbox
  elements.priorityModeCheckbox.addEventListener('change', () => {
    if (elements.priorityModeCheckbox.checked) {
      prioritizedAttrs = [...selectedAttributes].slice(0, 6);
    } else {
      prioritizedAttrs = [];
    }
    updatePriorityList();
  });

  // Start monitoring
  elements.startBtn.addEventListener('click', startMonitoring);

  // Stop monitoring
  elements.stopBtn.addEventListener('click', stopMonitoring);

  // Refilter
  elements.refilterBtn.addEventListener('click', rescreenModules);

  // Social links
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url) window.electronAPI.openExternal(url);
    });
  });

  // Distribution filter buttons
  document.querySelectorAll('.dist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setDistributionFilter(btn.dataset.filter);
    });
  });

  // Npcap modal buttons
  if (elements.npcapDownloadBtn) {
    elements.npcapDownloadBtn.addEventListener('click', () => {
      window.electronAPI.openExternal('https://npcap.com/');
    });
  }

  if (elements.npcapCloseBtn) {
    elements.npcapCloseBtn.addEventListener('click', () => {
      hideNpcapModal();
    });
  }

  // Close modal when clicking outside
  if (elements.npcapModal) {
    elements.npcapModal.addEventListener('click', (e) => {
      if (e.target === elements.npcapModal) {
        hideNpcapModal();
      }
    });
  }

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.npcapModal.classList.contains('hidden')) {
      hideNpcapModal();
    }
  });
}

// Setup IPC listeners
function setupIPCListeners() {
  window.electronAPI.onDataCaptured(() => {
    elements.refilterBtn.disabled = false;
    setStatus('statusCaptured');
    // Show loading screen when automatic optimization starts
    showLoading();
  });

  window.electronAPI.onProgressUpdate((message) => {
    setStatus('custom', message);
    // Update loading overlay status if visible
    if (!elements.loadingOverlay.classList.contains('hidden')) {
      // Parse progress from message (format: "Task x/15 completed. Highest score: ...")
      const taskMatch = message.match(/Task (\d+)\/(\d+)/);
      if (taskMatch) {
        const current = parseInt(taskMatch[1], 10);
        const total = parseInt(taskMatch[2], 10);
        const progress = (current / total) * 100;
        elements.progressBar.style.width = `${progress}%`;
        // Keep a generic message instead of the detailed task message
        const t = translations[currentLanguage];
        elements.loadingStatus.textContent = t.generating;
      } else {
        // For non-task messages, just update the text
        elements.loadingStatus.textContent = message;
      }
    }
  });

  window.electronAPI.onResultsReady((results) => {
    allResults = results;
    applyFiltersAndDisplay();
    hideLoading();
    elements.distributionFilter.classList.remove('hidden');
  });

  window.electronAPI.onMonitoringStopped(() => {
    // Update UI when monitoring stops automatically
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.networkInterface.disabled = false;
    setStatus('statusCaptured');
  });
}

// Start monitoring
async function startMonitoring() {
  const interfaceName = elements.networkInterface.value;
  const category = elements.moduleType.value;
  const attributes = [...selectedAttributes];
  const priorityOrderMode = elements.priorityModeCheckbox.checked;

  setStatus('statusStarting');
  elements.startBtn.classList.add('hidden');
  elements.stopBtn.classList.remove('hidden');
  elements.refilterBtn.disabled = true;
  elements.networkInterface.disabled = true;

  // Clear previous results
  allResults = [];
  filteredResults = [];
  renderEmptyState();

  const result = await window.electronAPI.startMonitoring({
    interfaceName,
    category,
    attributes,
    prioritizedAttrs: priorityOrderMode ? prioritizedAttrs : [],
    priorityOrderMode,
  });

  if (result.success) {
    setStatus('statusMonitoring');
    updateInstruction('changeChannel');
  } else {
    alert('Failed to start monitoring: ' + result.error);
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.networkInterface.disabled = false;
    setStatus('statusIdle');
  }
}

// Stop monitoring
async function stopMonitoring() {
  await window.electronAPI.stopMonitoring();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.networkInterface.disabled = false;
  elements.distributionFilter.classList.add('hidden');
  
  setStatus('statusIdle');
  updateInstruction('instruction');
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Rescreen modules (debounced version for frequent calls)
const debouncedRescreen = debounce(async function() {
  const category = elements.moduleType.value;
  const attributes = [...selectedAttributes];
  const priorityOrderMode = elements.priorityModeCheckbox.checked;

  showLoading();
  
  await window.electronAPI.rescreenModules({
    category,
    attributes,
    prioritizedAttrs: priorityOrderMode ? prioritizedAttrs : [],
    priorityOrderMode,
  });
}, 300);

// Rescreen modules
async function rescreenModules() {
  await debouncedRescreen();
}

// Apply distribution filter
function setDistributionFilter(filter) {
  currentDistFilter = filter;
  document.querySelectorAll('.dist-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  applyFiltersAndDisplay();
}

// Apply filters and redisplay
function applyFiltersAndDisplay() {
  if (currentDistFilter === 'All') {
    filteredResults = allResults;
  } else {
    filteredResults = allResults.filter(sol => {
      let lv5Count = 0, lv6Count = 0;
      for (const value of Object.values(sol.attrBreakdown)) {
        if (value >= 20) lv6Count++;
        else if (value >= 16) lv5Count++;
      }
      
      switch (currentDistFilter) {
        case 'Lv.5': return lv5Count >= 1 && lv6Count === 0;
        case 'Lv.5/Lv.5': return lv5Count >= 2;
        case 'Lv.5/Lv.6': return lv5Count >= 1 && lv6Count >= 1;
        case 'Lv.6/Lv.6': return lv6Count >= 2;
        default: return true;
      }
    });
  }
  
  displayCurrentPage();
}

// Display all results (optimized with DocumentFragment and requestAnimationFrame)
function displayCurrentPage() {
  requestAnimationFrame(() => {
    if (filteredResults.length === 0) {
      renderEmptyState();
      return;
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    filteredResults.forEach((sol, i) => {
      const cardElement = createResultCardElement(sol, i + 1);
      fragment.appendChild(cardElement);
    });

    // Clear and append in one operation
    elements.resultsContainer.innerHTML = '';
    elements.resultsContainer.appendChild(fragment);
  });
}

// Create result card element (optimized with DOM elements and lazy loading)
function createResultCardElement(solution, rank) {
  const totalAttrValue = Object.values(solution.attrBreakdown).reduce((a, b) => a + b, 0);
  const rarityColors = {
    'Rare': 'rare',
    'Epic': 'epic',
    'Legendary': 'legendary',
  };

  // Create main card element
  const card = document.createElement('div');
  card.className = 'result-card';

  // Create header
  const header = document.createElement('div');
  header.className = 'result-header';
  const rankDiv = document.createElement('div');
  rankDiv.className = 'result-rank';
  rankDiv.innerHTML = `
    <div>Effects: ${totalAttrValue}</div> 
    <div>Ability Score: ${Math.round(solution.score)}</div>
    <div>Rank ${rank} (Score: ${solution.optimizationScore.toFixed(2)})</div>
  `;
  header.appendChild(rankDiv);
  card.appendChild(header);

  // Create modules container
  const modulesContainer = document.createElement('div');
  modulesContainer.className = 'result-modules';
  
  solution.modules.forEach(module => {
    const rarity = module.name.split(' ')[0];
    const rarityClass = rarityColors[rarity] || '';
    
    const moduleCard = document.createElement('div');
    moduleCard.className = `module-card ${rarityClass}`;
    
    const moduleIcon = document.createElement('div');
    moduleIcon.className = 'module-icon';
    const moduleImg = document.createElement('img');
    const imageName = module.name.replace(/-Preferred$/, '');
    moduleImg.src = `../Modules/${imageName}.webp`;
    moduleImg.alt = module.name;
    moduleImg.className = 'module-image';
    moduleImg.loading = 'lazy'; // Lazy load images
    moduleImg.onerror = function() { this.style.display = 'none'; };
    moduleIcon.appendChild(moduleImg);
    moduleCard.appendChild(moduleIcon);
    
    const attrsDiv = document.createElement('div');
    attrsDiv.className = 'module-attrs';
    module.parts.forEach(part => {
      const attrLine = document.createElement('div');
      attrLine.className = 'module-attr-line';
      const attrImg = document.createElement('img');
      attrImg.src = `../Attributes/${part.name}.webp`;
      attrImg.alt = part.name;
      attrImg.className = 'module-attr-icon';
      attrImg.loading = 'lazy'; // Lazy load images
      attrImg.onerror = function() { this.style.display = 'none'; };
      const attrSpan = document.createElement('span');
      attrSpan.textContent = `+${part.value}`;
      attrLine.appendChild(attrImg);
      attrLine.appendChild(attrSpan);
      attrsDiv.appendChild(attrLine);
    });
    moduleCard.appendChild(attrsDiv);
    modulesContainer.appendChild(moduleCard);
  });
  card.appendChild(modulesContainer);

  // Create attribute distribution
  const attrDist = document.createElement('div');
  attrDist.className = 'attr-distribution';
  const title = document.createElement('div');
  title.className = 'attr-distribution-title';
  title.textContent = 'Attribute Distribution:';
  attrDist.appendChild(title);
  
  const attrList = document.createElement('div');
  attrList.className = 'attr-distribution-list';
  
  Object.entries(solution.attrBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => {
      let level = 0;
      if (value >= 20) level = 6;
      else if (value >= 16) level = 5;
      else if (value >= 12) level = 4;
      else if (value >= 8) level = 3;
      else if (value >= 4) level = 2;
      else if (value >= 1) level = 1;
      
      const isHighLevel = level >= 5;
      const item = document.createElement('div');
      item.className = `attr-dist-item ${isHighLevel ? 'high-level' : ''}`;
      const distImg = document.createElement('img');
      distImg.src = `../Attributes/${name}.webp`;
      distImg.alt = name;
      distImg.className = 'attr-dist-icon';
      distImg.loading = 'lazy'; // Lazy load images
      distImg.onerror = function() { this.style.display = 'none'; };
      const distSpan = document.createElement('span');
      distSpan.textContent = `${name} (Lv.${level}): +${value}`;
      item.appendChild(distImg);
      item.appendChild(distSpan);
      attrList.appendChild(item);
    });
  
  attrDist.appendChild(attrList);
  card.appendChild(attrDist);

  return card;
}

// Legacy function for compatibility (if needed elsewhere)
function renderResultCard(solution, rank) {
  // This is kept for backward compatibility but should use createResultCardElement instead
  const element = createResultCardElement(solution, rank);
  return element.outerHTML;
}

// Render empty state
function renderEmptyState() {
  const t = translations[currentLanguage];
  elements.resultsContainer.innerHTML = `
    <div class="empty-state">
      <span>${t.noResults}</span>
    </div>
  `;
}

// Apply language translations
function applyLanguage(lang) {
  const t = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
}

// Update instruction text
function updateInstruction(key) {
  const t = translations[currentLanguage];
  elements.instructionText.textContent = t[key] || t.instruction;
}

// Set status text
function setStatus(key, customMessage = '') {
  const t = translations[currentLanguage];
  elements.statusText.textContent = customMessage || t[key] || `Status: ${key}`;
}

// Show/hide loading
function showLoading(message = '') {
  elements.loadingOverlay.classList.remove('hidden');
  // Reset progress bar
  elements.progressBar.style.width = '0%';
  if (message) {
    elements.loadingStatus.textContent = message;
  } else {
    const t = translations[currentLanguage];
    elements.loadingStatus.textContent = t.generating;
  }
}

function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
  // Reset progress bar
  elements.progressBar.style.width = '0%';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

