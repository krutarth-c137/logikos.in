class SurveyEngine {
    constructor(data) {
        this.data = data;
        this.currentPageId = "p1";
        this.responses = {};
        this.history = [];
        this.selectedBranch = null;
    }

    init() { this.renderPage(); }

    renderPage() {
        const container = document.getElementById('surveyContainer');
        container.innerHTML = '';
        const page = this.data.pages.find(p => p.id === this.currentPageId);
        
        // Add unique page class for CSS targeting (like centering Welcome)
        container.className = `page-${page.id}`;

        const h = document.createElement(page.id === 'p1' ? 'h1' : 'h2');
        h.innerText = page.pageName;
        container.appendChild(h);

        page.questions.forEach(q => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question-block';
            
            if (q.type === 'InfoBox') {
                const p = document.createElement('p');
                p.className = (page.id === 'p1') ? 'welcome-desc' : '';
                p.innerText = q.content;
                wrapper.appendChild(p);
            } else {
                const label = document.createElement('label');
                label.className = 'q-text';
                label.innerText = q.label;
                wrapper.appendChild(label);
                
                if (q.type === 'DESQ') this.buildDESQ(q, wrapper);
                else if (q.type === 'MCQ_1' || q.type === 'MCQ_Logic') this.buildMCQ(q, wrapper, false);
                else if (q.type === 'MCQ_Multi') this.buildMCQ(q, wrapper, true);
                else if (q.type === 'List1') this.buildList1(q, wrapper);
            }
            container.appendChild(wrapper);
        });

        this.renderNav(page, container);
    }

    buildDESQ(q, w) {
        const i = document.createElement('input');
        i.type = q.inputType || 'text';
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
            const b = document.createElement('button'); b.className = 'btn-back'; b.innerText = "BACK";
            b.onclick = () => { this.currentPageId = this.history.pop(); this.renderPage(); };
            nav.appendChild(b);
        }

        if (!page.isEnd) {
            const n = document.createElement('button'); n.className = 'btn-next'; n.innerText = "NEXT";
            n.onclick = () => {
                if (page.id === 'p1' && (!this.responses['email'] || !this.responses['email'].includes('@'))) {
                    alert("Please enter a valid email."); return;
                }
                this.history.push(this.currentPageId);
                this.currentPageId = (this.currentPageId === 'p3' && this.selectedBranch) ? this.selectedBranch : page.nextPage;
                this.renderPage();
            };
            nav.appendChild(n);
        }
        container.appendChild(nav);
    }
}
