// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal
const io = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target);} }); }, { threshold:0.14, rootMargin:'0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Node reveal (card + viz slide in)
const nodes = [...document.querySelectorAll('.node')];
const nio = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); } }); }, { threshold:0.3 });
nodes.forEach(n=>nio.observe(n));

// Name-check ring count-up
const ring = document.getElementById('ncRing');
const scoreEl = document.getElementById('ncScore');
let ringDone = false;
const rio = new IntersectionObserver((es)=>{
  es.forEach(e=>{
    if(e.isIntersecting && !ringDone){
      ringDone = true;
      const target = 92;
      if (reduce){ ring.style.setProperty('--p', target); scoreEl.textContent = target; return; }
      ring.style.setProperty('--p', target);
      let n = 0;
      const step = ()=>{ n += 2; if(n>=target){ n=target; } scoreEl.textContent = n; if(n<target) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  });
}, { threshold:0.5 });
if (ring) rio.observe(ring);

// Scroll-fill rail + comet + light nodes
const rail = document.getElementById('rail');
const railFill = document.getElementById('railFill');
const comet = document.getElementById('comet');
let ticking=false;
function pipeScroll(){
  if (ticking) return; ticking=true;
  requestAnimationFrame(()=>{
    if (rail){
      const r = rail.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.55;
      const prog = Math.min(Math.max((start - r.top) / r.height, 0), 1);
      const h = prog * r.height;
      railFill.style.height = h + 'px';
      if (prog > 0 && prog < 1){ comet.style.opacity = '1'; comet.style.top = h + 'px'; }
      else { comet.style.opacity='0'; }
      nodes.forEach(n=>{
        const d = n.querySelector('.node-dot').getBoundingClientRect();
        const lit = (d.top + d.height/2) <= start + 4;
        n.classList.toggle('lit', lit);
      });
    }
    ticking=false;
  });
}
window.addEventListener('scroll', pipeScroll, { passive:true });
window.addEventListener('resize', pipeScroll);
pipeScroll();

// Staggered child reveal
const sio = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ const kids=[...e.target.children]; kids.forEach((k,i)=>{ k.style.transitionDelay=(i*80)+'ms'; }); e.target.classList.add('visible'); sio.unobserve(e.target);} }); }, { threshold:0.2 });
document.querySelectorAll('.stagger').forEach(el=>sio.observe(el));

// Count-up stats
const cio = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ const t=+e.target.dataset.count; if(reduce||t===0){ e.target.textContent=t; cio.unobserve(e.target); return; } let n=0; const inc=Math.max(1,Math.ceil(t/14)); const step=()=>{ n+=inc; if(n>=t)n=t; e.target.textContent=n; if(n<t) requestAnimationFrame(step); }; requestAnimationFrame(step); cio.unobserve(e.target);} }); }, { threshold:0.6 });
document.querySelectorAll('.cv[data-count]').forEach(el=>cio.observe(el));

// ── Unified scroll-motion loop (progress, parallax, hero depth, curve drift) ──
const progress = document.getElementById('scrollProgress');
const heroFrame = document.querySelector('.hero-frame');
const heroGlow = document.querySelector('.hero-glow');
const flowField = document.getElementById('flowField');
const parallaxEls = [...document.querySelectorAll('[data-parallax]')];
let sticking=false;
function motionLoop(){
  if (sticking) return; sticking=true;
  requestAnimationFrame(()=>{
    const y = window.scrollY, vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.width = Math.min(100, (y/Math.max(docH,1))*100) + '%';
    if (!reduce){
      // hero: lift + recede in 3D as it scrolls away
      if (y < vh){
        const p = y / vh;
        if (heroFrame) heroFrame.style.transform = `translateY(${y*0.05}px) rotateX(${p*6}deg) scale(${1 - p*0.04})`;
        if (heroGlow) heroGlow.style.transform = `translateX(-50%) translateY(${y*0.16}px)`;
      }
      // generic vertical parallax for in-view decorative layers
      parallaxEls.forEach(el=>{
        const sp = parseFloat(el.dataset.parallax)||0;
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh+200) return;
        const center = r.top + r.height/2 - vh/2;
        el.style.transform = `translateY(${-center*sp}px)`;
      });
    }
    sticking=false;
  });
}
window.addEventListener('scroll', motionLoop, { passive:true });
window.addEventListener('resize', motionLoop);
motionLoop();

document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.nav-links').classList.remove('open')));

// Every success path here navigates away, so the button is left disabled on
// purpose. Back/forward then restores the page from the bfcache with the DOM
// exactly as it was, leaving that button reading "Redirecting…" and, worse,
// still pointer-events:none, so it is unclickable until a hard reload.
// pageshow fires on both a fresh load and a bfcache restore, so reset there.
function restoreCheckoutButtons(){
  document.querySelectorAll('[data-checkout-label]').forEach(b => {
    b.textContent = b.dataset.checkoutLabel;
    b.style.pointerEvents = '';
    delete b.dataset.checkoutLabel;
  });
}
window.addEventListener('pageshow', restoreCheckoutButtons);

// ── Stripe checkout (quantity = ROC account slots; trial optional) ──
// PANDAROC_API + authFetch come from auth.js. The license server holds the per-account price.
async function startCheckout(quantity, trial){
  const qty = Math.max(1, Math.min(20, parseInt(quantity, 10) || 1));
  trial = !!trial;
  // `this` is the clicked element (see js/actions.js). The old implicit-global
  // `event` sniff resolved to `document` once these moved off inline onclick,
  // and the next line then threw on document.style.
  const btn = (this && this.nodeType === 1) ? this : null;
  const original = btn ? btn.textContent : '';
  if (btn){ btn.dataset.checkoutLabel = original; btn.style.pointerEvents = 'none'; btn.textContent = 'Redirecting…'; }
  try {
    const successUrl = window.location.origin + '/success.html' + (trial ? '?trial=1' : '');
    const res = await authFetch('/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, trial: trial, success_url: successUrl, cancel_url: window.location.origin + '/cancel.html' }),
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      if (res.status === 401){
        // Not logged in: remember the intent and create the account first.
        localStorage.setItem('pandaroc_pending_qty', String(qty));
        localStorage.setItem('pandaroc_pending_trial', trial ? '1' : '0');
        window.location.href = 'register.html';
        return;
      }
      if (res.status === 403){
        // Logged in but email not yet confirmed: the account page runs the verify-first flow.
        window.location.href = 'account.html';
        return;
      }
      throw new Error(err.detail || 'Checkout failed');
    }
    const data = await res.json();
    window.location.href = data.checkout_url;
  } catch (e){
    alert(e.message || 'Could not start checkout. Please try again.');
    restoreCheckoutButtons();
  }
}
