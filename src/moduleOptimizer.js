/**
 * Module Optimizer
 * JavaScript port of module_optimizer.py
 * Uses genetic algorithm for module combination optimization
 */

const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const {
  ModuleInfo,
  ModuleCategory,
  MODULE_CATEGORY_MAP,
  ATTR_THRESHOLDS,
  BASIC_ATTR_POWER_MAP,
  SPECIAL_ATTR_POWER_MAP,
  TOTAL_ATTR_POWER_MAP,
  ATTR_NAME_TYPE_MAP,
  PHYSICAL_ATTRIBUTES,
  MAGIC_ATTRIBUTES,
  ATTACK_ATTRIBUTES,
  GUARDIAN_ATTRIBUTES,
  SUPPORT_ATTRIBUTES,
} = require('./moduleTypes');
const { getLogger } = require('./logger');

const logger = getLogger('ModuleOptimizer');

/**
 * Module Solution class - represents a combination of modules
 */
class ModuleSolution {
  constructor(modules) {
    this.modules = [...modules].sort((a, b) => a.uuid - b.uuid);
    this.attrBreakdown = {};
    this.score = 0; // Final combat power
    this.optimizationScore = 0; // Fitness score used during optimization
  }

  getCombinationId() {
    return this.modules.map(m => m.uuid).join(',');
  }
}

/**
 * Calculate fitness score for a module combination
 */
function calculateFitness(modules, category, prioritizedAttrs = null) {
  if (!modules || new Set(modules.map(m => m.uuid)).size < 4) return 0;

  const attrBreakdown = {};
  for (const module of modules) {
    for (const part of module.parts) {
      attrBreakdown[part.name] = (attrBreakdown[part.name] || 0) + part.value;
    }
  }

  let score = 0;

  // Helper to convert value -> level (0..6)
  function valueToLevelFitness(val) {
    if (val >= 20) return 6;
    if (val >= 16) return 5;
    if (val >= 12) return 4;
    if (val >= 8) return 3;
    if (val >= 4) return 2;
    if (val >= 1) return 1;
    return 0;
  }

  if (prioritizedAttrs && prioritizedAttrs.length > 0) {
    const prioritizedSet = new Set(prioritizedAttrs);
    let prioritizedAttrScore = 0;
    
    for (const attrName of prioritizedAttrs) {
      const value = attrBreakdown[attrName] || 0;
      const level = valueToLevelFitness(value);
      if (level === 6) prioritizedAttrScore += 5000;
      else if (level === 5) prioritizedAttrScore += 2000;
      else if (level === 4) prioritizedAttrScore += 500;
      else if (level === 3) prioritizedAttrScore += 100;
      else if (level === 2) prioritizedAttrScore += 50;
      else if (level === 1) prioritizedAttrScore += 10;
    }
    score += prioritizedAttrScore;

    // Bonus for having prioritized attributes
    const matchCount = [...prioritizedSet].filter(attr => attrBreakdown[attr]).length;
    score += matchCount * 100;

    // Minor penalty for non-prioritized attributes
    const nonPrioritizedAttrs = Object.keys(attrBreakdown).filter(attr => !prioritizedSet.has(attr));
    score -= nonPrioritizedAttrs.reduce((sum, attr) => sum + attrBreakdown[attr], 0) * 5;
  }

  // Threshold score
  let thresholdScore = 0;
  for (const [attrName, value] of Object.entries(attrBreakdown)) {
    if (value >= 20) thresholdScore += 1000 + (value - 20) * 20;
    else if (value >= 16) thresholdScore += 500 + (value - 16) * 15;
    else if (value >= 12) thresholdScore += 100 + (value - 12) * 5;
  }
  score += thresholdScore;

  // Category bonuses
  let targetAttrs = new Set();
  if (category === ModuleCategory.ATTACK) targetAttrs = ATTACK_ATTRIBUTES;
  else if (category === ModuleCategory.GUARDIAN) targetAttrs = GUARDIAN_ATTRIBUTES;
  else if (category === ModuleCategory.SUPPORT) targetAttrs = SUPPORT_ATTRIBUTES;

  for (const [attrName, value] of Object.entries(attrBreakdown)) {
    if (targetAttrs.has(attrName)) score += value * 5;
  }

  // Physical/Magic conflict penalty
  const physicalSum = Object.entries(attrBreakdown)
    .filter(([k]) => PHYSICAL_ATTRIBUTES.has(k))
    .reduce((sum, [, v]) => sum + v, 0);
  const magicSum = Object.entries(attrBreakdown)
    .filter(([k]) => MAGIC_ATTRIBUTES.has(k))
    .reduce((sum, [, v]) => sum + v, 0);
  
  if (physicalSum > 0 && magicSum > 0) {
    score -= Math.min(physicalSum, magicSum) * 10;
  }

  // Small bonus for total attribute value
  score += Object.values(attrBreakdown).reduce((a, b) => a + b, 0) * 0.1;

  return Math.max(0, score);
}

