class SurveyEngine {
    constructor(data, containerId = 'surveyContainer') {
        this.data = data;
        this.container = document.getElementById(containerId);

        this.state = "WELCOME";
        this.currPageIndex = 0;
        this.responses = {};
        this.history = [];
        this.nextDest = null;

        this.init();
    }

    init() { this.render(); }

    render() {
        this.container.innerHTML = '';
        if (this.state === "WELCOME") this.renderWelcome();
        else if (this.state === "SURVEY") this.renderSurveyPage();
        else if (this.state === "THANKYOU") this.renderThankYou();
    }

    renderWelcome() {
        const p = this.data.page_welcome;
        this.container.innerHTML = `
            <div class="engine-page">
                <h1>${p.title}</h1>
                <p class="desc">${p.description}</p>
                <div class="consent-box"><label><input type="checkbox" id="consentCheck"> ${p.consent}</label></div>
                <button class="btn-start" onclick="engine.startSurvey()">${p.next_page_btn}</button>
            </div>`;
    }

    startSurvey() {
        if (!document.getElementById('consentCheck').checked) { alert("Please provide consent."); return; }
        this.state = "SURVEY";
        this.currPageIndex = 0;
        this.render();
    }

    renderThankYou() {
        const p = this.data.page_thankyou;
        this.container.innerHTML = `
            <div class="engine-page">
                <h1>${p.title}</h1>
                <p class="desc">${p.end_note}</p>
                ${p.redirect_url ? `<button class="btn-start" onclick="window.location.href='${p.redirect_url}'">Continue</button>` : ''}
            </div>`;
    }

    renderSurveyPage() {
        const page = this.data.pages_survey[this.currPageIndex];
        if (!page) return;
        this.nextDest = null;

        const wrapper = document.createElement('div');
        wrapper.className = 'engine-page';
        wrapper.innerHTML = `<h2>${page.page_title}</h2><p class="desc">${page.page_desc}</p>`;

        page.questions.forEach(qData => {
            const qID = qData.question_id;
            const isSub = !!qData.parent_id;
            const displayStyle = isSub ? 'display:none; margin-left:20px; border-left:3px solid #ccc; padding-left:15px;' : '';

            const qDiv = document.createElement('div');
            qDiv.className = 'engine-q-block';
            qDiv.id = `block_${qID}`;
            qDiv.style.cssText = displayStyle;

            const reqStar = qData.required ? '<span style="color:red">*</span>' : '';
            qDiv.innerHTML = `<div class="q-text">${qData.question_text} ${reqStar}</div>`;
            if (qData.question_desc) qDiv.innerHTML += `<div class="q-desc">${qData.question_desc}</div>`;

            const inputArea = document.createElement('div');
            inputArea.className = 'q-input-area';

            if (qData.type === 'MCQ_1') this.renderMCQ1(qID, qData, inputArea);
            else if (qData.type === 'MCQ_Multi') this.renderMCQMulti(qID, qData, inputArea);
            else if (qData.type === 'MCQ_Rank') this.renderMCQRank(qID, qData, inputArea);
            else if (qData.type === 'Des_Q') this.renderDesQ(qID, qData, inputArea);
            else if (qData.type === 'Gate_Q') this.renderGate(qID, qData, inputArea);
            else if (qData.type === 'Rating') this.renderRating(qID, qData, inputArea);

            qDiv.appendChild(inputArea);
            wrapper.appendChild(qDiv);
        });

        const nav = document.createElement('div');
        nav.className = 'nav-area';
        if (this.history.length > 0) nav.innerHTML += `<button class="btn-secondary" onclick="engine.goBack()">Back</button>`;
        nav.innerHTML += `<button class="btn-primary" onclick="engine.goNext()">${(this.currPageIndex >= this.data.pages_survey.length - 1) ? "Submit" : "Next"}</button>`;
        wrapper.appendChild(nav);
        this.container.appendChild(wrapper);
    }

    findQuestionData(id) {
        for (let p of this.data.pages_survey) {
            const found = p.questions.find(q => q.question_id === id);
            if (found) return found;
        }
        return null;
    }

    renderDesQ(qID, q, container) {
        const val = this.responses[qID] || '';
        container.innerHTML = `<textarea class="eng-input" rows="3" placeholder="${q.placeholder || ''}" oninput="engine.saveResponse('${qID}', this.value)">${val}</textarea>`;
    }

