class SurveyEngine {
    constructor(data) {
        this.data = data;
        this.currentPageId = "p1";
        this.responses = {};
        this.history = [];
        this.selectedBranch = null;
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyoZvAvwTUydT6OCABqfdK5YSKBQDgEgVP7-vKgqGaFAjn0yMgfAn1GjZ5jeLYb_SUf7w/exec";
    }

    init() { this.renderPage(); }

    renderPage() {
        const container = document.getElementById('surveyContainer');
        if (!container) return;
        container.innerHTML = '';
        
        const page = this.data.pages.find(p => p.id === this.currentPageId);
        container.className = `page-${page.id}`;

        const h = document.createElement(page.id === 'p1' ? 'h1' : 'h2');
        h.innerText = page.pageName;
        container.appendChild(h);

        page.questions.forEach(q => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question-block';
            wrapper.id = `block-${q.id}`; 
            
            if (q.type === 'InfoBox') {
                const p = document.createElement('p');
                p.className = (page.id === 'p1') ? 'welcome-desc' : '';
                p.innerText = q.content;
                wrapper.appendChild(p);
            } else {
                const label = document.createElement('label');
                label.className = 'q-text';
                label.innerHTML = `${q.label} <span class="error-msg" style="display:none;">*this field is mandatory</span>`;
                wrapper.appendChild(label);
                
                if (q.id === 'email') this.buildDESQ(q, wrapper);
                else if (q.type === 'MCQ_1' || q.type === 'MCQ_Logic') this.buildMCQ(q, wrapper, false);
                else if (q.type === 'MCQ_Multi') this.buildMCQ(q, wrapper, true);
                else if (q.type === 'List1') this.buildList1(q, wrapper);
            }
            container.appendChild(wrapper);
        });

        this.renderNav(page, container);
    }

    validatePage(page) {
        let isValid = true;
        page.questions.forEach(q => {
            if (q.required) {
                const res = this.responses[q.id];
                const block = document.getElementById(`block-${q.id}`);
                const errorSpan = block ? block.querySelector('.error-msg') : null;
                
                let hasValue = false;
                if (q.id === 'email') {
                    hasValue = res && res.includes('@');
                } else if (Array.isArray(res)) {
                    hasValue = res.length > 0;
                } else {
                    hasValue = (res !== undefined && res !== null && res !== "");
                }

                if (!hasValue) {
                    isValid = false;
                    if (errorSpan) errorSpan.style.display = 'inline';
                    if (block) block.style.borderLeft = "4px solid red";
                } else {
                    if (errorSpan) errorSpan.style.display = 'none';
                    if (block) block.style.borderLeft = "none";
                }
            }
        });
        return isValid;
    }

    buildDESQ(q, w) {
        const i = document.createElement('input');
        i.type = 'email';
        i.className = 'logikos-input';
        i.placeholder = "Enter your unique email ID";
        i.value = this.responses[q.id] || '';
        i.oninput = (e) => this.responses[q.id] = e.target.value;
        w.appendChild(i);
    }

    buildMCQ(q, w, isMulti) {
        q.options.forEach(opt => {
            const r = document.createElement('label');
            r.className = 'option-row';
            const checked = isMulti ? (this.responses[q.id] || []).includes(opt) : this.responses[q.id] === opt;
            r.innerHTML = `<input type="${isMulti?'checkbox':'radio'}" name="${q.id}" ${checked?'checked':''}> ${opt}`;
            r.querySelector('input').onchange = (e) => {
                if (!isMulti) {
                    this.responses[q.id] = opt;
                    if(q.type === 'MCQ_Logic') this.selectedBranch = q.logic_map[opt];
                } else {
                    if(!this.responses[q.id]) this.responses[q.id] = [];
                    e.target.checked ? this.responses[q.id].push(opt) : this.responses[q.id] = this.responses[q.id].filter(i => i !== opt);
                }
            };
            w.appendChild(r);
        });
    }

    buildList1(q, w) {
        const area = document.createElement('div'); area.className = 'selection-area';
        const pool = document.createElement('div'); pool.className = 'options-pool';
        const refresh = () => {
            area.innerHTML = '';
            (this.responses[q.id] || []).forEach(val => {
                const b = document.createElement('div'); b.className = 'selected-bubble';
                b.innerHTML = `${val} <span class="remove-btn">×</span>`;
                b.querySelector('.remove-btn').onclick = () => {
                    this.responses[q.id] = this.responses[q.id].filter(i => i !== val);
                    refresh();
                };
                area.appendChild(b);
            });
        };
        q.options.forEach(opt => {
            const b = document.createElement('div'); b.className = 'bubble-option'; b.innerText = opt;
            b.onclick = () => {
                if(!this.responses[q.id]) this.responses[q.id] = [];
                if(!this.responses[q.id].includes(opt)) { this.responses[q.id].push(opt); refresh(); }
            };
            pool.appendChild(b);
        });
        w.appendChild(area); w.appendChild(pool); refresh();
    }

    renderNav(page, container) {
        const nav = document.createElement('div');
        nav.className = 'nav-btns';
        
        if (this.history.length > 0) {
            const b = document.createElement('button'); b.className = 'btn-box'; b.innerText = "BACK";
            b.onclick = () => { this.currentPageId = this.history.pop(); this.renderPage(); };
            nav.appendChild(b);
        }

        const n = document.createElement('button'); 
        n.className = 'btn-box'; 
        n.innerText = (page.isEnd || page.id.startsWith('BRANCH')) ? "SUBMIT" : "NEXT";
        
       n.onclick = () => {
    if (this.validatePage(page)) {
        if (page.isEnd || page.id.startsWith('BRANCH')) {
            this.submitData();
        } else {
            this.history.push(this.currentPageId);
            
            // LOGIC FIX: Branching now occurs ONLY when leaving Page 3 (p3)
            if (page.id === 'p3' && this.selectedBranch) {
                this.currentPageId = this.selectedBranch;
            } else {
                this.currentPageId = page.nextPage;
            }
            
            this.renderPage();
        }
    }
};

    async submitData() {
        const container = document.getElementById('surveyContainer');
        container.innerHTML = "<h1>SYNCING DATA...</h1><p>Please wait while we secure your response.</p>";

        const payload = {};
        // Map survey responses directly to alphanumeric keys from your Spreadsheet
        for (const key in this.responses) {
            payload[key] = Array.isArray(this.responses[key]) ? this.responses[key].join(', ') : this.responses[key];
        }

        try {
            await fetch(this.SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            });
            container.innerHTML = "<h1>THANK YOU</h1><p>Your insights have been recorded. <br><br> <a href='https://logikos.in' class='btn-box' style='text-decoration:none;'>RETURN HOME</a></p>";
        } catch (error) {
            container.innerHTML = "<h1>SYNC FAILED</h1><p>Could not connect to the database. Check your internet connection.</p>";
        }
    }
}
