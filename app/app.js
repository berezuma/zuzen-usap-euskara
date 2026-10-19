import {
  SECTIONS, RUBRIC, PENALTY_BANDS, norm, countWords, fmt, round, loose, exact, wordPenalty, conventions,
  usedConnectors, copiedChunk, bandFor, textNormOf, gradeA3, score, emptyAnswers, picks, keyScore,
} from './grading.js';

const EXAM_MS = 90 * 60 * 1000;
const app = document.getElementById('app');
let MODELS = [];
let BANKS = null;
let ui = { filter: 'all', confirm: null, gym: null };
let ticker = null;

/* ---------- laguntzaileak ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(\S.*?\S|\S)\*(?=[\s).,;:]|$)/g, '$1<i>$2</i>');
const store = {
  get(k, d) { try { const v = localStorage.getItem('zuzen:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('zuzen:' + k, JSON.stringify(v)); } catch { /* biltegirik gabe ere badabil */ } },
  del(k) { try { localStorage.removeItem('zuzen:' + k); } catch { /* */ } },
};
const byId = (id) => MODELS.find((m) => m.id === id);
const LETTERS = 'abcde';
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const icon = {
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/></svg>',
};
const chip = (ok, text) => `<span class="chip ${ok ? 'ok' : 'bad'}">${ok ? icon.check : icon.warn}${esc(text)}</span>`;

function getAtt(id) { return store.get('att:' + id, null); }
function saveAtt(att) { att.updated = Date.now(); store.set('att:' + att.id, att); }
function newAtt(m) { const a = { id: m.id, started: Date.now(), elapsed: 0, section: 's11', finished: false, ans: emptyAnswers(m), self: {} }; saveAtt(a); return a; }

function setPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] === undefined) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = val;
}
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

/* ---------- ibilbideak ---------- */
function route() {
  clearInterval(ticker); ticker = null;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  ui.confirm = null;
  if (parts[0] === 'azterketa' && byId(parts[1])) return viewExam(byId(parts[1]));
  if (parts[0] === 'emaitza' && byId(parts[1])) return viewResult(byId(parts[1]));
  if (parts[0] === 'gimnasioa') return parts[1] ? viewDrill(parts[1]) : viewGym();
  return viewHome();
}

function top(active) {
  return `<header class="top"><div class="in">
    <a class="wordmark" href="#/">zuzen<span>.</span></a>
    <nav class="nav" aria-label="Nagusia">
      <a href="#/" ${active === 'home' ? 'aria-current="page"' : ''}>Azterketak</a>
      <a href="#/gimnasioa" ${active === 'gym' ? 'aria-current="page"' : ''}>Gimnasioa</a>
    </nav></div></header>`;
}

/* ---------- hasiera ---------- */
function statusOf(m) {
  const a = getAtt(m.id);
  if (!a) return { label: 'Hasi gabe', cls: '', href: `#/azterketa/${m.id}` };
  if (a.finished) {
    const r = a.result;
    const lab = r ? (r.pending ? `Eginda · ${fmt(r.total)}+` : `Eginda · ${fmt(r.total)}`) : 'Eginda';
    return { label: lab, cls: 'ok', href: `#/emaitza/${m.id}` };
  }
  const sec = SECTIONS.find((s) => s.id === a.section);
  return { label: `Abian · ${sec ? sec.label : ''}`, cls: 'on', href: `#/azterketa/${m.id}` };
}

function viewHome() {
  const filters = [['all', 'Denak'], ['X', '2026 ohikoa'], ['Y', '2026 ez-ohikoa'], ['Z', '2025 ohikoa'], ['W', '2025 ez-ohikoa']];
  const list = MODELS.filter((m) => ui.filter === 'all' || m.mota === ui.filter);
  const done = MODELS.map(getAtt).filter((a) => a && a.finished && a.result);
  const next = MODELS.find((m) => { const a = getAtt(m.id); return !a || !a.finished; }) || MODELS[0];
  const avg = done.length ? fmt(round(done.reduce((s, a) => s + a.result.total, 0) / done.length)) : null;
  app.innerHTML = `${top('home')}
  <main class="wrap">
    <section class="hero">
      <div class="main">
        <div class="eyebrow" style="color:var(--bar-muted)">Euskara eta Literatura II · USaP</div>
        <h1>Egin USaP-a, etxean eta lasai.</h1>
        <p>2027ko USaPeko egitura berria: ulermena eta idazlana, hizkuntza eta gizartea, eta literatura. Bukatzean, puntuz puntu jakingo duzu non irabazi eta non galdu duzun.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <a class="btn primary" href="#/azterketa/${next.id}">${getAtt(next.id) ? 'Jarraitu' : 'Hasi'}: ${esc(next.num)}. eredua</a>
          <a class="btn" style="border:1px solid #3A3E47;color:var(--bar-ink)" href="#/gimnasioa">Gimnasioa</a>
        </div>
        ${done.length ? `<p class="mono" style="font-size:14px">${done.length} eredu eginda · batez beste ${avg}</p>` : ''}
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="eyebrow">Arau ezkutuak</div>
        <h2 style="font-size:21px">Zuzentzaileak horrela kentzen ditu puntuak</h2>
        <div class="rules">
          <div><span>Idazlana 169–179 hitz</span><span class="mono">−0,5</span></div>
          <div><span>Idazlana 148 hitz edo gutxiago</span><span class="mono">−2,5</span></div>
          <div><span>Generoaren konbentziorik ez (izenburua, sinadura…)</span><span class="mono">−0,5</span></div>
          <div><span>Eskatutakoa ez den generoa</span><span class="mono">0 puntu</span></div>
          <div><span>Akats ortografikoa (lehena doan)</span><span class="mono">−0,25</span></div>
          <div><span>Laburpenean 60. hitzetik aurrerakoa</span><span class="mono" style="color:var(--muted)">ez da irakurtzen</span></div>
        </div>
      </div>
    </section>

    <div class="banner" role="note"><span><b>Probako bertsioa, 2027ko egiturarekin.</b> Ereduak eta galderak irakasle baten berrikuspenaren zain daude. Akatsen bat ikusten baduzu, esan zure irakasleari.</span></div>

    <section style="display:flex;flex-direction:column;gap:14px" aria-labelledby="ered-h">
      <div class="sechead">
        <h2 id="ered-h">20 azterketa-eredu</h2>
        <div class="seg" role="group" aria-label="Iragazi egituraren arabera">
          ${filters.map(([k, l]) => `<button data-act="filter" data-v="${k}" aria-pressed="${ui.filter === k}">${esc(l)}</button>`).join('')}
        </div>
      </div>
      <div class="grid">
        ${list.map((m) => { const st = statusOf(m); return `<a class="mcard" href="${st.href}">
          <div class="row"><span class="mono muted" style="font-size:13px">${esc(m.num)}. eredua</span><span class="mota" title="${esc(m.base)}">${m.mota}</span></div>
          <h3>${esc(m.title)}</h3>
          <div class="row"><span class="sub">${esc(m.base)} · ${m.a1.type === 'test' ? 'testa' : 'galdera irekiak'}</span><span class="chip ${st.cls}">${esc(st.label)}</span></div>
        </a>`; }).join('')}
      </div>
    </section>

    <section class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:20px">
      <div><b>Hizkuntza, automatikoki</b><p class="muted" style="font-size:15px;margin-top:4px">Testa, sinonimoak, aditzak, akatsak eta eratorpena txantiloiarekin zuzentzen dira.</p></div>
      <div><b>Idazlana, gizartea eta literatura, zuk</b><p class="muted" style="font-size:15px;margin-top:4px">Errubrikekin eta eredu-erantzunekin ebaluatzen duzu zure lana.</p></div>
      <div><b>Zure gailuan</b><p class="muted" style="font-size:15px;margin-top:4px">Konturik ez. Zure erantzunak nabigatzaile honetan gordetzen dira, eta ez dira inora bidaltzen.</p></div>
    </section>
    <footer class="footer"><span>Irizpideak: EHUren 2025 eta 2026ko USaPeko zuzenketa-irizpideak (Euskara eta Literatura II).</span><span>Nota orientagarria da, ez ofiziala.</span></footer>
  </main>`;
}

