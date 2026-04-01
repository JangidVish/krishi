/**
 * live-view.js
 * Connects Firebase realtime events → PlantationTracker → DOM grid
 *
 * Rules (handled by tracker):
 *  - saplings_planted increases  →  append 1 (planted 🌱)
 *  - trigger goes NO → YES       →  append 0 (missed ⚠️)
 */

import { createPlantationTracker } from './plantation-tracker.js';

const LIVE_VIEW_LOG = '[live-view]';

// ─── Config ──────────────────────────────────────────────────────────────────
const ROW_SIZE = 20; // cells per row

// ─── DOM refs ────────────────────────────────────────────────────────────────
const gridEl   = document.getElementById('plantationGrid');
const emptyEl  = document.getElementById('emptyState');

const stripPlanted = document.getElementById('strip-planted');
const stripMissed  = document.getElementById('strip-missed');
const stripTotal   = document.getElementById('strip-total');
let isFirebaseBound = false;

// ─── Tracker instance ────────────────────────────────────────────────────────
const tracker = createPlantationTracker({ rowSize: ROW_SIZE });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Update the three stat pills above the grid */
function updateStrip() {
  const { plantedCount, missedCount, total } = tracker.getSnapshot();
  console.log(`${LIVE_VIEW_LOG} updateStrip`, { plantedCount, missedCount, total });
  if (stripPlanted) stripPlanted.textContent = plantedCount;
  if (stripMissed)  stripMissed.textContent  = missedCount;
  if (stripTotal)   stripTotal.textContent   = total;
}

// Expose globally so inline observer in live-view.html can call it
window.updateStrip = updateStrip;

/**
 * Build / reconcile the full DOM grid from a 2-D number[][].
 * Only adds new rows/cells — never re-creates existing ones, so
 * CSS pop animations only fire on genuinely new cells.
 */
function renderGrid(grid) {
  if (!gridEl) return;

  // Empty state toggle
  const hasData = grid.length > 0 && grid.some(r => r.length > 0);
  console.log(`${LIVE_VIEW_LOG} renderGrid`, {
    rows: grid.length,
    hasData,
    rowSizes: grid.map((row) => row.length)
  });
  if (emptyEl) emptyEl.style.display = hasData ? 'none' : 'block';

  grid.forEach((rowData, rowIndex) => {
    let rowEl = gridEl.querySelector(`[data-row="${rowIndex}"]`);

    // Create row if missing
    if (!rowEl) {
      rowEl = document.createElement('div');
      rowEl.className = 'farm-row';
      rowEl.dataset.row = rowIndex;

      const label = document.createElement('div');
      label.className = 'row-label';
      label.textContent = `Row ${rowIndex + 1}`;
      rowEl.appendChild(label);

      gridEl.appendChild(rowEl);
    }

    // Add only the new cells (existing cells stay untouched)
    const existingCells = rowEl.querySelectorAll('.plant-cell').length;
    const newCells = Math.max(0, rowData.length - existingCells);
    if (newCells > 0) {
      console.log(`${LIVE_VIEW_LOG} adding cells`, {
        rowIndex,
        existingCells,
        rowLength: rowData.length,
        newCells
      });
    }

    rowData.slice(existingCells).forEach((cellVal, relIdx) => {
      const colIndex = existingCells + relIdx;
      const cell = document.createElement('div');
      cell.className = 'plant-cell';
      cell.dataset.row = rowIndex;
      cell.dataset.col = colIndex;

      if (cellVal === 1) {
        cell.classList.add('planted');
        cell.textContent = '🌱';
        cell.dataset.tip = `Row ${rowIndex + 1} · Col ${colIndex + 1} · Planted ✓`;
      } else {
        cell.classList.add('missed');
        cell.textContent = '⚠️';
        cell.dataset.tip = `Row ${rowIndex + 1} · Col ${colIndex + 1} · Missed ✗`;
      }

      rowEl.appendChild(cell);
    });
  });

  // Column headers (built once after first row is populated)
  buildColHeaders(ROW_SIZE);
}

/** Build numeric column headers (runs once) */
function buildColHeaders(count) {
  const ch = document.getElementById('colHeaders');
  if (!ch || ch.children.length > 0) return;
  for (let i = 1; i <= count; i++) {
    const d = document.createElement('div');
    d.className = 'col-header';
    d.textContent = i;
    ch.appendChild(d);
  }
}

/** Wipe the grid DOM completely before rendering a full incoming grid snapshot. */
function clearGrid() {
  if (!gridEl) return;
  console.warn(`${LIVE_VIEW_LOG} clearGrid called`);
  gridEl.innerHTML = '';
  const ch = document.getElementById('colHeaders');
  if (ch) ch.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'block';
}

function sanitizeGrid(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => Number(cell)).filter((cell) => cell === 0 || cell === 1));
}

function summarizeGrid(grid) {
  let planted = 0;
  let missed = 0;
  grid.forEach((row) => {
    row.forEach((cell) => {
      if (cell === 1) planted += 1;
      if (cell === 0) missed += 1;
    });
  });
  return { planted, missed, total: planted + missed };
}

// ─── Firebase event handler ──────────────────────────────────────────────────

function handleDataUpdate(event) {
  const payload = event.detail ?? {};
  console.log(`${LIVE_VIEW_LOG} data_updated event`, payload);

  const incomingGrid = sanitizeGrid(payload.plantation_grid);
  if (incomingGrid.length > 0) {
    // If backend already sends the full plantation grid, render it directly.
    clearGrid();
    renderGrid(incomingGrid);

    const stats = summarizeGrid(incomingGrid);
    if (stripPlanted) stripPlanted.textContent = stats.planted;
    if (stripMissed) stripMissed.textContent = stats.missed;
    if (stripTotal) stripTotal.textContent = stats.total;
    return;
  }

  // Remember if we had data before this update
  const before = tracker.getSnapshot();
  const hadData = before.total > 0;
  console.log(`${LIVE_VIEW_LOG} before snapshot`, before);

  // Run through tracker — this is where the plantation_grid logic lives
  const snapshot = tracker.processUpdate(payload);
  console.log(`${LIVE_VIEW_LOG} after processUpdate`, snapshot);

  // Render incremental changes
  renderGrid(snapshot.grid);

  // Refresh stat pills
  updateStrip();
}

// ─── Wire up ─────────────────────────────────────────────────────────────────

function bindFirebase(firebaseDb) {
  if (!firebaseDb || isFirebaseBound) return;

  console.log(`${LIVE_VIEW_LOG} binding data_updated listener`);
  firebaseDb.addEventListener('data_updated', handleDataUpdate);
  isFirebaseBound = true;

  // Render latest known state immediately even if first event was missed.
  if (firebaseDb.data) {
    handleDataUpdate({ detail: firebaseDb.data });
  }
}

bindFirebase(window.firebaseDb);
window.addEventListener('firebase_db_ready', (event) => {
  bindFirebase(event.detail || window.firebaseDb);
});