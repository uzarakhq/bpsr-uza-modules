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
    refilter: "Optimize",
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
    refilter: "Optimizar",
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
};

// Initialize
async function init() {
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

// Populate network interfaces dropdown
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
  
  networkInterfaces.forEach((iface, index) => {
    const option = document.createElement('option');
    option.value = iface.name;
    option.textContent = `${iface.index}: ${iface.description} (${iface.addresses.join(', ')})`;
    if (index === defaultIndex) {
      option.selected = true;
    }
    elements.networkInterface.appendChild(option);
  });
}

// Create attribute buttons
function createAttributeButtons() {
  elements.attributesContainer.innerHTML = '';
  allAttributes.forEach(attr => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.dataset.attr = attr;
    
    // Add attribute image
    const img = document.createElement('img');
    img.src = `../Attributes/${attr}.webp`;
    img.className = 'attr-icon';
    img.alt = attr;
    img.onerror = function() { this.style.display = 'none'; };
    
    const text = document.createElement('span');
    text.textContent = attr;
    
    btn.appendChild(img);
    btn.appendChild(text);
    btn.addEventListener('click', () => toggleAttribute(attr, btn));
    elements.attributesContainer.appendChild(btn);
  });
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
    elements.priorityList.innerHTML = '<div class="empty-state">Select attributes to prioritize (max 6).</div>';
    return;
  }

  prioritizedAttrs.forEach((attr, index) => {
    const item = document.createElement('div');
    item.className = 'priority-item';
    item.innerHTML = `
      <span class="priority-item-name">${index + 1}. ${attr}</span>
      <button class="priority-item-btn" onclick="movePriorityAttr('${attr}', -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
      <button class="priority-item-btn" onclick="movePriorityAttr('${attr}', 1)" ${index === prioritizedAttrs.length - 1 ? 'disabled' : ''}>▼</button>
      <button class="priority-item-btn remove" onclick="removePriorityAttr('${attr}')">✕</button>
    `;
    elements.priorityList.appendChild(item);
  });
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
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
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
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
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
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    elements.networkInterface.disabled = false;
    setStatus('statusIdle');
  }
}

// Stop monitoring
async function stopMonitoring() {
  await window.electronAPI.stopMonitoring();
  
  elements.startBtn.disabled = false;
  elements.stopBtn.disabled = true;
  elements.networkInterface.disabled = false;
  elements.distributionFilter.classList.add('hidden');
  
  setStatus('statusIdle');
  updateInstruction('instruction');
}

// Rescreen modules
async function rescreenModules() {
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

// Display all results
function displayCurrentPage() {
  if (filteredResults.length === 0) {
    renderEmptyState();
    return;
  }

  elements.resultsContainer.innerHTML = filteredResults.map((sol, i) => 
    renderResultCard(sol, i + 1)
  ).join('');
}

// Render result card
function renderResultCard(solution, rank) {
  const totalAttrValue = Object.values(solution.attrBreakdown).reduce((a, b) => a + b, 0);
  const rarityColors = {
    'Rare': 'rare',
    'Epic': 'epic',
    'Legendary': 'legendary',
  };

  const modulesHtml = solution.modules.map(module => {
    const rarity = module.name.split(' ')[0];
    const rarityClass = rarityColors[rarity] || '';
    const attrsHtml = module.parts.map(part => 
      `<div class="module-attr-line">
        <img src="../Attributes/${part.name}.webp" alt="${part.name}" class="module-attr-icon" onerror="this.style.display='none'">
        <span>+${part.value}</span>
      </div>`
    ).join('');
    
    // Map module name to image filename (remove "-Preferred" suffix if present)
    const imageName = module.name.replace(/-Preferred$/, '');
    const imagePath = `../Modules/${imageName}.webp`;
    
    return `
      <div class="module-card ${rarityClass}">
        <div class="module-icon">
          <img src="${imagePath}" alt="${module.name}" class="module-image" onerror="this.style.display='none'">
        </div>
        <div class="module-attrs">${attrsHtml}</div>
      </div>
    `;
  }).join('');

  const attrDistHtml = Object.entries(solution.attrBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      let level = 0;
      if (value >= 20) level = 6;
      else if (value >= 16) level = 5;
      else if (value >= 12) level = 4;
      else if (value >= 8) level = 3;
      else if (value >= 4) level = 2;
      else if (value >= 1) level = 1;
      
      const isHighLevel = level >= 5;
      return `<div class="attr-dist-item ${isHighLevel ? 'high-level' : ''}">
        <img src="../Attributes/${name}.webp" alt="${name}" class="attr-dist-icon" onerror="this.style.display='none'">
        <span>${name} (Lv.${level}): +${value}</span>
      </div>`;
    }).join('');

  return `
    <div class="result-card">
      <div class="result-header">
        <div class="result-rank">
          <div>Effects: ${totalAttrValue}</div> 
          <div>Ability Score: ${Math.round(solution.score)}</div>
          <div>Rank ${rank} (Score: ${solution.optimizationScore.toFixed(2)})</div>
        </div>
      </div>
      <div class="result-modules">${modulesHtml}</div>
      <div class="attr-distribution">
        <div class="attr-distribution-title">Attribute Distribution:</div>
        <div class="attr-distribution-list">${attrDistHtml}</div>
      </div>
    </div>
  `;
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

