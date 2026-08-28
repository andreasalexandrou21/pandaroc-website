// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
const io = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target);} }); }, { threshold:0.1 });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const progress = document.getElementById('scrollProgress');
const tocLinks = [...document.querySelectorAll('.toc a')];
const heads = tocLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
function onScroll(){
  const y=window.scrollY, h=document.documentElement.scrollHeight-window.innerHeight;
  if(progress) progress.style.width=Math.min(100,(y/Math.max(h,1))*100)+'%';
  let active=heads[0];
  heads.forEach(hd=>{ if(hd.getBoundingClientRect().top <= 130) active=hd; });
  tocLinks.forEach(a=>a.classList.toggle('active', active && a.getAttribute('href')==='#'+active.id));
}
window.addEventListener('scroll', onScroll, { passive:true }); onScroll();
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.nav-links').classList.remove('open')));