    renderMCQ1(qID, q, container) {
        if (q.dropdown) {
            const sel = document.createElement('select'); sel.className = 'eng-input';
            let optHtml = `<option value="">-- Select --</option>`;
            q.options.forEach(o => { optHtml += `<option value="${o}" ${this.responses[qID] === o ? 'selected' : ''}>${o}</option>`; });
            if (q.other_input) optHtml += `<option value="Other" ${this.responses[qID] === 'Other' ? 'selected' : ''}>Other</option>`;
            sel.innerHTML = optHtml;

            const otherInput = document.createElement('input'); otherInput.type = 'text'; otherInput.id = `other_${qID}`; otherInput.className = 'eng-input'; otherInput.style.cssText = "display:none; margin-top:5px;"; otherInput.placeholder = "Please specify..."; otherInput.value = this.responses[`${qID}_other`] || '';
            if (this.responses[qID] === 'Other') otherInput.style.display = 'block';

            sel.onchange = (e) => { this.saveResponse(qID, e.target.value); otherInput.style.display = (e.target.value === 'Other') ? 'block' : 'none'; };
            otherInput.oninput = (e) => { this.saveResponse(`${qID}_other`, e.target.value); };
            container.appendChild(sel); if (q.other_input) container.appendChild(otherInput);
        } else {
            q.options.forEach(opt => {
                const checked = this.responses[qID] === opt ? 'checked' : '';
                container.innerHTML += `<label class="eng-opt-row"><input type="radio" name="${qID}" value="${opt}" ${checked} onchange="engine.handleMCQ1Change('${qID}', this.value)"><span>${opt}</span></label>`;
            });
            if (q.other_input) {
                const checked = this.responses[qID] === 'Other' ? 'checked' : '';
                const otherVal = this.responses[`${qID}_other`] || '';
                container.innerHTML += `<label class="eng-opt-row"><input type="radio" name="${qID}" value="Other" ${checked} onchange="engine.handleMCQ1Change('${qID}', 'Other')"> Other</label><input type="text" id="other_${qID}" class="eng-input" style="display:${checked ? 'block' : 'none'}; margin-left:20px; width:80%" value="${otherVal}" placeholder="Specify..." oninput="engine.saveResponse('${qID}_other', this.value)">`;
            }
        }
    }

    handleMCQ1Change(qID, val) {
        this.saveResponse(qID, val);
        const otherBox = document.getElementById(`other_${qID}`);
        if (otherBox) otherBox.style.display = (val === 'Other') ? 'block' : 'none';
    }

    renderMCQMulti(qID, q, container) {
        if (q.variant === 'bubble') {
            const selected = this.responses[qID] || [];
            let available = q.options.filter(o => !selected.includes(o));
            if (q.other_input && !selected.includes("Other")) available.push("Other");

            const ansPool = document.createElement('div'); ansPool.style.cssText = "margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;";
            ansPool.innerHTML = "<strong>Selected:</strong> ";
            selected.forEach(opt => { ansPool.innerHTML += `<div class="eng-bubble-opt active" onclick="engine.toggleMulti('${qID}', '${opt}', true)">${opt} ✕</div>`; });
            const optPool = document.createElement('div'); optPool.innerHTML = "<strong>Options:</strong> ";
            available.forEach(opt => { optPool.innerHTML += `<div class="eng-bubble-opt" onclick="engine.toggleMulti('${qID}', '${opt}', true)">${opt}</div>`; });
            container.appendChild(ansPool); container.appendChild(optPool);

            if (q.other_input && selected.includes("Other")) {
                const otherVal = this.responses[`${qID}_other`] || '';
                const otherInput = document.createElement('input'); otherInput.type = 'text'; otherInput.className = 'eng-input'; otherInput.style.marginTop = "10px"; otherInput.placeholder = "Please specify..."; otherInput.value = otherVal; otherInput.oninput = (e) => this.saveResponse(`${qID}_other`, e.target.value); container.appendChild(otherInput);
            }
        } else {
            const stored = this.responses[qID] || [];
            q.options.forEach(opt => {
                const isChecked = stored.includes(opt);
                container.innerHTML += `<label class="eng-opt-row"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="engine.toggleMulti('${qID}', '${opt}')"><span>${opt}</span></label>`;
            });
            if (q.other_input) {
                const otherChecked = stored.includes("Other");
                const otherVal = this.responses[`${qID}_other`] || '';
                container.innerHTML += `<label class="eng-opt-row"><input type="checkbox" ${otherChecked ? 'checked' : ''} onchange="engine.toggleMulti('${qID}', 'Other')"> Other</label><input type="text" id="other_${qID}" class="eng-input" style="display:${otherChecked ? 'block' : 'none'}; margin-left:20px; width:80%" value="${otherVal}" placeholder="Specify..." oninput="engine.saveResponse('${qID}_other', this.value)">`;
            }
        }
    }

    toggleMulti(qID, val, isBubble = false) {
        if (!this.responses[qID]) this.responses[qID] = [];
        const idx = this.responses[qID].indexOf(val);
        if (idx > -1) this.responses[qID].splice(idx, 1);
        else this.responses[qID].push(val);
        if (isBubble) {
            const block = document.getElementById(`block_${qID}`);
            const inputArea = block.querySelector('.q-input-area'); inputArea.innerHTML = '';
            const qData = this.findQuestionData(qID); this.renderMCQMulti(qID, qData, inputArea);
        } else {
            if (val === 'Other') { const otherBox = document.getElementById(`other_${qID}`); if (otherBox) otherBox.style.display = (idx === -1) ? 'block' : 'none'; }
        }
    }

