import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzkcg1wzQTo2B7vQdcahtHAM2YBPn9WSY",
    databaseURL: "https://planting-77ce1-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

class RealtimeDatabaseSimulator extends EventTarget {
    constructor() {
        super();
        this.data = {
            speed: 0,
            distance: 0,
            plant_distance: 30, // cm
            saplings_planted: 0,
            saplings_missed: 0,
            plantation_grid: []
            // plantation_grid format: [ [1,1,0,...], [1,1,1,...] ] 1 = planted, 0 = missed
        };

        // Start listening to Firebase real-time data
        this.startListening();
    }

    resetDatabase() {
        if (confirm("Are you sure you want to reset the plantation database to zero?")) {
            const dbRef = ref(database, '/plant');
            set(dbRef, {
                count: 0,
                distance: 0,
                map: null // This removes all the plant map history
            }).then(() => {
                console.log("Database reset successfully!");
                // Also reset local state
                this.data.distance = 0;
                this.data.saplings_planted = 0;
                this.data.saplings_missed = 0;
                this.data.plantation_grid = [];
                this.dispatchEvent(new CustomEvent('data_updated', {
                    detail: this.data
                }));
            }).catch((error) => {
                console.error("Error resetting database:", error);
            });
        }
    }

    startListening() {
        // According to the schema, data is stored under "plant"
        const dbRef = ref(database, '/plant');
        onValue(dbRef, (snapshot) => {
            const val = snapshot.val();
            console.log("Firebase Data Received from /plant:", val);
            if (val) {
                // Map Firebase schema to UI schema

                // Tractor's distance travelled
                if (val.distance !== undefined) {
                    this.data.distance = val.distance.toFixed(1);
                }

                // Saplings Planted
                if (val.count !== undefined) {
                    this.data.saplings_planted = val.count;
                }

                // Assuming constant speed for now since it's not in the schema
                // Could be calculated based on delta distance / delta time in the future
                this.data.speed = 4.5;

                // Missed saplings could be calculated based on total possible plants 
                // vs actual planted (count), or read from the map.
                // For now, we calculate from the map data.
                if (val.map !== undefined) {
                    let totalMissed = 0;
                    let currentGrid = [];
                    let currentRow = [];

                    // The map keys are 1, 2, 3...
                    // Convert the object/array into a sorted array of values
                    const mapData = val.map;
                    const mapKeys = Object.keys(mapData).map(Number).sort((a, b) => a - b);

                    mapKeys.forEach((key, index) => {
                        const isPlanted = mapData[key] === 1 ? 1 : 0;
                        if (isPlanted === 0) totalMissed++;

                        currentRow.push(isPlanted);

                        // Push to grid every 20 plants (or desired row length)
                        if (currentRow.length >= 20 || index === mapKeys.length - 1) {
                            currentGrid.push(currentRow);
                            currentRow = [];
                        }
                    });

                    this.data.saplings_missed = totalMissed;
                    this.data.plantation_grid = currentGrid;
                }

                // Dispatch event for UI to catch
                this.dispatchEvent(new CustomEvent('data_updated', {
                    detail: this.data
                }));
            }
        });
    }
}

// Attach to window object to be accessible globally
window.firebaseDb = new RealtimeDatabaseSimulator();
