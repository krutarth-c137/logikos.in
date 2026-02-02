class SurveyEngine {
    constructor(data) {
        this.data = data;
        this.state = "WELCOME"; // States: WELCOME, SURVEY, THANK_YOU
        this.currPageIndex = 0;
        this.responses = {};
        this.history = [];
        this.next_dest = null; // Stores the Gate jump target
        this.SHEET_URL = "https://script.google.com/macros/s/AKfycbyoZvAvwTUydT6OCABqfdK5YSKBQDgEgVP7-vKgqGaFAjn0yMgfAn1GjZ5jeLYb_SUf7w/exec";
    }

    init() {
        this.render();
    }

    render() {
        const container = document.getElementById('surveyContainer');
        if (!container) return;
        container.innerHTML = '';

        if (this.state === "WELCOME") {
            this.renderWelcome(container);
        } else if (this.state === "SURVEY") {
            this.renderSurveyPage(container);
        } else if (this.state === "THANK_YOU") {
            this.renderThankYou(container);
        }
    }

    // --- RENDERERS ---

    renderWelcome(container) {
        const page = this.data.welcome_page;
        container.innerHTML = `<h1>${page.title}</h1><p class="welcome-desc">${page.description}</p>`;
        
        // 1. Create Wrapper
        const qWrapper = document.createElement('div');
        qWrapper.className = 'question-block';
        qWrapper.id = `q-${page.question.id}`;

        // 2. Create Label with Error Span
        const label = document.createElement('label');
        label.className = 'q-text';
        label.innerHTML = `${page.question.text} <span class="error-msg" style="display:none; color:#dc3545; font-size:0.8rem; margin-left:10px;">*mandatory</span>`;
        qWrapper.appendChild(label);

        // 3. Render Input
        this.renderDesQ(page.question, qWrapper);
        container.appendChild(qWrapper);

        // 4. Navigation
        const nav = document.createElement('div');
        nav.className = 'nav-btns';
        const btn = document.createElement('button');
        btn.className = 'btn-box';
        btn.innerText = "START";
        
        btn.onclick = () => {
            if (this.validateQuestion(page.question)) {
                this.state = "SURVEY";
                this.currPageIndex = 0; 
                this.render();
            }
        };
        nav.appendChild(btn);
        container.appendChild(nav);
    }

    renderSurveyPage(container) {
        if (!this.data.survey_pages || !this.data.survey_pages[this.currPageIndex]) {
            container.innerHTML = "<h1>Error: Page not found</h1>";
            return;
        }

        const page = this.data.survey_pages[this.currPageIndex];
        
        const h2 = document.createElement('h2');
        h2.innerText = page.title;
        container.appendChild(h2);

        page.questions.forEach(q => {
            const w = document.createElement('div');
            w.className = 'question-block';
            w.id = `q-${q.id}`;
            
            // Label
            const label = document.createElement('label');
            label.className = 'q-text';
            label.innerHTML = `${q.text} <span class="error-msg" style="display:none; color:#dc3545; font-size:0.8rem; margin-left:10px;">*mandatory</span>`;
            w.appendChild(label);

            // Type Switch
            if (q.type === 'Des_Q') this.renderDesQ(q, w);
            else if (q.type === 'MCQ_1') this.renderMCQ1(q, w);
            else if (q.type === 'MCQ_Multi') {
                if (q.variant === 'bubble') this.renderBubble(q, w);
                else this.renderMCQMulti(q, w);
            }
            else if (q.type === 'Gate') this.renderGate(q, w);

            container.appendChild(w);
        });

        this.renderNav(container);
    }

    renderThankYou(container) {
        const page = this.data.thank_you_page;
        container.innerHTML = `<h1>${page.title}</h1><p class="welcome-desc">${page.note}</p>`;
        
        if (page.redirect_url) {
            const btn = document.createElement('button');
            btn.className = 'btn-box';
            btn.innerText = "RETURN HOME";
            btn.onclick = () => window.location.href = page.redirect_url;
            container.appendChild(btn);
        }
    }

    // --- QUESTION BUILDERS ---

    renderDesQ(q, w) {
        const i = document.createElement('input');
        i.className = 'logikos-input';
        i.value = this.responses[q.id] || '';
        i.oninput = (e) => {
            this.responses[q.id] = e.target.value;
            const err = w.querySelector('.error-msg');
            if(err) err.style.display = 'none';
        };
        w.appendChild(i);
    }

    renderMCQ1(q, w) {
        q.options.forEach(opt => {
            const l = document.createElement('label');
            l.className = 'option-row';
            const val = opt; 
            const checked = this.responses[q.id] === val;
            l.innerHTML = `<input type="radio" name="${q.id}" ${checked?'checked':''}> ${val}`;
            l.querySelector('input').onchange = () => { 
                this.responses[q.id] = val; 
                const err = w.querySelector('.error-msg');
                if(err) err.style.display = 'none';
            };
            w.appendChild(l);
        });
    }

    renderMCQMulti(q, w) {
        q.options.forEach(opt => {
            const l = document.createElement('label');
            l.className = 'option-row';
            const checked = (this.responses[q.id] || []).includes(opt);
            l.innerHTML = `<input type="checkbox" name="${q.id}" ${checked?'checked':''}> ${opt}`;
            l.querySelector('input').onchange = (e) => {
                if (!this.responses[q.id]) this.responses[q.id] = [];
                if (e.target.checked) this.responses[q.id].push(opt);
                else this.responses[q.id] = this.responses[q.id].filter(x => x !== opt);
                
                const err = w.querySelector('.error-msg');
                if(err) err.style.display = 'none';
            };
            w.appendChild(l);
        });
    }

    renderBubble(q, w) {
        const area = document.createElement('div'); area.className = 'selection-area';
        const pool = document.createElement('div'); pool.className = 'options-pool';
        
        const refresh = () => {
            area.innerHTML = '';
            (this.responses[q.id] || []).forEach(val => {
                const b = document.createElement('div'); b.className = 'selected-bubble'; b.innerText = val + " ✕";
                b.onclick = () => {
                    this.responses[q.id] = this.responses[q.id].filter(x => x !== val);
                    refresh();
                };
                area.appendChild(b);
            });
            if ((this.responses[q.id] || []).length > 0) {
                 const err = w.querySelector('.error-msg');
                 if(err) err.style.display = 'none';
            }
        };

        q.options.forEach(opt => {
            const b = document.createElement('div'); b.className = 'bubble-option'; b.innerText = opt;
            b.onclick = () => {
                if (!this.responses[q.id]) this.responses[q.id] = [];
                if (!this.responses[q.id].includes(opt)) { 
                    this.responses[q.id].push(opt); 
                    refresh(); 
                }
            };
            pool.appendChild(b);
        });
        w.appendChild(area); w.appendChild(pool); refresh();
    }

    renderGate(q, w) {
        q.options.forEach(opt => {
            const l = document.createElement('label');
            l.className = 'option-row';
            const val = opt.label;
            const checked = this.responses[q.id] === val;
            
            l.innerHTML = `<input type="radio" name="${q.id}" ${checked?'checked':''}> ${val}`;
            l.querySelector('input').onchange = () => { 
                this.responses[q.id] = val;
                this.next_dest = opt.jump_to_page; 
                const err = w.querySelector('.error-msg');
                if(err) err.style.display = 'none';
            };
            w.appendChild(l);
        });
    }

    // --- NAVIGATION & VALIDATION ---

    renderNav(container) {
        const nav = document.createElement('div'); nav.className = 'nav-btns';
        
        // Back Button
        if (this.history.length > 0) {
            const b = document.createElement('button'); b.className = 'btn-box'; b.innerText = "BACK";
            b.onclick = () => { 
                this.currPageIndex = this.history.pop(); 
                this.render(); 
            };
            nav.appendChild(b);
        }

        // Next/Submit Button
        const isEnd = this.currPageIndex >= this.data.survey_pages.length - 1 || this.data.survey_pages[this.currPageIndex].page_id.startsWith("BRANCH");
        
        const n = document.createElement('button');
        n.className = 'btn-box';
        n.innerText = isEnd ? "SUBMIT" : "NEXT";
        
        n.onclick = () => {
            const page = this.data.survey_pages[this.currPageIndex];
            if (this.validatePage(page)) {
                if (isEnd) {
                    this.submit();
                } else {
                    this.history.push(this.currPageIndex);
                    
                    // ROUTING LOGIC
                    if (page.page_id === "p_prelim" && this.next_dest) {
                        const targetIndex = this.data.survey_pages.findIndex(p => p.page_id === this.next_dest);
                        if (targetIndex !== -1) this.currPageIndex = targetIndex;
                        else console.error("Branch not found:", this.next_dest);
                    } else {
                        this.currPageIndex++;
                    }
                    this.render();
                }
            }
        };
        nav.appendChild(n);
        container.appendChild(nav);
    }

    validatePage(page) {
        let ok = true;
        page.questions.forEach(q => {
             if (!this.validateQuestion(q)) ok = false;
        });
        return ok;
    }

    validateQuestion(q) {
        if (!q.required) return true;
        
        const val = this.responses[q.id];
        const hasVal = Array.isArray(val) ? val.length > 0 : (val && val !== "");
        
        const block = document.getElementById(`q-${q.id}`);
        const err = block.querySelector('.error-msg');
        
        if (!hasVal) {
            if(err) err.style.display = 'inline';
            block.style.borderLeft = "4px solid #dc3545";
            return false;
        } else {
            if(err) err.style.display = 'none';
            block.style.borderLeft = "4px solid transparent";
            return true;
        }
    }

    async submit() {
        const container = document.getElementById('surveyContainer');
        container.innerHTML = "<h1>SYNCING DATA...</h1>";
        
        const payload = {};
        for (let k in this.responses) {
            payload[k] = Array.isArray(this.responses[k]) ? this.responses[k].join(', ') : this.responses[k];
        }

        try {
            await fetch(this.SHEET_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
            this.state = "THANK_YOU";
            this.render();
        } catch (e) {
            container.innerHTML = "<h1>ERROR</h1><p>Connection failed.</p>";
        }
    }
}
