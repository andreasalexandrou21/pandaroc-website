from patchright.sync_api import sync_playwright
import threading, http.server, functools, pathlib

APP_DIR = r"C:\dev\PandaRoc\pandaroc-application"
PORT = 18923

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP_DIR)
server = http.server.HTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1500, "height": 780}, color_scheme="dark")

    def handle_route(route):
        url = route.request.url
        if "/api/" in url:
            route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
        elif "app.js" in url:
            route.fulfill(status=200, content_type="application/javascript", body="")
        else:
            route.continue_()

    page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    page.route("**/*", handle_route)
    page.goto(f"http://127.0.0.1:{PORT}/static/index.html", wait_until="load")
    page.wait_for_timeout(1000)

    # Inject Lucide directly via eval (bypasses context isolation)
    lucide_path = pathlib.Path(APP_DIR, "static", "vendor", "lucide.min.js")
    lucide_code = lucide_path.read_text(encoding="utf-8")
    page.evaluate("(code) => { (0, eval)(code); }", lucide_code)
    page.wait_for_timeout(300)

    diag = page.evaluate("""() => ({
        typeofLucide: typeof lucide,
        hasCreateIcons: typeof window.lucide === 'object' ? typeof window.lucide.createIcons : 'n/a',
    })""")
    print("After eval injection:", diag)

    page.evaluate("""() => {
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }""")
    page.wait_for_timeout(300)

    # Remove splash, hide nav chrome, set mock data
    page.evaluate("""() => {
        const splash = document.getElementById('app-splash');
        if (splash) splash.remove();

        document.querySelector('.top-nav-left').style.display = 'none';
        document.querySelector('.window-controls').style.display = 'none';

        // Center the nav pills
        const nav = document.querySelector('.top-nav');
        if (nav) { nav.style.justifyContent = 'center'; nav.style.position = 'relative'; }
        const pills = document.querySelector('.top-nav-pills');
        if (pills) { pills.style.margin = '0 auto'; pills.style.flex = 'none'; }
        const navRight = document.querySelector('.top-nav-right');
        if (navRight) navRight.style.display = 'none';

        // Stats
        const vals = {'stat-ekkremis':'3','stat-ready':'18','stat-completed':'142','stat-accounts':'11'};
        for (const [id, val] of Object.entries(vals)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
        document.getElementById('dashboard-greeting').textContent = 'Good afternoon, Panicos';

        // Finder - running
        const fs = document.getElementById('agent-b-status');
        if (fs) { fs.classList.add('running'); fs.innerHTML = '<span class="dot"></span><span>Running</span>'; }
        document.getElementById('agent-b-accounts').textContent = '11';
        document.getElementById('agent-b-scans').textContent = '248';

        // Downloader
        document.getElementById('agent-a-state').textContent = 'Waiting';
        document.getElementById('agent-a-next').textContent = 'Manual only';
        document.getElementById('agent-a-auto').textContent = 'ON';

        // Activity log
        const log = document.getElementById('activity-log');
        log.innerHTML = '';
        [
            {a:'finder', m:'Scan complete — 3 new pending orders found', t:'14:32:08'},
            {a:'downloader', m:'Certificate downloaded: HE-412890 — Annual Return', t:'14:31:45'},
            {a:'finder', m:'Account 7/11 scanned — no new orders', t:'14:31:22'},
            {a:'downloader', m:'Certificate downloaded: HE-398201 — Name Approval', t:'14:30:58'},
            {a:'system', m:'Downloader completed batch — 6 certificates filed', t:'14:30:15'},
            {a:'finder', m:'Account 6/11 scanned — 1 pending order queued', t:'14:29:44'},
        ].forEach(e => {
            const d = document.createElement('div');
            d.className = 'log-entry INFO';
            d.dataset.agent = e.a;
            d.innerHTML = '<div class="log-timeline"><div class="log-dot"></div></div>' +
                '<div class="log-body"><div class="log-body-top">' +
                '<span class="log-agent-tag ' + e.a + '">' + e.a + '</span>' +
                '<span class="log-time">' + e.t + '</span></div>' +
                '<div class="log-msg">' + e.m + '</div></div>';
            log.appendChild(d);
        });

        document.getElementById('setup-nudge').style.display = 'none';
        document.body.style.overflow = 'hidden';

        // Hide scrollbar so content uses full viewport width
        const content = document.querySelector('.content');
        if (content) {
            content.style.overflow = 'hidden';
            content.style.scrollbarWidth = 'none';
        }
        document.documentElement.style.cssText += 'scrollbar-width:none !important;';
        const s = document.createElement('style');
        s.textContent = '::-webkit-scrollbar{display:none !important;}';
        document.head.appendChild(s);
    }""")

    # Re-render icons after DOM changes
    page.evaluate("""() => {
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }""")
    page.wait_for_timeout(500)

    icon_count = page.evaluate("() => document.querySelectorAll('svg[class*=\"lucide\"]').length")
    print(f"Rendered {icon_count} Lucide icons")

    page.screenshot(path=r"C:\dev\PandaRoc\pandaroc-website\assets\screen_dashboard_live.png")
    print("Screenshot saved")
    browser.close()

server.shutdown()