/* ---------- azterketa ---------- */
function viewExam(m) {
  let att = getAtt(m.id);
  if (att && att.finished) { location.hash = `#/emaitza/${m.id}`; return; }
  if (!att) att = newAtt(m);
  fixAtt(att);
  const sec = att.section;
  const wide = matchMedia('(min-width: 981px)').matches;
  const showReading = sec === 's11' || sec === 's21';
  app.innerHTML = `
  <div class="xbar"><div class="in">
    <div class="title"><a class="close" href="#/" aria-label="Itxi (zure erantzunak gordeta geratzen dira)">${icon.close}</a>
      <div style="min-width:0"><b>${esc(m.num)}. eredua · ${esc(m.title)}</b><br><span class="sub">Egitura: ${esc(m.base)} · erantzunak automatikoki gordetzen dira</span></div></div>
    <div class="tabs" role="tablist" aria-label="Azterketaren atalak">
      ${SECTIONS.map((s) => `<button role="tab" data-act="sec" data-v="${s.id}" aria-selected="${s.id === sec}" class="${hasAnswers(att, s.id) && s.id !== sec ? 'done' : ''}">${s.label}<small>${fmt(s.max)} p</small></button>`).join('')}
    </div>
    <div class="timer"><span class="t" id="timer" aria-label="Geratzen den denbora">${mmss(EXAM_MS - att.elapsed)}</span></div>
  </div><div class="progress"><div id="prog" style="width:${Math.min(100, (att.elapsed / EXAM_MS) * 100)}%"></div></div></div>
  <div class="xbody ${showReading ? '' : 'solo'}">
    ${showReading ? `<details class="reading" ${wide ? 'open' : ''}><summary>Irakurgaia <span class="muted" style="font-weight:400;font-size:14px">${wide ? '' : 'ireki'}</span></summary>${readingHtml(m)}</details>` : ''}
    <main class="task" id="task">${sectionHtml(m, att, sec)}</main>
  </div>`;
  live(m, att);
  ticker = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    att.elapsed += 1000;
    const left = EXAM_MS - att.elapsed;
    const t = document.getElementById('timer');
    if (!t) return;
    t.textContent = left > 0 ? mmss(left) : `+${mmss(-left)}`;
    t.classList.toggle('low', left < 10 * 60 * 1000);
    const p = document.getElementById('prog'); if (p) p.style.width = Math.min(100, (att.elapsed / EXAM_MS) * 100) + '%';
    if (att.elapsed % 10000 === 0) saveAtt(att);
  }, 1000);
  app.dataset.model = m.id;
  currentAtt = att;
}
let currentAtt = null;

// 2025–2026ko egiturako saiakerak egitura berrira egokitu
function fixAtt(att) {
  if (!SECTIONS.some((x) => x.id === att.section)) att.section = 's11';
  for (const k of ['ch21', 'ch22', 'ch3']) if (att.ans[k] === undefined) att.ans[k] = null;
  for (const k of ['ts22', 'ts3']) if (att.ans[k] === undefined) att.ans[k] = '';
}

