/* LOGIKOS CALCULATOR ENGINE 
    Handles: 3D Rendering (Three.js), Physics Logic, Cost Estimation, and State Management.
*/

// --- CONFIGURATION ---
const CONFIG = {
    MAX_FILES: 5,
    MAX_SIZE_MB: 1,
    API_ENDPOINT: "https://your-project.cloudfunctions.net/api", // Placeholder
    DENSITIES: { // g/cm3
        "PLA": 1.24, "ABS": 1.04, "PETG": 1.27, "Nylon": 1.15,
        "TPU": 1.21, "Resin": 1.20, "PC": 1.20, "CF": 1.25
    },
    RATES: { // INR per gram (Hardcoded for now - Option C)
        "PLA": 8.0, "ABS": 9.0, "PETG": 8.5, "Nylon": 15.0,
        "TPU": 12.0, "Resin": 18.0, "PC": 16.0, "CF": 20.0,
        "base_fee": 150 // Setup fee per order
    }
};

class CalculatorEngine {
    constructor() {
        this.files = []; // Stores { name, data(blob), mesh, volume, weight, cost }
        this.currentFileIndex = -1;
        this.selectedMaterial = "PLA";
        this.selectedInfill = 20; // %
        this.hasCalculated = false;

        this.initThreeJS();
    }

