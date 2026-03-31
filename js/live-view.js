/**
 * Live View Logic
 * Handles real-time Firebase updates and builds reactive grid.
 */

// ── Stats strip updater ──
function updateStrip() {
    const grid = document.getElementById('plantationGrid');
    if (!grid) return;
    const planted = grid.querySelectorAll('.plant-cell.planted').length;
    const missed  = grid.querySelectorAll('.plant-cell.missed').length;
    const total   = grid.querySelectorAll('.plant-cell').length;
    const rate    = total > 0 ? Math.round((planted / total) * 100) + '%' : '—';

    const sp = document.getElementById('strip-planted');
    const sm = document.getElementById('strip-missed');
    const st = document.getElementById('strip-total');
    const sr = document.getElementById('strip-rate');
    if (sp) sp.textContent = planted;
    if (sm) sm.textContent = missed;
    if (st) st.textContent = total;
    if (sr) sr.textContent = rate;
}

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('plantationGrid');
    const colHeaders = document.getElementById('colHeaders');

    const rowElements = [];

    // 🔹 Initialize Grid
    const initializeGrid = (gridData) => {
        gridContainer.innerHTML = '';
        colHeaders.innerHTML = '';
        rowElements.length = 0;

        gridData.forEach((rowData, rowIndex) => {
            createRow(rowIndex);
        });
    };

    // 🔹 Create new row dynamically
    const createRow = (rowIndex) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'farm-row';

        const label = document.createElement('div');
        label.className = 'row-label';
        label.innerText = `R${rowIndex + 1}`;
        rowDiv.appendChild(label);

        const cellsContainer = document.createElement('div');
        cellsContainer.style.display = 'flex';
        cellsContainer.style.gap = '0.5rem';
        rowDiv.appendChild(cellsContainer);

        gridContainer.appendChild(rowDiv);

        rowElements[rowIndex] = {
            container: cellsContainer,
            length: 0
        };
    };

    // 🔹 Build column headers
    const buildColHeaders = (count) => {
        if (!colHeaders) return;
        colHeaders.innerHTML = '';

        for (let i = 1; i <= count; i++) {
            const d = document.createElement('div');
            d.className = 'col-header';
            d.textContent = i;
            colHeaders.appendChild(d);
        }
    };

    // 🔹 Update Grid
    const updateGrid = (gridData) => {

        // ✅ Handle full reset
        if (!gridData || gridData.length === 0) {
            gridContainer.innerHTML = '';
            colHeaders.innerHTML = '';
            rowElements.length = 0;
            updateStrip();
            return;
        }

        // ✅ First-time init
        if (rowElements.length === 0) {
            initializeGrid(gridData);
        }

        gridData.forEach((rowData, rowIndex) => {

            // ✅ Create row if new
            if (!rowElements[rowIndex]) {
                createRow(rowIndex);
            }

            const rowObj = rowElements[rowIndex];

            // ✅ Reset row if shrinks
            if (rowData.length < rowObj.length) {
                rowObj.container.innerHTML = '';
                rowObj.length = 0;
            }

            // ✅ Add new cells
            while (rowObj.length < rowData.length) {
                const cellVal = rowData[rowObj.length];
                const cell = document.createElement('div');

                cell.dataset.col = rowObj.length + 1;

                if (cellVal === 1) {
                    cell.className = 'plant-cell planted';
                    cell.innerText = '🌱';
                } else {
                    cell.className = 'plant-cell missed';
                    cell.innerText = '❌';
                }

                // Tooltip
                cell.dataset.tip = `R${rowIndex + 1} · Col ${cell.dataset.col} · ${cellVal === 1 ? 'Planted ✓' : 'Missed ✗'}`;

                rowObj.container.appendChild(cell);
                rowObj.length++;
            }
        });

        // ✅ Build column headers once
        const firstRow = gridData[0];
        if (firstRow) {
            buildColHeaders(firstRow.length);
        }

        // ✅ Update stats manually (optimized)
        updateStrip();
    };

    // 🔹 Debounced Firebase listener
    let updateTimeout;

    window.firebaseDb.addEventListener('data_updated', (e) => {
        clearTimeout(updateTimeout);

        updateTimeout = setTimeout(() => {
            const data = e.detail;
            console.log("Live Grid Data:", data.plantation_grid);
            updateGrid(data.plantation_grid);
        }, 50);
    });
});