function hasAnswers(att, id) {
  const a = att.ans;
  const f = (v) => JSON.stringify(v ?? '').replace(/"(opt|text|gaia|lab|w|r|word|suf)":/g, '').replace(/null/g, '').replace(/[{}[\]",:\s]/g, '').length > 0;
  if (id === 's11') return f(a.a1) || f(a.a2);
  if (id === 's12') return !!norm(a.b1.text);
  if (id === 's21') return a.ch21 === 0 || a.ch21 === 1;
  return !!norm(a['t' + id]);
}

function readingHtml(m) {
  return `<div class="txt"><h2>${esc(m.text.title)}</h2>${m.text.paragraphs.map((p, i) => `<p><span class="pn">${i + 1}</span>${esc(p)}</p>`).join('')}</div>`;
}

const qhead = (title, pts, forId) => `<div class="qh">${forId ? `<label for="${forId}">${esc(title)}</label>` : `<h3>${esc(title)}</h3>`}<span class="pts">${pts}</span></div>`;

function sectionHtml(m, att, sec) {
  const a = att.ans;
  const idx = SECTIONS.findIndex((s) => s.id === sec);
  const prev = SECTIONS[idx - 1], next = SECTIONS[idx + 1];
  const nav = `<div class="navrow">
    ${prev ? `<button class="btn ghost" data-act="sec" data-v="${prev.id}">← ${prev.label} ${esc(prev.name)}</button>` : '<span></span>'}
    ${next ? `<button class="btn primary" data-act="sec" data-v="${next.id}">${next.label} ${esc(next.name)} →</button>`
      : `<button class="btn accent" data-act="finish">${ui.confirm === 'finish' ? 'Ziur? Bai, amaitu eta zuzendu' : 'Amaitu eta zuzendu'}</button>`}
  </div>`;
  let body = '';
  if (sec === 's11') {
    if (m.a1.type === 'test') {
      body = `<div class="q">${qhead('1.1 Ulermenari buruzko galderak', '1 p · 0,2 galderako')}<p class="instr">Aukeratu erantzun zuzena (bakarra). Erantzun okerrek ez dute punturik kentzen.</p>
      <div class="items">${m.a1.questions.map((q, i) => `<fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:8px">
        <legend class="prompt" style="padding:0;margin-bottom:6px"><span class="mono muted" style="font-size:14px">${i + 1}.</span> ${md(q.q)}</legend>
        <div class="opts">${q.options.map((o) => `<label class="opt"><input type="radio" name="a1-${i}" value="${o.k}" data-path="a1.${i}" ${a.a1[i] === o.k ? 'checked' : ''}><span>${o.k}) ${md(o.t)}</span></label>`).join('')}</div>
      </fieldset>`).join('')}</div></div>`;
    } else {
      body = `<div class="q">${qhead('1.1 Ulermenari buruzko galderak', '1 p · 0,25 galderako')}<p class="instr">Erantzun galderei zure hitzak erabiliz, testutik kopiatu gabe.</p>
      <div class="items">${m.a1.questions.map((q, i) => `<div class="item"><span class="l">${LETTERS[i]})</span><div class="stack">
        <label class="prompt" for="a1-${i}">${md(q.q)}</label>
        <textarea id="a1-${i}" rows="3" data-path="a1.${i}">${esc(a.a1[i] || '')}</textarea></div></div>`).join('')}</div></div>`;
    }
  }
  if (sec === 's11') {
    body += `<div class="ctx"><div class="eyebrow">Testuingurua</div>${md(m.a2.context)}</div>
    <div class="q">${qhead('1.1 Gaia', '0,5 p · esaldi bakarra', 'a2-gaia')}
      <input type="text" id="a2-gaia" data-path="a2.gaia" value="${esc(a.a2.gaia)}" autocomplete="off">
      <div class="chips" id="gaia-live"></div></div>
    <div class="q">${qhead('1.1 Laburpena', '0,5 p · gehienez 60 hitz', 'a2-lab')}
      <p class="instr">Zure hitzekin. Ez kopiatu testuko esaldiak, eta ez erabili «egileak dioenez» erako egiturarik.</p>
      <textarea id="a2-lab" rows="7" data-path="a2.lab">${esc(a.a2.lab)}</textarea>
      <div id="lab-live" style="display:flex;flex-direction:column;gap:10px"></div></div>`;
  } else if (sec === 's21') {
    const ch = a.ch21;
    body = `<div class="ctx"><div class="eyebrow">2.1 Hizkuntza · 1,5 p</div>Bi galdera dituzu: aukeratu <b>bat</b> eta erantzun hari bakarrik.</div>
    <div class="genres">${[0, 1].map((i) => `<button class="genre" data-act="choose" data-k="ch21" data-v="${i}" aria-pressed="${ch === i}"><b>${i ? 'B' : 'A'} · ${esc(m.a3[i].title)}</b><span>${md(m.a3[i].instr)}</span></button>`).join('')}</div>
    ${ch === 0 || ch === 1 ? `<div class="q">${qhead(`2.1 ${m.a3[ch].title}`, '1,5 p · 0,3 itemeko')}<p class="instr">${md(m.a3[ch].instr)}</p>${a3Html(m, m.a3[ch], ch, a.a3[ch])}</div>` : ''}`;
  } else if (sec === 's22' || sec === 's3') {
    const pk = picks(m, BANKS)[sec];
    const ch = a['ch' + sec];
    const max = sec === 's22' ? '1,5' : '3';
    const qt = (q) => (sec === 's22' ? `${q.arloa} · ${q.izenburua}` : q.autorea ? `Gaitegia · ${q.autorea}` : `Irakurgaia · ${q.liburua}`);
    body = `<div class="ctx"><div class="eyebrow">${sec === 's22' ? '2.2 Gizartea' : '3. Literatura'} · ${max} p</div>Bi galdera dituzu: aukeratu <b>bat</b> eta erantzun hari bakarrik.</div>
    <div class="genres">${pk.map((q, i) => `<button class="genre" data-act="choose" data-k="ch${sec}" data-v="${i}" aria-pressed="${ch === i}"><b>${i ? 'B' : 'A'} · ${esc(qt(q))}</b><span>${esc(q.galdera)}</span></button>`).join('')}</div>
    ${ch === 0 || ch === 1 ? `<div class="q">${qhead(qt(pk[ch]), max + ' p', 'open-text')}
      ${pk[ch].testua ? `<blockquote style="white-space:pre-line">${esc(pk[ch].testua)}</blockquote>` : ''}
      <p class="prompt">${esc(pk[ch].galdera)}</p>
      <textarea id="open-text" rows="12" data-path="t${sec}">${esc(a['t' + sec] || '')}</textarea>
      <p class="muted" id="open-live" style="font-size:14px"></p></div>` : ''}`;
  } else if (sec === 's12') {
    body = `<div class="ctx"><div class="eyebrow">Testuingurua</div>${md(m.b1.context)}</div>
    <div class="banner" role="note"><span><b>2027: idazlanak 2 puntu balio ditu.</b> Hitz-muga eta kenketak ez daude oraindik berretsita: hemen 2025–2026ko arauak aplikatzen dira (4 puntutan), eta emaitza erdira eskalatzen da.</span></div>
    <div class="genres">${m.b1.options.map((o) => `<button class="genre" data-act="genre" data-v="${o.label}" aria-pressed="${a.b1.opt === o.label}"><b>${o.label} · ${esc(o.genre)}</b><span>${md(o.desc.charAt(0).toUpperCase() + o.desc.slice(1))}</span></button>`).join('')}</div>
    <div class="b1grid"><div class="q">${qhead('1.2 Ekoizpen idatzia', '2 p · gutxienez 180 hitz', 'b1-text')}
      <textarea id="b1-text" rows="22" data-path="b1.text" placeholder="${a.b1.opt ? '' : 'Lehenik, aukeratu generoa goian.'}">${esc(a.b1.text)}</textarea></div>
      <aside class="q b1side" id="b1-live" aria-label="Idazlanaren egoera"></aside></div>`;
  }
  return body + nav;
}

function a3Html(m, b, bi, ans) {
  const p = (ii, extra = '') => `a3.${bi}.${ii}${extra}`;
  if (b.kind === 'akatsak') {
    return `<blockquote>${esc(b.text)}</blockquote>
    <div class="items">${ans.map((row, i) => `<div class="item"><span class="l">${i + 1}</span><div class="pair">
      <input type="text" aria-label="${i + 1}. akatsa" placeholder="Akatsa" data-path="${p(i, '.w')}" value="${esc(row.w)}" autocomplete="off">
      <span class="arrow" aria-hidden="true">→</span>
      <input type="text" aria-label="${i + 1}. zuzenketa" placeholder="Zuzenketa" data-path="${p(i, '.r')}" value="${esc(row.r)}" autocomplete="off"></div></div>`).join('')}</div>`;
  }
  if (b.kind === 'eratorpena') {
    return `<div class="items">${ans.map((row, i) => `<div class="item"><span class="l">${i + 1}</span><div class="pair">
      <input type="text" aria-label="${i + 1}. hitza" placeholder="Testuko hitza" data-path="${p(i, '.word')}" value="${esc(row.word)}" autocomplete="off">
      <span class="arrow" aria-hidden="true">·</span>
      <input type="text" aria-label="${i + 1}. atzizkia" placeholder="Atzizkia (adib. -tasun)" data-path="${p(i, '.suf')}" value="${esc(row.suf)}" autocomplete="off"></div></div>`).join('')}</div>`;
  }
  return `<div class="items">${b.items.map((it, i) => {
    const id = `a3-${bi}-${i}`;
    let prompt = '';
    if (b.kind === 'sinonimoak') prompt = `<b style="font-family:var(--display)">${esc(it.w)}</b>`;
    if (b.kind === 'definizioak') prompt = md(it.def);
    if (b.kind === 'aditzak') prompt = `${esc(it.sentence)} <span class="muted" style="font-size:15px">(${esc(it.hint)})</span>`;
    if (b.kind === 'berridazketak') prompt = `${esc(it.sentence)}${it.element ? ` <span class="chip on" style="font-size:12px">Erabili: ${esc(it.element)}</span>` : ''}`;
    const field = b.kind === 'berridazketak'
      ? `<textarea id="${id}" rows="2" data-path="${p(i)}">${esc(ans[i] || '')}</textarea>`
      : `<input type="text" id="${id}" data-path="${p(i)}" value="${esc(ans[i] || '')}" autocomplete="off">`;
    return `<div class="item"><span class="l">${LETTERS[i]})</span><div class="stack"><label class="prompt" for="${id}">${prompt}</label>${field}</div></div>`;
  }).join('')}</div>`;
}

