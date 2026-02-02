class SurveyEngine {
    constructor(data) {
        this.data = data;
        this.pages = data.pages || [];
        this.currentPageId = this.pages[0]?.id || null;

        this.responses = {};
        this.history = [];

        // Branch handling
        this.branchTarget = null;
    }

    init() {
        if (!this.currentPageId) {
            console.error("Survey has no pages");
            return;
        }
        this.renderPage();
    }

    /* =========================
       PAGE RENDERING
    ========================== */

    renderPage() {
        const container = document.getElementById("surveyContainer");
        container.innerHTML = "";

        const page = this.getCurrentPage();
        if (!page) return;

        // END PAGE
        if (page.isEnd) {
            this.renderEnd(container, page);
            return;
        }

        // PAGE TITLE
        const title = document.createElement(page.id === this.pages[0].id ? "h1" : "h2");
        title.innerText = page.pageName || "";
        container.appendChild(title);

        // QUESTIONS
        page.questions.forEach(q => {
            this.renderQuestion(container, q);
        });

        // NAVIGATION
        this.renderNav(container, page);
    }

    getCurrentPage() {
        return this.pages.find(p => p.id === this.currentPageId);
    }

    /* =========================
       QUESTION RENDERING
    ========================== */

    renderQuestion(container, q) {
        const wrapper = document.createElement("div");
        wrapper.className = "question-block";
        wrapper.id = `block-${q.id}`;

        // INFOBOX (display-only)
        if (q.type === "InfoBox") {
            wrapper.innerHTML = `<p>${q.content || ""}</p>`;
            container.appendChild(wrapper);
            return;
        }

        // LABEL
        const label = document.createElement("label");
        label.className = "q-text";
        label.innerHTML = q.label || "";
        if (q.required) {
            label.innerHTML += ` <span class="error-msg">*this field is mandatory</span>`;
        }
        wrapper.appendChild(label);

        // INPUT TYPES
        switch (q.type) {
            case "DESQ":
                this.renderDESQ(q, wrapper);
                break;

            case "MCQ_1":
            case "MCQ_Logic":
                this.renderMCQ(q, wrapper, false);
                break;

            case "MCQ_Multi":
                this.renderMCQ(q, wrapper, true);
                break;

            case "List1":
                this.renderList1(q, wrapper);
                break;

            default:
                console.warn("Unsupported question type:", q.type);
        }

        container.appendChild(wrapper);
    }

    renderDESQ(q, wrapper) {
        const input = document.createElement("input");
        input.type = q.inputType || "text";
        input.value = this.responses[q.id] || "";

        input.oninput = e => {
            this.responses[q.id] = e.target.value.trim();
            wrapper.classList.remove("invalid");
        };

        wrapper.appendChild(input);
    }

    renderMCQ(q, wrapper, isMulti) {
        q.options.forEach(opt => {
            const row = document.createElement("label");
            row.className = "option-row";

            const input = document.createElement("input");
            input.type = isMulti ? "checkbox" : "radio";
            input.name = q.id;

            if (isMulti) {
                input.checked = (this.responses[q.id] || []).includes(opt);
            } else {
                input.checked = this.responses[q.id] === opt;
            }

            input.onchange = () => {
                wrapper.classList.remove("invalid");

                if (isMulti) {
                    if (!this.responses[q.id]) this.responses[q.id] = [];
                    const idx = this.responses[q.id].indexOf(opt);
                    idx > -1
                        ? this.responses[q.id].splice(idx, 1)
                        : this.responses[q.id].push(opt);
                } else {
                    this.responses[q.id] = opt;

                    // LOGIC CAPTURE (navigation only, not rendering)
                    if (q.type === "MCQ_Logic" && q.logic_map) {
                        this.branchTarget = q.logic_map[opt] || null;
                    }
                }
            };

            row.appendChild(input);
            row.appendChild(document.createTextNode(` ${opt}`));
            wrapper.appendChild(row);
        });
    }

    renderList1(q, wrapper) {
        const area = document.createElement("div");
        area.className = "selection-area";

        const pool = document.createElement("div");
        pool.className = "options-pool";

        const refresh = () => {
            area.innerHTML = "";
            (this.responses[q.id] || []).forEach(val => {
                const bubble = document.createElement("div");
                bubble.className = "selected-bubble";
                bubble.innerHTML = `${val} <span class="remove-btn">×</span>`;
                bubble.querySelector(".remove-btn").onclick = () => {
                    this.responses[q.id] = this.responses[q.id].filter(v => v !== val);
                    refresh();
                };
                area.appendChild(bubble);
            });
        };

        q.options.forEach(opt => {
            const bubble = document.createElement("div");
            bubble.className = "bubble-option";
            bubble.innerText = opt;

            bubble.onclick = () => {
                if (!this.responses[q.id]) this.responses[q.id] = [];
                if (!this.responses[q.id].includes(opt)) {
                    this.responses[q.id].push(opt);
                    wrapper.classList.remove("invalid");
                    refresh();
                }
            };

            pool.appendChild(bubble);
        });

        wrapper.appendChild(area);
        wrapper.appendChild(pool);
        refresh();
    }

    /* =========================
       NAVIGATION + VALIDATION
    ========================== */

    renderNav(container, page) {
        const nav = document.createElement("div");
        nav.className = "nav-btns";

        // BACK
        if (this.history.length > 0) {
            const back = document.createElement("button");
            back.className = "btn-back";
            back.innerText = "Back";
            back.onclick = () => {
                this.currentPageId = this.history.pop();
                this.renderPage();
            };
            nav.appendChild(back);
        } else {
            nav.appendChild(document.createElement("span"));
        }

        // NEXT / SUBMIT
        const next = document.createElement("button");
        next.className = "btn-next";
        next.innerText = this.isFinalPage(page) ? "Submit Survey" : "Next Page";

        next.onclick = () => {
            if (!this.validatePage(page)) return;

            if (this.isFinalPage(page)) {
                this.submitSurvey();
                return;
            }

            this.history.push(this.currentPageId);

            if (this.branchTarget) {
                this.currentPageId = this.branchTarget;
                this.branchTarget = null;
            } else {
                this.currentPageId = page.nextPage;
            }

            this.renderPage();
        };

        nav.appendChild(next);
        container.appendChild(nav);
    }

    isFinalPage(page) {
        return !page.nextPage || page.nextPage === "THANK_YOU";
    }

    validatePage(page) {
        let valid = true;

        page.questions.forEach(q => {
            if (!q.required || q.type === "InfoBox") return;

            const val = this.responses[q.id];
            const block = document.getElementById(`block-${q.id}`);

            const answered =
                typeof val === "string"
                    ? val.length > 0
                    : Array.isArray(val)
                    ? val.length > 0
                    : false;

            if (!answered) {
                block.classList.add("invalid");
                valid = false;
            }
        });

        return valid;
    }

    /* =========================
       SUBMISSION + END
    ========================== */

    submitSurvey() {
        console.log("Survey completed. Responses:", this.responses);
        this.currentPageId = "THANK_YOU";
        this.renderPage();
    }

    renderEnd(container, page) {
        const msg = page.questions?.[0]?.content || "Thank you.";
        container.innerHTML = `
            <div class="thank-you-card">
                <h1>Thank you for your time.</h1>
                <p>${msg}</p>
            </div>
        `;
    }
}
