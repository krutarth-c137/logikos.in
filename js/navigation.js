document.addEventListener("DOMContentLoaded", function() {
    // 1. INJECT HEADER
    const header = document.querySelector("#global-header");
    if (header) {
        header.innerHTML = `
            <div class="logo-container">LOGIKOS</div>
            <nav>
                <ul>
                    <li><a href="/index.html">Home</a></li>
                    <li><a href="/pages/services.html">Services</a></li>
                    <li><a href="/pages/calculator.html">Cost Estimator</a></li>
                    <li><a href="/pages/shop.html">Shop</a></li>
                    <li><a href="/pages/community.html">Community</a></li>
                </ul>
            </nav>
        `;
    }

    // 2. INJECT FOOTER
    const footer = document.querySelector("#global-footer");
    if (footer) {
        footer.innerHTML = `
            <div class="footer-content">
                <span>© 2026 Logikos.in</span>
                <span>Contact: email@logikos.in</span>
            </div>
        `;
    }
});
