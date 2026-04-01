/**
 * live-view.js
 * Connects Firebase realtime events → PlantationTracker → DOM grid
 *
 * Rules (handled by tracker):
 *  - saplings_planted increases  →  append 1 (planted 🌱)
 *  - trigger goes NO → YES       →  append 0 (missed ⚠️)
 *  - saplings_planted decreases  →  full reset
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

/** Wipe the grid DOM completely (used on tracker reset) */
function clearGrid() {
  if (!gridEl) return;
  console.warn(`${LIVE_VIEW_LOG} clearGrid called`);
  gridEl.innerHTML = '';
  const ch = document.getElementById('colHeaders');
  if (ch) ch.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'block';
}

// ─── Firebase event handler ──────────────────────────────────────────────────

function handleDataUpdate(event) {
  const payload = event.detail ?? {};
  console.log(`${LIVE_VIEW_LOG} data_updated event`, payload);

  // Remember if we had data before this update
  const before = tracker.getSnapshot();
  const hadData = before.total > 0;
  console.log(`${LIVE_VIEW_LOG} before snapshot`, before);

  // Run through tracker — this is where the plantation_grid logic lives
  const snapshot = tracker.processUpdate(payload);
  console.log(`${LIVE_VIEW_LOG} after processUpdate`, snapshot);

  // If saplings decreased → tracker reset → clear DOM too
  const wasReset = hadData && snapshot.total === 0;
  if (wasReset) {
    console.warn(`${LIVE_VIEW_LOG} detected reset after update`, {
      hadData,
      beforeTotal: before.total,
      afterTotal: snapshot.total
    });
  }
  if (wasReset) clearGrid();

  // Render incremental changes
  renderGrid(snapshot.grid);

  // Refresh stat pills
  updateStrip();
}

// ─── Wire up ─────────────────────────────────────────────────────────────────

if (window.firebaseDb) {
  console.log(`${LIVE_VIEW_LOG} binding data_updated listener (firebaseDb already available)`);
  window.firebaseDb.addEventListener('data_updated', handleDataUpdate);
} else {
  // Fallback: wait for firebaseDb to be attached
  window.addEventListener('load', () => {
    console.log(`${LIVE_VIEW_LOG} load event, checking firebaseDb`);
    if (window.firebaseDb) {
      console.log(`${LIVE_VIEW_LOG} binding data_updated listener after load`);
      window.firebaseDb.addEventListener('data_updated', handleDataUpdate);
    } else {
      console.error(`${LIVE_VIEW_LOG} firebaseDb is still unavailable on load`);
    }
  });
}