/**
 * Run a single genetic algorithm campaign
 */
function runSingleGaCampaign(modules, category, prioritizedAttrs, gaParams) {
  // Initialize population
  function initializePopulation(pool, size) {
    const population = [];
    const seen = new Set();
    if (pool.length < 4) return [];

    const maxPossibleCombinations = factorial(pool.length) / (factorial(4) * factorial(pool.length - 4));
    const targetSize = Math.min(size, maxPossibleCombinations);
    if (targetSize === 0) return [];

    while (population.length < targetSize) {
      const selectedModules = shuffleArray([...pool]).slice(0, 4);
      const solution = new ModuleSolution(selectedModules);
      const comboId = solution.getCombinationId();
      
      if (!seen.has(comboId)) {
        solution.optimizationScore = calculateFitness(solution.modules, category, prioritizedAttrs);
        population.push(solution);
        seen.add(comboId);
      }
    }
    return population;
  }

  // Selection
  function selection(population) {
    const tournamentSize = gaParams.tournamentSize;
    const tournament = shuffleArray([...population]).slice(0, tournamentSize);
    return tournament.reduce((best, current) => 
      current.optimizationScore > best.optimizationScore ? current : best
    );
  }

  // Crossover
  function crossover(p1, p2) {
    if (Math.random() > gaParams.crossoverRate) {
      return [deepCopy(p1), deepCopy(p2)];
    }

    const p1Ids = new Set(p1.modules.slice(0, 2).map(m => m.uuid));
    const p2Ids = new Set(p2.modules.slice(0, 2).map(m => m.uuid));

    const child1Mods = [
      ...p1.modules.slice(0, 2),
      ...p2.modules.filter(m => !p1Ids.has(m.uuid)).slice(0, 2)
    ];
    const child2Mods = [
      ...p2.modules.slice(0, 2),
      ...p1.modules.filter(m => !p2Ids.has(m.uuid)).slice(0, 2)
    ];

    return [
      child1Mods.length === 4 ? new ModuleSolution(child1Mods) : deepCopy(p1),
      child2Mods.length === 4 ? new ModuleSolution(child2Mods) : deepCopy(p2)
    ];
  }

  // Mutation
  function mutate(solution, pool) {
    if (Math.random() > gaParams.mutationRate) return;
    
    const currentIds = new Set(solution.modules.map(m => m.uuid));
    const candidates = pool.filter(m => !currentIds.has(m.uuid));
    if (candidates.length === 0) return;

    const indexToReplace = Math.floor(Math.random() * solution.modules.length);
    solution.modules[indexToReplace] = candidates[Math.floor(Math.random() * candidates.length)];
    solution.modules.sort((a, b) => a.uuid - b.uuid);
  }

  // Local search
  function localSearch(solution, pool) {
    let bestSolution = deepCopy(solution);
    bestSolution.optimizationScore = calculateFitness(bestSolution.modules, category, prioritizedAttrs);

    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < bestSolution.modules.length; i++) {
        const currentModule = bestSolution.modules[i];
        let bestReplacement = null;
        let bestNewScore = bestSolution.optimizationScore;

        for (const newModule of pool) {
          const otherIds = new Set(bestSolution.modules.filter((_, idx) => idx !== i).map(m => m.uuid));
          if (otherIds.has(newModule.uuid)) continue;

          const tempModules = [...bestSolution.modules];
          tempModules[i] = newModule;
          const newScore = calculateFitness(tempModules, category, prioritizedAttrs);

          if (newScore > bestNewScore) {
            bestNewScore = newScore;
            bestReplacement = newModule;
          }
        }

        if (bestReplacement) {
          bestSolution.modules[i] = bestReplacement;
          bestSolution.optimizationScore = bestNewScore;
          bestSolution.modules.sort((a, b) => a.uuid - b.uuid);
          improved = true;
        }
      }
    }
    return bestSolution;
  }

  // Main GA loop
  let population = initializePopulation(modules, gaParams.populationSize);
  if (population.length === 0) return [];

  for (let gen = 0; gen < gaParams.generations; gen++) {
    population.sort((a, b) => b.optimizationScore - a.optimizationScore);
    
    const nextGen = [];
    const eliteCount = Math.floor(gaParams.populationSize * gaParams.elitismRate);
    nextGen.push(...population.slice(0, eliteCount).map(s => deepCopy(s)));

    while (nextGen.length < gaParams.populationSize) {
      const p1 = selection(population);
      const p2 = selection(population);
      const [c1, c2] = crossover(p1, p2);
      mutate(c1, modules);
      mutate(c2, modules);
      nextGen.push(c1, c2);
    }

    for (const individual of nextGen) {
      individual.optimizationScore = calculateFitness(individual.modules, category, prioritizedAttrs);
    }

    nextGen.sort((a, b) => b.optimizationScore - a.optimizationScore);

    const localSearchCount = Math.floor(gaParams.populationSize * gaParams.localSearchRate);
    for (let i = 0; i < localSearchCount; i++) {
      nextGen[i] = localSearch(nextGen[i], modules);
    }

    population = nextGen;
  }

  return population.sort((a, b) => b.optimizationScore - a.optimizationScore);
}