    // --- 3D VIEWER SETUP ---
    initThreeJS() {
        this.container = document.getElementById('viewer-container');
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(100, 100, 100);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(0, 200, 100);
        this.scene.add(dirLight);

        // Resize Listener
        window.addEventListener('resize', () => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.renderer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        });

        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // --- FILE HANDLING ---
    // --- FILE HANDLING ---
    handleFiles(fileList) {
        if (this.files.length + fileList.length > CONFIG.MAX_FILES) {
            alert(`Max ${CONFIG.MAX_FILES} files allowed.`);
            return;
        }

        Array.from(fileList).forEach(file => {
            if (file.size > CONFIG.MAX_SIZE_MB * 1024 * 1024) {
                alert(`File ${file.name} is too large (Max ${CONFIG.MAX_SIZE_MB}MB)`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.files.push({
                    name: file.name,
                    data: e.target.result,
                    status: 'Pending',
                    volume: 0
                });

                // If first file, render it immediately
                if (this.files.length === 1) this.viewFile(0);
                this.updateQueueUI();

                // NEW: Change Button Text
                document.getElementById('upload-btn-text').innerText = "➕ Add Another File";
            };
            reader.readAsArrayBuffer(file);
        });
    }

    handleLink() {
        const url = document.getElementById('link-input').value;
        if (!url) return;
        // Mocking link fetch for now (since backend logic handles this)
        // In real deployment, this sends URL to Python API, which returns file list.
        alert("Link processing requires live Backend. Please upload STLs for now.");
    }

    // --- RENDERING ---
    viewFile(index) {
        if (index < 0 || index >= this.files.length) return;
        this.currentFileIndex = index;

        // Cleanup old mesh
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this.currentMesh.geometry.dispose();
            this.currentMesh.material.dispose();
        }

        const file = this.files[index];
        const loader = new THREE.STLLoader();
        const geometry = loader.parse(file.data);

        // Center Geometry
        geometry.computeBoundingBox();
        geometry.center();

        // Calculate Volume (Client-side fallback)
        // Note: trimesh in python is more accurate, but ThreeJS works for estimation
        if (file.volume === 0) {
            file.volume = this.getVolume(geometry); // cm3
        }

        // Material
        const material = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            specular: 0x111111,
            shininess: 200
        });

        this.currentMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.currentMesh);

        // Adjust Camera to fit object
        const boundingBox = geometry.boundingBox;
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        this.camera.position.z = maxDim * 2.5;

        // Update UI Counters
        document.getElementById('view-counter').innerText = `${index + 1} / ${this.files.length}`;
        this.updateQueueUI();
    }

    getVolume(geometry) {
        // Signed volume of triangle mesh
        let position = geometry.attributes.position;
        let faces = position.count / 3;
        let sum = 0;
        let p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();

        for (let i = 0; i < faces; i++) {
            p1.fromBufferAttribute(position, i * 3 + 0);
            p2.fromBufferAttribute(position, i * 3 + 1);
            p3.fromBufferAttribute(position, i * 3 + 2);
            sum += p1.dot(p2.cross(p3));
        }
        return Math.abs(sum / 6) / 1000; // Convert mm3 to cm3
    }

    // --- CONTROLS ---
    nextFile() {
        if (this.files.length === 0) return;
        let next = this.currentFileIndex + 1;
        if (next >= this.files.length) next = 0;
        this.viewFile(next);
    }

    prevFile() {
        if (this.files.length === 0) return;
        let prev = this.currentFileIndex - 1;
        if (prev < 0) prev = this.files.length - 1;
        this.viewFile(prev);
    }

    rotateModel(axis) {
        if (!this.currentMesh) return;
        this.currentMesh.rotation[axis] += Math.PI / 2; // 90 deg
    }

    resetView() {
        if (!this.currentMesh) return;
        this.currentMesh.rotation.set(0, 0, 0);
        this.controls.reset();
    }

    // --- STATE SETTERS ---
    setMaterial(mat, btn) {
        this.selectedMaterial = mat;
        document.querySelectorAll('.mat-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.hasCalculated) this.reCalculateCosts();
    }

    setInfill(val, btn) {
        this.selectedInfill = val;
        document.querySelectorAll('.inf-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.hasCalculated) this.reCalculateCosts();
    }

    // --- UI UPDATES ---
    updateQueueUI() {
        const queueDiv = document.getElementById('file-queue');
        queueDiv.innerHTML = "";

        let grandTotal = 0;

        this.files.forEach((f, i) => {
            const isActive = i === this.currentFileIndex ? 'active-view' : '';
            let details = "";

            if (this.hasCalculated) {
                details = `
                    <div class="queue-meta">
                        <span><strong>Vol:</strong> ${f.volume.toFixed(1)} cm³</span>
                        <span><strong>Wt:</strong> ${f.weight}g</span>
                        <span style="color:#1a1a1a; font-weight:bold;">₹${f.cost}</span>
                    </div>
                `;
                grandTotal += parseFloat(f.cost);
            } else {
                details = `<div class="queue-meta"><span>Ready to calc</span></div>`;
            }

            queueDiv.innerHTML += `
                <div class="queue-item ${isActive}" onclick="engine.viewFile(${i})">
                    <div style="flex-grow:1;">
                        <strong>${i + 1}. ${f.name}</strong>
                        ${details}
                    </div>
                    ${isActive ? '<span style="font-size:1.2rem;">👁️</span>' : ''}
                </div>
            `;
        });

        if (this.hasCalculated) {
            document.getElementById('totals-display').style.display = 'flex';
            document.getElementById('grand-total').innerText = `₹ ${Math.ceil(grandTotal + CONFIG.RATES.base_fee)}`;
        }
    }

    // --- CALCULATION LOGIC ---
    triggerAction() {
        if (this.files.length === 0) return alert("Please upload files first.");

        if (this.hasCalculated) {
            // Already calculated -> Proceed to Order (or Reset)
            alert("Proceeding to checkout with total: " + document.getElementById('grand-total').innerText);
            // Here you would redirect or show success-view
        } else {
            // Check User Data
            if (sessionStorage.getItem('userEmail')) {
                this.performCalculation();
            } else {
                document.getElementById('modal').style.display = 'block';
            }
        }
    }

    submitUserData() {
        const email = document.getElementById('u-email').value;
        const city = document.getElementById('u-city').value;
        const phone = document.getElementById('u-phone').value;

        if (!email.includes('@')) return alert("Valid Email Required");

        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('userCity', city);
        sessionStorage.setItem('userPhone', phone);

        document.getElementById('modal').style.display = 'none';
        this.performCalculation();
    }

    performCalculation() {
        // Here we simulate the Python API call locally for now
        this.hasCalculated = true;
        this.reCalculateCosts();
        document.getElementById('action-btn').innerText = "CHECKOUT";
    }

    reCalculateCosts() {
        const density = CONFIG.DENSITIES[this.selectedMaterial] || 1.24;
        const rate = CONFIG.RATES[this.selectedMaterial] || 8.0;

        // Infill Factor: 100% infill = 1.0 multiplier, 20% != 0.2 (shells count), approximate:
        // formula: base_vol * (0.3 + (infill/100 * 0.7)) -> Simple approximation
        const infillFactor = 0.3 + (this.selectedInfill / 100 * 0.7);

        this.files.forEach(f => {
            // Volume was calculated on load
            const finalVol = f.volume * infillFactor;
            f.weight = (finalVol * density).toFixed(1);
            f.cost = (f.weight * rate).toFixed(2);
        });

        this.updateQueueUI();
    }
}

// Initialize Engine globally so HTML can access it
const engine = new CalculatorEngine();
