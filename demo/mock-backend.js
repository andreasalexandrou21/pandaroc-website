/* ════════════════════════════════════════════════════════════════════
   PandaRoc demo — mock backend.
   Intercepts the app's fetch('/api/...') calls and returns the seeded
   demo dataset, so the REAL frontend renders fully populated with no
   live ROC traffic. Invented Cyprus companies, no real client data.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  const origFetch = window.fetch.bind(window);
  try { localStorage.setItem('pandaroc-zoom', '1.4'); } catch (e) {}
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const isoIn = (msAhead) => new Date(now + msAhead).toISOString();

  // ── ROC accounts (11; invented firms) ──
  const ACCOUNTS = [
    ['AELIUS', 'Aelius Corporate Ltd'],
    ['DRAKOS', 'Drakos & Vella LLC'],
    ['STRATUS', 'Stratus Fiduciary Ltd'],
    ['MERIDIAN', 'Meridian Trust (CY) Ltd'],
    ['NOSTOS', 'Nostos Fiduciaries Ltd'],
    ['PELAGOS', 'Pelagos Management Ltd'],
    ['ARGAKI', 'Argaki Secretarial Ltd'],
    ['CYAN', 'Cyan Harbour Advisors Ltd'],
    ['HALCYON', 'Halcyon Compliance Ltd'],
    ['THALASSA', 'Thalassa Corporate Ltd'],
    ['ORACLE', 'Oracle Nominees Ltd'],
  ].map(([code, username]) => ({
    code, username, enabled: true, finder_enabled: true,
    downloader_enabled: true, has_password: true, bad_password: false,
  }));

  const L = (name, color) => ({ name, color });
  const C_PURPLE = '#b094d6', C_BLUE = '#6ea8db', C_GREEN = '#7bb449', C_AMBER = '#e8891a', C_TEAL = '#4bb3a6';

  // ── helper to build an order ──
  function ord(o) {
    return Object.assign({
      he_number: '', company_name: '', service_type: 'certificate',
      decision: 'undecided', decision_pending: false, roc_account: 'Aelius Corporate Ltd',
      labels: [], doc_types: [], client_name: '', expected_documents: 0,
      files_downloaded: 0, status: 'new', last_error: '', notes: [], user_comment: '',
      name_slot: 0, name_slot_total: 0,
    }, o);
  }

  // ── PENDING (ekkremis): 5, the New Company KYMA DIGITAL is the star ──
  const ekkremis = [
    ord({ order_id: '3100920', company_name: 'KYMA DIGITAL LTD', he_number: '', service_type: 'new_company',
      roc_account: 'Aelius Corporate Ltd', status: 'new', expected_documents: 5,
      labels: [L('New Co', C_PURPLE)], created_ts: iso(3 * 60e3) }),
    ord({ order_id: '3100881', company_name: 'HORIZON TRUSTEES LTD', he_number: '448120', service_type: 'certificate',
      roc_account: 'Aelius Corporate Ltd', status: 'pending', doc_types: ['Directors', 'Shareholders'],
      created_ts: iso(26 * 60e3) }),
    ord({ order_id: '3100877', company_name: 'GODO CAPITAL LTD', he_number: '464570', service_type: 'other',
      roc_account: 'Aelius Corporate Ltd', labels: [L('HE4', C_GREEN)], client_name: 'Maria Koundourou',
      status: 'pending', created_ts: iso(52 * 60e3) }),
    ord({ order_id: '3100903', company_name: 'ASTRA HOLDINGS LTD', he_number: '459881', service_type: 'certificate',
      roc_account: 'Drakos & Vella LLC', status: 'pending', doc_types: ['Certificates'], expected_documents: 3,
      created_ts: iso(70 * 60e3) }),
    ord({ order_id: '3100844', company_name: 'MERSENNE LABS LTD', he_number: '', service_type: 'name_approval',
      roc_account: 'Drakos & Vella LLC', status: 'pending', name_slot: 1, name_slot_total: 2,
      created_ts: iso(95 * 60e3) }),
  ];

  // ── ACCEPTED (ready): attention (returned) + normal w/ doc badges ──
  const ready = [
    // ONE returned-for-corrections order so the "needs attention" line in the VO matches.
    ord({ order_id: '3098990', company_name: 'TYROS HOLDINGS LTD', he_number: '447902', service_type: 'certificate',
      roc_account: 'Drakos & Vella LLC', decision: 'accepted', status: 'failed', last_error: 'Returned for corrections',
      expected_documents: 4, files_downloaded: 0, labels: [L('Certificates', C_AMBER)], created_ts: iso(30 * 3600e3) }),
    // Accepted orders being watched by the Downloader (doc badges 2/5, 1/2)
    ord({ order_id: '3099120', company_name: 'LYSANDER TRUST LTD', he_number: '451233', service_type: 'certificate',
      roc_account: 'Aelius Corporate Ltd', decision: 'accepted', status: 'waiting', expected_documents: 5, files_downloaded: 2,
      labels: [L('Directors', C_BLUE), L('Shareholders', C_BLUE)], created_ts: iso(6 * 3600e3) }),
    ord({ order_id: '3099004', company_name: 'KETOS SHIPPING LTD', he_number: '441900', service_type: 'other',
      roc_account: 'Aelius Corporate Ltd', decision: 'accepted', status: 'waiting', expected_documents: 2, files_downloaded: 1,
      labels: [L('Apostille', C_PURPLE)], client_name: 'Andreou & Co', created_ts: iso(9 * 3600e3) }),
    ord({ order_id: '3098770', company_name: 'AETHER CAPITAL LTD', he_number: '436012', service_type: 'certificate',
      roc_account: 'Drakos & Vella LLC', decision: 'accepted', status: 'waiting', expected_documents: 3, files_downloaded: 0,
      labels: [L('Certificates', C_AMBER)], created_ts: iso(12 * 3600e3) }),
    ord({ order_id: '3098661', company_name: 'SELENE NOMINEES LTD', he_number: '429004', service_type: 'name_approval',
      roc_account: 'Drakos & Vella LLC', decision: 'accepted', status: 'waiting', created_ts: iso(18 * 3600e3) }),
  ];

  // ── COMPLETED: a screenful (stat says 105) ──
  const completedNames = [
    ['3100694', 'NOSTOS CAPITAL LTD', '451900', 'certificate', 'Nostos Fiduciaries Ltd', 3, [L('Directors', C_BLUE)]],
    ['3100655', 'PELAGOS MARINE LTD', '447120', 'other', 'Pelagos Management Ltd', 1, [L('M&A', C_AMBER)]],
    ['3100640', 'ARGAKI VENTURES LTD', '440655', 'certificate', 'Argaki Secretarial Ltd', 2, [L('Shareholders', C_BLUE)]],
    ['3100612', 'CYAN HARBOUR HOLDINGS LTD', '438771', 'new_company', 'Cyan Harbour Advisors Ltd', 6, [L('New Co', C_PURPLE)]],
    ['3100588', 'AKINITA SERVICES LTD', '431200', 'certificate', 'Halcyon Compliance Ltd', 4, [L('Certificates', C_AMBER)]],
    ['3100571', 'MERIDIAN TRUST CY LTD', '428115', 'other', 'Meridian Trust (CY) Ltd', 1, []],
    ['3100540', 'THALASSA SHIPPING LTD', '419887', 'certificate', 'Thalassa Corporate Ltd', 2, [L('Good Standing', C_AMBER)]],
    ['3100533', 'ORACLE PARTNERS LTD', '415663', 'certificate', 'Oracle Nominees Ltd', 3, [L('Directors', C_BLUE)]],
    ['3100510', 'HALCYON ESTATES LTD', '410042', 'other', 'Halcyon Compliance Ltd', 1, [L('Register Office', C_BLUE)]],
    ['3100498', 'KORYVANTES LTD', '404519', 'new_company', 'Aelius Corporate Ltd', 6, [L('New Co', C_PURPLE)]],
  ];
  const completed = completedNames.map(([order_id, company_name, he_number, service_type, roc_account, docs, labels], i) =>
    ord({ order_id, company_name, he_number, service_type, roc_account, labels,
      decision: 'accepted', status: 'completed', expected_documents: docs, files_downloaded: docs,
      completed_ts: iso((i + 1) * 47 * 60e3) }));

  // ── SETTINGS ──
  const settings = {
    theme_mode: 'dark', zoom_level: 1.4,
    display_name: 'Andreas Georgiou',
    download_directory: 'C:\\Users\\Andreas\\PandaRoc\\Downloads',
    notifications_enabled: true,
    accepted_account_order: ACCOUNTS.map(a => a.code),
    agent_account_order: ACCOUNTS.map(a => a.code),
    accounts: ACCOUNTS,
    label_presets: [
      L('New Co', C_PURPLE), L('Certificates', C_AMBER), L('Directors', C_BLUE),
      L('Shareholders', C_BLUE), L('Apostille', C_PURPLE), L('M&A', C_AMBER),
      L('Good Standing', C_TEAL), L('Register Office', C_BLUE),
    ],
    client_presets: ['Maria Koundourou', 'Andreou & Co', 'Stentoris Legal LLC', 'Stephanou Legal'],
    agent_a_headless: false, agent_b_headless: true,
    agent_b_interval_seconds: 420,
    finder_active_hours_enabled: true,
    finder_active_start_hour: 9, finder_active_end_hour: 18,
    finder_active_days: [0, 1, 2, 3, 4],
    download_folder_mode: 'organized',
    trello_enabled: false, trello_api_key: '', trello_has_token: false, trello_board_id: '',
    trello_sync_interval_seconds: 300,
    onboarding_completed: true,
    auto_update_enabled: true,
  };

  // ── STATUS ──
  const status = {
    accounts: 11,
    download_directory: 'C:\\Users\\Andreas\\PandaRoc\\Downloads',
    queue: { in_ekkremis: 5, ready_to_download: 22, completed: 105 },
    finder: { running: false },
    agent_b: { running: false },
    downloader: { state: 'idle', scheduler_enabled: true, interval_minutes: 120, next_run: isoIn(115 * 60e3) },
  };

  // ── ACTIVITY ──
  const activity = {
    version: 1,
    log: [
      { timestamp: iso(1 * 60e3), message: 'Order 3100694 (new company) removed from queue', level: 'INFO', agent: 'system' },
      { timestamp: iso(1 * 60e3 + 20e3), message: 'Order 3100694 (HE451900) removed from queue', level: 'INFO', agent: 'system' },
      { timestamp: iso(2 * 60e3), message: 'Downloaded 3 documents · NOSTOS CAPITAL LTD', level: 'SUCCESS', agent: 'downloader' },
      { timestamp: iso(4 * 60e3), message: 'New service found · KYMA DIGITAL LTD', level: 'INFO', agent: 'finder' },
      { timestamp: iso(5 * 60e3), message: 'Auto-Run schedule activated', level: 'INFO', agent: 'system' },
      { timestamp: iso(6 * 60e3), message: 'PandaRoc v8.4 started successfully', level: 'INFO', agent: 'system' },
    ],
  };

  // ── LICENSE ──
  const license = {
    licensed: true, status: 'active', pending: false, is_trial: false,
    customer_name: 'Andreas Georgiou', email: 'andreas@pandaserve.eu',
    slot_count: 25, days_remaining: null, plan_tier: 'firm',
  };

  // ── NAME CHECK ──
  const shortlist = {
    candidates: [
      { id: 'n1', name: 'PANDAROC LTD', normalized: 'PANDAROC LTD', score: 85, verdict: 'likely', registry_ran: true, has_consent: false },
      { id: 'n2', name: 'SEFORMA LTD', normalized: 'SEFORMA LTD', score: 85, verdict: 'likely', registry_ran: true, has_consent: false },
    ],
  };
  function nameResult(body, live) {
    const name = (body && body.name) || 'Zymex Labs';
    const isZymex = /zymex/i.test(name);
    if (isZymex) {
      return {
        name, normalized: 'ZYMEX LABS LTD',
        verdict: 'likely', score: 83,
        registry_note: live ? 'live' : 'pending', registry_ran: live,
        pillars: { distinctiveness: 0.08, collision: live ? 0.2 : 0.0, compliance: 0.0 },
        flags: [],
        crowding: { primary_overflow: false },
        closest: live ? [
          { name: 'ZYMEX ENTERPRISES LTD', reg_no: 'HE 421887', status: 'Registered', similarity: 0.34, reason: "shares the distinctive word 'ZYMEX'" },
          { name: 'ZYMA LABS LTD', reg_no: 'HE 388210', status: 'Registered', similarity: 0.27, reason: "similar to 'ZYMEX'" },
          { name: 'ZENITH LABS LTD', reg_no: 'HE 356104', status: 'Registered', similarity: 0.21, reason: "shares the word 'LABS'" },
        ] : [],
      };
    }
    return {
      name, normalized: (name || '').toUpperCase(),
      verdict: 'uncertain', score: 52,
      registry_note: live ? 'live' : 'pending', registry_ran: live,
      pillars: { distinctiveness: 0.3, collision: live ? 0.35 : 0.0, compliance: 0.0 },
      flags: [], crowding: { primary_overflow: false }, closest: [],
    };
  }

  // ── router ──
  function route(path, method, body) {
    if (path.startsWith('/health')) return path.includes('issues') ? { issues: [] } : { ok: true, ready: true };
    if (path === '/status') return status;
    if (path === '/queue') return { ekkremis, ready, completed };
    if (path.startsWith('/activity')) return activity;
    if (path === '/settings') return settings;
    if (path === '/license/status') return license;
    if (path.startsWith('/sync/status')) return { enabled: true, status: 'synced', last_sync: iso(33 * 60e3), last_sync_relative: '33m ago' };
    if (path === '/blocked-orders') return { blocked: [], blocked_orders: [] };
    if (path.startsWith('/settings/trello/status')) return { connected: false, enabled: false };
    if (path === '/settings/theme' && body && body.theme_mode) { settings.theme_mode = body.theme_mode; return { success: true }; }
    if (path.startsWith('/print/today')) return { count: 7, printed: 7, failed: 0 };
    if (path.startsWith('/print/order')) return { count: 3, printed: 3, failed: 0 };
    if (path === '/names') return shortlist;
    if (path === '/names/check') return nameResult(body, false);
    if (path === '/names/collision') return nameResult(body, true);
    // decisions actually mutate the seeded queue so the UI reflects them
    if (path === '/queue/decision' && body && body.order_id) {
      const o = [...ekkremis, ...ready].find(x => x.order_id === body.order_id);
      if (o) o.decision = body.decision;
      return { success: true, order_id: body.order_id };
    }
    if (path === '/queue/decision/bulk' && body && body.order_ids) {
      body.order_ids.forEach(id => { const o = [...ekkremis, ...ready].find(x => x.order_id === id); if (o) o.decision = body.decision; });
      return { success: true };
    }
    // generic acks for POST/PATCH/DELETE actions triggered during the demo
    return { success: true, ok: true };
  }

  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
    const apiIdx = url.indexOf('/api/');
    if (apiIdx === -1 && !url.includes('/api?')) {
      return origFetch(input, init); // static assets, fonts, etc.
    }
    let path = url.slice(apiIdx + 4); // strip '/api'
    const q = path.indexOf('?'); // keep query for /activity but match on base
    let body = null;
    try { if (init && init.body) body = JSON.parse(init.body); } catch (_) {}
    let data;
    try { data = route(path, method, body); }
    catch (e) { data = { success: true }; }
    const resp = new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return Promise.resolve(resp);
  };

  // pywebview is absent in browser mode; the app already guards for it.
  window.__PANDAROC_DEMO__ = true;
})();