// Helper functions
function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function deepCopy(solution) {
  const copy = new ModuleSolution([...solution.modules]);
  copy.attrBreakdown = { ...solution.attrBreakdown };
  copy.score = solution.score;
  copy.optimizationScore = solution.optimizationScore;
  return copy;
}

/**
 * Module Optimizer class
 */
class ModuleOptimizer {
  constructor() {
    this.logger = logger;
    this.gaParams = {
      populationSize: 150,
      generations: 50,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      elitismRate: 0.1,
      tournamentSize: 5,
      localSearchRate: 0.3,
    };
    this.numCampaigns = Math.max(1, os.cpus().length - 1);
    this.qualityThreshold = 12;
    this.prefilterTopNPerAttr = 60;
    this.prefilterTopNTotalValue = 100;
  }

  /**
   * Get module category from config ID
   */
  getModuleCategory(module) {
    return MODULE_CATEGORY_MAP[module.configId] || ModuleCategory.ATTACK;
  }

  /**
   * Pre-filter modules to reduce pool size
   */
  prefilterModules(modules, prioritizedAttrs = null) {
    // Starting pre-filtering
    if (!modules.length) return [];

    // Sort by total attribute value
    const sortedByTotalValue = [...modules].sort((a, b) => {
      const aSum = a.parts.reduce((sum, p) => sum + p.value, 0);
      const bSum = b.parts.reduce((sum, p) => sum + p.value, 0);
      return bSum - aSum;
    });
    const topModules = new Set(sortedByTotalValue.slice(0, this.prefilterTopNTotalValue));

    // Get top modules for each attribute
    const attrModules = {};
    for (const module of modules) {
      for (const part of module.parts) {
        if (!attrModules[part.name]) attrModules[part.name] = [];
        attrModules[part.name].push({ module, value: part.value });
      }
    }

    const candidateModules = new Set(topModules);
    for (const [attrName, moduleValues] of Object.entries(attrModules)) {
      if (prioritizedAttrs && !prioritizedAttrs.includes(attrName)) continue;
      
      const sortedByAttr = [...moduleValues].sort((a, b) => b.value - a.value);
      for (const item of sortedByAttr.slice(0, this.prefilterTopNPerAttr)) {
        candidateModules.add(item.module);
      }
    }

    const filteredModules = [...candidateModules];
    // Pre-filtering complete
    return filteredModules;
  }

  /**
   * Calculate combat power from modules
   */
  calculateCombatPower(modules) {
    const attrBreakdown = {};
    for (const module of modules) {
      for (const part of module.parts) {
        attrBreakdown[part.name] = (attrBreakdown[part.name] || 0) + part.value;
      }
    }

    let thresholdPower = 0;
    const totalAttrValue = Object.values(attrBreakdown).reduce((a, b) => a + b, 0);

    for (const [attrName, attrValue] of Object.entries(attrBreakdown)) {
      let maxLevel = 0;
      for (const threshold of ATTR_THRESHOLDS) {
        if (attrValue >= threshold) maxLevel++;
      }
      
      if (maxLevel > 0) {
        const attrType = ATTR_NAME_TYPE_MAP[attrName] || "basic";
        const powerMap = attrType === 'special' ? SPECIAL_ATTR_POWER_MAP : BASIC_ATTR_POWER_MAP;
        thresholdPower += powerMap[maxLevel] || 0;
      }
    }

    const totalAttrPower = TOTAL_ATTR_POWER_MAP[totalAttrValue] || 0;
    return [thresholdPower + totalAttrPower, attrBreakdown];
  }