function meterHtml(n, max, label) {
  const over = n > max;
  return `<div class="meter"><div class="bar"><div class="${over ? 'over' : ''}" style="width:${Math.min(100, (n / max) * 100)}%"></div></div><span class="mono" style="font-size:14px">${n} / ${max}</span></div>${label || ''}`;
}

function live(m, att) {
  const a = att.ans;
  const src = textNormOf(m);
  const gaia = document.getElementById('gaia-live');
  if (gaia) {
    const t = a.a2.gaia.trim();
    const sentences = t.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean).length;
    const copy = copiedChunk(t, src, 5);
    gaia.innerHTML = t ? [chip(sentences <= 1, sentences <= 1 ? 'Esaldi bakarra' : `${sentences} esaldi: bakarra erabili`),
      chip(!copy, copy ? `Testutik kopiatua: «${copy}»` : 'Zure hitzekin')].join('') : '';
  }
  const lab = document.getElementById('lab-live');
  if (lab) {
    const n = countWords(a.a2.lab);
    const egile = /egile(ak|aren)?\s+(dio|dioenez|arabera)|egilearen\s+ustez/i.test(a.a2.lab);
    const copy = copiedChunk(a.a2.lab, src);
    lab.innerHTML = meterHtml(n, 60, n > 60 ? `<div class="chips">${chip(false, `${n - 60} hitz gehiegi: 60. hitzetik aurrerakoa ez da kontuan hartzen`)}</div>` : '')
      + (n ? `<div class="chips">${chip(!egile, egile ? '«Egileak dioenez» erako egitura: kendu' : 'Ez dago «egileak dioenez» egiturarik')}${chip(!copy, copy ? `Testutik hitzez hitz: «${copy}»` : 'Ez da kopiatutako zatirik aurkitu')}</div>` : '');
  }
  const b1 = document.getElementById('b1-live');
  if (b1) {
    const text = a.b1.text;
    const n = countWords(text);
    const wp = wordPenalty(n);
    const opt = m.b1.options.find((o) => o.label === a.b1.opt);
    const conv = opt ? conventions(opt.genre, text) : [];
    const conns = usedConnectors(text);
    const usedCount = conns.filter((c) => c.used).length;
    b1.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="mono" style="font-size:34px;line-height:1">${n}</span><span class="muted">hitz · ${n >= 180 ? 'nahikoa' : `${180 - n} falta 180era iristeko`}</span></div>
      <div class="bands" aria-label="Hitz-kopuruagatiko kenketak">${PENALTY_BANDS.map(([r, pen]) => `<div class="${pen === wp ? `on ${pen === 0 ? 'ok' : ''}` : ''}"><span>${r}</span><b>${pen ? '−' + fmt(pen) : '0'}</b></div>`).join('')}</div>
      <p style="font-size:14px">${n === 0 ? 'Idazten hasi ahala, hemen ikusiko duzu zenbat puntu galduko zenituzkeen hitz-kopuruagatik.' : wp ? `Orain bidaliz gero, <b>−${fmt(wp)} puntu</b> kenduko lizkizukete hitz-kopuruagatik, idazlana ona izanda ere.` : 'Ez dago hitz-kopuruagatiko kenketarik.'}</p>
      ${opt ? `<div style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">Generoaren konbentzioak · ${esc(opt.genre)}</div><div class="chips">${conv.map((c) => chip(c.ok, c.label)).join('')}</div>
        <p class="muted" style="font-size:13px">${conv.filter((c) => !c.ok).map((c) => `${esc(c.label)}: ${esc(c.hint)}`).join(' · ') || 'Konbentzio guztiak daudela dirudi.'}</p></div>`
        : '<p class="chip bad" style="align-self:flex-start">Aukeratu generoa goian</p>'}
      <div style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">Lokailuak · ${usedCount} desberdin</div>
        <div class="chips">${conns.map((c) => `<span class="chip ${c.used ? 'on' : ''}">${esc(c.c)}</span>`).join('')}</div></div>`;
  }
  const ol = document.getElementById('open-live');
  if (ol) { const n = countWords(getPath(a, document.getElementById('open-text').dataset.path)); ol.textContent = n ? `${n} hitz` : ''; }
  const b2 = document.getElementById('b2-live');
  if (b2) {
    const n = countWords(a.b2.text);
    b2.innerHTML = meterHtml(n, 50, n > 50 ? `<div class="chips" style="margin-top:8px">${chip(false, '50 hitz baino gehiago: laburtu')}</div>` : '');
  }
}

/* ---------- emaitzak ---------- */
function viewResult(m) {
  const att = getAtt(m.id);
  if (!att) { location.hash = `#/azterketa/${m.id}`; return; }
  fixAtt(att);
  if (!att.finished) { att.finished = true; att.finishedAt = Date.now(); }
  const sc = score(m, att, BANKS);
  att.result = { total: sc.total, pending: sc.pending };
  saveAtt(att);
  const s = att.self;
  const tag = (p) => (p.pending ? `<span class="tag todo">${p.pending} ebaluatzeko</span>` : p.mode === 'auto' ? '<span class="tag auto">automatikoa</span>' : p.mode === 'mixed' ? '<span class="tag auto">automatikoa + zuk</span>' : '<span class="tag self">zuk ebaluatua</span>');
  const y = window.scrollY;
  app.innerHTML = `${top('home')}
  <main class="wrap" style="gap:24px">
    <div class="sechead">
      <div><div class="eyebrow">Emaitza · ${esc(m.num)}. eredua · ${mmss(att.elapsed)} erabilita</div><h1 style="font-size:clamp(28px,4vw,40px)">${esc(m.title)}</h1></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" data-act="restart">${ui.confirm === 'restart' ? 'Ziur? Erantzun guztiak ezabatuko dira' : 'Berriz egin'}</button>
        <a class="btn primary" href="#/">Azterketak</a>
      </div>
    </div>

    <section class="score">
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div class="eyebrow">Zure nota orientagarria</div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="big">${fmt(sc.total)}</span><span class="muted" style="font-size:18px">/ 10</span></div>
        <p style="font-size:15px">${sc.pending ? `<b>Partziala.</b> ${sc.pending} zati falta zaizkizu ebaluatzeko: jarraitu behean, eta nota eguneratu egingo da.` : 'Ebaluazio osoa. Gogoratu: idazlanaren eta galdera irekien puntuak zuk erabaki dituzu, errubrikarekin.'}</p>
      </div>
      <div class="card lines">
        ${SECTIONS.map((sec) => { const p = sc.parts[sec.id]; return `<div><span>${sec.label} ${esc(sec.name)} ${tag(p)}</span><span class="mono">${fmt(p.pts)} / ${fmt(sec.max)}</span></div>`; }).join('')}
        <div><span class="pen">Zuzentasuna (ortografia eta gramatika)</span><span class="mono pen">${sc.pen ? '−' + fmt(sc.pen) : '0'}</span></div>
      </div>
    </section>

    ${resA1(m, att, s)}
    ${resA2(m, att, s)}
    ${resB1(m, att, s, sc.parts.s12.b1)}
    ${att.ans.ch21 === 0 || att.ans.ch21 === 1 ? resA3(m, att, att.ans.ch21) : '<section class="card"><h2 style="font-size:20px">2.1 Hizkuntza</h2><p class="muted">Ez duzu galderarik aukeratu: 0 puntu.</p></section>'}
    ${resOpen(m, att, s, 's22')}
    ${resOpen(m, att, s, 's3')}
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:20px">Zuzentasuna</h2>
      <p class="muted" style="font-size:15px">Irakurri berriro zure erantzunak eta zenbatu akatsak. Lehen akats ortografikoa doan da; akats bera errepikatuz gero, behin bakarrik zenbatzen da. Gehienez −2 puntu guztira, eta gramatikagatik −1.</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <label style="display:flex;gap:10px;align-items:center">Akats ortografikoak <input type="number" min="0" max="20" data-self="ort" value="${s.ort ?? 0}"></label>
        <label style="display:flex;gap:10px;align-items:center">Gramatika-akatsak <input type="number" min="0" max="20" data-self="gram" value="${s.gram ?? 0}"></label>
      </div>
    </section>
  </main>`;
  window.scrollTo(0, y);
}

