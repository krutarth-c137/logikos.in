/* LOGIKOS CALCULATOR ENGINE 
   Handles: 3D Rendering (Three.js), Gatekeeper Logic, Cloud Slicing, and Cost Estimation.
*/

// --- CONFIGURATION ---
const CONFIG = {
    MAX_FILES: 5,
    MAX_SIZE_MB: 5, // Increased to 5MB as discussed
    DENSITIES: { // g/cm3
        "PLA": 1.24, "ABS": 1.04, "PETG": 1.27, "Nylon": 1.15,
        "TPU": 1.21, "Resin": 1.20, "PC": 1.20, "CF": 1.25
    },
    RATES: { // INR per gram
        "PLA": 8.0, "ABS": 9.0, "PETG": 8.5, "Nylon": 15.0,
        "TPU": 12.0, "Resin": 18.0, "PC": 16.0, "CF": 20.0,
        "base_fee": 0 // Setup fee per order
    }
};

// --- CLOUD ENDPOINTS (PASTE YOUR URLs HERE) ---
const CLOUD_CONFIG = {
    // 1. The Google Sheet Web App URL (Gatekeeper)
    GATEKEEPER_URL: 'https://script.google.com/macros/s/AKfycbzgtd4pTgIHMp-AJz4AGCRGFMAIRye0NSnMbHULib8ULNXmTrbSChNK2O4MYd0RZxCf/exec', 
    
    // 2. The Python Cloud Function URL (Slicer)
    SLICER_URL: 'https://asia-south1-logikos-website-d56b0.cloudfunctions.net/slicer_api'
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

    // --- 3D VIEWER SETUP (Unchanged) ---
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

            // DUPLICATE CHECK
            if (this.files.some(f => f.name === file.name)) {
                alert(`File "${file.name}" is already added.`);
                return; // Skip this file
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.files.push({
                    fileObject: file,
                    name: file.name,
                    data: e.target.result,
                    status: 'Pending',
                    volume: 0, 
                    isPrecise: false
                });

                if (this.files.length === 1) this.viewFile(0);
                this.updateQueueUI();
                document.getElementById('upload-btn-text').innerText = "➕ Add Another File";
            };
            reader.readAsArrayBuffer(file);
        });
    }

    async handleLink() {
        const urlInput = document.getElementById('link-input');
        const url = urlInput.value.trim();
        if (!url) return alert("Please paste a Thingiverse link.");

        // UI Feedback
        const btn = document.querySelector('#tab-link button');
        const originalText = btn.innerText;
        btn.innerText = "⏳ Fetching...";
        btn.disabled = true;

        try {
            // 1. Call Python Cloud Slicer
            const response = await fetch(CLOUD_CONFIG.SLICER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ mode: 'link', input_data: url })
            });

            if (!response.ok) throw new Error("Could not fetch link data");

            const data = await response.json();
            
            if (data.files.length === 0) {
                alert("No STL files found in this link.");
                return;
            }

            // 2. Add files to the list
            data.files.forEach(f => {
                // Check duplicate
                if (this.files.some(existing => existing.name === f.filename)) return;

                this.files.push({
                    fileObject: null, // No raw file for links
                    name: f.filename,
                    data: null,       // No 3D Data (Visualizer skipped)
                    status: 'Cloud',
                    volume: f.metrics.volume_cm3,
                    isPrecise: true
                });
            });

            this.updateQueueUI();
            
            // 3. Auto-Calculate Price (Since we already have the volume)
            this.hasCalculated = true;
            this.reCalculateCosts(); 

            // 4. Log to Google Sheet (Links Tab)
            // We use the ID returned by Python (project_id)
            const userId = this.currentUserID || "GUEST";
            fetch(CLOUD_CONFIG.GATEKEEPER_URL, {
                 method: 'POST',
                 headers: { "Content-Type": "text/plain;charset=utf-8" },
                 body: JSON.stringify({ 
                     action: 'log_link', 
                     user_id: userId, 
                     link: url,
                     db_id: data.project_id || "N/A"
                 })
            });

            urlInput.value = ""; // Clear input

        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
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
           this.currentMesh = null;
        }

        const file = this.files[index];
       // --- SAFETY CHECK FOR LINK FILES ---
        if (!file.data) {
            // This is a cloud link file, we cannot view it in 3D
            document.getElementById('view-counter').innerText = `${index + 1} / ${this.files.length} (No Preview)`;
            this.updateQueueUI();
            return; 
        }
        // -----------------------------------
        const loader = new THREE.STLLoader();
        const geometry = loader.parse(file.data);

        // Center Geometry
        geometry.computeBoundingBox();
        geometry.center();

        // Calculate Volume (Client-side fallback)
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
        this.currentMesh.rotation[axis] += Math.PI / 2;
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

        if (this.files.length === 0) {
             queueDiv.innerHTML = '<p style="text-align:center; color:#ccc; margin-top:20px;">No files added.</p>';
             document.getElementById('totals-display').style.display = 'none';
             document.getElementById('upload-btn-text').innerText = "📂 Select Files";
             // Clear viewer if empty
             if(this.currentMesh) {
                 this.scene.remove(this.currentMesh);
                 this.currentMesh = null;
             }
             return;
        }

        let grandTotal = 0;

        this.files.forEach((f, i) => {
            const isActive = i === this.currentFileIndex ? 'active-view' : '';
            let details = "";
            let statusIcon = f.isPrecise ? "✅" : "⚠️"; 

            if (this.hasCalculated) {
                details = `
                    <div class="queue-meta">
                        <span><strong>Vol:</strong> ${f.volume.toFixed(1)} cm³ ${statusIcon}</span>
                        <span><strong>Wt:</strong> ${f.weight}g</span>
                        <span style="color:#1a1a1a; font-weight:bold;">₹${f.cost}</span>
                    </div>
                `;
                grandTotal += parseFloat(f.cost);
            } else {
                details = `<div class="queue-meta"><span>Ready to calc</span></div>`;
            }

            // SVG Icons for Eye (View) and Trash (Delete)
            const eyeIcon = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
            const trashIcon = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

            queueDiv.innerHTML += `
                <div class="queue-item ${isActive}" onclick="engine.viewFile(${i})">
                    <div style="flex-grow:1;">
                        <strong>${i + 1}. ${f.name}</strong>
                        ${details}
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="icon-btn" title="View" onclick="engine.viewFile(${i}); event.stopPropagation();">
                            ${eyeIcon}
                        </button>
                        <button class="icon-btn" title="Remove" onclick="engine.deleteFile(${i}); event.stopPropagation();">
                            ${trashIcon}
                        </button>
                    </div>
                </div>
            `;
        });

        if (this.hasCalculated) {
            document.getElementById('totals-display').style.display = 'flex';
            document.getElementById('grand-total').innerText = `₹ ${Math.ceil(grandTotal + CONFIG.RATES.base_fee)}`;
        }
    }
   
   deleteFile(index) {
        if (index < 0 || index >= this.files.length) return;
        
        // Remove file
        this.files.splice(index, 1);
        
        // Reset view if we deleted the currently viewed file
        if (this.files.length === 0) {
            this.currentFileIndex = -1;
            // Clear totals if list is empty
            this.hasCalculated = false;
        } else if (index === this.currentFileIndex) {
            this.viewFile(0); // Jump to first file
        } else if (index < this.currentFileIndex) {
            this.currentFileIndex--; // Shift index down
        }

        // If we have calculated results, we should probably update the total cost immediately
        if (this.hasCalculated) {
            this.reCalculateCosts();
        } else {
            this.updateQueueUI();
        }
    }

    // --- GATEKEEPER & CLOUD LOGIC ---

    triggerAction() {
        if (this.files.length === 0) return alert("Please upload files first.");

        if (this.hasCalculated) {
            alert("Proceeding to checkout with total: " + document.getElementById('grand-total').innerText);
        } else {
            // Check Identity
            const savedEmail = sessionStorage.getItem('userEmail');
            if (savedEmail) {
                this.startQuoteProcess(savedEmail);
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
        
        // Start the Gatekeeper Process
        this.startQuoteProcess(email);
    }

    async startQuoteProcess(email) {
        const statusMsg = document.getElementById('status-msg');
        if(statusMsg) {
            statusMsg.innerText = "⏳ Verifying Quota...";
            statusMsg.style.color = "blue";
        }

        // Retrieve User Data
        const city = sessionStorage.getItem('userCity') || "N/A";
        const phone = sessionStorage.getItem('userPhone') || "N/A";

        try {
            // 1. CHECK QUOTA & REGISTER USER
            // We use 'text/plain' to bypass Google CORS restrictions
            const response = await fetch(CLOUD_CONFIG.GATEKEEPER_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ 
                    action: "check_quota", 
                    email: email, 
                    city: city, 
                    phone: phone 
                })
            });

            const data = await response.json();

            if (data.status === "allowed" || data.status === "existing" || data.status === "new") {
                
                // PRE-FLIGHT LIMIT CHECK
                // If adding these files exceeds the limit (and user is not a Member)
                const projectedCount = data.current_count + this.files.length;
                if (data.user_type !== "Member" && projectedCount > 10) {
                     alert(`❌ Upload limit reached. You have used ${data.current_count}/10 calculations. adding ${this.files.length} more would exceed the limit.`);
                     if(statusMsg) statusMsg.innerText = "❌ Limit Reached";
                     return;
                }

                if(statusMsg) {
                    statusMsg.innerText = "✅ Authorized! Uploading to Slicer...";
                    statusMsg.style.color = "green";
                }
                
                // 2. PROCEED TO PYTHON UPLOAD
                // We pass the User ID so we can increment the count later
                this.uploadFilesToSlicer(email, data.user_id);

            } else {
                alert(`❌ ${data.message}`);
                if(statusMsg) statusMsg.innerText = "❌ Limit Reached";
            }
        } catch (error) {
            console.error("Gatekeeper Error:", error);
            alert("Connection failed. Using Offline Estimation mode.");
            this.performLocalCalculation(); 
        }
    }

    async uploadFilesToSlicer(email, userId) {
        const formData = new FormData();
        
        // Append raw file objects
        this.files.forEach(f => {
            formData.append('files', f.fileObject);
        });
        formData.append('email', email);

        try {
            const response = await fetch(CLOUD_CONFIG.SLICER_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Analysis Failed");

            const data = await response.json();
            console.log("Slicer Data:", data);

            // 1. UPDATE VOLUMES WITH PRECISE DATA
            data.files.forEach(serverFile => {
                const localFile = this.files.find(f => f.name === serverFile.filename);
                if (localFile) {
                    localFile.volume = serverFile.metrics.volume_cm3;
                    localFile.isPrecise = true;
                }
            });

            // 2. INCREMENT USAGE COUNT (Since upload was successful)
            // Fire and forget - we don't need to wait for this to finish
            if (userId) {
                fetch(CLOUD_CONFIG.GATEKEEPER_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ 
                        action: "increment_usage", 
                        user_id: userId,
                        file_count: this.files.length 
                    })
                });
            }

            // 3. TRIGGER FINAL PRICING
            this.performLocalCalculation(); 
            
            const statusMsg = document.getElementById('status-msg');
            if(statusMsg) statusMsg.innerText = "✅ Analysis Complete!";

        } catch (error) {
            console.error("Upload Error:", error);
            alert("Cloud Slicer failed. Using local estimation.");
            this.performLocalCalculation();
        }
    }

    performLocalCalculation() {
        this.hasCalculated = true;
        this.reCalculateCosts();
        document.getElementById('action-btn').innerText = "CHECKOUT";
    }

    reCalculateCosts() {
        const density = CONFIG.DENSITIES[this.selectedMaterial] || 1.24;
        const rate = CONFIG.RATES[this.selectedMaterial] || 8.0;

        // Infill Factor logic
        const infillFactor = 0.3 + (this.selectedInfill / 100 * 0.7);

        this.files.forEach(f => {
            // Volume is now either ThreeJS (estimate) or Python (precise)
            const finalVol = f.volume * infillFactor;
            f.weight = (finalVol * density).toFixed(1);
            f.cost = (f.weight * rate).toFixed(2);
        });

        this.updateQueueUI();
    }
}

// Initialize Engine globally
const engine = new CalculatorEngine();