  /**
   * Get attribute level key for deduplication
   */
  _getAttributeLevelKey(attrBreakdown) {
    const levels = [];
    for (const [attrName, value] of Object.entries(attrBreakdown).sort()) {
      let levelStr = "(Level 0)";
      if (value >= 20) levelStr = "(Level 6)";
      else if (value >= 16) levelStr = "(Level 5)";
      else if (value >= 12) levelStr = "(Level 4)";
      else if (value >= 8) levelStr = "(Level 3)";
      else if (value >= 4) levelStr = "(Level 2)";
      else if (value >= 1) levelStr = "(Level 1)";
      levels.push(`${attrName}${levelStr}`);
    }
    return levels.join(',');
  }

  /**
   * Compute priority sort key
   */
  _computePrioritySortKey(solution, prioritizedAttrs, topK = 4) {
    function valueToLevel(val) {
      if (val >= 20) return 6;
      if (val >= 16) return 5;
      if (val >= 12) return 4;
      if (val >= 8) return 3;
      if (val >= 4) return 2;
      if (val >= 1) return 1;
      return 0;
    }

    const levels = prioritizedAttrs.map((attr, idx) => ({
      attr,
      level: valueToLevel(solution.attrBreakdown[attr] || 0),
      index: idx
    }));

    // Pick top_k attributes by (level desc, user order asc)
    levels.sort((a, b) => b.level - a.level || a.index - b.index);
    const topSelected = levels.slice(0, topK);

    const counts = { 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumLevels = 0;
    for (const item of topSelected) {
      if (item.level >= 1) {
        counts[item.level]++;
        sumLevels += item.level;
      }
    }

    return [
      counts[6], counts[5], counts[4], counts[3], counts[2], counts[1],
      sumLevels,
      solution.score || 0,
      solution.optimizationScore || 0
    ];
  }

  /**
   * Main optimization method
   */
  async optimizeModules(modules, category, topN = 40, prioritizedAttrs = null, priorityOrderMode = false, progressCallback = null) {
    // Starting optimization

    // Filter by category
    let modulePool = category === ModuleCategory.All 
      ? modules 
      : modules.filter(m => this.getModuleCategory(m) === category);

    // Filter by prioritized attributes
    if (prioritizedAttrs && prioritizedAttrs.length > 0) {
      const prioritizedSet = new Set(prioritizedAttrs);
      modulePool = modulePool.filter(m => m.parts.some(p => prioritizedSet.has(p.name)));
    }

    // Preliminary check
    if (prioritizedAttrs && prioritizedAttrs.length > 0) {
      const availableAttrs = new Set();
      for (const m of modulePool) {
        for (const p of m.parts) availableAttrs.add(p.name);
      }
      const prioritizedSet = new Set(prioritizedAttrs);
      const intersection = [...prioritizedSet].filter(a => availableAttrs.has(a));
      if (intersection.length === 0) {
        this.logger.warn("Pre-check failed: No prioritized attributes found in modules.");
        return [];
      }
    }

    const candidateModules = this.prefilterModules(modulePool, prioritizedAttrs);
    if (candidateModules.length < 4) {
      this.logger.warn("Less than 4 modules after pre-filtering.");
      return [];
    }

    const highQualityModules = candidateModules.filter(m => 
      m.parts.reduce((sum, p) => sum + p.value, 0) >= this.qualityThreshold
    );
    const lowQualityModules = candidateModules.filter(m =>
      m.parts.reduce((sum, p) => sum + p.value, 0) < this.qualityThreshold
    );

    // Module pooling completed

    const workingPool = highQualityModules.length >= 4 ? highQualityModules : candidateModules;

    // Run GA campaigns in parallel using worker threads
    const allBestSolutions = [];
    if (progressCallback) progressCallback(`Running ${this.numCampaigns} optimization tasks in parallel...`);

    // Create workers for parallel execution
    const workers = [];
    const workerPromises = [];
    let completedCount = 0;

    for (let i = 0; i < this.numCampaigns; i++) {
      const workerPromise = new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'gaWorker.js');
        const worker = new Worker(workerPath);

        worker.on('message', (data) => {
          if (data.success) {
            // Reconstruct ModuleSolution objects from worker results
            const reconstructedResults = data.results.map(result => {
              const solution = new ModuleSolution(result.modules);
              solution.attrBreakdown = result.attrBreakdown;
              solution.score = result.score;
              solution.optimizationScore = result.optimizationScore;
              // Verify combination ID matches (for debugging)
              if (result.combinationId && solution.getCombinationId() !== result.combinationId) {
                this.logger.warn('Combination ID mismatch in worker result');
              }
              return solution;
            });

            if (reconstructedResults.length > 0) {
              allBestSolutions.push(...reconstructedResults);
              completedCount++;
              const bestScore = reconstructedResults[0].optimizationScore;
              if (progressCallback) {
                progressCallback(`Task ${completedCount}/${this.numCampaigns} completed. Highest score: ${bestScore.toFixed(2)}`);
              }
            }

            resolve(reconstructedResults);
          } else {
            this.logger.warn(`Campaign ${data.campaignId} failed: ${data.error}`);
            resolve([]);
          }
        });

        worker.on('error', (error) => {
          this.logger.error(`Worker error in campaign ${i + 1}: ${error.message}`);
          reject(error);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            this.logger.warn(`Worker ${i + 1} stopped with exit code ${code}`);
          }
        });

        workers.push(worker);

        // Send work to worker
        worker.postMessage({
          modules: workingPool,
          category,
          prioritizedAttrs,
          gaParams: this.gaParams,
          campaignId: i + 1
        });
      });

      workerPromises.push(workerPromise);
    }

    // Wait for all workers to complete
    try {
      await Promise.all(workerPromises);
    } catch (error) {
      this.logger.error(`Error in parallel execution: ${error.message}`);
      // Fallback to sequential execution if parallel fails
      this.logger.warn('Falling back to sequential execution');
      allBestSolutions.length = 0; // Clear any partial results
      for (let i = 0; i < this.numCampaigns; i++) {
        const results = runSingleGaCampaign(workingPool, category, prioritizedAttrs, this.gaParams);
        if (results.length > 0) {
          allBestSolutions.push(...results);
          const bestScore = results[0].optimizationScore;
          if (progressCallback) {
            progressCallback(`Task ${i + 1}/${this.numCampaigns} completed. Highest score: ${bestScore.toFixed(2)}`);
          }
        }
      }
    } finally {
      // Terminate all workers
      workers.forEach(worker => {
        try {
          worker.terminate();
        } catch (err) {
          this.logger.warn(`Error terminating worker: ${err.message}`);
        }
      });
    }

    // Deduplicate and finalize
    const uniqueSolutions = new Map();
    for (const sol of allBestSolutions) {
      const id = sol.getCombinationId();
      if (!uniqueSolutions.has(id) || sol.optimizationScore > uniqueSolutions.get(id).optimizationScore) {
        uniqueSolutions.set(id, sol);
      }
    }

    let finalResults = [...uniqueSolutions.values()];

    // Calculate combat power for all solutions
    for (const solution of finalResults) {
      if (Object.keys(solution.attrBreakdown).length === 0) {
        [solution.score, solution.attrBreakdown] = this.calculateCombatPower(solution.modules);
      }
    }

    // Deduplicate by attribute-level signature
    const solutionsByAttrLevel = new Map();
    for (const solution of finalResults) {
      const key = this._getAttributeLevelKey(solution.attrBreakdown);
      if (!solutionsByAttrLevel.has(key)) {
        solutionsByAttrLevel.set(key, solution);
      }
    }

    const deduplicatedSolutions = [...solutionsByAttrLevel.values()];

    // Sort by priority or score
    if (prioritizedAttrs && priorityOrderMode) {
      deduplicatedSolutions.sort((a, b) => {
        const keyA = this._computePrioritySortKey(a, prioritizedAttrs);
        const keyB = this._computePrioritySortKey(b, prioritizedAttrs);
        for (let i = 0; i < keyA.length; i++) {
          if (keyB[i] !== keyA[i]) return keyB[i] - keyA[i];
        }
        return 0;
      });
    } else {
      deduplicatedSolutions.sort((a, b) => b.score - a.score);
    }

    // Optimization completed
    if (progressCallback) progressCallback(`Completed! Found ${deduplicatedSolutions.length} unique combinations.`);

    return deduplicatedSolutions.slice(0, topN);
  }

  /**
   * Get optimal solutions (public API)
   */
  async getOptimalSolutions(modules, category = ModuleCategory.All, topN = 40, prioritizedAttrs = null, priorityOrderMode = false, progressCallback = null) {
    const optimalSolutions = await this.optimizeModules(modules, category, topN, prioritizedAttrs, priorityOrderMode, progressCallback);
    return optimalSolutions;
  }

  /**
   * Print solution details (deprecated - results shown in UI)
   */
  printSolutionDetails(solution, rank) {
    // Solution details are displayed in the UI, no console output needed
  }
}

module.exports = { ModuleOptimizer, ModuleSolution, calculateFitness };