const segBtns = (key, values, cur) => `<div class="seg">${values.map(([v, l]) => `<button data-act="self" data-k="${key}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
const yours = (t) => `<div><div class="eyebrow">Zure erantzuna</div>${t ? esc(t) : '<span class="muted">(hutsik)</span>'}</div>`;

function resA1(m, att, s) {
  const a = att.ans.a1;
  if (m.a1.type === 'test') {
    return `<section class="card"><h2 style="font-size:20px;margin-bottom:8px">1.1 Ulermena · galderak</h2>${m.a1.questions.map((q, i) => {
      const ok = a[i] === q.correct;
      const corr = q.options.find((o) => o.k === q.correct);
      return `<div class="res"><span class="mark ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'}</span><div class="body"><span>${i + 1}. ${md(q.q)}</span>
        <span class="muted">${a[i] ? `Zuk: ${a[i]})` : 'Erantzunik ez'}${ok ? '' : ` · Zuzena: <b>${corr.k}) ${md(corr.t)}</b>`}</span></div><span class="mono">${ok ? '0,4' : '0'}</span></div>`;
    }).join('')}</section>`;
  }
  return `<section class="card" style="display:flex;flex-direction:column;gap:16px"><h2 style="font-size:20px">A.1 Ulermena</h2>
    <p class="muted" style="font-size:15px">Alderatu zure erantzuna ereduarekin. Zuzentzaileek ikuspegi zabala erabiltzen dute: ideia bera zure hitzekin badago, zuzena da.</p>
    ${m.a1.questions.map((q, i) => `<div style="display:flex;flex-direction:column;gap:8px"><b>${LETTERS[i]}) ${md(q.q)}</b>
      <div class="cmp">${yours(a[i])}<div class="model"><div class="eyebrow">Erantzun-eredua</div>${md(q.answer)}</div></div>
      ${norm(a[i]) ? segBtns(`a1.${i}`, [[0.5, 'Zuzena'], [0.25, 'Erdizka'], [0, 'Okerra']], s.a1?.[i]) : '<span class="muted">Erantzunik gabe: 0</span>'}</div>`).join('')}
  </section>`;
}

function resA2(m, att, s) {
  const a = att.ans.a2;
  const n = countWords(a.lab);
  const labShown = n > 60 ? a.lab.trim().split(/\s+/).slice(0, 60).join(' ') + ' […]' : a.lab;
  return `<section class="card" style="display:flex;flex-direction:column;gap:16px"><h2 style="font-size:20px">1.1 Ulermena · gaia eta laburpena</h2>
    <b>Gaia</b><div class="cmp">${yours(a.gaia)}<div class="model"><div class="eyebrow">Eredua</div>${md(m.a2.gaia)}</div></div>
    ${norm(a.gaia) ? segBtns('gaia', [[0.5, 'Gaia zehatz jasota · 0,5'], [0.25, 'Erdizka · 0,25'], [0, 'Ez · 0']], s.gaia) : ''}
    <b>Laburpena <span class="muted mono" style="font-weight:400;font-size:13px">${n} hitz${n > 60 ? ' · lehen 60ak bakarrik' : ''}</span></b>
    <div class="cmp">${yours(labShown)}<div class="model"><div class="eyebrow">Eredu-laburpena</div>${md(m.a2.laburpena)}</div></div>
    <ul class="muted" style="margin:0;padding-left:20px;font-size:14px"><li>Ideia nagusi guztiak jaso dituzu?</li><li>Zure hitzekin idatzi duzu, kopiatu gabe?</li><li>Trinkoa, koherentea eta kohesionatua da?</li></ul>
    ${norm(a.lab) ? segBtns('lab', [[1, 'Oso ona'], [0.75, 'Ona'], [0.5, 'Erdizka'], [0.25, 'Ahula'], [0, 'Ez']], s.lab) : ''}
  </section>`;
}

