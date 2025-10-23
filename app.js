/* ================================
   Book Animator – app.js (full)
   ================================ */

/* ---------- tiny utils ---------- */
const $ = id => document.getElementById(id);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; }
  catch { return d; }
};
const fileToDataURL = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function escapeHtml(s) {
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return (s || '').replace(/[&<>"']/g, ch => map[ch]);
}
function showToast(msg, kind="error") {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;right:12px;bottom:72px;background:#121212;border:1px solid '+(kind==="ok"?"#22c55e":"#ef4444")+';color:#fff;padding:.6rem .8rem;border-radius:10px;max-width:74vw;z-index:9999;font:14px/1.4 system-ui';
  d.textContent = (kind==="ok"?"✅ ":"❌ ") + msg;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 5000);
}

/* ---------- refs ---------- */
const UI = {
  leftBtn: $('btnLeft'), rightBtn: $('btnRight'),
  leftMenu: $('leftMenu'), rightMenu: $('rightMenu'),
  closeLeft: $('closeLeft'), closeRight: $('closeRight'),
  tabBtns: [...document.querySelectorAll('[data-tab]')],
  rtabBtns: [...document.querySelectorAll('[data-rtab]')],
  setRenderMode: $('setRenderMode'), setAspect: $('setAspect'),
  proxyBase: $('proxyBase'), btnSaveSecrets: $('btnSaveSecrets'), btnTestProxy: $('btnTestProxy'),
  fileChars: $('fileChars'), fileGeneral: $('fileGeneral'), uploadList: $('uploadList'),
  txt: $('bookText'), thumbs: $('thumbs'),
  preview: $('btnPreview'), start: $('btnStart'),
  scenesBadge: $('scenesBadge'), modeBadge: $('modeBadge'),
  meter: $('meterFill'), pct: $('pct'),
  btnZip: $('btnZip'), btnSave: $('btnSave'), btnVideo: $('btnVideo'),
  // character modal
  ceName: $('ceName'), ceNotes: $('ceNotes'), ceVoice: $('ceVoice'),
  ce11: $('ce11'), cePortrait: $('cePortrait'),
  cePreviewOA: $('cePreviewOA'), cePreview11: $('cePreview11'),
  cePreview: $('cePreview'), // fallback single button if present
  ceCancel: $('ceCancel'), ceSave: $('ceSave'),
};

/* ---------- state ---------- */
let SETTINGS = load('ba_settings', { renderMode: 'offline', artStyle: 'Comic', visualMotion: 'Ken Burns', aspect: '16:9' });
let SECRETS  = load('ba_secrets',  { proxy: 'https://ai-proxydjs.blindart2020.workers.dev' });
let CHARS    = load('ba_chars', defaultCharacters());
let ASSETS   = { images: [], narration: [], sfx: [] };
let editingIx = -1;

/* ---------- UI wiring: menus ---------- */
UI.leftBtn?.addEventListener('click', () => UI.leftMenu.style.display = 'flex');
UI.rightBtn?.addEventListener('click', () => UI.rightMenu.style.display = 'flex');
UI.closeLeft?.addEventListener('click', () => UI.leftMenu.style.display = 'none');
UI.closeRight?.addEventListener('click', () => UI.rightMenu.style.display = 'none');

UI.tabBtns.forEach(b => b.addEventListener('click', () => {
  ['tChars','tSettings','tSecrets','tHelp'].forEach(k => $(k).style.display = (k === b.dataset.tab ? 'block' : 'none'));
}));
UI.rtabBtns.forEach(b => b.addEventListener('click', () => {
  ['uUploads','uProject'].forEach(k => $(k).style.display = (k === b.dataset.rtab ? 'block' : 'none'));
}));

/* ---------- segmented controls ---------- */
const ART_STYLES = ["Comic","Cartoon","Anime","Watercolor","Ink & Wash","Digital Paint","Flat Toon","Dark Fantasy","Low-Poly","Flip Book"];
const RENDER_MOTIONS = ["Ken Burns","Pan Left","Pan Right","Zoom In","Zoom Out","Static"];

function buildSeg(id, opts, cur, onPick) {
  const host = $(id);
  host.innerHTML = '';
  opts.forEach(name => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (name === cur ? ' active' : '');
    b.textContent = name;
    b.onclick = () => {
      host.querySelectorAll('.opt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onPick(name);
    };
    host.appendChild(b);
  });
}

UI.setRenderMode.value = SETTINGS.renderMode;
UI.setAspect.value     = SETTINGS.aspect;
buildSeg('artStyles', ART_STYLES, SETTINGS.artStyle, v => { SETTINGS.artStyle = v; save('ba_settings', SETTINGS); });
buildSeg('renderMotions', RENDER_MOTIONS, SETTINGS.visualMotion, v => { SETTINGS.visualMotion = v; save('ba_settings', SETTINGS); });
UI.modeBadge.textContent = SETTINGS.renderMode === 'online' ? 'Online' : 'Simple';

/* ---------- secrets ---------- */
UI.btnSaveSecrets.onclick = () => {
  SECRETS.proxy = (UI.proxyBase.value || '').trim();
  SETTINGS.renderMode = UI.setRenderMode.value;
  SETTINGS.aspect     = UI.setAspect.value;
  save('ba_secrets', SECRETS);
  save('ba_settings', SETTINGS);
  UI.modeBadge.textContent = SETTINGS.renderMode === 'online' ? 'Online' : 'Simple';
  showToast('Settings saved', 'ok');
};

UI.btnTestProxy.onclick = async () => {
  const base = (UI.proxyBase.value || '').replace(/\/$/, '');
  if (!base) return showToast('Enter proxy URL first');
  try {
    const r = await fetch(base + '/health');
    showToast(r.ok ? 'Proxy reachable' : 'Proxy error ' + r.status, r.ok ? 'ok' : 'error');
  } catch {
    showToast('Proxy unreachable');
  }
};

/* ---------- uploads ---------- */
UI.fileGeneral?.addEventListener('change', e => {
  const files = [...e.target.files];
  UI.uploadList.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('div'); row.className = 'item';
    row.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
    UI.uploadList.appendChild(row);
  });
});
UI.fileChars?.addEventListener('change', async e => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    CHARS = JSON.parse(await f.text());
    save('ba_chars', CHARS);
    renderCharList();
    showToast('Characters imported', 'ok');
  } catch {
    showToast('Invalid Characters JSON');
  }
});

