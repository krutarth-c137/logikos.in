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

        if (page.id === "THANK_YOU") return this.renderEnd(container, page);

        const h = document.createElement(page.id === "p1" ? 'h1' : 'h2');
        h.innerText = page.pageName;
        container.appendChild(h);

        page.questions.forEach(q => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question-block';
            wrapper.id = `block-${q.id}`;

            const label = document.createElement('label');
            label.className = 'q-text';
            label.innerHTML = `${q.label} <span class="error-msg">*this field is mandatory</span>`;
            wrapper.appendChild(label);

            if (q.type === 'DESQ') this.addDESQ(q, wrapper);
            else if (q.type === 'MCQ_1' || q.type === 'MCQ_Logic') this.addMCQ(q, wrapper, false);
            else if (q.type === 'MCQ_Multi') this.addMCQ(q, wrapper, true);
            else if (q.type === 'List1') this.addList1(q, wrapper);
            else if (q.type === 'InfoBox') { wrapper.innerHTML = `<p>${q.content}</p>`; }

            container.appendChild(wrapper);
        });

        this.renderNav(page, container);
    }

    addDESQ(q, w) {
        const i = document.createElement('input');
        i.type = q.inputType; i.placeholder = q.placeholder || "";
        i.value = this.responses[q.id] || "";
        i.oninput = (e) => { this.responses[q.id] = e.target.value; w.classList.remove('invalid'); };
        w.appendChild(i);
    }

    addMCQ(q, w, isMulti) {
        q.options.forEach(opt => {
            const r = document.createElement('label'); r.className = 'option-row';
            const i = document.createElement('input');
            i.type = isMulti ? 'checkbox' : 'radio'; i.name = q.id;
            i.checked = isMulti ? (this.responses[q.id] || []).includes(opt) : this.responses[q.id] === opt;
            i.onchange = () => {
                w.classList.remove('invalid');
                if (!isMulti) {
                    this.responses[q.id] = opt;
                    if (q.type === 'MCQ_Logic') this.selectedBranch = q.logic_map[opt];
                } else {
                    if (!this.responses[q.id]) this.responses[q.id] = [];
                    const idx = this.responses[q.id].indexOf(opt);
                    idx > -1 ? this.responses[q.id].splice(idx, 1) : this.responses[q.id].push(opt);
                }
            };
            r.appendChild(i); r.appendChild(document.createTextNode(` ${opt}`));
            w.appendChild(r);
        });
    }

    addList1(q, w) {
        const area = document.createElement('div'); area.className = 'selection-area';
        const pool = document.createElement('div'); pool.className = 'options-pool';
        const refresh = () => {
            area.innerHTML = '';
            (this.responses[q.id] || []).forEach(act => {
                const b = document.createElement('div'); b.className = 'selected-bubble';
                b.innerHTML = `${act} <span class="remove-btn">×</span>`;
                b.querySelector('.remove-btn').onclick = () => {
                    this.responses[q.id] = this.responses[q.id].filter(i => i !== act);
                    refresh();
                };
                area.appendChild(b);
            });
        };
        q.options.forEach(opt => {
            const b = document.createElement('div'); b.className = 'bubble-option'; b.innerText = opt;
            b.onclick = () => {
                if (!this.responses[q.id]) this.responses[q.id] = [];
                if (!this.responses[q.id].includes(opt)) { this.responses[q.id].push(opt); refresh(); w.classList.remove('invalid'); }
            };
            pool.appendChild(b);
        });
        w.appendChild(area); w.appendChild(pool); refresh();
    }

    renderNav(page, container) {
        const div = document.createElement('div'); div.className = 'nav-btns';
        if (this.history.length > 0) {
            const b = document.createElement('button'); b.className = 'btn-back'; b.innerText = "Back";
            b.onclick = () => { this.currentPageId = this.history.pop(); this.renderPage(); };
            div.appendChild(b);
        } else div.appendChild(document.createElement('span'));

        const n = document.createElement('button'); n.className = 'btn-next';
        n.innerText = page.id.startsWith('BRANCH') ? "Submit Survey" : "Next Page";
        n.onclick = () => {
            if (this.validate(page)) {
                this.history.push(this.currentPageId);
                this.currentPageId = (this.currentPageId === "p3" && this.selectedBranch) ? this.selectedBranch : page.nextPage;
                this.renderPage();
            }
        };
        div.appendChild(n); container.appendChild(div);
    }

    validate(page) {
        let valid = true;
        page.questions.forEach(q => {
            const block = document.getElementById(`block-${q.id}`);
            const res = this.responses[q.id];
            let answered = (q.type === 'DESQ') ? (res && res.includes('@')) : (res && res.length > 0);
            if (q.required && !answered) { block.classList.add('invalid'); valid = false; }
        });
        return valid;
    }

    renderEnd(container, page) {
        const q = page.questions[0];
        container.innerHTML = `<div class="thank-you-card"><h1>Thank you for your time.</h1><p>${q.content}</p><a href="https://logikos.in/pages/calculator.html" class="calc-link">Try Cost Calculator</a></div>`;
    }
}