function resA3(m, att, bi) {
  const b = m.a3[bi];
  const ans = att.ans.a3[bi];
  const r = gradeA3(m, bi, ans, att.self.a3);
  const rows = (b.kind === 'akatsak' || b.kind === 'eratorpena') ? ans : b.items;
  const okCount = r.items.filter((x) => x.state === 'ok').length;
  return `<section class="card"><div class="sechead" style="margin-bottom:8px"><h2 style="font-size:20px">2.1 Hizkuntza · ${esc(b.title)}</h2><span class="mono">${fmt(r.pts * 3)} / 1,5</span></div>
  ${b.kind === 'akatsak' ? `<p class="muted" style="font-size:14px;margin-bottom:6px">Akats guztiak: ${b.pairs.map((p) => `${esc(p.wrong)} → <b>${esc(p.right[0])}</b>`).join(' · ')}</p>` : ''}
  ${b.kind === 'eratorpena' ? `<p class="muted" style="font-size:14px;margin-bottom:6px">Aukerak: ${b.options.map((o) => `${esc(o.suffix)} (${esc(o.words.join(', '))})`).join(' · ')}</p>` : ''}
  ${rows.map((row, i) => {
    const st = r.items[i];
    const mark = st.state === 'ok' ? '<span class="mark ok">✓</span>' : st.state === 'todo' ? '<span class="mark todo">?</span>' : '<span class="mark bad">✗</span>';
    let body = '';
    if (b.kind === 'akatsak') body = `<span class="yours">${row.w || row.r ? `${esc(row.w)} → ${esc(row.r)}` : '<span class="muted">(hutsik)</span>'}</span>`;
    else if (b.kind === 'eratorpena') body = `<span class="yours">${row.word || row.suf ? `${esc(row.word)} · ${esc(row.suf)}` : '<span class="muted">(hutsik)</span>'}</span>${st.reason ? `<span class="muted">${esc(st.reason)}</span>` : ''}`;
    else {
      const label = b.kind === 'sinonimoak' ? `<b>${esc(row.w)}</b>` : b.kind === 'definizioak' ? md(row.def) : esc(row.sentence) + (row.hint ? ` <span class="muted">(${esc(row.hint)})</span>` : '') + (row.element ? ` <span class="muted">· ${esc(row.element)}</span>` : '');
      body = `<span>${LETTERS[i]}) ${label}</span><span class="yours">${ans[i] ? esc(ans[i]) : '<span class="muted">(hutsik)</span>'}</span>`;
      if (b.kind === 'berridazketak') body += `<span class="muted">Proposamena: ${esc(row.proposal)}</span>${st.reason ? `<span class="muted">${esc(st.reason)}</span>` : ''}`;
      else body += `<span class="muted">Onartuak: ${esc(row.accepted.join(', '))}</span>`;
    }
    let act = '';
    const key = `a3.${bi}.${i}`;
    if (b.kind === 'berridazketak' && st.state !== 'empty' && !st.reason) {
      act = `<div class="seg"><button data-act="self" data-k="${key}" data-v="true" aria-pressed="${st.self && st.state === 'ok'}">Esanahi bera</button><button data-act="self" data-k="${key}" data-v="false" aria-pressed="${st.self && st.state === 'bad'}">Ez</button></div>`;
    } else if (b.kind !== 'berridazketak' && (st.state === 'bad' || st.override)) {
      act = `<button class="linkbtn" data-act="ovr" data-k="${key}">${st.override ? 'Desegin' : 'Nirea ere zuzena da'}</button>`;
    }
    return `<div class="res">${mark}<div class="body">${body}</div><div>${act}</div></div>`;
  }).join('')}
  ${b.kind !== 'berridazketak' ? `<p class="muted" style="font-size:13px;margin-top:8px">«Nirea ere zuzena da»: zuzentzaileek zerrendan ez dauden sinonimo edo forma zuzenak ere onartzen dituzte. Erabili zintzotasunez. ${okCount > 5 ? 'Gehienez 5 item zenbatzen dira.' : ''}</p>` : ''}
  </section>`;
}

function resB1(m, att, s, p) {
  const a = att.ans.b1;
  if (!p.opt || !p.words) {
    return `<section class="card"><h2 style="font-size:20px">1.2 Idazlana</h2><p class="muted">Ez duzu idazlanik idatzi${p.opt ? '' : ' edo generoa aukeratu'}: 0 puntu.</p></section>`;
  }
  const rub = RUBRIC.map((_, i) => s.rub?.[i]);
  const band = p.band;
  const steps = band && band.hi > 0 ? [band.lo, band.lo + 0.25, band.lo + 0.5, band.lo + 0.75, band.hi] : [];
  return `<section class="card" style="display:flex;flex-direction:column;gap:16px">
    <div class="sechead"><h2 style="font-size:20px">1.2 Idazlana · ${esc(p.opt.genre)}</h2><span class="mono">${fmt(p.pts)} / 4 → ${fmt(p.pts / 2)} / 2</span></div>
    <div class="lines">
      <div><span>Hitz-kopurua: ${p.words}</span><span class="mono ${p.wp ? 'pen' : ''}">${p.wp ? '−' + fmt(p.wp) : '0'}</span></div>
      <div><span>Generoaren konbentzioak ${p.conv.map((c) => chip(c.ok, c.label)).join(' ')}</span><span class="mono ${p.convPen ? 'pen' : ''}">${p.convPen ? '−0,5' : '0'}</span></div>
    </div>
    ${p.conv.some((c) => !c.ok) ? `<label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" data-self="conv" ${s.conv ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)"> Begiratu dut, eta konbentzio guztiak badaude (detektagailuak huts egin du).</label>` : ''}
    <details class="more"><summary>Ikusi zure idazlana</summary><div style="white-space:pre-wrap;font:17px/1.6 var(--read);padding:12px 0">${esc(a.text)}</div></details>
    <div><div class="eyebrow" style="margin-bottom:4px">Kokatu zure idazlana: errubrika ofiziala, galderatan</div>
      ${RUBRIC.map(([q, note], i) => `<div class="crit"><span>${esc(q)}<br><span class="muted" style="font-size:12px">${esc(note)}</span></span>
        <div class="seg" style="flex:none"><button data-act="self" data-k="rub.${i}" data-v="true" aria-pressed="${rub[i] === true}">Bai</button><button data-act="self" data-k="rub.${i}" data-v="false" aria-pressed="${rub[i] === false}">Ez</button></div></div>`).join('')}
    </div>
    ${band ? `<div class="bandbox ${band.hi >= 2 ? '' : 'bad'}"><span style="font-size:14px">Zure erantzunen arabera:</span><b style="font-size:20px">${band.label}</b>
      ${steps.length ? `<span style="font-size:14px">Aukeratu puntuazioa banda barruan:</span>${segBtns('b1score', steps.map((v) => [v, fmt(v)]), p.chosen)}` : '<span style="font-size:14px">Generoa edo gaia betetzen ez bada, ariketa ez da puntuatzen.</span>'}
      <span style="font-size:13px">Azken puntuazioa: ${fmt(p.chosen ?? 0)} ${p.wp ? `− ${fmt(p.wp)} (hitzak)` : ''} ${p.convPen ? '− 0,5 (konbentzioak)' : ''} = <b>${fmt(p.pts)}</b></span></div>`
      : '<p class="muted" style="font-size:14px">Erantzun galdera guztiei banda ikusteko.</p>'}
    <details class="more"><summary>Txantiloiaren oharrak</summary><p style="padding-top:8px;font-size:15px">${md(m.b1.notes)}</p></details>
  </section>`;
}

