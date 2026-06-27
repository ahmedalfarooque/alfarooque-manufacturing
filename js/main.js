/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — MAIN JS v5.0
   Preloader · Nav · Reveal · Counters · Gallery · Cursor · Form
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const $ = (s,c=document) => c.querySelector(s);
const $$ = (s,c=document) => [...c.querySelectorAll(s)];

/* ═══ PRELOADER ═══ */
(function(){
  const pl = $('#preloader');
  if(!pl) return;
  window.addEventListener('load',()=>{
    setTimeout(()=>pl.classList.add('done'),900);
    setTimeout(()=>pl.remove(),1700);
  });
})();

/* ═══ SCROLL PROGRESS ═══ */
(function(){
  const bar = $('#progress-bar');
  if(!bar) return;
  let ticking=false;
  window.addEventListener('scroll',()=>{
    if(ticking) return; ticking=true;
    requestAnimationFrame(()=>{
      ticking=false;
      const h = document.documentElement;
      const pct = (h.scrollTop/(h.scrollHeight-h.clientHeight))*100;
      bar.style.width = pct+'%';
    });
  },{passive:true});
})();

/* ═══ CURSOR GLOW ═══ */
(function(){
  const cg = $('#cursor-glow');
  if(!cg||window.innerWidth<768) return;
  let tx=0,ty=0,cx=0,cy=0;
  document.addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;},{passive:true});
  (function raf(){
    cx += (tx-cx)*0.08; cy += (ty-cy)*0.08;
    cg.style.left=cx+'px'; cg.style.top=cy+'px';
    requestAnimationFrame(raf);
  })();
  document.addEventListener('mouseleave',()=>{cg.style.opacity='0';});
  document.addEventListener('mouseenter',()=>{cg.style.opacity='1';});
})();

/* ═══ NAVIGATION ═══ */
(function(){
  const nav    = $('.nav');
  const burger = $('.nav-burger');
  const mob    = $('.nav-mobile');
  if(!nav) return;

  window.addEventListener('scroll',()=>{
    nav.classList.toggle('scrolled',window.scrollY>50);
  },{passive:true});

  if(burger&&mob){
    burger.addEventListener('click',()=>{
      const open = burger.classList.toggle('open');
      mob.classList.toggle('open',open);
      document.body.style.overflow = open?'hidden':'';
    });
    $$('a',mob).forEach(a=>a.addEventListener('click',()=>{
      burger.classList.remove('open');
      mob.classList.remove('open');
      document.body.style.overflow='';
    }));
  }

  // Active link highlight — cache section offsets, batch in rAF (no per-scroll reflow)
  const sections = $$('section[id]');
  const navAs = $$('.nav-links a, .nav-mobile a');
  if(sections.length && navAs.length){
    let offsets=[];
    const measure=()=>{ offsets=sections.map(s=>({id:s.id,top:s.offsetTop,bottom:s.offsetTop+s.offsetHeight})); };
    measure();
    window.addEventListener('resize',measure,{passive:true});
    window.addEventListener('load',measure);
    let ticking=false;
    window.addEventListener('scroll',()=>{
      if(ticking) return; ticking=true;
      requestAnimationFrame(()=>{
        ticking=false;
        const y = window.scrollY+100;
        for(const o of offsets){
          if(o.top<=y && o.bottom>y){
            navAs.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+o.id));
            break;
          }
        }
      });
    },{passive:true});
  }
})();

/* ═══ SCROLL REVEAL ═══ */
(function(){
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
    });
  },{threshold:0.10,rootMargin:'0px 0px -40px 0px'});
  $$('.reveal').forEach(el=>io.observe(el));
})();

/* ═══ ANIMATED COUNTERS ═══ */
(function(){
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      io.unobserve(e.target);
      const el=e.target;
      const target=parseFloat(el.dataset.count||'0');
      const suffix=el.dataset.suffix||'';
      const prefix=el.dataset.prefix||'';
      const dec=parseInt(el.dataset.dec||'0');
      const dur=1800;
      let start=null;
      function step(ts){
        if(!start) start=ts;
        const p=Math.min((ts-start)/dur,1);
        const ease=1-Math.pow(1-p,3);
        el.textContent=prefix+((target*ease).toFixed(dec))+suffix;
        if(p<1) requestAnimationFrame(step);
        else el.textContent=prefix+target.toFixed(dec)+suffix;
      }
      requestAnimationFrame(step);
    });
  },{threshold:0.5});
  $$('[data-count]').forEach(el=>io.observe(el));
})();

