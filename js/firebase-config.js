import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔐 Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAo2-BGrCrO3N8pjTqaoAPH34_o6-Eueyo",
    databaseURL: "https://tifan-66317-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

class RealtimeDatabase extends EventTarget {
    constructor() {
        super();

        this.isResetting = false;

        this.data = {
            speed: 0,
            distance: 0,
            plant_distance: 300,
            saplings_planted: 0,
            saplings_missed: 0,
            plantation_grid: [],
            direction: "",
            bed: "",
            trigger: ""
        };

        this.startListening();
    }

    // 🔴 REALTIME LISTENER
    startListening() {
        const dbRef = ref(database, '/transplanter');

        onValue(dbRef, (snapshot) => {
            const val = snapshot.val();
            console.log("🔥 Firebase Data:", val);

            if (!val) return;

            this.data = {
                speed: Number(val.speed ?? 0),
                distance: Number(val.distance ?? 0),
                plant_distance: Number(val.plant_distance ?? 300),
                saplings_planted: Number(val.saplings_planted ?? val.count ?? 0),
                saplings_missed: Number(val.saplings_missed ?? 0),
                plantation_grid: Array.isArray(val.plantation_grid) ? val.plantation_grid : [],
                direction: val.direction ?? "",
                bed: val.bed ?? "",
                trigger: String(val.trigger ?? "NO").toUpperCase()
            };

            // 🔁 Trigger UI update
            this.dispatchEvent(new CustomEvent('data_updated', {
                detail: this.data
            }));
        });
    }

    // 🔄 RESET DATABASE
    resetDatabase() {
        if (this.isResetting) {
            console.warn("⚠️ Reset already in progress");
            return;
        }

        if (!confirm("Reset database?")) return;

        this.isResetting = true;

        const dbRef = ref(database, '/transplanter');

        const resetPayload = {
            bed: "OFF_BED",
            direction: "STOP",
            speed: 0,
            distance: 0,
            plant_distance: 300,
            trigger: "NO",
            saplings_planted: 0,
            saplings_missed: 0,
            count: 0,
            plantation_grid: []
        };

        set(dbRef, resetPayload)
        .then(() => {
            console.log("✅ Database reset");

            // Keep local state consistent immediately, even before onValue callback arrives.
            this.data = { ...this.data, ...resetPayload };
            this.dispatchEvent(new CustomEvent('data_updated', {
                detail: this.data
            }));
        })
        .catch(err => console.error("❌ Reset error:", err))
        .finally(() => {
            this.isResetting = false;
        });
    }

    // 🧪 TEST MODE (NO FIREBASE NEEDED)
    simulateData() {
        console.log("🧪 Running TEST MODE...");

        let grid = [];
        let row = [];

        setInterval(() => {
            const val = Math.random() > 0.3 ? 1 : 0;
            row.push(val);

            if (row.length >= 10) {
                grid.push(row);
                row = [];
            }

            this.data.plantation_grid = [...grid, row];

            this.dispatchEvent(new CustomEvent('data_updated', {
                detail: this.data
            }));

        }, 800);
    }
}

// 🌍 Make global
window.firebaseDb = new RealtimeDatabase();


// 🧪 👉 ENABLE THIS LINE TO TEST WITHOUT FIREBASE
// window.firebaseDb.simulateData();