function resOpen(m, att, s, id) {
  const max = id === 's22' ? 1.5 : 3;
  const name = id === 's22' ? '2.2 Gizartea' : '3. Literatura';
  const ch = att.ans['ch' + id];
  const text = att.ans['t' + id] || '';
  if (!(ch === 0 || ch === 1) || !norm(text)) return `<section class="card"><h2 style="font-size:20px">${name}</h2><p class="muted">Ez duzu erantzunik idatzi: 0 puntu.</p></section>`;
  const q = picks(m, BANKS)[id][ch];
  const ticks = s['k' + id];
  const v = keyScore(ticks, q.gakoak.length, max);
  return `<section class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="sechead"><h2 style="font-size:20px">${name} · ${esc(q.izenburua)}</h2><span class="mono">${v === null ? '—' : fmt(v)} / ${fmt(max)}</span></div>
    <p style="font:18px/1.5 var(--read)">${esc(q.galdera)}</p>
    <div class="cmp">${yours(text)}<div class="model">${q.eredua ? `<div class="eyebrow">Eredu-erantzuna</div>${esc(q.eredua)}` : '<div class="eyebrow">Eredu-erantzunik ez</div>Irakurgaiei buruzko galderetan zure irakurketa da gakoa: erabili beheko zerrenda zure erantzuna ebaluatzeko.'}</div></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Markatu zure erantzunak betetzen dituen gakoak · ${fmt(max)} p, proportzioan</div>
      ${q.gakoak.map((g, i) => `<label class="crit" style="justify-content:flex-start;gap:12px;cursor:pointer"><input type="checkbox" data-tick="${id}" data-i="${i}" ${Array.isArray(ticks) && ticks[i] ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent);flex:none"><span>${esc(g)}</span></label>`).join('')}</div>
    ${Array.isArray(ticks) ? '' : `<button class="btn ghost" data-act="tick-none" data-k="${id}" style="align-self:flex-start">Ez dut bat ere betetzen</button>`}
  </section>`;
}

function resB2(m, att, s) {
  const a = att.ans.b2.text;
  return `<section class="card" style="display:flex;flex-direction:column;gap:14px"><h2 style="font-size:20px">B.2 Egin lotura <span class="mono muted" style="font-size:13px;font-weight:400">${countWords(a)} hitz</span></h2>
    <div class="cmp">${yours(a)}<div class="model"><div class="eyebrow">Eredu-erantzuna</div>${md(m.b2.model)}</div></div>
    <ul class="muted" style="margin:0;padding-left:20px;font-size:14px"><li>Testuaren ideia nagusia ondo interpretatu duzu?</li><li>Irakurgaiarekiko lotura koherentea eta argudiatua da?</li></ul>
    ${norm(a) ? segBtns('b2', [[1, '1'], [0.75, '0,75'], [0.5, '0,5'], [0.25, '0,25'], [0, '0']], s.b2) : '<span class="muted">Erantzunik gabe: 0</span>'}
  </section>`;
}

/* ---------- gimnasioa ---------- */
const GYM = {
  sinonimoak: { name: 'Sinonimoak', desc: 'Hitz bat bere testuinguruan: eman sinonimo bat.' },
  aditzak: { name: 'Aditza moldatu', desc: 'Denbora, modua, ahalera eta baldintza.' },
  definizioak: { name: 'Definizioak', desc: 'Definizio bat eta paragrafo bat: aurkitu hitza.' },
};

function sentences(m) {
  return m.text.paragraphs.flatMap((p) => p.split(/(?<=[.!?])\s+/));
}
function highlight(sentence, word) {
  const stem = norm(word).slice(0, Math.max(4, norm(word).length - 2));
  return esc(sentence).replace(/[\p{L}-]+/gu, (tok) => (norm(tok).startsWith(stem) ? `<mark>${tok}</mark>` : tok));
}
function pool(type) {
  const out = [];
  MODELS.forEach((m) => m.a3.forEach((b) => {
    if (type === 'sinonimoak' && b.kind === 'sinonimoak') b.items.forEach((it) => {
      const stem = norm(it.w).slice(0, Math.max(4, norm(it.w).length - 2));
      const sent = sentences(m).find((x) => norm(x).includes(stem));
      out.push({ prompt: sent ? highlight(sent, it.w) : `<mark>${esc(it.w)}</mark>`, ask: `Eman «${it.w}» hitzaren sinonimo bat, testuinguru honetan.`, accepted: it.accepted, match: loose, src: m });
    });
    if (type === 'aditzak' && b.kind === 'aditzak') b.items.forEach((it) => {
      out.push({ prompt: esc(it.sentence), ask: `(${it.hint})`, accepted: it.accepted, match: exact, src: m });
    });
    if (type === 'definizioak' && b.kind === 'definizioak') b.items.forEach((it) => {
      const stem = norm(it.accepted[0]).slice(0, Math.max(4, norm(it.accepted[0]).length - 2));
      const par = m.text.paragraphs.find((p) => norm(p).includes(stem)) || '';
      out.push({ prompt: md(it.def), ask: 'Aurkitu paragrafo honetan definizio horri dagokion hitza:', para: par, accepted: it.accepted, match: loose, src: m });
    });
  }));
  return out;
}

function viewGym() {
  const stats = store.get('gym', {});
  app.innerHTML = `${top('gym')}
  <main class="wrap">
    <div style="display:flex;flex-direction:column;gap:8px"><h1 style="font-size:clamp(30px,4vw,44px)">Gimnasioa</h1>
      <p class="muted" style="max-width:62ch;font-size:17px">A.3ko ariketak banan-banan, 20 ereduetako item guztiekin. Saio bakoitza 10 itemekoa da, eta berehala ikusiko duzu zuzena den.</p></div>
    <div class="grid">${Object.entries(GYM).map(([k, g]) => {
      const st = stats[k] || { ok: 0, total: 0 };
      const pct = st.total ? Math.round((st.ok / st.total) * 100) : 0;
      return `<div class="card stat"><div class="row" style="display:flex;justify-content:space-between"><span class="eyebrow">A.3</span><span class="mono" style="font-size:13px">${st.total ? pct + '%' : '—'}</span></div>
        <h2 style="font-size:22px">${g.name}</h2><p class="muted" style="font-size:14px">${g.desc} ${pool(k).length} item.</p>
        <div class="meterbar"><div style="width:${pct}%"></div></div>
        <a class="btn primary" href="#/gimnasioa/${k}" style="margin-top:6px">Hasi saioa</a></div>`;
    }).join('')}</div>
  </main>`;
}

function viewDrill(type) {
  if (!GYM[type]) { location.hash = '#/gimnasioa'; return; }
  if (!ui.gym || ui.gym.type !== type) {
    const all = pool(type).sort(() => Math.random() - 0.5).slice(0, 10);
    ui.gym = { type, items: all, i: 0, answer: '', checked: false, ok: false, results: [] };
  }
  const g = ui.gym;
  if (g.i >= g.items.length) {
    const ok = g.results.filter(Boolean).length;
    app.innerHTML = `${top('gym')}<main class="wrap"><div class="drill">
      <div class="eyebrow">${GYM[type].name} · saioa amaituta</div>
      <div style="display:flex;align-items:baseline;gap:10px"><span class="big">${ok}</span><span class="muted" style="font-size:20px">/ ${g.items.length}</span></div>
      <p>${ok >= 8 ? 'Oso ondo! Azterketan ' + fmt(Math.min(5, ok / 2) * 0.1) + ' puntu inguru ziurtatuta.' : 'Jarraitu entrenatzen: errepikatutako item zailak gogoratzen errazagoak izango dira.'}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-act="gym-again">Beste saio bat</button><a class="btn ghost" href="#/gimnasioa">Gimnasioa</a></div>
    </div></main>`;
    return;
  }
  const it = g.items[g.i];
  app.innerHTML = `${top('gym')}<main class="wrap"><div class="drill">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">${GYM[type].name} · ${g.i + 1} / ${g.items.length}</span><a class="linkbtn" href="#/gimnasioa">Utzi saioa</a></div>
    <div class="meter"><div class="bar"><div style="width:${(g.i / g.items.length) * 100}%"></div></div></div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <p class="prompt">${it.prompt}</p>
      ${it.para ? `<blockquote style="margin:0;padding:12px 14px;background:var(--ground);border-radius:10px;font:16px/1.6 var(--read)">${esc(it.para)}</blockquote>` : ''}
      <label for="gym-in" class="muted" style="font-size:15px">${esc(it.ask)}</label>
      <form id="gym-form" style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="text" id="gym-in" value="${esc(g.answer)}" autocomplete="off" style="flex:1 1 220px" ${g.checked ? 'readonly' : ''}>
        ${g.checked ? '' : '<button class="btn primary" type="submit">Egiaztatu</button>'}
      </form>
      ${g.checked ? `<div class="fb ${g.ok ? 'ok' : 'bad'}"><b>${g.ok ? 'Zuzena · +0,1' : 'Ez da zerrendakoa'}</b><span>Onartuak: ${esc(it.accepted.join(', '))}</span><span class="muted" style="font-size:13px">${esc(it.src.num)}. eredua · ${esc(it.src.title)}</span>
        ${g.ok ? '' : '<button class="linkbtn" data-act="gym-ovr" style="align-self:flex-start">Nirea ere zuzena da</button>'}</div>
        <button class="btn primary" data-act="gym-next">${g.i + 1 < g.items.length ? 'Hurrengoa →' : 'Ikusi emaitza'}</button>` : ''}
    </div></div></main>`;
  const input = document.getElementById('gym-in');
  if (!g.checked) input.focus();
  document.getElementById('gym-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (g.checked) return;
    g.answer = input.value;
    if (!norm(g.answer)) return;
    g.ok = it.accepted.some((acc) => it.match(g.answer, acc));
    g.checked = true;
    viewDrill(type);
  });
}

function gymRecord(type, ok) {
  const stats = store.get('gym', {});
  const st = stats[type] || { ok: 0, total: 0 };
  st.total++; if (ok) st.ok++;
  stats[type] = st;
  store.set('gym', stats);
}

/* ---------- gertaerak ---------- */
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.path && currentAtt) {
    const val = el.type === 'radio' ? el.value : el.value;
    setPath(currentAtt.ans, el.dataset.path, val);
    saveAtt(currentAtt);
    live(byId(currentAtt.id), currentAtt);
  }
});
app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.path && currentAtt && el.type === 'radio') { setPath(currentAtt.ans, el.dataset.path, el.value); saveAtt(currentAtt); }
  if (el.dataset.tick) {
    const m = byId(location.hash.split('/')[2]);
    const att = getAtt(m.id);
    const id = el.dataset.tick;
    const q = picks(m, BANKS)[id][att.ans['ch' + id]];
    const arr = Array.isArray(att.self['k' + id]) ? att.self['k' + id] : q.gakoak.map(() => false);
    arr[Number(el.dataset.i)] = el.checked;
    att.self['k' + id] = arr;
    saveAtt(att); viewResult(m); return;
  }
  if (el.dataset.self) {
    const m = byId(location.hash.split('/')[2]);
    const att = getAtt(m.id);
    att.self[el.dataset.self] = el.type === 'checkbox' ? el.checked : Math.max(0, parseInt(el.value || '0', 10) || 0);
    saveAtt(att);
    viewResult(m);
  }
});
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'filter') { ui.filter = el.dataset.v; viewHome(); return; }
  if (act === 'sec' && currentAtt) {
    currentAtt.section = el.dataset.v; saveAtt(currentAtt); ui.confirm = null;
    const m = byId(currentAtt.id);
    clearInterval(ticker); viewExam(m); window.scrollTo(0, 0); return;
  }
  if (act === 'choose' && currentAtt) {
    currentAtt.ans[el.dataset.k] = Number(el.dataset.v); saveAtt(currentAtt);
    clearInterval(ticker); viewExam(byId(currentAtt.id)); return;
  }
  if (act === 'genre' && currentAtt) {
    currentAtt.ans.b1.opt = el.dataset.v; saveAtt(currentAtt);
    document.querySelectorAll('.genre').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.dataset.v)));
    const ta = document.getElementById('b1-text'); if (ta) ta.placeholder = '';
    live(byId(currentAtt.id), currentAtt); return;
  }
  if (act === 'finish' && currentAtt) {
    if (ui.confirm !== 'finish') { ui.confirm = 'finish'; el.textContent = 'Ziur? Bai, amaitu eta zuzendu'; return; }
    currentAtt.finished = true; currentAtt.finishedAt = Date.now(); saveAtt(currentAtt);
    location.hash = `#/emaitza/${currentAtt.id}`; return;
  }
  const m = byId(location.hash.split('/')[2]);
  if (act === 'restart' && m) {
    if (ui.confirm !== 'restart') { ui.confirm = 'restart'; viewResult(m); return; }
    store.del('att:' + m.id); ui.confirm = null; location.hash = `#/azterketa/${m.id}`; return;
  }
  if (act === 'tick-none' && m) {
    const att = getAtt(m.id);
    const id = el.dataset.k;
    att.self['k' + id] = picks(m, BANKS)[id][att.ans['ch' + id]].gakoak.map(() => false);
    saveAtt(att); viewResult(m); return;
  }
  if (act === 'self' && m) {
    const att = getAtt(m.id);
    const raw = el.dataset.v;
    const v = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
    const k = el.dataset.k;
    if (k.startsWith('a3.')) { const [, bi, i] = k.split('.'); setPath(att.self, `a3.${bi}.${i}`, v); }
    else setPath(att.self, k, v);
    saveAtt(att); viewResult(m); return;
  }
  if (act === 'ovr' && m) {
    const att = getAtt(m.id);
    const [, bi, i] = el.dataset.k.split('.');
    const cur = getPath(att.self, `a3.${bi}.${i}`);
    setPath(att.self, `a3.${bi}.${i}`, cur === true ? null : true);
    saveAtt(att); viewResult(m); return;
  }
  if (act === 'gym-next' && ui.gym) {
    const g = ui.gym; g.results.push(g.ok); gymRecord(g.type, g.ok);
    g.i++; g.answer = ''; g.checked = false; g.ok = false; viewDrill(g.type); return;
  }
  if (act === 'gym-ovr' && ui.gym) { ui.gym.ok = true; viewDrill(ui.gym.type); return; }
  if (act === 'gym-again' && ui.gym) { const t = ui.gym.type; ui.gym = null; viewDrill(t); }
});
window.addEventListener('hashchange', () => { if (currentAtt) saveAtt(currentAtt); currentAtt = null; route(); });
window.addEventListener('pagehide', () => { if (currentAtt) saveAtt(currentAtt); });

/* ---------- abiaraztea ---------- */
const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
Promise.all([getJSON('data/ereduak.json'), getJSON('data/gizartea.json'), getJSON('data/literatura.json')])
  .then(([data, gizartea, literatura]) => { MODELS = data; BANKS = { gizartea, literatura }; route(); })
  .catch(() => { app.innerHTML = '<p class="loading">Ezin izan dira ereduak kargatu. Freskatu orria, mesedez.</p>'; });
