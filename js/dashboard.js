/**
 * Dashboard Logic
 * Subscribes to Firebase (simulated) events and updates the UI
 */

const DASHBOARD_LOG = '[dashboard]';

document.addEventListener('DOMContentLoaded', () => {
    const elSaplingsPlanted = document.getElementById('saplingsPlanted');
    const elTriggerCount = document.getElementById('triggerCount');
    const elTotalSaplings = document.getElementById('totalSaplings');
    const elTotalDistance = document.getElementById('totalDistance');
    const elSpeed = document.getElementById('val-speed');
    const elPlantDistanceDropdown = document.getElementById('plantDistanceDropdown');

    let triggerYesCount = 0;
    let prevTrigger = null;
    let countOfSaplings = 0;
    let selectedPlantDistance = Number(elPlantDistanceDropdown?.value ?? 300);
    let isFirebaseBound = false;

    console.log(`${DASHBOARD_LOG} DOM ready`, {
        hasSaplingsEl: Boolean(elSaplingsPlanted),
        hasTriggerEl: Boolean(elTriggerCount),
        hasTotalEl: Boolean(elTotalSaplings),
        hasDistanceEl: Boolean(elTotalDistance),
        hasSpeedEl: Boolean(elSpeed),
        hasDistanceDropdown: Boolean(elPlantDistanceDropdown)
    });

    const safeNumber = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const pulseValue = (element) => {
        if (!element) {
            return;
        }
        element.classList.remove('value-updated');
        void element.offsetWidth;
        element.classList.add('value-updated');
    };

    // Smoothly animates numeric transitions for key dashboard values.
    const animateNumberText = (element, nextValue, options = {}) => {
        if (!element) {
            return;
        }

        const {
            decimals = 0,
            suffix = '',
            duration = 350
        } = options;

        const target = safeNumber(nextValue, 0);
        const current = safeNumber(element.dataset.rawValue, 0);

        if (Math.abs(current - target) < 1e-9) {
            element.textContent = `${target.toFixed(decimals)}${suffix}`;
            element.dataset.rawValue = String(target);
            return;
        }

        const start = performance.now();
        const diff = target - current;

        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = current + (diff * eased);
            element.textContent = `${value.toFixed(decimals)}${suffix}`;

            if (t < 1) {
                requestAnimationFrame(tick);
                return;
            }

            element.dataset.rawValue = String(target);
            pulseValue(element);
        };

        requestAnimationFrame(tick);
    };

    const renderDerived = () => {
        const totalSaplings = countOfSaplings + triggerYesCount;
        const totalDistanceMeters = (totalSaplings * selectedPlantDistance) / 1000;

        console.log(`${DASHBOARD_LOG} renderDerived`, {
            countOfSaplings,
            triggerYesCount,
            totalSaplings,
            selectedPlantDistance,
            totalDistanceMeters
        });

        animateNumberText(elSaplingsPlanted, countOfSaplings, { decimals: 0 });
        animateNumberText(elTriggerCount, triggerYesCount, { decimals: 0 });
        animateNumberText(elTotalSaplings, totalSaplings, { decimals: 0 });
        animateNumberText(elTotalDistance, totalDistanceMeters, { decimals: 2 });
    };

    if (elPlantDistanceDropdown) {
        const selected = String(selectedPlantDistance);
        if ([...elPlantDistanceDropdown.options].some((option) => option.value === selected)) {
            elPlantDistanceDropdown.value = selected;
        }

        elPlantDistanceDropdown.addEventListener('change', (event) => {
            const nextDistance = safeNumber(event.target.value, 300);
            if (![300, 450, 600].includes(nextDistance)) {
                console.warn(`${DASHBOARD_LOG} Ignored invalid plant distance`, event.target.value);
                return;
            }
            selectedPlantDistance = nextDistance;
            console.log(`${DASHBOARD_LOG} Plant distance changed`, selectedPlantDistance);
            renderDerived();
        });
    }

    const handleDataUpdate = (event) => {
        const data = event?.detail ?? event ?? {};
        const saplingsPlanted = safeNumber(data.saplings_planted, 0);
        const trigger = String(data.trigger ?? 'NO').toUpperCase();
        const previousTrigger = prevTrigger;

        console.log(`${DASHBOARD_LOG} data_updated received`, {
            saplings_planted: saplingsPlanted,
            speed: safeNumber(data.speed, 0),
            trigger,
            previousTrigger
        });

        countOfSaplings = Math.max(0, saplingsPlanted);
        if (trigger === 'YES' && prevTrigger !== 'YES') {
            triggerYesCount += 1;
            console.log(`${DASHBOARD_LOG} Trigger NO->YES edge detected`, { triggerYesCount });
            pulseValue(elTriggerCount);
        }
        prevTrigger = trigger;

        const speedValue = safeNumber(data.speed, 0);
        animateNumberText(elSpeed, speedValue, { decimals: 3 });
        renderDerived();
    };

    const bindFirebase = (firebaseDb) => {
        if (!firebaseDb || isFirebaseBound) {
            console.log(`${DASHBOARD_LOG} bindFirebase skipped`, {
                hasFirebaseDb: Boolean(firebaseDb),
                isFirebaseBound
            });
            return;
        }

        console.log(`${DASHBOARD_LOG} Binding data_updated listener`);
        firebaseDb.addEventListener('data_updated', handleDataUpdate);
        isFirebaseBound = true;

        // Render latest known state right away, even if first realtime event was already emitted.
        if (firebaseDb.data) {
            console.log(`${DASHBOARD_LOG} Rendering initial firebaseDb.data`);
            handleDataUpdate(firebaseDb.data);
        }
    };

    console.log(`${DASHBOARD_LOG} Attempting immediate bind with window.firebaseDb`);
    bindFirebase(window.firebaseDb);
    window.addEventListener('firebase_db_ready', (event) => {
        console.log(`${DASHBOARD_LOG} firebase_db_ready event received`);
        bindFirebase(event.detail || window.firebaseDb);
    });
});
