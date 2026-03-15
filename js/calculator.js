/**
 * Plantation Calculator Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calculatorForm');
    const resultContainer = document.getElementById('resultContainer');
    const totalPlantsElement = document.getElementById('totalPlants');

    // Conversion factors to Square Meters (sqm)
    const conversionFactors = {
        'sqm': 1,
        'acre': 4046.86,
        'hectare': 10000,
        'sqft': 0.092903,
        'bigha': 2500 // Note: Bigha varies by region in India (~1333 to ~2500 sqm). Using a common value.
    };

    // Conversion factors to Meters (m) for plant/row distance
    const distanceConversionFactors = {
        'cm': 0.01,
        'm': 1,
        'in': 0.0254,
        'ft': 0.3048
    };

    // DOM Elements for Toggle logic
    const singleRowToggle = document.getElementById('singleRowToggle');
    const rowSpacingInput = document.getElementById('rowSpacing');
    const rowSpacingContainer = document.getElementById('rowSpacingContainer');

    // Handle toggle change
    singleRowToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Disable row-to-row spacing as it's not needed for a single row
            rowSpacingInput.disabled = true;
            rowSpacingInput.removeAttribute('required');
            rowSpacingContainer.style.opacity = '0.5';
        } else {
            // Enable it back
            rowSpacingInput.disabled = false;
            rowSpacingInput.setAttribute('required', 'true');
            rowSpacingContainer.style.opacity = '1';
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const landArea = parseFloat(document.getElementById('landArea').value);
        const areaUnit = document.getElementById('areaUnit').value;
        const plantDistanceVal = parseFloat(document.getElementById('plantDistance').value);
        const plantDistanceUnit = document.getElementById('plantDistanceUnit').value;
        const isSingleRow = singleRowToggle.checked;
        const rowSpacingVal = isSingleRow ? 1 : parseFloat(document.getElementById('rowSpacing').value); // Use 1 to avoid NaN 
        const rowSpacingUnit = document.getElementById('rowSpacingUnit').value;

        if (isNaN(landArea) || isNaN(plantDistanceVal) || (!isSingleRow && isNaN(rowSpacingVal)) ||
            landArea <= 0 || plantDistanceVal <= 0 || (!isSingleRow && rowSpacingVal <= 0)) {
            alert('Please enter valid positive numbers.');
            return;
        }

        // Convert total area to square meters
        const areaInSqm = landArea * conversionFactors[areaUnit];

        // Convert spacings to meters
        const plantDistanceM = plantDistanceVal * distanceConversionFactors[plantDistanceUnit];
        const rowSpacingM = rowSpacingVal * distanceConversionFactors[rowSpacingUnit];

        let totalPlants = 0;

        if (isSingleRow) {
            // Formula for single row: A / P (Total Length / Plant Distance)
            // Note: In single row mode, 'landArea' acts as total length. 
            // The unit might still be selected as area, but semantically for a single row, we divide Length by Distance.
            // Converting the "area" input (acting as length) to meters if it's meant to be a 1D line:
            // Since we don't have a specific "Length Unit" dropdown, we will treat the input as meters directly 
            // for simplicity, or we can use sqrt of the area to approximate a side, but it's simpler to just do A / P 
            // and assume the user enters Total Length in meters when in "Single Row" mode.
            // Let's divide the Area directly by Plant Distance (assuming width is 1 unit of Area)

            // Formula: Length (Area) / Plant Distance
            // To ensure correct units, if they enter Area in sqm, we treat it as Length in m.
            totalPlants = Math.floor(areaInSqm / plantDistanceM);
        } else {
            // Calculate area for a single plant in square meters (R x P)
            const singlePlantAreaSqm = rowSpacingM * plantDistanceM;

            // Calculate total plants needed (Total Land Area / Area per Plant)
            // Formula: A / (R x P)
            totalPlants = Math.floor(areaInSqm / singlePlantAreaSqm);
        }

        // Animate result
        displayResult(totalPlants);
    });

    const displayResult = (total) => {
        resultContainer.style.display = 'block';

        // Simple counter animation
        let start = 0;
        const duration = 1000; // 1 second
        const stepTime = Math.abs(Math.floor(duration / 30));
        let step = Math.ceil(total / 30);

        // Reset element
        totalPlantsElement.innerText = "0";
        totalPlantsElement.classList.remove('value-updated');
        void totalPlantsElement.offsetWidth; // trigger reflow

        const timer = setInterval(() => {
            start += step;
            if (start >= total) {
                totalPlantsElement.innerText = total.toLocaleString();
                totalPlantsElement.classList.add('value-updated');
                clearInterval(timer);
            } else {
                totalPlantsElement.innerText = start.toLocaleString();
            }
        }, stepTime);
    };
});
