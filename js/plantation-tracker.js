/**
 * Plantation tracking logic layer.
 *
 * Rules:
 *  - count increases + trigger NO  → planted 🌱 (cell = 1)
 *  - trigger edge NO → YES         → missed  ⚠️ (cell = 0)  ← count does NOT increase here
 *  - count decreases               → full reset
 */

const TRACKER_LOG = '[plantation-tracker]';

/**
 * @typedef {"YES" | "NO"} TriggerState
 */

/**
 * @typedef {{
 *   saplings_planted?: number;
 *   count?: number;
 *   trigger?: string;
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

function normalizeTrigger(value) {
  return String(value || "NO").toUpperCase().trim() === "YES" ? "YES" : "NO";
}

function sanitizeGrid(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => Array.isArray(row))
    .map((row) =>
      row.map((cell) => Number(cell)).filter((cell) => cell === 0 || cell === 1)
    );
}

export function getNextPlacement(grid, rowSize) {
  const safeRowSize = Number.isInteger(rowSize) && rowSize > 0 ? rowSize : 20;
  if (grid.length === 0) return { rowIndex: 0, colIndex: 0 };
  const lastRowIndex = grid.length - 1;
  const lastRow = grid[lastRowIndex] || [];
  if (lastRow.length < safeRowSize) return { rowIndex: lastRowIndex, colIndex: lastRow.length };
  return { rowIndex: lastRowIndex + 1, colIndex: 0 };
}

function summarizeGrid(grid) {
  let plantedCount = 0;
  let missedCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 1) plantedCount += 1;
      else if (cell === 0) missedCount += 1;
    }
  }
  return { plantedCount, missedCount, total: plantedCount + missedCount };
}

export function createPlantationTracker(options = {}) {
  const rowSize = Number.isInteger(options.rowSize) && options.rowSize > 0 ? options.rowSize : 20;
  let grid = sanitizeGrid(options.initialGrid);

  let prevSaplings = 0;
  let prevTrigger = /** @type {TriggerState} */ ("NO");
  let triggerYesCount = 0;

  let { plantedCount, missedCount, total } = summarizeGrid(grid);

  console.log(`${TRACKER_LOG} tracker created`, { rowSize });

  function appendCell(value) {
    const { rowIndex } = getNextPlacement(grid, rowSize);
    if (!grid[rowIndex]) grid[rowIndex] = [];
    grid[rowIndex].push(value);
    console.log(`${TRACKER_LOG} appendCell`, {
      value: value === 1 ? '🌱 planted' : '⚠️ missed',
      rowIndex,
      colIndex: grid[rowIndex].length - 1
    });
  }

  function resetState(saplingsValue) {
    console.warn(`${TRACKER_LOG} resetState`);
    grid = [];
    prevSaplings = Math.max(0, Number(saplingsValue) || 0);
    prevTrigger = "NO";
    triggerYesCount = 0;
    plantedCount = 0;
    missedCount = 0;
    total = 0;
  }

  function processUpdate(payload = {}) {
    // Accept either field name from Firebase
    const incomingSaplings = Math.max(0, Number(payload.saplings_planted ?? payload.count) || 0);
    const trigger = normalizeTrigger(payload.trigger);

    console.log(`${TRACKER_LOG} processUpdate`, {
      incomingSaplings,
      trigger,
      prevSaplings,
      prevTrigger
    });

    // ── RESET: count went down ───────────────────────────────────────────────
    if (incomingSaplings < prevSaplings) {
      console.warn(`${TRACKER_LOG} count decreased → reset`);
      resetState(incomingSaplings);
      prevTrigger = trigger;
      return snapshot();
    }

    // ── MISSED: trigger edge NO → YES ────────────────────────────────────────
    // count does NOT increase when trigger is YES (machine stops planting)
    // so we record the miss on the trigger edge itself
    if (trigger === "YES" && prevTrigger === "NO") {
      triggerYesCount += 1;
      appendCell(0); // ⚠️ missed
      missedCount += 1;
      total += 1;
      console.log(`${TRACKER_LOG} NO→YES edge → missed cell appended`, { triggerYesCount });
    }

    // ── PLANTED: count increased while trigger is NO ─────────────────────────
    if (incomingSaplings > prevSaplings) {
      const delta = incomingSaplings - prevSaplings;
      console.log(`${TRACKER_LOG} count increased by ${delta}`);
      for (let i = 0; i < delta; i++) {
        appendCell(1); // 🌱 planted
        plantedCount += 1;
        total += 1;
      }
    }

    prevSaplings = incomingSaplings;
    prevTrigger = trigger;

    return snapshot();
  }

  function snapshot() {
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

  function getSnapshot() {
    console.log(`${TRACKER_LOG} getSnapshot`, { plantedCount, missedCount, total });
    return snapshot();
  }

  return {
    processUpdate,
    getSnapshot,
    reset: () => resetState(0),
    getConfig: () => ({ rowSize })
  };
}