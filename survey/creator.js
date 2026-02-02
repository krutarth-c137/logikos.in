class CreatorApp {
    constructor() {
        // Default Project Structure
        this.surveyData = {
            project_title: "New Project",
            welcome_page: { 
                title: "Welcome", 
                description: "Enter survey description here...", 
                question: { id: "email", type: "Des_Q", text: "Enter email", required: true } 
            },
            survey_pages: [
                { page_id: "p1", title: "Page 1", questions: [] }
            ],
            thank_you_page: { 
                title: "Thank You", 
                note: "Thank you for participating.", 
                redirect_url: "", 
                buttons: [] 
            }
        };
        
        this.activePageType = "welcome"; 
        this.activePageIndex = 0; 
        
        // Auto-load if file uploaded logic triggers later
        this.init();
    }

    init() {
        this.renderSidebar();
        this.loadPage("welcome", 0);
        
        // Setup File Listener
        document.getElementById('fileInput').addEventListener('change', (e) => this.processFile(e));
    }

    // ==========================================
    // 1. SIDEBAR & NAVIGATION
    // ==========================================

    renderSidebar() {
        const list = document.getElementById('pageList');
        list.innerHTML = '';

        // Welcome
        list.innerHTML += this.createPageCard("Welcome Page", "welcome", 0);

        // Survey Pages
        this.surveyData.survey_pages.forEach((p, index) => {
            const title = p.title || `Page ${index + 1}`;
            list.innerHTML += this.createPageCard(title, "survey", index, true);
        });

        // Thank You
        list.innerHTML += this.createPageCard("Thank You Page", "thank_you", 0);
    }

    createPageCard(title, type, index, isDeletable = false) {
        const isActive = (this.activePageType === type && this.activePageIndex === index) ? 'active' : '';
        const delBtn = isDeletable ? `<span class="btn-del-page" onclick="event.stopPropagation(); app.deletePage(${index})">×</span>` : '';
        
        return `
            <div class="page-card ${isActive}" onclick="app.loadPage('${type}', ${index})">
                <span>${title}</span>
                ${delBtn}
            </div>
        `;
    }

    loadPage(type, index) {
        this.activePageType = type;
        this.activePageIndex = index;
        this.renderSidebar(); 
        
        const canvas = document.getElementById('editorCanvas');
        canvas.innerHTML = '';

        if (type === 'welcome') this.renderWelcomeEditor(canvas);
        else if (type === 'survey') this.renderSurveyPageEditor(canvas, index);
        else if (type === 'thank_you') this.renderThankYouEditor(canvas);
    }

    addPage() {
        const newId = `p${this.surveyData.survey_pages.length + 1}`;
        this.surveyData.survey_pages.push({ page_id: newId, title: "New Page", questions: [] });
        this.renderSidebar();
        this.loadPage('survey', this.surveyData.survey_pages.length - 1);
    }

    deletePage(index) {
        if (!confirm("Delete this page?")) return;
        this.surveyData.survey_pages.splice(index, 1);
        this.renderSidebar();
        this.loadPage('welcome', 0);
    }

    // ==========================================
    // 2. PAGE EDITORS (METADATA)
    // ==========================================

    renderWelcomeEditor(container) {
        const page = this.surveyData.welcome_page;
        container.innerHTML = `
            <div class="editor-section">
                <h2>EDIT: WELCOME PAGE</h2>
                <div class="input-group">
                    <label class="lbl">Page Title</label>
                    <input class="input-text" value="${page.title}" oninput="app.updateWelcome('title', this.value)">
                </div>
                <div class="input-group">
                    <label class="lbl">Description</label>
                    <textarea class="input-text" rows="4" oninput="app.updateWelcome('description', this.value)">${page.description}</textarea>
                </div>
                <div class="input-group">
                    <label class="lbl">Email Question Text</label>
                    <input class="input-text" value="${page.question.text}" oninput="app.updateWelcome('q_text', this.value)">
                </div>
            </div>
        `;
    }

    renderThankYouEditor(container) {
        const page = this.surveyData.thank_you_page;
        container.innerHTML = `
            <div class="editor-section">
                <h2>EDIT: THANK YOU PAGE</h2>
                <div class="input-group">
                    <label class="lbl">Page Title</label>
                    <input class="input-text" value="${page.title}" oninput="app.updateThankYou('title', this.value)">
                </div>
                <div class="input-group">
                    <label class="lbl">Thank You Note</label>
                    <textarea class="input-text" rows="4" oninput="app.updateThankYou('note', this.value)">${page.note}</textarea>
                </div>
                <div class="input-group">
                    <label class="lbl">Redirect URL</label>
                    <input class="input-text" value="${page.redirect_url}" oninput="app.updateThankYou('redirect_url', this.value)">
                </div>
            </div>
        `;
    }

    renderSurveyPageEditor(container, index) {
        const page = this.surveyData.survey_pages[index];
        container.innerHTML = `
            <div class="editor-section">
                <h2>EDIT: SURVEY PAGE (${page.page_id})</h2>
                <div class="input-group">
                    <label class="lbl">Page ID (Must be Unique)</label>
                    <input class="input-text" value="${page.page_id}" oninput="app.updateSurveyPage(${index}, 'page_id', this.value)">
                </div>
                <div class="input-group">
                    <label class="lbl">Page Title</label>
                    <input class="input-text" value="${page.title}" oninput="app.updateSurveyPage(${index}, 'title', this.value)">
                </div>
                
                <div class="q-list" id="qListContainer">
                    <h3>QUESTIONS (${page.questions.length})</h3>
                    ${this.renderQuestionsList(page.questions, index)}
                </div>

                <div class="add-q-area">
                    <select id="newQType" class="type-select">
                        <option value="MCQ_1">MCQ (Single)</option>
                        <option value="MCQ_Multi">MCQ (Multi)</option>
                        <option value="Des_Q">Descriptive</option>
                        <option value="Gate">Gate (Logic)</option>
                    </select>
                    <button class="btn-action" onclick="app.addQuestion(${index})">+ ADD QUESTION</button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 3. QUESTION BUILDER (The Core Logic)
    // ==========================================

    renderQuestionsList(questions, pageIndex) {
        if (questions.length === 0) return `<p style="color:#666;">No questions yet.</p>`;
        
        return questions.map((q, qIndex) => {
            let extraFields = '';
            
            // OPTION PARSING: Convert array ["A", "B"] back to string "(A),(B)"
            const optionsStr = (q.options && Array.isArray(q.options)) 
                ? q.options.map(o => typeof o === 'object' ? `(${o.label})` : `(${o})`).join(',')
                : '';

            // 1. OPTION INPUT (For MCQs & Gates)
            if (q.type !== 'Des_Q') {
                extraFields += `
                    <div class="input-group">
                        <label class="lbl">Option Qty</label>
                        <input type="number" class="input-text" style="width:80px" value="${q.option_qty || 0}" 
                               oninput="app.updateQuestion(${pageIndex}, ${qIndex}, 'option_qty', this.value)">
                    </div>
                    <div class="input-group">
                        <label class="lbl">Option Values (e.g. (OptionA),(OptionB))</label>
                        <input class="input-text" value="${optionsStr}" 
                               oninput="app.updateQuestionOptions(${pageIndex}, ${qIndex}, this.value)">
                    </div>
                `;
            }

            // 2. TOGGLES (MCQ Variants)
            if (q.type === 'MCQ_1') {
                extraFields += `
                    <div class="input-group" style="display:flex; gap:10px;">
                        <label><input type="checkbox" ${q.is_dropdown ? 'checked' : ''} onchange="app.updateQuestion(${pageIndex}, ${qIndex}, 'is_dropdown', this.checked)"> Dropdown Mode</label>
                        <label><input type="checkbox" ${q.has_other ? 'checked' : ''} onchange="app.updateQuestion(${pageIndex}, ${qIndex}, 'has_other', this.checked)"> Include 'Other'</label>
                    </div>
                `;
            } else if (q.type === 'MCQ_Multi') {
                extraFields += `
                    <div class="input-group" style="display:flex; gap:10px;">
                        <label><input type="checkbox" ${q.variant === 'bubble' ? 'checked' : ''} onchange="app.updateQuestion(${pageIndex}, ${qIndex}, 'variant', this.checked ? 'bubble' : 'standard')"> Bubble Mode</label>
                        <label><input type="checkbox" ${q.has_other ? 'checked' : ''} onchange="app.updateQuestion(${pageIndex}, ${qIndex}, 'has_other', this.checked)"> Include 'Other'</label>
                    </div>
                `;
            }

            // 3. GATE LOGIC (Dropdowns for each option)
            if (q.type === 'Gate' && q.options) {
                const pageOptions = this.surveyData.survey_pages.map(p => `<option value="${p.page_id}">${p.title} (${p.page_id})</option>`).join('');
                const thankYouOpt = `<option value="THANK_YOU">Thank You Page</option>`;
                
                const gateLogic = q.options.map((opt, oIndex) => `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center; border-bottom:1px solid #eee;">
                        <span>Option: <b>${opt.label}</b></span>
                        <select onchange="app.updateGateJump(${pageIndex}, ${qIndex}, ${oIndex}, this.value)">
                            <option value="">-- Select Page --</option>
                            ${pageOptions}
                            ${thankYouOpt}
                        </select>
                        <span style="font-size:0.8rem; color:blue;">Current: ${opt.jump_to_page || 'None'}</span>
                    </div>
                `).join('');
                
                extraFields += `<div style="background:#f0f8ff; padding:10px; margin-top:10px; border:1px solid #cce;">
                    <label class="lbl">GATE LOGIC: MAP OPTIONS TO PAGES</label>
                    ${gateLogic}
                </div>`;
            }

            return `
            <div class="q-card">
                <div class="q-header">
                    <span class="badge">${q.type}</span>
                    <button class="btn-del-page" onclick="app.deleteQuestion(${pageIndex}, ${qIndex})">DELETE</button>
                </div>
                <div class="input-group">
                    <label class="lbl">Question ID (Header)</label>
                    <input class="input-text" value="${q.id}" oninput="app.updateQuestion(${pageIndex}, ${qIndex}, 'id', this.value)">
                </div>
                <div class="input-group">
                    <label class="lbl">Question Text</label>
                    <input class="input-text" value="${q.text}" oninput="app.updateQuestion(${pageIndex}, ${qIndex}, 'text', this.value)">
                </div>
                ${extraFields}
            </div>`;
        }).join('');
    }

    // --- ADD / UPDATE / DELETE QUESTIONS ---

    addQuestion(pageIndex) {
        const type = document.getElementById('newQType').value;
        const newQ = {
            id: `Q${Date.now().toString().substr(-4)}`,
            type: type,
            text: "New Question",
            required: true
        };

        if (type !== 'Des_Q') {
            newQ.option_qty = 2;
            newQ.options = (type === 'Gate') 
                ? [{label:"A", jump_to_page:""}, {label:"B", jump_to_page:""}] 
                : ["Option A", "Option B"];
        }
        
        if (type === 'MCQ_1') { newQ.is_dropdown = false; newQ.has_other = false; }
        if (type === 'MCQ_Multi') { newQ.variant = 'standard'; newQ.has_other = false; }

        this.surveyData.survey_pages[pageIndex].questions.push(newQ);
        this.loadPage('survey', pageIndex); // Re-render
    }

    updateQuestion(pageIndex, qIndex, key, val) {
        this.surveyData.survey_pages[pageIndex].questions[qIndex][key] = val;
    }

    // PARSER: Converts "(A),(B)" string into Array ["A", "B"]
    updateQuestionOptions(pageIndex, qIndex, str) {
        const q = this.surveyData.survey_pages[pageIndex].questions[qIndex];
        
        // Regex to extract text between parentheses
        const matches = str.match(/\((.*?)\)/g); 
        const rawValues = matches ? matches.map(s => s.slice(1, -1)) : [];
        
        if (q.type === 'Gate') {
            // Preserve existing logic if possible
            q.options = rawValues.map((label, i) => {
                const existing = (q.options && q.options[i]) ? q.options[i] : {};
                return { label: label, jump_to_page: existing.jump_to_page || "" };
            });
        } else {
            q.options = rawValues;
        }
        // Don't re-render immediately to keep focus
    }

    updateGateJump(pageIndex, qIndex, optIndex, pageId) {
        this.surveyData.survey_pages[pageIndex].questions[qIndex].options[optIndex].jump_to_page = pageId;
    }

    deleteQuestion(pageIndex, qIndex) {
        if (!confirm("Remove this question?")) return;
        this.surveyData.survey_pages[pageIndex].questions.splice(qIndex, 1);
        this.loadPage('survey', pageIndex);
    }

    // --- DATA UPDATERS (METADATA) ---
    updateWelcome(key, val) {
        if (key === 'q_text') this.surveyData.welcome_page.question.text = val;
        else this.surveyData.welcome_page[key] = val;
    }
    updateSurveyPage(index, key, val) {
        this.surveyData.survey_pages[index][key] = val;
        if (key === 'title' || key === 'page_id') this.renderSidebar();
    }
    updateThankYou(key, val) {
        this.surveyData.thank_you_page[key] = val;
    }

    // ==========================================
    // 4. UPLOAD & DOWNLOAD
    // ==========================================

    handleUpload() {
        document.getElementById('fileInput').click();
    }

    processFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Simple validation check
                if (json.welcome_page && json.survey_pages) {
                    this.surveyData = json;
                    this.init(); // Restart app with new data
                    alert("Survey Loaded Successfully!");
                } else {
                    alert("Invalid JSON format");
                }
            } catch (err) {
                alert("Error reading JSON file");
            }
        };
        reader.readAsText(file);
    }

    downloadJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.surveyData, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "survey.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }
}

// INITIALIZE APP
const app = new CreatorApp();