/* ═══ PARTICLES ═══ */
(function(){
  $$('.particles').forEach(c=>{
    for(let i=0;i<30;i++){
      const p=document.createElement('div');
      p.className='pt';
      p.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;animation-duration:${3+Math.random()*5}s;animation-delay:${-Math.random()*8}s;opacity:${0.3+Math.random()*0.5};`;
      c.appendChild(p);
    }
  });
})();

/* ═══ MAGNETIC BUTTONS ═══ */
(function(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('[data-mag]').forEach(btn=>{
    let rect=null,mx=0,my=0,raf=0;
    const apply=()=>{ raf=0; btn.style.transform=`translate(${mx}px,${my}px)`; };
    btn.addEventListener('mouseenter',()=>{ rect=btn.getBoundingClientRect(); });
    btn.addEventListener('mousemove',e=>{
      if(!rect) rect=btn.getBoundingClientRect();
      mx=(e.clientX-rect.left-rect.width/2)*0.22;
      my=(e.clientY-rect.top-rect.height/2)*0.22;
      if(!raf) raf=requestAnimationFrame(apply);
    },{passive:true});
    btn.addEventListener('mouseleave',()=>{ rect=null; if(raf){cancelAnimationFrame(raf);raf=0;} btn.style.transform=''; });
  });
})();

/* ═══ CARD TILT ═══ */
(function(){
  if(window.innerWidth<768) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('[data-tilt]').forEach(card=>{
    let rect=null,px=0,py=0,raf=0;
    const apply=()=>{
      raf=0;
      card.style.transform=`perspective(700px) rotateY(${px*8}deg) rotateX(${-py*8}deg) translateY(-6px)`;
    };
    card.addEventListener('mouseenter',()=>{
      rect=card.getBoundingClientRect();
      card.style.willChange='transform';   /* composite once → tilt frames don't repaint text */
    });
    card.addEventListener('mousemove',e=>{
      if(!rect) rect=card.getBoundingClientRect();
      px=(e.clientX-rect.left)/rect.width-0.5;
      py=(e.clientY-rect.top)/rect.height-0.5;
      if(!raf) raf=requestAnimationFrame(apply);  /* coalesce to one write per frame */
    },{passive:true});
    card.addEventListener('mouseleave',()=>{
      rect=null;
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      card.style.transform='';
      card.style.willChange='auto';        /* release the layer when idle */
    });
  });
})();

/* ═══ MOUSE-FOLLOWING GRADIENT ═══ */
(function(){
  const hero = $('.hero');
  if(!hero||window.innerWidth<768) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let rect=null,hx='50%',hy='50%',raf=0;
  const apply=()=>{ raf=0; hero.style.setProperty('--mx',hx); hero.style.setProperty('--my',hy); };
  hero.addEventListener('mouseenter',()=>{ rect=hero.getBoundingClientRect(); });
  hero.addEventListener('mousemove',e=>{
    if(!rect) rect=hero.getBoundingClientRect();
    hx=((e.clientX-rect.left)/rect.width*100).toFixed(1)+'%';
    hy=((e.clientY-rect.top)/rect.height*100).toFixed(1)+'%';
    if(!raf) raf=requestAnimationFrame(apply);
  },{passive:true});
})();

/* ═══ HERO PARALLAX (division pages) ═══ */
(function(){
  const imgs = $$('.svc-hero-img');
  if(!imgs.length || window.innerWidth<768) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking=false;
  const update=()=>{
    ticking=false;
    const y=window.scrollY;
    imgs.forEach(im=>{ im.style.transform='translateY('+(y*0.18).toFixed(1)+'px)'; });
  };
  window.addEventListener('scroll',()=>{
    if(ticking) return; ticking=true;
    requestAnimationFrame(update);
  },{passive:true});
  update();
})();

/* ═══ GALLERY — Filter + Lightbox ═══ */
(function(){
  const flts = $$('.flt');
  const items = $$('.gal-item');
  const lb    = $('#lightbox');
  const lbImg = $('#lb-img');
  const lbClose = $('#lb-close');

  // Filters
  flts.forEach(btn=>{
    btn.addEventListener('click',()=>{
      flts.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      items.forEach(item=>{
        const show = cat==='all'||item.dataset.cat===cat;
        item.style.display = show?'block':'none';
      });
    });
  });

  // Lightbox
  if(!lb||!lbImg) return;
  items.forEach(item=>{
    item.addEventListener('click',()=>{
      const img=$('img',item);
      if(!img) return;
      lbImg.src=img.src;
      lbImg.alt=img.alt||'';
      lb.classList.add('open');
      document.body.style.overflow='hidden';
    });
  });
  function closeLb(){lb.classList.remove('open');document.body.style.overflow='';}
  lbClose&&lbClose.addEventListener('click',closeLb);
  lb.addEventListener('click',e=>{ if(e.target===lb) closeLb(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLb(); });

  // Lazy images
  const imgObserver = new IntersectionObserver((entries,obs)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const img=e.target;
      if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;}
      obs.unobserve(img);
    });
  },{rootMargin:'200px'});
  $$('img[data-src]').forEach(img=>imgObserver.observe(img));
})();

/* ═══ CONTACT FORM ═══ */
(function(){
  const form=$('#contact-form');
  if(!form) return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=form.querySelector('[type=submit]');
    if(!btn) return;
    btn.disabled=true;
    btn.textContent='Sending…';
    await new Promise(r=>setTimeout(r,1400));
    btn.textContent='✓ Message Sent';
    btn.style.cssText='background:rgba(34,197,94,0.14);border-color:rgba(34,197,94,0.40);color:#4ade80;';
    setTimeout(()=>{
      form.reset();btn.disabled=false;
      btn.textContent='Send Message';btn.style.cssText='';
    },3500);
  });
})();

/* ═══ YEAR ═══ */
$$('#current-year').forEach(el=>{ el.textContent=new Date().getFullYear(); });

/* ═══ MARQUEE DUPLICATE ═══ */
(function(){
  const track = $('.marquee-track');
  if(!track) return;
  track.innerHTML += track.innerHTML;
})();

/* ═══ SMOOTH ANCHOR SCROLL ═══ */
$$('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const id=a.getAttribute('href').slice(1);
    const target=document.getElementById(id);
    if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth',block:'start'}); }
  });
});

/* ── Sync body class from html class on DOM ready ── */
(function() {
  if (document.documentElement.classList.contains('light')) {
    document.body.classList.add('light');
  }
})();