/* ---------- characters ---------- */
function defaultCharacters() {
  const names = ['Narrator','Sidetracked Sally','Darling Danielle','Dark Dan','Skater Skip','Creative Callie','Zen Zena','Grumpy Gus'];
  return names.map(n => ({ name:n, notes:'', voice:'ember', eleven:'', portrait:'' }));
}

function renderCharList() {
  const list = $('charList'); list.innerHTML = '';
  CHARS.forEach((c, ix) => {
    const el = document.createElement('div'); el.className = 'item';
    el.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(c.name)}</div>
        <div style="color:#bbb;font-size:.9rem">
          OpenAI: ${escapeHtml(c.voice || 'ember')}
          ${c.eleven ? ' · 11Labs: ' + escapeHtml(c.eleven) : ''}
        </div>
      </div>
      <div>
        <button class="btn small" data-edit="${ix}">Edit</button>
      </div>`;
    list.appendChild(el);
  });
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openChar(+b.dataset.edit));
}
renderCharList();

function openChar(ix) {
  editingIx = ix;
  const c = CHARS[ix];
  $('charModal').style.display = 'flex';
  UI.ceName.value  = c.name;
  UI.ceNotes.value = c.notes || '';
  UI.ceVoice.value = c.voice || 'ember';
  UI.ce11.value    = c.eleven || '';
  UI.cePortrait.value = '';
}
function closeChar() { $('charModal').style.display = 'none'; }

UI.ceCancel.onclick = closeChar;

UI.ceSave.onclick = async () => {
  const c = CHARS[editingIx];
  c.name   = UI.ceName.value.trim() || c.name;
  c.notes  = UI.ceNotes.value.trim();
  c.voice  = UI.ceVoice.value;
  c.eleven = UI.ce11.value.trim();
  const f = UI.cePortrait.files?.[0]; if (f) c.portrait = await fileToDataURL(f);
  save('ba_chars', CHARS);
  renderCharList();
  closeChar();
};

/* --- NEW: separate preview buttons for OpenAI & ElevenLabs --- */
async function previewOpenAI() {
  const text  = `Hello, I'm ${UI.ceName.value || 'the character'}. This is an OpenAI voice preview.`;
  const voice = UI.ceVoice.value || 'ember';
  try {
    const url = await ttsOpenAI(text, voice);
    new Audio(url).play();
  } catch (e) { showToast('OpenAI preview failed: ' + e.message); }
}
async function previewEleven() {
  const text = `Hello, I'm ${UI.ceName.value || 'the character'}. This is an ElevenLabs voice preview.`;
  const id   = UI.ce11.value.trim();
  if (!id) return showToast('Enter an ElevenLabs Voice ID first');
  try {
    const url = await ttsEleven(text, id);
    new Audio(url).play();
  } catch (e) { showToast('ElevenLabs preview failed: ' + e.message); }
}
// Bind (works whether you have one button or the two new ones)
UI.cePreviewOA?.addEventListener('click', previewOpenAI);
UI.cePreview11?.addEventListener('click', previewEleven);
UI.cePreview?.addEventListener('click', previewOpenAI);

/* ---------- scenes & generation ---------- */
UI.preview.onclick = () => { updateSceneCount(); };
function splitScenes(t) {
  const primary = (t||'').split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  if (primary.length) return primary;
  const alt = (t||'').trim().split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  return alt.slice(0, 100);
}
function updateSceneCount() {
  const scenes = splitScenes(UI.txt.value);
  UI.scenesBadge.textContent = scenes.length;
  UI.thumbs.innerHTML = '';
  scenes.forEach((_, i) => UI.thumbs.appendChild(makeTile(i+1)));
}
function makeTile(n) {
  const t = document.createElement('div');
  t.className = 'tile';
  t.innerHTML = `<div class="num">#${n}</div><span style="color:#ccc">waiting…</span>`;
  return t;
}

/* ---------- proxy helpers ---------- */
function getProxyBase() {
  const base = (SECRETS.proxy || '').replace(/\/+$/,'');
  return base || 'https://ai-proxydjs.YOURNAME.workers.dev';
}
async function callProxy(path, { method='POST', json=null, qs=null, expect='json' } = {}) {
  const base = getProxyBase(), q = qs ? ('?'+new URLSearchParams(qs)) : '';
  const res = await fetch(base + path + q, {
    method,
    headers: json ? {'Content-Type':'application/json'} : undefined,
    body: json ? JSON.stringify(json) : undefined
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${path} ${res.status}: ${txt.slice(0,200)}`);
  }
  return (expect==='blob') ? await res.blob() : await res.json();
}
async function genImage(prompt, style, aspect) {
  const blob = await callProxy('/images', { json: { prompt, style, aspect }, expect:'blob' });
  return URL.createObjectURL(blob);
}
async function ttsOpenAI(text, voice='ember') {
  const blob = await callProxy('/voice/openai', { json: { text, voice }, expect:'blob' });
  return URL.createObjectURL(blob);
}
async function ttsEleven(text, voice_id) {
  const blob = await callProxy('/voice/11labs', { json: { text, voice_id }, expect:'blob' });
  return URL.createObjectURL(blob);
}
async function autoSfx(text) {
  const blob = await callProxy('/sfx/auto', { json: { text }, expect:'blob' });
  return URL.createObjectURL(blob);
}

/* ---------- generate ---------- */
UI.start.onclick = async () => {
  const scenes = splitScenes(UI.txt.value);
  if (!scenes.length) return showToast('Paste some text first');
  const online = SETTINGS.renderMode === 'online';

  UI.thumbs.innerHTML = '';
  scenes.forEach((_, i) => UI.thumbs.appendChild(makeTile(i+1)));
  UI.meter.style.width = '0%'; UI.pct.textContent = '0%';
  ASSETS = { images: [], narration: [], sfx: [] };

  const narrator = CHARS.find(c => /^narrator$/i.test(c.name)) || CHARS[0] || { voice:'ember' };

  for (let i=0; i<scenes.length; i++) {
    const tile = UI.thumbs.children[i];
    const line = scenes[i];

    // image
    try {
      let imgUrl;
      if (online) {
        const prompt = `Illustration, ${SETTINGS.artStyle}. Scene: ${line}`;
        imgUrl = await genImage(prompt, SETTINGS.artStyle, SETTINGS.aspect);
      } else {
        imgUrl = await placeholderPNG(`Scene ${i+1}`, `${SETTINGS.artStyle} • ${SETTINGS.visualMotion}`);
      }
      ASSETS.images[i] = imgUrl;
      tile.innerHTML = `<div class="num">#${i+1}</div><img alt="scene ${i+1}" src="${imgUrl}"/>`;
    } catch (e) {
      showToast('Image gen failed (scene '+(i+1)+'): ' + e.message);
      const ph = await placeholderPNG(`Scene ${i+1}`, 'Image failed');
      ASSETS.images[i] = ph;
      tile.innerHTML = `<div class="num">#${i+1}</div><img alt="scene ${i+1}" src="${ph}"/>`;
    }

    // narration
    try {
      let voiceUrl = null;
      if (online) {
        voiceUrl = narrator.eleven
          ? await ttsEleven(line, narrator.eleven)
          : await ttsOpenAI(line, narrator.voice || 'ember');
      }
      ASSETS.narration[i] = voiceUrl;
      // Optionally auto-play first scene’s narration
      if (i === 0 && voiceUrl) new Audio(voiceUrl).play();
    } catch (e) {
      showToast('TTS failed (scene '+(i+1)+'): ' + e.message);
      ASSETS.narration[i] = null;
    }

    // sfx (optional)
    try {
      ASSETS.sfx[i] = online ? await autoSfx(line) : null;
    } catch (e) {
      ASSETS.sfx[i] = null; // ignore
    }

    const p = Math.round(((i+1)/scenes.length)*100);
    UI.meter.style.width = p + '%'; UI.pct.textContent = p + '%';
    await sleep(30);
  }

  alert('Scenes processed.');
};

/* ---------- placeholders (offline) ---------- */
async function placeholderPNG(title, subtitle) {
  const w=640,h=360,pad=18,r=12;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  x.fillStyle='#0f0f0f'; x.fillRect(0,0,w,h);
  x.strokeStyle='#666'; x.lineWidth=2; roundRect(x,pad,pad,w-pad*2,h-pad*2,r); x.stroke();
  x.fillStyle='#fff'; x.font='bold 22px Inter, system-ui'; x.fillText(title,26,50);
  x.fillStyle='#bbb'; x.font='15px Inter, system-ui'; wrapText(x,subtitle,26,80,w-52,20);
  return c.toDataURL('image/png');
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function wrapText(ctx,text,x,y,max,lh){const words=(text||'').split(/\s+/), line=[];for(const w of words){const test=[...line,w].join(' ');if(ctx.measureText(test).width>max){ctx.fillText(line.join(' '),x,y);line.length=0;y+=lh;}line.push(w);}ctx.fillText(line.join(' '),x,y);}

/* ---------- export: ZIP ---------- */
UI.btnZip.onclick = async () => {
  if (!ASSETS.images.length) return showToast('Generate scenes first');
  const zip = new JSZip();
  const manifest = { settings: SETTINGS, characters: CHARS, scenes: [] };
  for (let i=0; i<ASSETS.images.length; i++) {
    manifest.scenes[i] = {
      image: `scene-${String(i+1).padStart(3,'0')}.png`,
      narration: ASSETS.narration[i] ? `scene-${String(i+1).padStart(3,'0')}.mp3` : null,
      sfx: ASSETS.sfx[i] ? `scene-${String(i+1).padStart(3,'0')}-sfx.mp3` : null
    };
    if (ASSETS.images[i])    zip.file(manifest.scenes[i].image,    await (await fetch(ASSETS.images[i])).blob());
    if (ASSETS.narration[i]) zip.file(manifest.scenes[i].narration,await (await fetch(ASSETS.narration[i])).blob());
    if (ASSETS.sfx[i])       zip.file(manifest.scenes[i].sfx,      await (await fetch(ASSETS.sfx[i])).blob());
  }
  zip.file('manifest.json', JSON.stringify(manifest,null,2));
  const blob = await zip.generateAsync({ type:'blob' });
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='BookAnimator_Project.zip'; a.click();
};

/* ---------- export: WebM slideshow (beta) ---------- */
UI.btnVideo.onclick = async () => {
  if (!ASSETS.images.length) return showToast('Generate scenes first');
  const canvas = $('videoPreview'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, fps = 30, perSceneSec = 4;

  // audio mix (choose narration, fallback to sfx)
  const AC = new (window.AudioContext || window.webkitAudioContext)();
  const dest = AC.createMediaStreamDestination();
  const audios = ASSETS.narration.map((u,i)=>u||ASSETS.sfx[i]||null).map(u=>{
    if(!u) return null;
    const el = new Audio(u); el.crossOrigin='anonymous';
    const src = AC.createMediaElementSource(el); src.connect(dest); src.connect(AC.destination);
    return el;
  });

  const stream = canvas.captureStream(fps);
  const merged = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(merged, { mimeType:'video/webm' });
  const chunks=[];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type:'video/webm' });
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='BookAnimator_Slideshow.webm'; a.click();
  };
  rec.start();

  function drawFit(img) {
    const iw=img.width, ih=img.height;
    const s=Math.max(W/iw, H/ih); const nw=iw*s, nh=ih*s;
    const dx=(W-nw)/2, dy=(H-nh)/2;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    ctx.drawImage(img,dx,dy,nw,nh);
  }

  for (let i=0;i<ASSETS.images.length;i++) {
    const img = new Image(); img.src = ASSETS.images[i];
    try { await img.decode(); } catch {}
    drawFit(img);
    if (audios[i]) { try { await audios[i].play(); } catch {} }
    const end = performance.now() + perSceneSec*1000;
    while (performance.now() < end) { await new Promise(r => requestAnimationFrame(r)); }
    if (audios[i]) { audios[i].pause(); audios[i].currentTime = 0; }
  }
  rec.stop();
};

/* ---------- misc ---------- */
UI.btnSave.onclick = () => { save('ba_settings', SETTINGS); save('ba_secrets', SECRETS); save('ba_chars', CHARS); showToast('Saved to this browser', 'ok'); };
$('btnClearThumbs')?.addEventListener('click', () => { $('thumbs').innerHTML=''; ASSETS={images:[],narration:[],sfx:[]}; });
$('btnWipe')?.addEventListener('click', () => {
  localStorage.removeItem('ba_settings'); localStorage.removeItem('ba_secrets'); localStorage.removeItem('ba_chars'); showToast('Cleared saved data. Reload the page.', 'ok');
});