    renderMCQRank(qID, q, container) {
        q.options.forEach(opt => {
            const val = (this.responses[qID] && this.responses[qID][opt]) ? this.responses[qID][opt] : '';
            container.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;"><span>${opt}</span><input type="number" class="eng-input" style="width:60px" min="1" max="${q.options.length}" value="${val}" oninput="engine.saveRank('${qID}', '${opt}', this)"></div>`;
        });
    }
    saveRank(qID, opt, input) {
        let val = parseInt(input.value); const max = parseInt(input.getAttribute('max'));
        if (val < 1) { val = 1; input.value = 1; } if (val > max) { val = max; input.value = max; }
        if (!this.responses[qID]) this.responses[qID] = {}; this.responses[qID][opt] = val;
    }

    renderRating(qID, q, container) {
        const max = q.points_on_scale || 5;
        const current = this.responses[qID];
        const isText = q.rating_type === 'TEXT';

        if (isText) {
            // NEW: HORIZONTAL STEPPER
            let html = `
                <div class="rating-horizontal-container">
                    <div class="rating-line"></div>
            `;
            for (let i = 1; i <= max; i++) {
                const label = (q.custom_labels && q.custom_labels[i - 1]) ? q.custom_labels[i - 1] : `Step ${i}`;
                const isActive = current == i ? 'active' : '';
                html += `
                    <div class="rating-step ${isActive}" onclick="engine.handleRating('${qID}', ${i})">
                        <div class="rating-circle"></div>
                        <div class="rating-label">${label}</div>
                    </div>
                `;
            }
            html += `</div>`;
            container.innerHTML = html;
        } else {
            // STANDARD NUMERIC BOXES
            let html = '<div style="display:flex; gap:10px; flex-wrap:wrap;">';
            for (let i = 1; i <= max; i++) {
                const active = current == i ? 'background:black; color:white; border-color:black;' : '';
                html += `<div class="eng-rating-box rating-opt-${qID}" style="${active}" onclick="engine.handleRating('${qID}', ${i})">${i}</div>`;
            }
            html += '</div>'; container.innerHTML = html;
        }
    }

    handleRating(qID, val) {
        this.saveResponse(qID, val);
        const qData = this.findQuestionData(qID);
        // Re-render only this input area to update active states
        const block = document.getElementById(`block_${qID}`);
        if (block) {
            const inputArea = block.querySelector('.q-input-area');
            if (inputArea) this.renderRating(qID, qData, inputArea);
        }
    }

    renderGate(qID, q, container) {
        q.options.forEach(opt => {
            const checked = this.responses[qID] === opt ? 'checked' : '';
            container.innerHTML += `<label class="eng-opt-row"><input type="radio" name="${qID}" value="${opt}" ${checked} onchange="engine.handleGateChange('${qID}', '${opt}')"><span>${opt}</span></label>`;
        });
        if (this.responses[qID]) setTimeout(() => this.handleGateChange(qID, this.responses[qID]), 50);
    }

    handleGateChange(qID, val) {
        this.saveResponse(qID, val);
        const qData = this.findQuestionData(qID);
        if (!qData.actions || !qData.actions[val]) return;
        const action = qData.actions[val];

        if (action.type === 'JUMP') {
            this.nextDest = action.target;
        }
        else if (action.type === 'SHOW') {
            // Hide all potential targets
            const allTargets = [];
            Object.values(qData.actions).forEach(act => { if (act.targets) allTargets.push(...act.targets); });
            allTargets.forEach(tid => { const el = document.getElementById(`block_${tid}`); if (el) el.style.display = 'none'; });

            // Show current targets
            if (action.targets) {
                action.targets.forEach(subID => {
                    const el = document.getElementById(`block_${subID}`);
                    if (el) el.style.display = 'block';
                });
            }
        }
    }

    saveResponse(qID, val) { this.responses[qID] = val; }

    validatePage() {
        const page = this.data.pages_survey[this.currPageIndex];
        let isValid = true;
        page.questions.forEach(qData => {
            const qID = qData.question_id;
            const el = document.getElementById(`block_${qID}`);
            if (el && el.style.display !== 'none') {
                if (qData.required) {
                    const val = this.responses[qID];
                    const empty = (val === undefined || val === "" || (Array.isArray(val) && val.length === 0));
                    if (empty) { el.style.borderLeft = "4px solid red"; isValid = false; }
                    else { el.style.borderLeft = "3px solid #ccc"; }
                }
            }
        });
        return isValid;
    }

    goNext() {
        if (!this.validatePage()) { alert("Please answer all required questions."); return; }
        this.history.push(this.currPageIndex);
        if (this.nextDest) {
            if (this.nextDest === 'THANK_YOU') { this.submit(); return; }
            const idx = this.data.pages_survey.findIndex(p => p.page_id === this.nextDest);
            if (idx !== -1) { this.currPageIndex = idx; this.render(); return; }
        }
        if (this.currPageIndex < this.data.pages_survey.length - 1) { this.currPageIndex++; this.render(); }
        else { this.submit(); }
    }
    goBack() { if (this.history.length > 0) { this.currPageIndex = this.history.pop(); this.render(); } }
    submit() { this.state = "THANKYOU"; this.render(); console.log("FINAL RESPONSES:", this.responses); }
}
