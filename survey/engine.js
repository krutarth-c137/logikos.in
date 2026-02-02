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
        container.innerHTML = '';
        const page = this.data.pages.find(p => p.id === this.currentPageId);

        const h = document.createElement(page.id === 'p1' ? 'h1' : 'h2');
        h.innerText = page.pageName;
        container.appendChild(h);

        page.questions.forEach(q => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question-block';
            wrapper.id = `block-${q.id}`;
            if (this.currentPageId === 'p1') wrapper.style.textAlign = 'center';

            if (q.type === 'InfoBox') {
                const p = document.createElement('p');
                p.className = (page.id === 'p1') ? 'welcome-desc' : '';
                p.innerText = q.content;
                wrapper.appendChild(p);
            } else {
                const label = document.createElement('label');
                label.className = 'q-text';
                label.innerHTML = `${q.label} <span class="error-msg">*mandatory</span>`;
                wrapper.appendChild(label);
                
                if (q.type === 'DESQ') this.buildDESQ(q, wrapper);
                else if (q.type.startsWith('MCQ')) this.buildMCQ(q, wrapper, q.type==='MCQ_Multi');
                else if (q.type === 'List1') this.buildList1(q, wrapper);
            }
            container.appendChild(wrapper);
        });
        this.renderNav(page, container);
    }

    validate(page) {
        let valid = true;
        page.questions.forEach(q => {
            if (q.required) {
                const res = this.responses[q.id];
                const block = document.getElementById(`block-${q.id}`);
                const hasVal = Array.isArray(res) ? res.length > 0 : (res && res !== "");
                
                if (!hasVal) {
                    valid = false;
                    block.querySelector('.error-msg').style.display = 'inline';
                    block.style.borderLeft = "4px solid red";
                } else {
                    block.querySelector('.error-msg').style.display = 'none';
                    block.style.borderLeft = "4px solid transparent";
                }
            }
        });
        return valid;
    }

    buildDESQ(q, w) {
        const i = document.createElement('input');
        i.className = 'logikos-input';
        i.placeholder = "Enter response...";
        i.value = this.responses[q.id] || '';
        i.oninput = (e) => this.responses[q.id] = e.target.value;
        w.appendChild(i);
    }

    buildMCQ(q, w, isMulti) {
        const bundle = document.createElement('div');
        bundle.className = 'option-bundle';
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
            bundle.appendChild(r);
        });
        w.appendChild(bundle);
    }

    buildList1(q, w) {
        const area = document.createElement('div'); area.className = 'selection-area';
        const pool = document.createElement('div'); pool.className = 'options-pool';
        const refresh = () => {
            area.innerHTML = '';
            (this.responses[q.id] || []).forEach(val => {
                const b = document.createElement('div'); b.className = 'selected-bubble'; b.innerText = val;
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
        n.innerText = (page.id.startsWith('BRANCH') || page.isEnd) ? "SUBMIT" : "NEXT";
        n.onclick = () => {
            if (this.validate(page)) {
                if (page.id.startsWith('BRANCH') || page.isEnd) {
                    this.submit();
                } else {
                    this.history.push(this.currentPageId);
                    // LOGIC FIX: Force Page 3 before branching
                    if (page.id === 'p3' && this.selectedBranch) {
                        this.currentPageId = this.selectedBranch;
                    } else {
                        this.currentPageId = page.nextPage;
                    }
                    this.renderPage();
                }
            }
        };
        nav.appendChild(n);
        container.appendChild(nav);
    }

    async submit() {
        document.getElementById('surveyContainer').innerHTML = "<h1>SYNCING...</h1>";
        const payload = {};
        for (const key in this.responses) {
            payload[key] = Array.isArray(this.responses[key]) ? this.responses[key].join(', ') : this.responses[key];
        }
        try {
            await fetch(this.SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
            document.getElementById('surveyContainer').innerHTML = "<h1>THANK YOU</h1><p>Your insights are recorded.</p>";
        } catch (e) { alert("Sync Error. Please try again."); }
    }
}
