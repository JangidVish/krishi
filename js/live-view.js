/**
 * Live View Logic
 * Listens to simulated Firebase updates and builds a reactive grid.
 */

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('plantationGrid');

    // We will keep track of rows mapped by indeces
    const rowElements = [];

    // Initialize DOM rows based on incoming data
    const initializeGrid = (gridData) => {
        gridContainer.innerHTML = '';
        rowElements.length = 0;

        gridData.forEach((rowData, rowIndex) => {
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

            rowElements.push({
                container: cellsContainer,
                length: 0 // track how many cells we've drawn
            });
        });
    };

    // Update the DOM based on new plantation_grid states
    const updateGrid = (gridData) => {
        // Init if we haven't created the rows
        if (rowElements.length === 0 && gridData.length > 0) {
            initializeGrid(gridData);
        }

        gridData.forEach((rowData, rowIndex) => {
            const rowObj = rowElements[rowIndex];

            // If the row data got cleared or reset
            if (rowData.length < rowObj.length) {
                rowObj.container.innerHTML = '';
                rowObj.length = 0;
            }

            // Append newly added cells
            while (rowObj.length < rowData.length) {
                const cellVal = rowData[rowObj.length];
                const cell = document.createElement('div');

                if (cellVal === 1) {
                    cell.className = 'plant-cell planted popIn';
                    cell.innerText = '🌱'; // '✔' also requested, going with 🌱
                } else {
                    cell.className = 'plant-cell missed popIn';
                    cell.innerText = '❌';
                }

                rowObj.container.appendChild(cell);
                rowObj.length++;
            }
        });
    };

    // Listen for data updates
    window.firebaseDb.addEventListener('data_updated', (e) => {
        const data = e.detail;
        console.log("Live View Grid UI Received Data:", data.plantation_grid);
        updateGrid(data.plantation_grid);
    });
});
