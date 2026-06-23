const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutQuart: (t) => 1 - --t * t * t * t,
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, f) => a + (b - a) * f;
function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const ef = Array.isArray(ease) ? ease[i] || Easing.linear : ease;
        return output[i] + (output[i + 1] - output[i]) * ef(local);
      }
    }
    return output[output.length - 1];
  };
}
const TimelineContext = React.createContext({ time: 0, duration: 10, playing: false });
const useTimeline = () => React.useContext(TimelineContext);
const useTime = () => React.useContext(TimelineContext).time;
const SpriteContext = React.createContext({ localTime: 0, progress: 0 });
const useSprite = () => React.useContext(SpriteContext);
function Sprite({ start = 0, end = Infinity, children }) {
  const { time } = useTimeline();
  if (time < start || time > end) return null;
  const duration = end - start, localTime = Math.max(0, time - start);
  const progress = duration > 0 && isFinite(duration) ? clamp(localTime / duration, 0, 1) : 0;
  return React.createElement(
    SpriteContext.Provider,
    { value: { localTime, progress, duration } },
    typeof children === "function" ? children({ localTime, progress, duration }) : children
  );
}
const MONO = "'JetBrains Mono',ui-monospace,monospace";
const SANS = "'Inter',system-ui,sans-serif";
const EMBER = "#d07959", EMBER_HI = "#e7a58c", INK = "#16140f", PAPER = "#f0ece7", MUTE = "#a09c98";
const VO = { title: 7.48, dashboard: 14.26, finder: 11.33, pending: 13.33, accepted: 17.09, completed: 15, namecheck: 15.14, settings: 12.82, end: 7.57 };
const GAP = 0.5, INTER = 2.8;
let _c = 0;
const at = {};
at.title = _c;
_c += VO.title + 0.45;
at.interA = _c;
_c += INTER;
at.dashboard = _c;
_c += VO.dashboard + GAP;
at.finder = _c;
_c += VO.finder + GAP;
at.interB = _c;
_c += INTER;
at.pending = _c;
_c += VO.pending + GAP;
at.accepted = _c;
_c += VO.accepted + GAP;
at.completed = _c;
_c += VO.completed + GAP;
at.interC = _c;
_c += INTER;
at.namecheck = _c;
_c += VO.namecheck + GAP;
at.interD = _c;
_c += INTER;
at.settings = _c;
_c += VO.settings + 2.6;
at.end = _c;
_c += VO.end + 1.4;
const TOTAL = _c;
const APP_IN = at.dashboard - 0.6, APP_OUT = at.end - 0.4;
const LINES = {
  title: ["If you manage Cyprus companies, downloading ROC certificates by hand eats your whole day.", "PandaRoc does it for you."],
  dashboard: ["This is your workspace.", "PandaRoc finds your new orders, waits for your decision,", "then watches each one and downloads every document the moment it is ready.", "Pending, accepted, completed. All in one place."],
  finder: ["The Finder logs into your ROC accounts on a schedule", "and brings every new order into your queue.", "It works at a human pace, so your accounts stay healthy", "and you never check the portal by hand again."],
  pending: ["Everything the Finder brings in lands here in Pending,", "grouped by account, each order showing the documents to expect.", "You stay in control.", "Approve an order and PandaRoc takes over, or reject the ones that are not yours."],
  accepted: ["Accepted orders are watched around the clock.", "Each badge shows how many documents are ready so far.", "If an order is a name approval, you see at once whether it was accepted or rejected.", "And PandaRoc flags anything that needs you, like a filing sent back for corrections."],
  completed: ["The moment ROC generates them, the documents download and land in your folder, named and organised.", "And when you need hard copies, one click on Print Today sends the whole day to your printer.", "Found, accepted, downloaded."],
  namecheck: ["Starting a new company?", "Before you file, Name Check tells you how likely the Registrar is to approve your name.", "It applies the naming rules, runs a live search of the registry,", "and shows the closest existing matches, so a weak name never costs you weeks."],
  settings: ["Setup is one screen.", "Add your ROC accounts, and your credentials are encrypted and kept only on this computer.", "They never leave it.", "Pick your download folder, choose light or dark, and you are done."],
  end: ["PandaRoc. Built in Cyprus, for the firms that live this every day.", "Start your free seven-day trial at pandaroc.com."]
};
const SUBS = [];
Object.keys(LINES).forEach((scene) => {
  const start = at[scene], dur = VO[scene], lines = LINES[scene];
  const tot = lines.reduce((s, l) => s + l.length, 0);
  let acc = 0;
  lines.forEach((l) => {
    const s = start + acc / tot * dur;
    acc += l.length;
    const e = start + acc / tot * dur;
    SUBS.push({ s: s + 0.05, e: e - 0.05, t: l });
  });
});
function Subtitles() {
  const time = useTime();
  const cur = SUBS.find((s) => time >= s.s && time <= s.e);
  if (!cur) return null;
  const fade = Math.min((time - cur.s) / 0.22, 1, (cur.e - time) / 0.22);
  return React.createElement(
    "div",
    { style: { position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", zIndex: 80, pointerEvents: "none", padding: "0 220px" } },
    React.createElement("div", { style: { maxWidth: 1200, textAlign: "center", fontFamily: SANS, fontSize: 34, lineHeight: 1.34, fontWeight: 600, color: "#fdf8f2", letterSpacing: "-0.01em", opacity: clamp(fade, 0, 1), textShadow: "0 2px 18px rgba(0,0,0,0.92), 0 1px 3px rgba(0,0,0,0.95)", transform: `translateY(${(1 - clamp(fade, 0, 1)) * 6}px)`, textWrap: "pretty" } }, cur.t)
  );
}
function CursorLive({ x, y, hidden, clicks, time }) {
  if (hidden) return null;
  let down = false, ripple = null;
  for (const c of clicks || []) {
    if (time >= c - 0.06 && time <= c + 0.16) down = true;
    if (time >= c && time <= c + 0.55) {
      const p = (time - c) / 0.55;
      ripple = { s: 0.3 + p * 1.6, o: (1 - p) * 0.5 };
    }
  }
  return React.createElement(
    "div",
    { style: { position: "absolute", left: x, top: y, zIndex: 60, pointerEvents: "none", transform: `translate(-4px,-2px) scale(${down ? 0.84 : 1})`, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.55))", transition: "transform 90ms ease-out" } },
    ripple && React.createElement("span", { style: { position: "absolute", left: 2, top: 2, width: 52, height: 52, marginLeft: -26, marginTop: -26, borderRadius: "50%", border: "3px solid rgba(219,108,64,0.92)", transform: `scale(${ripple.s})`, opacity: ripple.o } }),
    React.createElement(
      "svg",
      { width: 34, height: 34, viewBox: "0 0 24 24", style: { display: "block" } },
      React.createElement("path", { d: "M5 2.5l0 16.5 4.0-3.9 2.5 5.6 2.9-1.3-2.5-5.4 5.5 0z", fill: "#fff", stroke: "#1a1410", strokeWidth: 1.1, strokeLinejoin: "round" })
    )
  );
}
function nav(w, section) {
  try {
    w._applySectionSwap(section);
    w._afterSectionSwap(section);
  } catch (e) {
    try {
      w.switchSection(section);
    } catch (_) {
    }
  }
}
function rowById(doc, id) {
  const s = [...doc.querySelectorAll("td strong")].find((el) => el.textContent.trim() === id);
  return s ? s.closest("tr") : null;
}
function rectOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
}
function centerOn(w, sel) {
  try {
    const el = w.document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tgt = w.scrollY + r.top - (w.innerHeight / 2 - r.height / 2);
    w.scrollTo({ top: Math.max(0, tgt), behavior: "smooth" });
  } catch (e) {
  }
}
function centerRow(w, id) {
  try {
    const tr = rowById(w.document, id);
    if (!tr) return;
    const r = tr.getBoundingClientRect();
    const tgt = w.scrollY + r.top - (w.innerHeight / 2 - r.height / 2);
    w.scrollTo({ top: Math.max(0, tgt), behavior: "smooth" });
  } catch (e) {
  }
}
function typeName(w, text) {
  const inp = w.document.getElementById("nc-input");
  if (!inp) return;
  if (inp.value === text) {
    try {
      w.runNameCheck();
    } catch (e) {
    }
    return;
  }
  inp.value = "";
  let i = 0;
  const step = () => {
    if (!w.document.getElementById("nc-input")) return;
    inp.value = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 55);
    else {
      try {
        w.runNameCheck();
      } catch (e) {
      }
    }
  };
  step();
}
function resolvePoint(doc, spec) {
  if (!spec) return null;
  if (spec.x != null) return { x: spec.x, y: spec.y };
  let el = null;
  if (spec.approve) el = doc.querySelector(`button[onclick*="${spec.approve}"][onclick*="accepted"]`);
  else if (spec.docbadge) {
    const tr = rowById(doc, spec.docbadge);
    el = tr && (tr.querySelector(".chip.warn") || tr.querySelector(".chip") || tr);
  } else if (spec.rowById) {
    el = rowById(doc, spec.rowById);
  } else if (spec.sel) el = doc.querySelector(spec.sel);
  const r = rectOf(el);
  if (!r) return null;
  return { x: r.cx + (spec.dx || 0), y: r.cy + (spec.dy || 0) };
}
function resolveCam(doc, spec, fallback) {
  if (!spec) return fallback;
  if (spec.x != null) return { fx: spec.x, fy: spec.y, s: spec.s || 1 };
  const el = doc.querySelector(spec.sel);
  const r = rectOf(el);
  if (!r) return fallback;
  return { fx: r.cx + (spec.dx || 0), fy: r.cy + (spec.dy || 0), s: spec.s || 1 };
}
const FULL = { x: 960, y: 540, s: 1 };
const PILL_O = { x: 891, y: 41 }, PILL_N = { x: 1098, y: 41 }, COG = { x: 1685, y: 41 }, SEGBAR = { x: 326, y: 311 };
const BEATS = [
  // ══ DASHBOARD — hold the WHOLE app; never crop the full-width counters ══
  { t: at.dashboard - 0.5, app: (w) => {
    nav(w, "dashboard");
    w.scrollTo(0, 0);
  }, cam: FULL, cur: { hidden: true } },
  { t: at.dashboard + 2, cam: { x: 960, y: 505, s: 1.05 } },
  { t: at.dashboard + 9.6, app: (w) => w.scrollTo({ top: 0, behavior: "smooth" }), cam: FULL },
  // "all in one place" = everything visible
  // ══ FINDER (same screen, focus the Finder card) ══
  { t: at.finder + 0.2, app: (w) => centerOn(w, "#agent-b-card"), cam: { sel: "#agent-b-card", s: 1.32 }, cur: { hidden: true } },
  { t: at.finder + 6.5, cam: { sel: "#agent-b-card", s: 1.36 } },
  { t: at.finder + 9.6, app: (w) => w.scrollTo({ top: 0, behavior: "smooth" }), cam: { x: 960, y: 540, s: 1.1 } },
  // ══ PENDING — press Orders tab, then approve KYMA ══
  { t: at.pending + 0, cam: { x: PILL_O.x, y: PILL_O.y, s: 1.5 }, cur: { sel: '.top-nav-pill[data-section="orders"]' } },
  { t: at.pending + 1.4, app: (w) => {
    nav(w, "orders");
    try {
      w.switchSegment("ekkremis");
    } catch (e) {
    }
    w.scrollTo(0, 0);
  }, cam: { x: PILL_O.x, y: PILL_O.y, s: 1.5 }, cur: { sel: '.top-nav-pill[data-section="orders"]' }, click: true },
  { t: at.pending + 2.7, app: (w) => w.scrollTo(0, 0), cam: FULL, cur: { hidden: true } },
  { t: at.pending + 5.5, app: (w) => centerRow(w, "3100920"), cam: { rowById: "3100920", s: 1.3 }, cur: { hidden: true } },
  { t: at.pending + 8.2, app: (w) => centerRow(w, "3100920"), cam: { rowById: "3100920", s: 1.55 }, cur: { approve: "3100920" } },
  { t: at.pending + 10.8, app: (w) => {
    try {
      w.setDecision("3100920", "accepted");
      w.refreshQueue && w.refreshQueue(true);
    } catch (e) {
    }
  }, cam: { rowById: "3100920", s: 1.56 }, cur: { approve: "3100920" }, click: true },
  { t: at.pending + 12.4, cam: { rowById: "3100920", s: 1.42 }, cur: { hidden: true } },
  // ══ ACCEPTED — rise to the tab bar FIRST, then press Accepted ══
  { t: at.accepted + 0, app: (w) => w.scrollTo({ top: 0, behavior: "smooth" }), cam: { x: SEGBAR.x, y: SEGBAR.y, s: 1.22 }, cur: { hidden: true } },
  { t: at.accepted + 1.1, cam: { sel: '.segment-btn[data-segment="ready"]', s: 1.4 }, cur: { sel: '.segment-btn[data-segment="ready"]' } },
  { t: at.accepted + 2.3, app: (w) => {
    try {
      w.switchSegment("ready");
    } catch (e) {
    }
    w.scrollTo(0, 0);
  }, cam: { sel: '.segment-btn[data-segment="ready"]', s: 1.4 }, cur: { sel: '.segment-btn[data-segment="ready"]' }, click: true },
  { t: at.accepted + 3.6, app: (w) => w.scrollTo(0, 0), cam: FULL, cur: { hidden: true } },
  { t: at.accepted + 5.6, app: (w) => centerRow(w, "3099120"), cam: { rowById: "3099120", s: 1.5 }, cur: { docbadge: "3099120", dx: 20 } },
  { t: at.accepted + 9.6, app: (w) => centerRow(w, "3098661"), cam: { rowById: "3098661", s: 1.5 }, cur: { hidden: true } },
  { t: at.accepted + 13.4, app: (w) => centerRow(w, "3098990"), cam: { rowById: "3098990", s: 1.48 }, cur: { hidden: true } },
  // ══ COMPLETED — rise to the tab bar FIRST, then press Completed ══
  { t: at.completed + 0, app: (w) => w.scrollTo({ top: 0, behavior: "smooth" }), cam: { x: SEGBAR.x, y: SEGBAR.y, s: 1.22 }, cur: { hidden: true } },
  { t: at.completed + 1.1, cam: { sel: '.segment-btn[data-segment="completed"]', s: 1.4 }, cur: { sel: '.segment-btn[data-segment="completed"]' } },
  { t: at.completed + 2.3, app: (w) => {
    try {
      w.switchSegment("completed");
    } catch (e) {
    }
    w.scrollTo(0, 0);
  }, cam: { sel: '.segment-btn[data-segment="completed"]', s: 1.4 }, cur: { sel: '.segment-btn[data-segment="completed"]' }, click: true },
  { t: at.completed + 3.6, app: (w) => w.scrollTo(0, 0), cam: FULL, cur: { hidden: true } },
  { t: at.completed + 5.8, app: (w) => centerRow(w, "3100612"), cam: { rowById: "3100612", s: 1.36 }, cur: { hidden: true } },
  { t: at.completed + 8.8, app: (w) => w.scrollTo({ top: 0, behavior: "smooth" }), cam: { sel: 'button[onclick="printTodaysOrders()"]', s: 1.45 }, cur: { sel: 'button[onclick="printTodaysOrders()"]' } },
  { t: at.completed + 11, cam: { sel: 'button[onclick="printTodaysOrders()"]', s: 1.5 }, cur: { sel: 'button[onclick="printTodaysOrders()"]' }, click: true },
  { t: at.completed + 13, cam: FULL, cur: { hidden: true } },
  // ══ NAME CHECK — press tab, type, then read result (gentle, centered) ══
  { t: at.namecheck + 0, cam: { x: PILL_N.x, y: PILL_N.y, s: 1.5 }, cur: { sel: '.top-nav-pill[data-section="approvals"]' } },
  { t: at.namecheck + 1.4, app: (w) => {
    nav(w, "approvals");
    w.scrollTo(0, 0);
  }, cam: { x: PILL_N.x, y: PILL_N.y, s: 1.5 }, cur: { sel: '.top-nav-pill[data-section="approvals"]' }, click: true },
  { t: at.namecheck + 2.7, app: (w) => w.scrollTo(0, 0), cam: FULL, cur: { hidden: true } },
  { t: at.namecheck + 3.4, app: (w) => typeName(w, "Zymex Labs"), cam: { sel: "#nc-input", s: 1.24 }, cur: { sel: "#nc-input", dx: -220 } },
  { t: at.namecheck + 8, app: (w) => centerOn(w, ".nc-hero"), cam: { sel: ".nc-hero", s: 1.3 }, cur: { hidden: true } },
  // the 83 / Likely ring
  { t: at.namecheck + 12.2, app: (w) => centerOn(w, "#nc-closest"), cam: { sel: "#nc-closest", s: 1.26 } },
  // closest matches
  // ══ SETTINGS — press cog, accounts, theme flip, then RETURN to dashboard ══
  { t: at.settings + 0, cam: { x: COG.x, y: COG.y, s: 1.5 }, cur: { sel: "#nav-cog-btn" } },
  { t: at.settings + 1.2, app: (w) => {
    nav(w, "settings");
    try {
      w.switchSettingsPanel("accounts");
    } catch (e) {
    }
    w.scrollTo(0, 0);
  }, cam: { x: COG.x, y: COG.y, s: 1.5 }, cur: { sel: "#nav-cog-btn" }, click: true },
  { t: at.settings + 2.6, app: (w) => w.scrollTo(0, 0), cam: FULL, cur: { hidden: true } },
  { t: at.settings + 3.6, app: (w) => w.scrollTo(0, 0), cam: { x: 1050, y: 640, s: 1.28 }, cur: { hidden: true } },
  // ROC accounts (encrypted, on this machine)
  { t: at.settings + 7.8, app: (w) => w.scrollTo(0, 0), cam: { sel: '.settings-nav-link[data-panel="appearance"]', s: 1.35 }, cur: { sel: '.settings-nav-link[data-panel="appearance"]' } },
  { t: at.settings + 8.6, app: (w) => {
    try {
      w.switchSettingsPanel("appearance");
    } catch (e) {
    }
    w.scrollTo(0, 0);
  }, cam: { sel: '.settings-nav-link[data-panel="appearance"]', s: 1.35 }, cur: { sel: '.settings-nav-link[data-panel="appearance"]' }, click: true },
  { t: at.settings + 9.7, app: (w) => w.scrollTo(0, 0), cam: { sel: "#theme-light-btn", s: 1.4 }, cur: { sel: "#theme-light-btn" } },
  { t: at.settings + 10.7, app: (w) => {
    try {
      w.setTheme("light");
    } catch (e) {
    }
  }, cam: { sel: "#theme-light-btn", s: 1.46 }, cur: { sel: "#theme-light-btn" }, click: true },
  { t: at.settings + 12.2, app: (w) => {
    try {
      w.setTheme("light");
    } catch (e) {
    }
    nav(w, "dashboard");
    w.scrollTo(0, 0);
  }, cam: { x: 960, y: 505, s: 1.05 }, cur: { hidden: true } },
  // back to dashboard (now light)
  { t: at.settings + 13.4, cam: FULL }
];
function resetCanonical(w) {
  try {
    w.setTheme("dark");
  } catch (e) {
  }
  try {
    w.setDecision("3100920", "undecided");
  } catch (e) {
  }
  try {
    const inp = w.document.getElementById("nc-input");
    if (inp) {
      inp.value = "";
    }
  } catch (e) {
  }
  try {
    nav(w, "dashboard");
    w.scrollTo(0, 0);
  } catch (e) {
  }
}
function DemoApp({ time, active }) {
  const frRef = React.useRef(null);
  const S = React.useRef(null);
  if (!S.current) S.current = { idx: 0, lastT: -1, loaded: false, cam: { ...FULL, fx: 960, fy: 540 }, camT: { s: 1, fx: 960, fy: 540 }, cur: { x: 980, y: 600 }, curT: { x: 980, y: 600, hidden: true }, clicks: [], camSpec: FULL, curSpec: { hidden: true } };
  const st = S.current;
  const applyBeat = (w2, b) => {
    if (b.app) {
      try {
        b.app(w2);
      } catch (e) {
      }
    }
    if (b.cam) st.camSpec = b.cam;
    if (b.cur) st.curSpec = b.cur;
  };
  const replayTo = (w2, t) => {
    resetCanonical(w2);
    st.idx = 0;
    st.clicks = [];
    let i = 0;
    while (i < BEATS.length && t >= BEATS[i].t) {
      applyBeat(w2, BEATS[i]);
      if (BEATS[i].click) st.clicks.push(BEATS[i].t);
      i++;
    }
    st.idx = i;
    const c = resolveCam(w2.document, st.camSpec, { fx: 960, fy: 540, s: 1 });
    st.camT = { s: c.s, fx: c.fx, fy: c.fy };
    st.cam = { ...st.camT };
    if (st.curSpec.hidden) {
      st.curT = { ...st.curT, hidden: true };
    } else {
      const p = resolvePoint(w2.document, st.curSpec);
      if (p) {
        st.curT = { x: p.x, y: p.y, hidden: false };
        st.cur = { x: p.x, y: p.y };
      }
    }
  };
  const onLoad = () => {
    st.loaded = true;
    const w2 = frRef.current && frRef.current.contentWindow;
    if (!w2) return;
    replayTo(w2, time);
    st.lastT = time;
  };
  const w = frRef.current && frRef.current.contentWindow;
  if (w && st.loaded && active) {
    if (time < st.lastT - 0.5) {
      replayTo(w, time);
    } else {
      while (st.idx < BEATS.length && time >= BEATS[st.idx].t) {
        const b = BEATS[st.idx];
        applyBeat(w, b);
        if (b.click) {
          st.clicks.push(b.t);
          if (st.clicks.length > 6) st.clicks.shift();
        }
        st.idx++;
      }
    }
    st.lastT = time;
    const c = resolveCam(w.document, st.camSpec, st.camT);
    st.camT = { s: c.s, fx: c.fx, fy: c.fy };
    if (st.curSpec.hidden) {
      st.curT = { ...st.curT, hidden: true };
    } else {
      const p = resolvePoint(w.document, st.curSpec);
      if (p) {
        st.curT = { x: p.x, y: p.y, hidden: false };
      }
    }
  }
  st.cam.s = lerp(st.cam.s, st.camT.s, 0.06);
  st.cam.fx = lerp(st.cam.fx, st.camT.fx, 0.06);
  st.cam.fy = lerp(st.cam.fy, st.camT.fy, 0.06);
  st.cur.x = lerp(st.cur.x, st.curT.x, 0.14);
  st.cur.y = lerp(st.cur.y, st.curT.y, 0.14);
  st.clicks = st.clicks.filter((c) => time >= c - 1 && time <= c + 1.4);
  const appOpacity = clamp((time - APP_IN) / 0.6, 0, 1) * clamp((APP_OUT + 0.4 - time) / 0.5, 0, 1);
  const s = st.cam.s;
  const tx = clamp(960 - st.cam.fx * s, 1920 * (1 - s), 0);
  const ty = clamp(540 - st.cam.fy * s, 1080 * (1 - s), 0);
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, overflow: "hidden", opacity: appOpacity, pointerEvents: "none", background: INK } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 0, left: 0, width: 1920, height: 1080, transform: `translate(${tx}px,${ty}px) scale(${s})`, transformOrigin: "0 0", willChange: "transform" } }, /* @__PURE__ */ React.createElement(
    "iframe",
    {
      ref: frRef,
      src: "realapp.html",
      onLoad,
      title: "PandaRoc",
      style: { width: 1920, height: 1080, border: "none", display: "block", background: INK }
    }
  ), /* @__PURE__ */ React.createElement(CursorLive, { x: st.cur.x, y: st.cur.y, hidden: st.curT.hidden, clicks: st.clicks, time })));
}
function Grain() {
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, backgroundImage: "url('assets/grain-body.svg')", backgroundSize: "200px 200px", opacity: 0.09, mixBlendMode: "soft-light", pointerEvents: "none" } });
}
function Eyebrow({ children, intro }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "inline-flex", alignItems: "center", gap: 11, fontFamily: MONO, fontSize: 16, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: EMBER, opacity: intro, transform: `translateY(${(1 - intro) * 8}px)` } }, /* @__PURE__ */ React.createElement("span", { style: { width: 26, height: 1, background: "currentColor", opacity: 0.55 } }), children);
}
function Headline({ pre, em, post, intro }) {
  return /* @__PURE__ */ React.createElement("h1", { style: { fontFamily: SANS, fontSize: 96, lineHeight: 0.96, letterSpacing: "-0.04em", fontWeight: 800, color: PAPER, margin: "26px 0 0", maxWidth: "17ch", textWrap: "balance", opacity: intro, transform: `translateY(${(1 - intro) * 22}px) scale(${0.985 + intro * 0.015})` } }, pre, /* @__PURE__ */ React.createElement("span", { style: { background: `linear-gradient(180deg,${EMBER_HI},${EMBER})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, em), post);
}
function Interstitial({ eyebrow, pre, em, post }) {
  const { localTime: lt, duration } = useSprite();
  const eyeIntro = Easing.easeOutCubic(clamp(lt / 0.38, 0, 1));
  const headIntro = Easing.easeOutCubic(clamp((lt - 0.14) / 0.5, 0, 1));
  const out = clamp((duration - lt) / 0.4, 0, 1);
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 18%, #2a211c 0%, ${INK} 62%, #0e0c08 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: out, fontFamily: SANS } }, /* @__PURE__ */ React.createElement(Grain, null), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 2, padding: "0 80px", display: "flex", flexDirection: "column", alignItems: "center" } }, /* @__PURE__ */ React.createElement(Eyebrow, { intro: eyeIntro }, eyebrow), /* @__PURE__ */ React.createElement(Headline, { pre, em, post, intro: headIntro })));
}
function TitleCard() {
  const { localTime: lt, duration } = useSprite();
  const logoIn = Easing.easeOutCubic(clamp(lt / 0.9, 0, 1));
  const wordIn = Easing.easeOutCubic(clamp((lt - 0.5) / 0.9, 0, 1));
  const subIn = clamp((lt - 1.5) / 1, 0, 1);
  const out = clamp((duration - lt) / 0.5, 0, 1);
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 36%, #2a211c 0%, ${INK} 60%, #0d0a08 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: out, fontFamily: SANS } }, /* @__PURE__ */ React.createElement(Grain, null), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" } }, /* @__PURE__ */ React.createElement("img", { src: "assets/logo.png", width: 148, height: 148, style: { opacity: logoIn, transform: `translateY(${(1 - logoIn) * 24}px) scale(${0.9 + logoIn * 0.1})`, marginBottom: 32, filter: "drop-shadow(0 12px 34px rgba(0,0,0,0.55))" } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 88, fontWeight: 800, letterSpacing: "-0.03em", opacity: wordIn, transform: `translateY(${(1 - wordIn) * 14}px)` } }, /* @__PURE__ */ React.createElement("span", { style: { color: EMBER } }, "Panda"), /* @__PURE__ */ React.createElement("span", { style: { color: PAPER } }, "Roc")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 20, fontSize: 25, color: MUTE, fontFamily: MONO, letterSpacing: "0.04em", opacity: subIn } }, "Cyprus ROC certificates, downloaded for you.")));
}
function EndCard() {
  const { localTime: lt, duration } = useSprite();
  const intro = Easing.easeOutCubic(clamp(lt / 0.8, 0, 1));
  const row = (d) => clamp((lt - d) / 0.6, 0, 1);
  const out = clamp((duration - lt) / 0.5, 0, 1);
  const tiers = [["Starter", "\u20AC29", "1 account"], ["Small Firm", "\u20AC99", "5 accounts"], ["Professional", "\u20AC179", "10 accounts"], ["Firm", "\u20AC299", "20 accounts"]];
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 30%, #2a211c 0%, ${INK} 62%, #0d0a08 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: SANS, color: PAPER, opacity: out } }, /* @__PURE__ */ React.createElement(Grain, null), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" } }, /* @__PURE__ */ React.createElement("img", { src: "assets/logo.png", width: 104, height: 104, style: { opacity: intro, transform: `translateY(${(1 - intro) * 18}px)`, marginBottom: 18, filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.5))" } }), /* @__PURE__ */ React.createElement("h1", { style: { fontSize: 68, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, margin: 0, opacity: intro, textAlign: "center" } }, "Built where the ", /* @__PURE__ */ React.createElement("span", { style: { background: `linear-gradient(180deg,${EMBER_HI},${EMBER})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, "paperwork is.")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 38, display: "flex", gap: 14, opacity: row(1.2) } }, tiers.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { padding: "20px 26px", borderRadius: 14, background: "rgba(255,255,255,0.035)", border: "1px solid #33312b", textAlign: "center", minWidth: 158 } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTE } }, p[0]), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 9, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: PAPER } }, p[1], /* @__PURE__ */ React.createElement("span", { style: { fontSize: 15, color: MUTE, fontWeight: 500, fontFamily: MONO } }, "/mo")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 5, fontFamily: MONO, fontSize: 11, color: MUTE } }, p[2])))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 30, display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 18px", borderRadius: 999, background: "rgba(123,180,73,0.12)", border: "1px solid rgba(123,180,73,0.26)", color: "#8ec45a", fontFamily: MONO, fontSize: 14, letterSpacing: "0.04em", opacity: row(2) } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "#8ec45a" } }), "Every plan includes a free 7-day trial"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 26, fontSize: 30, fontWeight: 700, color: EMBER, letterSpacing: "0.01em", opacity: row(2.8) } }, "pandaroc.com")));
}
const AUDIO = [
  ["title", at.title],
  ["dashboard", at.dashboard],
  ["finder", at.finder],
  ["pending", at.pending],
  ["accepted", at.accepted],
  ["completed", at.completed],
  ["namecheck", at.namecheck],
  ["settings", at.settings],
  ["end", at.end]
];
function AudioLayer() {
  const { time, playing } = useTimeline();
  const refs = React.useRef({});
  const musicRef = React.useRef(null);
  const cur = React.useRef(null);
  React.useEffect(() => {
    const active = AUDIO.find(([k, s]) => time >= s && time < s + VO[k]);
    const els = refs.current;
    const mu = musicRef.current;
    if (mu) {
      mu.volume = 0.06;
      if (playing) {
        if (mu.paused) mu.play().catch(() => {
        });
      } else if (!mu.paused) {
        mu.pause();
      }
    }
    if (!playing) {
      Object.values(els).forEach((a) => a && !a.paused && a.pause());
      cur.current = null;
      return;
    }
    const key = active ? active[0] : null;
    Object.entries(els).forEach(([k, a]) => {
      if (a && k !== key && !a.paused) a.pause();
    });
    if (key) {
      const a = els[key], start = active[1], want = time - start;
      if (cur.current !== key) {
        try {
          a.currentTime = Math.max(0, want);
        } catch (e) {
        }
        a.play().catch(() => {
        });
        cur.current = key;
      } else {
        if (Math.abs(a.currentTime - want) > 0.28) {
          try {
            a.currentTime = Math.max(0, want);
          } catch (e) {
          }
        }
        if (a.paused) a.play().catch(() => {
        });
      }
    } else cur.current = null;
  }, [time, playing]);
  return /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", width: 0, height: 0, overflow: "hidden" } }, AUDIO.map(([k]) => /* @__PURE__ */ React.createElement("audio", { key: k, ref: (el) => refs.current[k] = el, src: `audio/${k}.mp3`, preload: "auto" })));
}
function IconButton({ children, onClick, title }) {
  const [h, setH] = React.useState(false);
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      title,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: h ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f6f4ef", cursor: "pointer", padding: 0 }
    },
    children
  );
}
function PlaybackBar({ time, duration, playing, muted, onPlayPause, onReset, onSeek, onHover, onMute }) {
  const trackRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const tFromE = React.useCallback((e) => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1) * duration;
  }, [duration]);
  React.useEffect(() => {
    if (!drag) return;
    const up = () => setDrag(false);
    const mv = (e) => {
      if (trackRef.current) onSeek(tFromE(e));
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", mv);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", mv);
    };
  }, [drag, tFromE, onSeek]);
  const pct = duration > 0 ? time / duration * 100 : 0;
  const fmt = (t) => {
    const m = Math.floor(Math.max(0, t) / 60), s = Math.floor(Math.max(0, t) % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: "rgba(20,18,15,0.94)", borderTop: "1px solid rgba(255,255,255,0.08)", width: "100%", maxWidth: 780, alignSelf: "center", borderRadius: 8, color: "#f6f4ef", fontFamily: SANS, userSelect: "none", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(IconButton, { onClick: onReset, title: "Restart (0)" }, /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none" }, /* @__PURE__ */ React.createElement("path", { d: "M3 2v10M12 2L5 7l7 5V2z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", strokeLinecap: "round" }))), /* @__PURE__ */ React.createElement(IconButton, { onClick: onPlayPause, title: "Play/pause (space)" }, playing ? /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 14 14" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "2", width: "3", height: "10", fill: "currentColor" }), /* @__PURE__ */ React.createElement("rect", { x: "8", y: "2", width: "3", height: "10", fill: "currentColor" })) : /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 14 14" }, /* @__PURE__ */ React.createElement("path", { d: "M3 2l9 5-9 5V2z", fill: "currentColor" }))), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: MONO, fontSize: 12, fontVariantNumeric: "tabular-nums", width: 52, textAlign: "right" } }, fmt(time)), /* @__PURE__ */ React.createElement("div", { ref: trackRef, onMouseMove: (e) => {
    if (!trackRef.current) return;
    drag ? onSeek(tFromE(e)) : onHover(tFromE(e));
  }, onMouseLeave: () => !drag && onHover(null), onMouseDown: (e) => {
    setDrag(true);
    onSeek(tFromE(e));
    onHover(null);
  }, style: { flex: 1, height: 22, position: "relative", cursor: "pointer", display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.13)", borderRadius: 2 } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", left: 0, width: `${pct}%`, height: 4, background: EMBER, borderRadius: 2 } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", left: `${pct}%`, top: "50%", width: 12, height: 12, marginLeft: -6, marginTop: -6, background: "#fff", borderRadius: 6, boxShadow: "0 2px 4px rgba(0,0,0,0.4)" } })), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: MONO, fontSize: 12, fontVariantNumeric: "tabular-nums", width: 52, color: "rgba(246,244,239,0.55)" } }, fmt(duration)), /* @__PURE__ */ React.createElement(IconButton, { onClick: onMute, title: "Mute/unmute voiceover" }, muted ? /* @__PURE__ */ React.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("path", { d: "M11 5 6 9H2v6h4l5 4V5z" }), /* @__PURE__ */ React.createElement("path", { d: "m23 9-6 6M17 9l6 6" })) : /* @__PURE__ */ React.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("path", { d: "M11 5 6 9H2v6h4l5 4V5z" }), /* @__PURE__ */ React.createElement("path", { d: "M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" }))));
}
function Stage({ duration, children }) {
  const W = 1920, H = 1080, persistKey = "pandaroc-demo";
  const autoStart = (() => {
    try {
      return new URLSearchParams(location.search).has("autoplay");
    } catch (e) {
      return false;
    }
  })();
  const [time, setTime] = React.useState(() => {
    if (autoStart) return 0;
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ":t") || "0");
      return isFinite(v) ? clamp(v, 0, duration) : 0;
    } catch {
      return 0;
    }
  });
  const [playing, setPlaying] = React.useState(autoStart);
  const [muted, setMuted] = React.useState(false);
  const [ctrlVis, setCtrlVis] = React.useState(true);
  const idleRef = React.useRef(null);
  const [hoverTime, setHoverTime] = React.useState(null);
  const [scale, setScale] = React.useState(1);
  const stageRef = React.useRef(null), rafRef = React.useRef(null), lastRef = React.useRef(null);
  React.useEffect(() => {
    try {
      localStorage.setItem(persistKey + ":t", String(time));
    } catch {
    }
  }, [time]);
  React.useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const m = () => {
      const s = Math.min(el.clientWidth / W, (el.clientHeight - 46) / H);
      setScale(Math.max(0.05, s));
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return;
    }
    const step = (ts) => {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1e3;
      lastRef.current = ts;
      setTime((t) => {
        let n = t + dt;
        if (n >= duration) {
          n = duration;
          setPlaying(false);
        }
        return n;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, duration]);
  React.useEffect(() => {
    const k = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowLeft") {
        setTime((t) => clamp(t - (e.shiftKey ? 5 : 0.5), 0, duration));
      } else if (e.code === "ArrowRight") {
        setTime((t) => clamp(t + (e.shiftKey ? 5 : 0.5), 0, duration));
      } else if (e.key === "0" || e.code === "Home") {
        setTime(0);
      } else if (e.key === "c" || e.key === "C") {
        setCtrlVis((v) => !v);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [duration]);
  React.useEffect(() => {
    const onMove = () => {
      setCtrlVis(true);
      if (idleRef.current) clearTimeout(idleRef.current);
      if (playing) idleRef.current = setTimeout(() => setCtrlVis(false), 1800);
    };
    window.addEventListener("mousemove", onMove);
    if (playing) {
      idleRef.current = setTimeout(() => setCtrlVis(false), 1800);
    } else setCtrlVis(true);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [playing]);
  const displayTime = hoverTime != null ? hoverTime : time;
  const ctx = React.useMemo(() => ({ time: displayTime, duration, playing: playing && hoverTime == null && !muted }), [displayTime, duration, playing, hoverTime, muted]);
  return /* @__PURE__ */ React.createElement("div", { ref: stageRef, style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", background: "#000", fontFamily: SANS } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { width: W, height: H, background: INK, position: "relative", transform: `scale(${scale})`, transformOrigin: "center", flexShrink: 0, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" } }, /* @__PURE__ */ React.createElement(TimelineContext.Provider, { value: ctx }, children))), /* @__PURE__ */ React.createElement("div", { style: { height: 46, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", opacity: ctrlVis ? 1 : 0, transition: "opacity .35s", pointerEvents: ctrlVis ? "auto" : "none" } }, /* @__PURE__ */ React.createElement(
    PlaybackBar,
    {
      time: displayTime,
      duration,
      playing,
      muted,
      onPlayPause: () => setPlaying((p) => !p),
      onReset: () => setTime(0),
      onSeek: setTime,
      onHover: setHoverTime,
      onMute: () => setMuted((m) => !m)
    }
  )));
}
function Root() {
  const { time } = useTimeline();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(DemoApp, { time, active: time >= APP_IN && time <= APP_OUT + 0.5 }), /* @__PURE__ */ React.createElement(Sprite, { start: 0, end: at.interA - 1e-3 }, /* @__PURE__ */ React.createElement(TitleCard, null)), /* @__PURE__ */ React.createElement(Sprite, { start: at.interA, end: at.dashboard - 1e-3 }, /* @__PURE__ */ React.createElement(Interstitial, { eyebrow: "The problem", pre: "Hours of ROC clicks, ", em: "done in minutes." })), /* @__PURE__ */ React.createElement(Sprite, { start: at.interB, end: at.pending - 1e-3 }, /* @__PURE__ */ React.createElement(Interstitial, { eyebrow: "What it does", pre: "You decide what to accept. ", em: "We handle the rest." })), /* @__PURE__ */ React.createElement(Sprite, { start: at.interC, end: at.namecheck - 1e-3 }, /* @__PURE__ */ React.createElement(Interstitial, { eyebrow: "Before you file", pre: "Check a name ", em: "before you commit." })), /* @__PURE__ */ React.createElement(Sprite, { start: at.interD, end: at.settings - 1e-3 }, /* @__PURE__ */ React.createElement(Interstitial, { eyebrow: "Private by design", pre: "Your data never leaves ", em: "your computer." })), /* @__PURE__ */ React.createElement(Sprite, { start: at.end, end: TOTAL }, /* @__PURE__ */ React.createElement(EndCard, null)), /* @__PURE__ */ React.createElement(Subtitles, null), /* @__PURE__ */ React.createElement(AudioLayer, null));
}
function PandaRocDemo() {
  return React.createElement(Stage, { duration: TOTAL }, React.createElement(Root));
}
window.PandaRocDemo = PandaRocDemo;
if (typeof module !== "undefined") module.exports = { PandaRocDemo };
