/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — MAIN JS v6.0
   Preloader · Nav · Reveal · Counters · Gallery · Cursor · Form
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const $ = (s,c=document) => c.querySelector(s);
const $$ = (s,c=document) => [...c.querySelectorAll(s)];

/* ═══ PRELOADER ═══ */
(function(){
  const pl = document.getElementById('preloader');
  if(!pl) return;
  window.addEventListener('load',()=>{
    setTimeout(()=>pl.classList.add('done'),900);
    setTimeout(()=>pl.remove(),1700);
  });
})();

/* ═══ SCROLL PROGRESS ═══ */
(function(){
  const bar = document.getElementById('progress-bar');
  if(!bar) return;
  let ticking=false;
  window.addEventListener('scroll',()=>{
    if(ticking) return; ticking=true;
    requestAnimationFrame(()=>{
      ticking=false;
      const h = document.documentElement;
      const pct = h.scrollHeight - h.clientHeight > 0
        ? (h.scrollTop / (h.scrollHeight - h.clientHeight))
        : 0;
      bar.style.transform = 'scaleX(' + pct + ')';
    });
  },{passive:true});
})();

/* ═══ CURSOR GLOW ═══ */
(function(){
  const cg = document.getElementById('cursor-glow');
  if(!cg || window.innerWidth < 768) return;
  let tx=0,ty=0,cx=0,cy=0,rafId=0,running=false;
  function step(){
    cx += (tx-cx)*0.08; cy += (ty-cy)*0.08;
    cg.style.transform = 'translate('+(cx-200)+'px,'+(cy-200)+'px)';
    /* Stop RAF when converged to avoid burning 60fps at rest */
    if(Math.abs(tx-cx) > 0.5 || Math.abs(ty-cy) > 0.5){
      rafId = requestAnimationFrame(step);
    } else {
      running = false;
    }
  }
  document.addEventListener('mousemove',e=>{
    tx=e.clientX; ty=e.clientY;
    if(!running){ running=true; rafId=requestAnimationFrame(step); }
  },{passive:true});
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
      document.body.classList.toggle('no-scroll',open);
    });
    mob.addEventListener('click',e=>{
      if(e.target.tagName==='A'){
        burger.classList.remove('open');
        mob.classList.remove('open');
        document.body.classList.remove('no-scroll');
      }
    });
  }

  // Active link highlight — batch reads in rAF
  const sections = $$('section[id]');
  const navAs = $$('.nav-links a, .nav-mobile a');
  if(sections.length && navAs.length){
    let offsets=[];
    const measure=()=>{
      offsets=sections.map(s=>({id:s.id,top:s.offsetTop,bottom:s.offsetTop+s.offsetHeight}));
    };
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
    const frag = document.createDocumentFragment();
    for(let i=0;i<30;i++){
      const p=document.createElement('div');
      p.className='pt';
      p.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;animation-duration:${3+Math.random()*5}s;animation-delay:${-Math.random()*8}s;opacity:${0.3+Math.random()*0.5};`;
      frag.appendChild(p);
    }
    c.appendChild(frag);
  });
})();

/* ═══ MAGNETIC BUTTONS ═══ */
(function(){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
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
    btn.addEventListener('mouseleave',()=>{
      rect=null; if(raf){cancelAnimationFrame(raf);raf=0;}
      btn.style.transform='';
    });
  });
})();

/* ═══ CARD TILT ═══ */
(function(){
  if(window.innerWidth<768) return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  $$('[data-tilt]').forEach(card=>{
    let rect=null,px=0,py=0,raf=0;
    const apply=()=>{
      raf=0;
      card.style.transform=`perspective(700px) rotateY(${px*8}deg) rotateX(${-py*8}deg) translateY(-6px)`;
    };
    card.addEventListener('mouseenter',()=>{
      rect=card.getBoundingClientRect();
      card.style.willChange='transform';
    });
    card.addEventListener('mousemove',e=>{
      if(!rect) rect=card.getBoundingClientRect();
      px=(e.clientX-rect.left)/rect.width-0.5;
      py=(e.clientY-rect.top)/rect.height-0.5;
      if(!raf) raf=requestAnimationFrame(apply);
    },{passive:true});
    card.addEventListener('mouseleave',()=>{
      rect=null;
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      card.style.transform='';
      card.style.willChange='auto';
    });
  });
})();

/* ═══ MOUSE-FOLLOWING GRADIENT ═══ */
(function(){
  const hero = $('.hero');
  if(!hero||window.innerWidth<768) return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
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
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
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
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');

  // Filters
  flts.forEach(btn=>{
    btn.addEventListener('click',()=>{
      flts.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      items.forEach(item=>{
        item.classList.toggle('gal-item--hidden', cat!=='all' && item.dataset.cat!==cat);
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
      document.body.classList.add('no-scroll');
    });
  });
  function closeLb(){lb.classList.remove('open');document.body.classList.remove('no-scroll');}
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
  const form=document.getElementById('contact-form');
  if(!form) return;

  const IS_AR = document.documentElement.lang === 'ar';
  const tr = (en, ar) => IS_AR ? ar : en;

  /* Status message element injected just below the form */
  let statusEl = document.getElementById('contact-status');
  if(!statusEl){
    statusEl = document.createElement('div');
    statusEl.id = 'contact-status';
    statusEl.setAttribute('role','status');
    statusEl.setAttribute('aria-live','polite');
    statusEl.style.cssText='display:none;margin-top:14px;padding:12px 16px;border-radius:10px;font-size:14px;line-height:1.55;';
    form.appendChild(statusEl);
  }
  function showStatus(text, kind){
    const palette = {
      info:   ['rgba(6,182,212,0.10)','rgba(6,182,212,0.30)','#22c4de'],
      success:['rgba(34,197,94,0.12)','rgba(34,197,94,0.38)','#4ade80'],
      error:  ['rgba(239,68,68,0.12)','rgba(239,68,68,0.40)','#f87171'],
    }[kind] || ['transparent','transparent','inherit'];
    statusEl.textContent = text || '';
    statusEl.style.display = text ? 'block' : 'none';
    statusEl.style.background  = palette[0];
    statusEl.style.border      = '1px solid ' + palette[1];
    statusEl.style.color       = palette[2];
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    console.log('[Quote] Submit button clicked');

    const btn=form.querySelector('[type=submit]');
    if(!btn) return;

    const data=Object.fromEntries(new FormData(form));
    data.type = 'contact';
    data.language = IS_AR ? 'ar' : 'en';
    console.log('[Quote] Form data collected:',{
      name: data.first_name?`${data.first_name} ${data.last_name||''}`:data.name,
      email: data.email,
      service: data.service,
    });

    btn.disabled=true;
    const origText=btn.textContent;
    btn.textContent=tr('Sending…','جارٍ الإرسال…');
    showStatus(tr('Sending your request…','جارٍ إرسال طلبك…'),'info');

    console.log('[Quote] Calling API: POST /api/quote');
    let res,json;
    try {
      res=await fetch('/api/quote',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data),
      });
      json=await res.json().catch(()=>({}));
    } catch(err){
      console.error('[Quote] Network error:',err.message);
      btn.disabled=false;
      btn.textContent=origText;
      showStatus(tr('Network error — please check your connection and try again.',
                    'خطأ في الشبكة — يرجى التحقق من الاتصال والمحاولة مرة أخرى.'),'error');
      return;
    }

    console.log('[Quote] API response:',res.status,json);

    if(res.ok&&json.success){
      console.log('[Quote] SUCCESS — email delivered to arshad@alfarooque.com, id:',json.id);
      btn.textContent=tr('✓ Sent','✓ تم الإرسال');
      showStatus(tr('Thank you. Your request has been submitted successfully.',
                    'شكراً لك. تم إرسال طلبك بنجاح.'),'success');
      setTimeout(()=>{
        form.reset();btn.disabled=false;btn.textContent=origText;
        showStatus('',null);
      },4500);
    } else {
      const detail = (json && (json.error || json.message)) || ('HTTP ' + res.status);
      console.error('[Quote] FAILED — recipient: arshad@alfarooque.com — error:',json);
      btn.disabled=false;
      btn.textContent=origText;
      showStatus(tr('Could not send your request: ','تعذّر إرسال طلبك: ') + detail,'error');
    }
  });
})();

/* ═══ YEAR ═══ */
(function(){
  const el=document.getElementById('current-year');
  if(el) el.textContent=new Date().getFullYear();
})();

/* ═══ MARQUEE DUPLICATE ═══ */
(function(){
  const track = $('.marquee-track');
  if(!track) return;
  const clone = track.cloneNode(true);
  /* Transfer children of clone into track (avoids double-nesting) */
  while(clone.firstChild) track.appendChild(clone.firstChild);
})();

/* ═══ SMOOTH ANCHOR SCROLL ═══ */
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');
  if(!a) return;
  const id=a.getAttribute('href').slice(1);
  const target=document.getElementById(id);
  if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth',block:'start'}); }
});

/* ═══ HERO SLIDER ═══ */
(function(){
  $$('[data-slider]').forEach(container=>{
    const slides = $$('.ph-slide-bg',container);
    if(slides.length < 2) return;
    let cur = 0;
    let timer = null;

    function advance(){
      slides[cur].classList.remove('active');
      cur = (cur+1) % slides.length;
      slides[cur].classList.add('active');
      // Replay content animation — rAF avoids synchronous layout flush
      const els = $$('.ph-hero-el',container);
      els.forEach(el=>el.classList.remove('ph-hero-el'));
      requestAnimationFrame(()=>els.forEach(el=>el.classList.add('ph-hero-el')));
    }

    function start(){ timer = setInterval(advance, 5500); }
    function stop(){ clearInterval(timer); }

    document.addEventListener('visibilitychange',()=>{ document.hidden ? stop() : start(); });
    start();
  });
})();

/* ── Sync body class from html class on DOM ready ── */
(function() {
  if (document.documentElement.classList.contains('light')) {
    document.body.classList.add('light');
  }
})();
