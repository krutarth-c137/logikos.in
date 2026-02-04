class CreatorApp {
    constructor() {
        this.surveyData = {
            project_title: "New Project",
            page_welcome: { title: "Welcome", description: "Description...", consent: "I agree", next_page_btn: "Start" },
            pages_survey: [
                { page_id: "p1", page_title: "Page 1", page_desc: "", questions: [] }
            ],
            page_thankyou: { title: "Thank You", end_note: "Thanks.", redirect_url: "" }
        };

        this.activePageType = "welcome";
        this.activePageIndex = 0;
        this.viewMode = "Creator";

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            const newHeader = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newHeader, fileInput);
            newHeader.addEventListener('change', (e) => this.processFile(e));
        }

        this.setupDelegation();
        this.init();
    }

    init() {
        this.renderSidebar();
        this.loadPage('welcome', 0);
    }

    // ==========================================
    // 0. EVENT DELEGATION
    // ==========================================
    setupDelegation() {
        const canvas = document.getElementById('editorCanvas');

        canvas.addEventListener('input', (e) => {
            const target = e.target;
            const context = target.dataset.context;
            const id = target.dataset.id;
            const key = target.dataset.key;
            const val = target.value;

            if (!context) return;

            if (context === 'welcome') this.surveyData.page_welcome[key] = val;
            else if (context === 'thankyou') this.surveyData.page_thankyou[key] = val;
            else if (context === 'page') this.surveyData.pages_survey[this.activePageIndex][key] = val;
            else if (context === 'question') {
                const q = this.findQ(id);
                if (q) {
                    if (key === 'points_on_scale') q[key] = parseInt(val);
                    else q[key] = val;
                }
            }
            else if (context === 'option') {
                const q = this.findQ(id);
                const idx = parseInt(target.dataset.index);
                if (q && q.options) q.options[idx] = val;
            }
            else if (context === 'rating_label') {
                const q = this.findQ(id);
                const idx = parseInt(target.dataset.index);
                if (q) { if (!q.custom_labels) q.custom_labels = []; q.custom_labels[idx] = val; }
            }

            if (context === 'page' && key === 'page_title') this.renderSidebar();
        });

        // HANDLE CHANGE (Checkboxes/Toggles)
        canvas.addEventListener('change', (e) => {
            const target = e.target;
            const context = target.dataset.context;
            const id = target.dataset.id;
            const key = target.dataset.key;

            if (!context || target.type === 'text' || target.tagName === 'TEXTAREA') return;

            let val;
            if (key === 'variant') {
                val = target.checked ? 'bubble' : 'standard';
            } else {
                val = target.type === 'checkbox' ? target.checked : target.value;
            }

            if (context === 'question') {
                const q = this.findQ(id);
                if (q) {
                    if (key === 'option_qty') this.updateOptionQty(q, val);
                    else {
                        q[key] = val;
                        // Structural changes need re-render
                        if (['type', 'required', 'dropdown', 'variant', 'gate_type', 'rating_type', 'points_on_scale', 'other_input'].includes(key)) {
                            this.renderPageQuestions(this.activePageIndex);
                        }
                    }
                }
            }
            else if (context === 'gate_action') {
                const opt = target.dataset.opt;
                const type = target.dataset.actiontype;
                this.setGateAction(id, opt, type, val);
            }
        });
    }

    // ==========================================
    // 1. NAVIGATION
    // ==========================================

    renderSidebar() {
        const list = document.getElementById('pageList');
        list.innerHTML = '';
        list.innerHTML += this.createPageCard("Welcome Page", "welcome", 0);

        this.surveyData.pages_survey.forEach((p, index) => {
            const displayTitle = (p.page_title && p.page_title.trim() !== "") ? p.page_title : `Page ${index + 1}`;
            // Display ID in sidebar for clarity
            const label = `<b>${p.page_id.toUpperCase()}</b>: ${displayTitle}`;
            list.innerHTML += this.createPageCard(label, "survey", index, true);
        });

        list.innerHTML += `<div class="add-page-btn" onclick="app.addPage()"><span>+ Add Page</span></div>`;
        list.innerHTML += this.createPageCard("Thank You Page", "thankyou", 0);
    }

    createPageCard(title, type, index, isDeletable = false) {
        const isActive = (this.activePageType === type && this.activePageIndex === index) ? 'active' : '';
        const delBtn = isDeletable ? `<span class="btn-del-page" onclick="event.stopPropagation(); app.deletePage(${index})">×</span>` : '';
        return `<div class="page-card ${isActive}" onclick="app.loadPage('${type}', ${index})"><span>${title}</span>${delBtn}</div>`;
    }

    loadPage(type, index) {
        this.activePageType = type;
        this.activePageIndex = index;
        this.renderSidebar();
        const canvas = document.getElementById('editorCanvas');
        canvas.innerHTML = '';
        if (type === 'welcome') this.renderWelcomeEditor(canvas);
        else if (type === 'survey') this.renderSurveyPageEditor(canvas, index);
        else if (type === 'thankyou') this.renderThankYouEditor(canvas);
    }

    // FIX: SEQUENTIAL PAGE IDs
    getNextPageID() {
        let max = 0;
        this.surveyData.pages_survey.forEach(p => {
            // Match p1, p2, p10...
            const match = p.page_id.match(/^p(\d+)$/i);
            if (match) {
                const num = parseInt(match[1]);
                if (num > max) max = num;
            }
        });
        return `p${max + 1}`;
    }

    addPage() {
        const newId = this.getNextPageID();
        const title = `Page ${newId.replace('p', '')}`;
        this.surveyData.pages_survey.push({ page_id: newId, page_title: title, page_desc: "", questions: [] });
        this.renderSidebar();
        this.loadPage('survey', this.surveyData.pages_survey.length - 1);
    }

    deletePage(index) {
        if (!confirm("Delete this page?")) return;
        this.surveyData.pages_survey.splice(index, 1);
        this.renderSidebar();
        this.loadPage('welcome', 0);
    }

    // ==========================================
    // 2. PAGE EDITORS
    // ==========================================

    getToggleHTML() {
        return `
            <div class="toggle-wrapper">
                <span>Creator</span>
                <label class="switch">
                    <input type="checkbox" ${this.viewMode === 'Filler' ? 'checked' : ''} onchange="app.toggleViewMode(this.checked)">
                    <span class="slider round"></span>
                </label>
                <span>Filler</span>
            </div>`;
    }

    renderWelcomeEditor(container) {
        if (this.viewMode === 'Filler') { this.launchFiller(container); return; }
        const page = this.surveyData.page_welcome;
        container.innerHTML = `
            <div class="editor-section">
                <div style="display:flex; justify-content:space-between;"><h2>WELCOME PAGE</h2>${this.getToggleHTML()}</div>
                <div class="input-group"><label class="lbl">Title</label><input class="input-text" data-context="welcome" data-key="title" value="${page.title}"></div>
                <div class="input-group"><label class="lbl">Description</label><textarea class="input-text" data-context="welcome" data-key="description">${page.description}</textarea></div>
                <div class="input-group"><label class="lbl">Consent Text</label><input class="input-text" data-context="welcome" data-key="consent" value="${page.consent}"></div>
                <div class="input-group"><label class="lbl">Button Label</label><input class="input-text" data-context="welcome" data-key="next_page_btn" value="${page.next_page_btn}"></div>
            </div>`;
    }

    renderThankYouEditor(container) {
        if (this.viewMode === 'Filler') { this.launchFiller(container); return; }
        const page = this.surveyData.page_thankyou;
        container.innerHTML = `
            <div class="editor-section">
                <div style="display:flex; justify-content:space-between;"><h2>THANK YOU PAGE</h2>${this.getToggleHTML()}</div>
                <div class="input-group"><label class="lbl">Title</label><input class="input-text" data-context="thankyou" data-key="title" value="${page.title}"></div>
                <div class="input-group"><label class="lbl">End Note</label><textarea class="input-text" data-context="thankyou" data-key="end_note">${page.end_note}</textarea></div>
                <div class="input-group"><label class="lbl">Redirect URL</label><input class="input-text" data-context="thankyou" data-key="redirect_url" value="${page.redirect_url}"></div>
            </div>`;
    }

    renderSurveyPageEditor(container, index) {
        const page = this.surveyData.pages_survey[index];
        if (this.viewMode === 'Filler') { this.launchFiller(container, index); return; }

        let pickOptions = `<option value="">-- Copy Question From... --</option>`;
        this.surveyData.pages_survey.forEach((p, pIdx) => {
            if (pIdx === index) return;
            if (p.questions.length > 0) {
                pickOptions += `<optgroup label="${p.page_title || 'Page ' + (pIdx + 1)}">`;
                p.questions.forEach(q => { pickOptions += `<option value="${q.question_id}">[${q.question_id}] ${(q.question_text || '').substring(0, 30)}...</option>`; });
                pickOptions += `</optgroup>`;
            }
        });

        container.innerHTML = `
            <div class="editor-section">
                <div style="display:flex; justify-content:space-between;"><h2>SURVEY PAGE (${page.page_id.toUpperCase()})</h2>${this.getToggleHTML()}</div>
                <div class="input-group">
                    <label class="lbl">Page Title</label>
                    <input class="input-text" data-context="page" data-key="page_title" value="${page.page_title}"> 
                </div>
                <div class="input-group">
                    <label class="lbl">Description</label>
                    <textarea class="input-text" data-context="page" data-key="page_desc">${page.page_desc}</textarea>
                </div>
                <hr style="border:0; border-top:1px solid #ccc; margin:20px 0;">
                
                <div id="questionsContainer" class="q-list"></div>
                
                <div class="add-q-area">
                    <div class="action-row">
                        <select id="newQType" class="type-select">
                            <option value="MCQ_1">MCQ (Single)</option>
                            <option value="MCQ_Multi">MCQ (Multi)</option>
                            <option value="MCQ_Rank">MCQ (Rank)</option>
                            <option value="Des_Q">Descriptive</option>
                            <option value="Gate_Q">Gate (Logic)</option>
                            <option value="Rating">Rating Scale</option>
                        </select>
                        <button class="btn-action" onclick="app.addNewQuestion(${index})">+ CREATE NEW</button>
                    </div>
                    <div class="action-row">
                        <select id="pickQSelect" class="type-select">${pickOptions}</select>
                        <button class="btn-secondary" onclick="app.copyQuestionToPage(${index})">COPY EXISTING</button>
                    </div>
                </div>
            </div>`;
        this.renderPageQuestions(index);
    }

    launchFiller(container, pageIndex = 0) {
        container.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:20px;"><h2>PREVIEW MODE</h2>${this.getToggleHTML()}</div><div id="enginePreviewContainer"></div>`;
        window.engine = new SurveyEngine(this.surveyData, 'enginePreviewContainer');
        window.engine.state = (this.activePageType === 'survey') ? "SURVEY" : this.activePageType.toUpperCase();
        if (this.activePageType === 'survey') window.engine.currPageIndex = pageIndex;
        window.engine.render();
    }

    toggleViewMode(isFiller) {
        this.viewMode = isFiller ? 'Filler' : 'Creator';
        this.loadPage(this.activePageType, this.activePageIndex);
    }

    // ==========================================
    // 3. QUESTION RENDERING
    // ==========================================

    renderPageQuestions(pageIndex) {
        const container = document.getElementById('questionsContainer');
        const page = this.surveyData.pages_survey[pageIndex];
        container.innerHTML = '';

        if (page.questions.length === 0) {
            container.innerHTML = `<p style="color:#888; text-align:center;">No questions yet.</p>`;
            return;
        }

        page.questions.forEach((qData, qIndex) => {
            const qID = qData.question_id;
            const wrapper = document.createElement('div');
            wrapper.className = 'q-card';

            const header = `
                <div class="q-header">
                    <span class="badge">${qData.type} | ID: ${qID}</span>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-small" onclick="app.moveQuestion(${pageIndex}, ${qIndex}, -1)">↑</button>
                        <button class="btn-small" onclick="app.moveQuestion(${pageIndex}, ${qIndex}, 1)">↓</button>
                        <button class="btn-del-q" onclick="app.removeQuestionFromPage(${pageIndex}, ${qIndex})">REMOVE</button>
                    </div>
                </div>`;

            const content = this.renderQuestionCreator(qID, qData);
            wrapper.innerHTML = header + content;
            container.appendChild(wrapper);
        });
    }

    findQ(id) {
        for (let p of this.surveyData.pages_survey) {
            const found = p.questions.find(q => q.question_id === id);
            if (found) return found;
        }
        return null;
    }

    renderToggle(label, isChecked, dataset) {
        return `
            <div style="display:flex; align-items:center; margin-right:15px;">
                <span class="toggle-label">${label}</span>
                <label class="switch switch-sm">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} ${dataset}>
                    <span class="slider round"></span>
                </label>
            </div>
        `;
    }

    renderQuestionCreator(qID, q) {
        let html = `
            <div class="input-group">
                <label class="lbl">Question Text</label>
                <input class="input-text" data-context="question" data-id="${qID}" data-key="question_text" value="${q.question_text}">
            </div>
            <div class="input-group">
                <label class="lbl">Description</label>
                <textarea class="input-text" data-context="question" data-id="${qID}" data-key="question_desc">${q.question_desc || ''}</textarea>
            </div>
            <div style="margin-bottom:15px;">
                ${this.renderToggle("Required", q.required, `data-context="question" data-id="${qID}" data-key="required"`)}
            </div>
        `;

        if (['MCQ_1', 'MCQ_Multi', 'MCQ_Rank', 'Gate_Q'].includes(q.type)) {
            html += this.renderOptionsBuilder(qID, q);
        }

        if (q.type === 'MCQ_1') {
            html += `<div style="display:flex; margin-top:10px;">
                ${this.renderToggle("Dropdown Mode", q.dropdown, `data-context="question" data-id="${qID}" data-key="dropdown"`)}
                ${this.renderToggle("'Other' Option", q.other_input, `data-context="question" data-id="${qID}" data-key="other_input"`)}
            </div>`;
        }
        if (q.type === 'MCQ_Multi') {
            html += `<div style="display:flex; margin-top:10px;">
                ${this.renderToggle("Bubble Variant", q.variant === 'bubble', `data-context="question" data-id="${qID}" data-key="variant"`)}
                ${this.renderToggle("'Other' Option", q.other_input, `data-context="question" data-id="${qID}" data-key="other_input"`)}
            </div>`;
        }

        if (q.type === 'Des_Q') {
            html += `<div class="input-group"><label class="lbl">Placeholder</label><input class="input-text" data-context="question" data-id="${qID}" data-key="placeholder" value="${q.placeholder || ''}"></div>`;
        }

        if (q.type === 'Rating') html += this.renderRatingBuilder(qID, q);
        if (q.type === 'Gate_Q') html += this.renderGateLogic(qID, q);

        return html;
    }

    renderOptionsBuilder(qID, q) {
        const boxes = (q.options || []).map((opt, i) => `
            <div style="margin-bottom:5px;">
                <input class="input-text" data-context="option" data-id="${qID}" data-index="${i}" value="${opt}" placeholder="Option ${i + 1}">
            </div>`).join('');

        return `
            <div class="input-group" style="background:#fafafa; padding:12px; border:1px solid #ddd;">
                <label class="lbl">Option Quantity</label>
                <input type="number" class="input-text" style="width:80px; margin-bottom:10px;" 
                       data-context="question" data-id="${qID}" data-key="option_qty" value="${q.option_qty || 0}">
                <label class="lbl">Option Values</label>
                ${boxes}
            </div>`;
    }

    updateOptionQty(q, val) {
        const qty = parseInt(val);
        if (isNaN(qty) || qty < 0) return;
        q.option_qty = qty;
        if (!q.options) q.options = [];
        while (q.options.length < qty) q.options.push(`Option ${q.options.length + 1}`);
        while (q.options.length > qty) q.options.pop();
        this.renderPageQuestions(this.activePageIndex);
    }

    renderRatingBuilder(qID, q) {
        const isText = q.rating_type === 'TEXT';
        let labelInputs = '';
        if (isText) {
            const labels = q.custom_labels || [];
            while (labels.length < q.points_on_scale) labels.push(`Label ${labels.length + 1}`);
            while (labels.length > q.points_on_scale) labels.pop();
            labelInputs = `<div style="margin-top:10px; padding:10px; background:#fff; border:1px solid #eee;"><label class="lbl">Custom Labels</label>${labels.map((lbl, i) => `<input class="input-text" style="margin-bottom:5px;" data-context="rating_label" data-id="${qID}" data-index="${i}" value="${lbl}" placeholder="Label ${i + 1}">`).join('')}</div>`;
        }
        return `
            <div class="input-group" style="background:#eef; padding:12px; border:1px solid #cce;">
                <label class="lbl">Rating Configuration</label>
                <div style="display:flex; gap:20px; align-items:center;">
                    <span>Points (Max 10):</span>
                    <input type="number" class="input-text" style="width:60px" data-context="question" data-id="${qID}" data-key="points_on_scale" value="${q.points_on_scale || 5}" max="10" min="2">
                    <label><input type="radio" name="r_type_${qID}" ${!isText ? 'checked' : ''} data-context="question" data-id="${qID}" data-key="rating_type" value="NUMERIC"> Numeric</label>
                    <label><input type="radio" name="r_type_${qID}" ${isText ? 'checked' : ''} data-context="question" data-id="${qID}" data-key="rating_type" value="TEXT"> Custom Labels</label>
                </div>${labelInputs}
            </div>`;
    }

    renderGateLogic(qID, q) {
        const isJump = q.gate_type === 'JUMP';
        const logicRows = (q.options || []).map((opt, i) => {
            const currentAction = (q.actions && q.actions[opt]) ? q.actions[opt] : null;
            let actionUI = '';

            if (isJump) {
                actionUI = `<select class="input-text" data-context="gate_action" data-id="${qID}" data-opt="${opt}" data-actiontype="JUMP">
                    <option value="">-- Select Page --</option>
                    <option value="THANK_YOU" ${currentAction && currentAction.target === 'THANK_YOU' ? 'selected' : ''}>End Survey</option>
                    ${this.surveyData.pages_survey.map(p => `<option value="${p.page_id}" ${currentAction && currentAction.target === p.page_id ? 'selected' : ''}>${p.page_title}</option>`).join('')}
                </select>`;
            } else {
                const allQs = [];
                this.surveyData.pages_survey.forEach(p => { p.questions.forEach(qx => { if (qx.question_id !== qID) allQs.push(qx); }); });

                actionUI = `<div style="display:flex; gap:5px; align-items:center;">
                    <button class="btn-small" onclick="app.addSubQuestions('${qID}', '${opt.replace(/'/g, "\\'")}')">+ Add Sub-Question</button>
                </div>`;

                if (currentAction && currentAction.targets) {
                    currentAction.targets.forEach(tid => {
                        const targetQ = this.findQ(tid);
                        if (targetQ) {
                            actionUI += `<div style="font-size:0.85rem; color:#005500; margin-top:4px;">↳ Linked: [${tid}] ${targetQ.question_text.substring(0, 20)}...</div>`;
                        }
                    });
                }
            }
            return `<div style="display:flex; justify-content:space-between; align-items:top; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;"><span style="flex:1; padding-top:5px;">If <b>${opt}</b>:</span><div style="flex:2">${actionUI}</div></div>`;
        }).join('');

        return `<div style="background:#eef; padding:10px; margin-top:10px; border:1px solid #cce;">
            <label class="lbl">GATE ACTION TYPE</label>
            <select class="input-text" style="margin-bottom:10px;" data-context="question" data-id="${qID}" data-key="gate_type">
                <option value="JUMP" ${isJump ? 'selected' : ''}>Page Jump (Routing)</option>
                <option value="SHOW" ${!isJump ? 'selected' : ''}>Show Sub-Question</option>
            </select>
            ${logicRows}
        </div>`;
    }

    setGateAction(qID, opt, type, val) {
        const q = this.findQ(qID);
        if (!q.actions) q.actions = {};
        if (type === 'JUMP') {
            q.actions[opt] = { type: 'JUMP', target: val };
        }
    }

    addSubQuestions(parentID, optLabel) {
        const newID = this.generateID();
        const newQ = {
            question_id: newID,
            type: 'MCQ_1',
            question_text: `Sub-Question for ${optLabel}`,
            required: true,
            options: ["Option 1", "Option 2"], option_qty: 2,
            parent_id: parentID,
            trigger_option: optLabel
        };

        this.surveyData.pages_survey[this.activePageIndex].questions.push(newQ);

        const parent = this.findQ(parentID);
        if (!parent.actions) parent.actions = {};
        if (!parent.actions[optLabel]) parent.actions[optLabel] = { type: 'SHOW', targets: [] };
        if (!parent.actions[optLabel].targets) parent.actions[optLabel].targets = [];
        parent.actions[optLabel].targets.push(newID);

        this.renderPageQuestions(this.activePageIndex);
    }

    // ==========================================
    // 5. UTILS & ID LOGIC
    // ==========================================

    // Helper to get raw MAX number (integer)
    getMaxQNumber() {
        let max = 0;
        this.surveyData.pages_survey.forEach(p => {
            p.questions.forEach(q => {
                const match = q.question_id.match(/^Q(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > max) max = num;
                }
            });
        });
        return max;
    }

    generateID() {
        return `Q${this.getMaxQNumber() + 1}`;
    }

    addNewQuestion(pageIndex) {
        const type = document.getElementById('newQType').value;
        const newID = this.generateID();
        const newQ = {
            question_id: newID,
            type: type,
            question_text: "New Question",
            required: true,
            options: [],
            option_qty: 0
        };
        if (['MCQ_1', 'MCQ_Multi', 'Gate_Q', 'MCQ_Rank'].includes(type)) { newQ.option_qty = 2; newQ.options = ["Option 1", "Option 2"]; }
        if (type === 'Gate_Q') { newQ.gate_type = 'JUMP'; newQ.actions = {}; }
        if (type === 'Rating') { newQ.points_on_scale = 5; newQ.rating_type = 'NUMERIC'; }

        this.surveyData.pages_survey[pageIndex].questions.push(newQ);
        this.renderPageQuestions(pageIndex);
    }

    // FIX: BATCH ID GENERATION
    copyQuestionToPage(pageIndex) {
        const select = document.getElementById('pickQSelect');
        const sourceID = select.value;
        if (!sourceID) { alert("Please select a question to copy."); return; }

        const sourceQ = this.findQ(sourceID);
        if (!sourceQ) return;

        const chain = [sourceQ];
        const allQuestions = [];
        this.surveyData.pages_survey.forEach(p => allQuestions.push(...p.questions));

        const addChildren = (pid) => {
            const kids = allQuestions.filter(q => q.parent_id === pid);
            kids.forEach(k => {
                chain.push(k);
                addChildren(k.question_id);
            });
        };
        addChildren(sourceID);

        // --- CRITICAL FIX START ---
        // Calculate the base Max ID ONCE
        const currentMax = this.getMaxQNumber();
        const idMap = {};

        // Loop through chain and assign Q(Max+1), Q(Max+2)...
        chain.forEach((q, index) => {
            idMap[q.question_id] = `Q${currentMax + index + 1}`;
        });
        // --- CRITICAL FIX END ---

        const newChain = chain.map(orig => {
            const clone = JSON.parse(JSON.stringify(orig));
            clone.question_id = idMap[orig.question_id];

            if (clone.parent_id && idMap[clone.parent_id]) {
                clone.parent_id = idMap[clone.parent_id];
            } else {
                delete clone.parent_id;
            }

            if (clone.actions) {
                Object.values(clone.actions).forEach(act => {
                    if (act.type === 'SHOW' && act.targets) {
                        act.targets = act.targets.map(oldT => idMap[oldT]).filter(x => x);
                    }
                });
            }
            return clone;
        });

        const currentPage = this.surveyData.pages_survey[pageIndex];
        newChain.forEach(q => currentPage.questions.push(q));
        this.renderPageQuestions(pageIndex);
    }

    removeQuestionFromPage(pageIndex, qIndex) {
        const page = this.surveyData.pages_survey[pageIndex];
        const parentQ = page.questions[qIndex];
        const parentID = parentQ.question_id;

        const allQuestions = page.questions;
        const orphans = allQuestions.filter(q => q.parent_id === parentID);

        if (orphans.length > 0) {
            const userChoice = confirm(`"Safe Delete" Check:\n\nThis question controls ${orphans.length} sub-questions.\n\n[OK] = Delete Question AND all sub-questions.\n[Cancel] = Delete Question but KEEP sub-questions (Promote to top-level).`);

            page.questions.splice(qIndex, 1);

            if (userChoice) {
                for (let i = page.questions.length - 1; i >= 0; i--) {
                    if (page.questions[i].parent_id === parentID) {
                        page.questions.splice(i, 1);
                    }
                }
            } else {
                orphans.forEach(q => { delete q.parent_id; delete q.trigger_option; });
            }
        } else {
            page.questions.splice(qIndex, 1);
        }
        this.renderPageQuestions(pageIndex);
    }

    moveQuestion(pageIndex, qIndex, dir) {
        const arr = this.surveyData.pages_survey[pageIndex].questions;
        const newPos = qIndex + dir;
        if (newPos >= 0 && newPos < arr.length) {
            [arr[qIndex], arr[newPos]] = [arr[newPos], arr[qIndex]];
            this.renderPageQuestions(pageIndex);
        }
    }

    downloadJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.surveyData, null, 2));
        const a = document.createElement('a'); a.href = dataStr; a.download = "survey.json"; a.click();
    }
    handleUpload() { document.getElementById('fileInput').click(); }
    processFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { try { this.surveyData = JSON.parse(ev.target.result); this.init(); alert("Loaded Successfully"); } catch (err) { alert("Invalid JSON"); } };
        reader.readAsText(file);
    }
}
window.app = new CreatorApp();
