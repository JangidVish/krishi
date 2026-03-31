/**
 * Plantation tracking logic layer.
 *
 * This module is UI-agnostic and can be used with Firebase onValue updates.
 * It processes cumulative counters and trigger edges into a deterministic grid state.
 */

/**
 * @typedef {"YES" | "NO"} TriggerState
 */

/**
 * @typedef {{
 *   saplings_planted?: number;
 *   trigger?: string;
 *   plantation_grid?: number[][];
 * }} RealtimePayload
 */

/**
 * @typedef {{
 *   grid: number[][];
 *   plantedCount: number;
 *   missedCount: number;
 *   total: number;
 *   triggerYesCount: number;
 *   prevSaplings: number;
 *   prevTrigger: TriggerState;
 * }} TrackerSnapshot
 */

/**
 * Returns a normalized trigger value.
 * Any non-YES value is treated as NO for safety.
 * @param {unknown} value
 * @returns {TriggerState}
 */
function normalizeTrigger(value) {
  return String(value || "NO").toUpperCase() === "YES" ? "YES" : "NO";
}

/**
 * Creates a deep-cloned, numeric-only grid.
 * Invalid rows/cells are ignored to avoid NaN/shape issues.
 * @param {unknown} input
 * @returns {number[][]}
 */
function sanitizeGrid(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter((row) => Array.isArray(row))
    .map((row) =>
      row
        .map((cell) => Number(cell))
        .filter((cell) => cell === 0 || cell === 1)
    );
}

/**
 * Returns row/column for the next insertion based on current grid length.
 * @param {number[][]} grid
 * @param {number} rowSize
 * @returns {{ rowIndex: number; colIndex: number }}
 */
export function getNextPlacement(grid, rowSize) {
  const safeRowSize = Number.isInteger(rowSize) && rowSize > 0 ? rowSize : 20;

  if (grid.length === 0) {
    return { rowIndex: 0, colIndex: 0 };
  }

  const lastRowIndex = grid.length - 1;
  const lastRow = grid[lastRowIndex] || [];

  if (lastRow.length < safeRowSize) {
    return { rowIndex: lastRowIndex, colIndex: lastRow.length };
  }

  return { rowIndex: lastRowIndex + 1, colIndex: 0 };
}

/**
 * Computes planted/missed/total from a grid.
 * @param {number[][]} grid
 * @returns {{ plantedCount: number; missedCount: number; total: number }}
 */
function summarizeGrid(grid) {
  let plantedCount = 0;
  let missedCount = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell === 1) plantedCount += 1;
      else if (cell === 0) missedCount += 1;
    }
  }

  return {
    plantedCount,
    missedCount,
    total: plantedCount + missedCount
  };
}

/**
 * Creates a tracker with idempotent update processing.
 *
 * Rules implemented:
 * - New event only when saplings_planted increases
 * - Success if trigger === NO, failure if trigger === YES
 * - Trigger YES count increments only on NO -> YES edge
 * - Reset state if saplings_planted decreases
 * - Ignore duplicate/unchanged saplings_planted values
 *
 * @param {{ rowSize?: number; initialGrid?: number[][] }} [options]
 */
export function createPlantationTracker(options = {}) {
  const rowSize = Number.isInteger(options.rowSize) && options.rowSize > 0 ? options.rowSize : 20;
  let grid = sanitizeGrid(options.initialGrid);

  let prevSaplings = 0;
  let prevTrigger = /** @type {TriggerState} */ ("NO");
  let triggerYesCount = 0;

  // Initialize counters from initial grid so snapshot is immediately correct.
  let { plantedCount, missedCount, total } = summarizeGrid(grid);

  /**
   * Appends one attempt result to the grid using configured row size.
   * @param {0 | 1} value
   */
  function appendCell(value) {
    const { rowIndex } = getNextPlacement(grid, rowSize);

    if (!grid[rowIndex]) {
      grid[rowIndex] = [];
    }

    grid[rowIndex].push(value);
  }

  /**
   * Resets tracker state.
   * @param {number} saplingsValue
   */
  function resetState(saplingsValue) {
    grid = [];
    prevSaplings = Math.max(0, Number(saplingsValue) || 0);
    prevTrigger = "NO";
    triggerYesCount = 0;
    plantedCount = 0;
    missedCount = 0;
    total = 0;
  }

  /**
   * Processes one incoming realtime payload.
   * @param {RealtimePayload} payload
   * @returns {TrackerSnapshot}
   */
  function processUpdate(payload = {}) {
    const incomingSaplings = Math.max(0, Number(payload.saplings_planted) || 0);
    const trigger = normalizeTrigger(payload.trigger);

    // Count ONLY transition NO -> YES and avoid duplicates while YES remains high.
    if (trigger === "YES" && prevTrigger !== "YES") {
      triggerYesCount += 1;
    }

    // Device/session reset handling.
    if (incomingSaplings < prevSaplings) {
      resetState(incomingSaplings);
      prevTrigger = trigger;

      return {
        grid: grid.map((row) => row.slice()),
        plantedCount,
        missedCount,
        total,
        triggerYesCount,
        prevSaplings,
        prevTrigger
      };
    }

    // New planting attempt occurred only when counter increased.
    if (incomingSaplings > prevSaplings) {
      const delta = incomingSaplings - prevSaplings;

      // Process each missed intermediate event in order using current trigger.
      // This keeps logic deterministic with cumulative counters.
      for (let i = 0; i < delta; i += 1) {
        const cellValue = trigger === "NO" ? 1 : 0;
        appendCell(cellValue);

        if (cellValue === 1) plantedCount += 1;
        else missedCount += 1;
        total += 1;
      }
    }

    prevSaplings = incomingSaplings;
    prevTrigger = trigger;

    return {
      grid: grid.map((row) => row.slice()),
      plantedCount,
      missedCount,
      total,
      triggerYesCount,
      prevSaplings,
      prevTrigger
    };
  }

  /**
   * Returns current snapshot without mutating state.
   * @returns {TrackerSnapshot}
   */
  function getSnapshot() {
    return {
      grid: grid.map((row) => row.slice()),
      plantedCount,
      missedCount,
      total,
      triggerYesCount,
      prevSaplings,
      prevTrigger
    };
  }

  return {
    processUpdate,
    getSnapshot,
    reset: () => resetState(0),
    getConfig: () => ({ rowSize })
  };
}
