/**
 * Dashboard Logic
 * Subscribes to Firebase (simulated) events and updates the UI
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elSpeed = document.getElementById('val-speed');
    const elDistance = document.getElementById('val-distance');
    const elSpacing = document.getElementById('val-spacing');
    const elPlanted = document.getElementById('val-planted');
    const elMissed = document.getElementById('val-missed');

    // Utility to trigger CSS animation on value update
    const animateValueUpdate = (element, newValue) => {
        // Check if value changed
        if (element.innerText !== String(newValue)) {
            element.innerText = newValue;

            // Remove the class and force a reflow to trigger animation again
            element.classList.remove('value-updated');
            void element.offsetWidth; // trigger reflow
            element.classList.add('value-updated');
        }
    };

    // Listen for data updates from our Firebase Simulator
    window.firebaseDb.addEventListener('data_updated', (e) => {
        const data = e.detail;
        console.log("Dashboard UI Received Data:", data);

        animateValueUpdate(elSpeed, data.speed);
        animateValueUpdate(elDistance, data.distance);
        animateValueUpdate(elSpacing, data.plant_distance);
        animateValueUpdate(elPlanted, data.saplings_planted);
        animateValueUpdate(elMissed, data.saplings_missed);
    });
});
