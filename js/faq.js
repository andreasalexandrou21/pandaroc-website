// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
const io = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target);} }); }, { threshold:0.12 });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const progress = document.getElementById('scrollProgress');
window.addEventListener('scroll', ()=>{ const y=window.scrollY, h=document.documentElement.scrollHeight-window.innerHeight; if(progress) progress.style.width=Math.min(100,(y/Math.max(h,1))*100)+'%'; }, { passive:true });

// accordion
document.querySelectorAll('.faq-q').forEach(q=>{
  q.addEventListener('click', ()=>{
    const item = q.parentElement;
    const a = item.querySelector('.faq-a');
    const open = item.classList.contains('open');
    if (open){ item.classList.remove('open'); a.style.maxHeight = '0px'; }
    else { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
  });
});

// search filter
const search = document.getElementById('faqSearch');
const items = [...document.querySelectorAll('.faq-item')];
const groups = [...document.querySelectorAll('[data-group]')];
const noRes = document.getElementById('noResults');
search.addEventListener('input', ()=>{
  const term = search.value.trim().toLowerCase();
  let any = false;
  items.forEach(it=>{
    const t = it.textContent.toLowerCase();
    const match = !term || t.includes(term);
    it.style.display = match ? '' : 'none';
    if (match) any = true;
  });
  groups.forEach(g=>{
    let sib = g.nextElementSibling, visible=false;
    while (sib && sib.classList.contains('faq-item')){ if(sib.style.display!=='none') visible=true; sib=sib.nextElementSibling; }
    g.style.display = (!term || visible) ? '' : 'none';
  });
  noRes.style.display = any ? 'none' : '';
});
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.nav-links').classList.remove('open')));
