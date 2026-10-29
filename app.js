import {
  SECTIONS, RUBRIC, PENALTY_BANDS, norm, countWords, fmt, round, loose, synonym, exact, wordPenalty, conventions,
  usedConnectors, copiedChunk, bandFor, textNormOf, gradeA3, score, emptyAnswers, picks, keyScore,
} from './grading.js';

const EXAM_MS = 90 * 60 * 1000;
const app = document.getElementById('app');
let MODELS = [];
let BANKS = null;
let ui = { filter: 'all', confirm: null, gym: null, seen: {} };
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
  info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
  // zuzentzailearen marrak: eskuz egindako tika, gurutzea eta galdera-marka
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5c2 1.4 3.6 3 4.8 5.2C11.6 12 15.4 7.4 20.5 4.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5c4.6 4.4 8.6 9.2 13 14.5M18.8 5.2C13.6 9.4 9.4 14 5.2 19"/></svg>',
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M8.5 8.8a3.6 3.6 0 1 1 5.4 3.1c-1.2.7-1.9 1.4-1.9 2.9M12 18.6h.01"/></svg>',
};
// eskuz marraztutako zirkulua (zuzentzaileak nota inguratzen duen bezala)
const ringSvg = '<svg viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true"><path d="M58 6C30 3 6 14 5 34c-1 20 24 31 49 30 25-1 42-13 41-31C94 15 74 5 48 7"/></svg>';
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
  if (parts[0] === 'ikasi') { window.scrollTo(0, 0); return viewLearn(parts[1]); }
  if (parts[0] === 'pribatutasuna') { window.scrollTo(0, 0); return viewPrivacy(); }
  if (parts[0] === 'lege-oharra') { window.scrollTo(0, 0); return viewLegal(); }
  if (parts[0] === 'iturriak') { window.scrollTo(0, 0); return viewSources(); }
  return viewHome();
}

function top(active) {
  return `<header class="top"><div class="in">
    <a class="wordmark" href="#/">USaPeuskara<span>.</span></a>
    <nav class="nav" aria-label="Nagusia">
      <a href="#/" ${active === 'home' ? 'aria-current="page"' : ''}>Azterketak</a>
      <a href="#/ikasi" ${active === 'learn' ? 'aria-current="page"' : ''}>Ikasi</a>
      <a href="#/gimnasioa" ${active === 'gym' ? 'aria-current="page"' : ''}>Gimnasioa</a>
    </nav></div></header>`;
}

/* ---------- oina eta lege-orriak ---------- */
const EMAIL = 'info@berezuma.com';
const SITE = 'usapeuskara.berezuma.com';
const AUTHOR = 'Beñat Erezuma';
const UPDATED = '2026ko urriaren 27a';

function siteFoot() {
  return `<footer class="site-foot"><div class="in">
    <p class="name" aria-hidden="true">USaPeuskara<span>.</span></p>
    <nav class="foot-links" aria-label="Oina">
      <a href="#/iturriak">Iturriak eta irizpideak</a>
      <a href="#/pribatutasuna">Pribatutasuna</a>
      <a href="#/lege-oharra">Lege-oharra</a>
      <a href="mailto:${EMAIL}">${EMAIL}</a>
    </nav>
    <div class="foot-notes">
      <p>Beñat Erezumaren doako proiektu pertsonala, EHUrekin lotura ofizialik gabea. Irizpideak: EHUren 2025 eta 2026ko zuzenketa-irizpideak, eta 2027ko azterketa-ereduaren argibideak (2025eko azaroa); ikusi <a href="#/iturriak">iturriak</a>. Nota orientagarria da, ez ofiziala.</p>
      <p>Ez dago cookierik, konturik ez estatistikarik: zure erantzunak gailu honetan bakarrik gordetzen dira.</p>
    </div>
  </div></footer>`;
}

// gailu honetan gordetako gakoak (aurrerapena); ezabatzeko eskubidea bertan bertan erabil daiteke
function storedKeys() {
  try { return Object.keys(localStorage).filter((k) => k.startsWith('zuzen:')); } catch { return []; }
}

function viewPrivacy() {
  const n = storedKeys().length;
  app.innerHTML = `${top()}
  <main class="wrap narrow legal">
    <div class="page-h"><h1>Pribatutasun-politika</h1><p>Azken eguneratzea: ${UPDATED}.</p></div>
    <p class="lead-p">Laburbilduz: USaPeuskarak ez du zure daturik biltzen. Ez dago konturik, formulariorik, cookierik, estatistikarik ez publizitaterik. Zure erantzunak zure gailuan bakarrik gordetzen dira, eta zuk ezaba ditzakezu orri honetan bertan.</p>

    <section class="paper erase" aria-labelledby="erase-h">
      <h2 id="erase-h">Zure datuak gailu honetan</h2>
      <p id="erase-st">${n ? `Gailu honetan ${n} elementu daude gordeta: azterketa-saiakerak, erantzunak, autoebaluazioak eta gimnasioko emaitzak.` : 'Gailu honetan ez dago USaPeuskarako daturik gordeta.'}</p>
      ${n ? `<button class="btn ${ui.confirm === 'erase' ? 'red' : ''}" data-act="erase">${ui.confirm === 'erase' ? 'Ziur? Dena ezabatuko da, eta ezin da berreskuratu' : 'Ezabatu nire datu guztiak'}</button>` : ''}
    </section>

    <section class="stack"><h2>Arduraduna</h2>
      <p>Webgune honen arduraduna ${AUTHOR} da, USaPeuskara proiektuaren egilea (${SITE}). Harremanetarako: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p></section>

    <section class="stack"><h2>Zer gordetzen da, eta non</h2>
      <p>Aplikazioak nabigatzailearen <i>localStorage</i> biltegia erabiltzen du zure aurrerapena gordetzeko: azterketa bakoitzeko erantzunak, erabilitako denbora, zure autoebaluazioak eta gimnasioko asmatze-tasa. Datu horiek ez dira inoiz gure zerbitzarira edo beste inora bidaltzen; zure gailutik ez dira ateratzen, eta guk ezin ditugu ikusi.</p>
      <p>Biltegi hori zuk eskatutako zerbitzua emateko ezinbestekoa da (zure erantzunak ez galtzea), eta ez du zure jarraipenik egiten. Horregatik ez da baimenik eskatzen (Informazio Gizartearen Zerbitzuei buruzko 34/2002 Legea, 22.2 artikulua).</p></section>

    <section class="stack"><h2>Ostatua</h2>
      <p>Webgunea GitHub Pages-en dago (GitHub, Inc.). Edozein webgunetan bezala, zerbitzariak konexioaren datu teknikoak (IP helbidea, data eta nabigatzailea) erregistra ditzake segurtasunerako eta zerbitzua emateko, guk horietara sarbiderik izan gabe. Oinarri juridikoa interes legitimoa da (DBEO, 6.1.f artikulua). GitHub-ek datu horiek nola tratatzen dituen haren <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">pribatutasun-adierazpenean</a> azaltzen da, Europatik kanpoko transferentzietarako bermeak barne.</p>
      <p>Letra-motak eta gainerako fitxategi guztiak webgune beretik zerbitzatzen dira: ez da hirugarrenen zerbitzurik kargatzen (Google Fonts edo antzekorik ez).</p></section>

    <section class="stack"><h2>Zure eskubideak</h2>
      <p>Datuak babesteko araudiak (DBEO eta 3/2018 Lege Organikoa) eskubide hauek ematen dizkizu: sarbidea, zuzenketa, ezabaketa, aurka egitea, tratamendua mugatzea eta eramangarritasuna. Zure gailuko datuak zuk zeuk kontrolatzen dituzu: goiko botoiarekin ezaba ditzakezu, edo nabigatzailearen ezarpenetan webgune honen datuak garbituz. Bestelako zalantzarik baduzu, idatzi <a href="mailto:${EMAIL}">${EMAIL}</a> helbidera.</p>
      <p>Erreklamazioa aurkez dezakezu Datuak Babesteko Espainiako Agentzian (<a href="https://www.aepd.es" rel="noopener">aepd.es</a>).</p></section>

    <section class="stack"><h2>Adingabeak</h2>
      <p>Webgunea batxilergoko ikasleentzat da, eta ez du inoren daturik biltzen, ezta adingabeenik ere.</p></section>

    <section class="stack"><h2>Aldaketak</h2>
      <p>Politika hau aldatzen bada, orri honetan argitaratuko da, eguneratze-data aldatuta.</p></section>
  </main>${siteFoot()}`;
}

function viewLegal() {
  app.innerHTML = `${top()}
  <main class="wrap narrow legal">
    <div class="page-h"><h1>Lege-oharra</h1><p>Azken eguneratzea: ${UPDATED}.</p></div>
    <section class="stack"><h2>Titularra</h2>
      <p>Titularra eta egilea: ${AUTHOR}<br>Webgunea: ${SITE}<br>Proiektua: USaPeuskara<br>Harremanetarako: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
      <p>USaPeuskara doako proiektu pertsonala da, irabazi-asmorik gabea, eta ez du jarduera ekonomikorik.</p></section>
    <section class="stack"><h2>Helburua</h2>
      <p>Batxilergoko ikasleei USaPeko Euskara eta Literatura II azterketa prestatzen laguntzea: azterketa simulatzea eta zuzenketa-irizpide ofizialak ezagutzea.</p></section>
    <section class="stack"><h2>EHUrekiko lotura</h2>
      <p>USaPeuskarak ez du Euskal Herriko Unibertsitatearekin (EHU) lotura ofizialik. Azterketen egitura eta zuzenketa-irizpideak EHUk argitaratutako agiri publikoetatik hartu dira, iturri gisa aipatuta (ikusi <a href="#/iturriak">iturriak eta irizpideak</a>). Ereduak eta galderak proiektu honek sortuak dira, eta ez dira azterketa ofizialak.</p></section>
    <section class="stack"><h2>Erantzukizuna</h2>
      <p>Emandako nota orientagarria da, eta ez du azterketa ofizialeko emaitzarik bermatzen. Edukiak arretaz prestatu dira, baina akatsak egon daitezke; ikusten baduzu, idatzi <a href="mailto:${EMAIL}">${EMAIL}</a> helbidera.</p></section>
    <section class="stack"><h2>Jabetza intelektuala</h2>
      <p>Webgunearen testuak, ereduak eta diseinua Beñat Erezumarenak dira, eta hezkuntza-erabilerarako erabil daitezke, iturria aipatuta. Letra-motak: General Sans (Indian Type Foundry, ITF Free Font License) eta Literata (TypeTogether, SIL Open Font License).</p></section>
    <section class="stack"><h2>Pribatutasuna</h2>
      <p>Ez da daturik biltzen. Xehetasunak: <a href="#/pribatutasuna">pribatutasun-politika</a>.</p></section>
    <section class="stack"><h2>Lege aplikagarria</h2>
      <p>Lege-ohar hau Espainiako eta Europar Batasuneko legeriaren arabera arautzen da.</p></section>
  </main>${siteFoot()}`;
}

// tresnak erabiltzen dituen agiri ofizialak; aldatzen badira, eguneratu hemen eta grading.js-en
const SOURCES = [
  { title: 'USaP – Euskara eta literatura II irakasgairako argibideak', org: 'EHU', date: '2025' },
  { title: '2025 eta 2026ko azterketak eta zuzentzeko eta kalifikatzeko irizpideak (ohiko eta ez-ohiko deialdiak)', org: 'EHU', date: '2025–2026' },
];

function viewSources() {
  app.innerHTML = `${top()}
  <main class="wrap narrow legal">
    <div class="page-h"><h1>Iturriak eta irizpideak</h1><p>Azken berrikuspena: ${UPDATED}.</p></div>
    <p class="lead-p">USaPeuskara Batxilergoko ikasleei Euskara eta Literatura II azterketa prestatzen laguntzeko doako tresna bat da. Edukiak eta ariketak argitaratutako dokumentu ofizial hauetan oinarritzen dira:</p>

    <ul class="sources" aria-label="Dokumentu ofizialak">${SOURCES.map((d) => `
      <li><p class="src-t">${d.title}</p><p class="src-m">${d.org}, ${d.date}</p></li>`).join('')}
    </ul>

    <section class="stack">
      <p>Gaitegia edo azterketaren eredua aldatzen bada, tresna dokumentu ofizial berrietara egokituko da ahalik eta lasterren.</p>
      <p>USaPeuskara proiektu pertsonala eta independentea da, eta ez dago lotuta ez EHUrekin ez beste inongo erakunderekin. Ez du ordezkatzen ez azterketa ofiziala ez ikastetxeetako irakasleen lana; entrenatzeko baliabide osagarria da. Ematen duen nota orientagarria da, ez ofiziala.</p>
      <p>Akatsen bat ikusi baduzu edo dokumentu ofizial berri baten berri baduzu, idatzi <a href="mailto:${EMAIL}">${EMAIL}</a> helbidera.</p></section>
  </main>${siteFoot()}`;
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

// animazioak behin bakarrik: ikuspegi bakoitza lehen aldiz agertzen denean
function firstTime(k) { if (ui.seen[k]) return false; ui.seen[k] = true; return true; }
function reveal(first) {
  const els = app.querySelectorAll('.reveal');
  if (!first || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

const DEMO_WORDS = 142;
function demoHtml(n) {
  const wp = wordPenalty(n);
  return `<div class="verdict"><span class="ring ${wp ? '' : 'zero'}" id="demo-ring">${ringSvg}<span>${wp ? '−' + fmt(wp) : '0'}</span></span>
    <p>${wp ? `${n} hitzekin, <b>${fmt(wp)} puntu</b> kentzen dira, idazlana ona izanda ere.` : `${n} hitzekin ez dago kenketarik. Hortik behera hasten dira.`}</p></div>
    <div class="bands" aria-label="Hitz-kopuruagatiko kenketak">${PENALTY_BANDS.map(([r, pen]) => `<div class="${pen === wp ? `on ${pen === 0 ? 'ok' : ''}` : ''}"><span>${r}</span><b>${pen ? '−' + fmt(pen) : '0'}</b></div>`).join('')}</div>`;
}

function viewHome() {
  const filters = [['all', 'Denak'], ['X', '2026 ohikoa'], ['Y', '2026 ez-ohikoa'], ['Z', '2025 ohikoa'], ['W', '2025 ez-ohikoa']];
  const list = MODELS.filter((m) => ui.filter === 'all' || m.mota === ui.filter);
  const done = MODELS.map(getAtt).filter((a) => a && a.finished && a.result);
  const next = MODELS.find((m) => { const a = getAtt(m.id); return !a || !a.finished; }) || MODELS[0];
  const nextAtt = getAtt(next.id);
  const avg = done.length ? fmt(round(done.reduce((s, a) => s + a.result.total, 0) / done.length)) : null;
  const first = firstTime('home');
  app.innerHTML = `${top('home')}
  <section class="hero ${first ? 'enter' : ''}" aria-labelledby="hero-h"><div class="in">
    <div class="head"><h1 id="hero-h">Egin <span style="white-space:nowrap">USaP-a</span> etxean.</h1>
    <p class="lead rise" style="--i:1">Euskara eta Literatura II, indarreko ereduan: 90 minutu eta bost atal, zuzentzaileen irizpide ofizialetan oinarrituta zuzenduta. Bukatzean, puntuz puntu ikusiko duzu non irabazi eta non galdu duzun.
    ${done.length ? `<span class="stats"><b>${done.length}</b> eredu eginda · batez beste <b>${avg}</b></span>` : ''}
    <span class="src-note"><span>Indarreko dokumentu ofizialetan oinarritua</span> · <span>Proiektu independentea</span> · <a href="#/iturriak">Iturriak</a></span></p></div>
    <div class="folders">
      <ol style="list-style:none;margin:0;padding:0" aria-label="Azterketaren atalak">
        ${SECTIONS.map((s, i) => `<li class="folder f${i + 1}" style="--i:${i}"><span class="tab">${s.label} ${esc(s.name)} <small>${fmt(s.max)} p</small></span><div class="body"></div></li>`).join('')}
      </ol>
      <div class="folder front" style="--i:5">
        <div class="body">
          <div><h2>${esc(next.title)}</h2><p>${parseInt(next.num, 10)}. eredua · ${esc(next.base)} egitura · ${nextAtt ? 'erdizka utzi duzu, jarraitu nahi duzunean' : 'zure erantzunak gailu honetan gordetzen dira'}</p></div>
          <a class="btn primary" href="#/azterketa/${next.id}">${nextAtt ? 'Jarraitu azterketa' : 'Hasi azterketa'}</a>
        </div>
      </div>
    </div>
  </div></section>
  <main class="wrap">
    <section class="eyes" aria-labelledby="eyes-h">
      <div class="intro reveal">
        <h2 id="eyes-h">Zuzentzailearen begiekin</h2>
        <p>Zuzentzaileek arau zehatzak dituzte, eta ikasle askok azterketa-egunean ezagutzen dituzte lehen aldiz. Mugitu idazlanaren hitz-kopurua eta ikusi zer gertatzen den.</p>
        <a class="linkbtn" href="#/ikasi">Ikasi 2027ko eduki berriak</a>
      </div>
      <div class="slip reveal" style="--i:1">
        <div class="dial"><label for="demo-words">1.2 Idazlana <output id="demo-out" for="demo-words">${DEMO_WORDS} hitz</output></label>
          <input type="range" id="demo-words" min="110" max="170" step="1" value="${DEMO_WORDS}"></div>
        <div id="demo" aria-live="polite">${demoHtml(DEMO_WORDS)}</div>
        <p class="small muted">2025–2026ko araua, 4 puntutan. 2027ko muga ez dago oraindik berretsita.</p>
        <h3>Beste arau batzuk</h3>
        <div class="lines">
          <div class="leader"><span>2.1, 2.2 eta 3: bi galderatik bat</span><span>bakarra erantzun</span></div>
          <div class="leader"><span>Eskatutakoa ez den generoa</span><span class="minus">0 puntu</span></div>
          <div class="leader"><span>Akats ortografikoa (lehena doan)</span><span class="minus">−0,25</span></div>
          <div class="leader"><span>Laburpena, 60. hitzetik aurrera</span><span class="minus">ez da irakurtzen</span></div>
          <div class="leader total"><span>Azterketa osoa</span><span>10 puntu · 90 min</span></div>
        </div>
      </div>
    </section>

    <section class="stack" style="gap:20px" aria-labelledby="ered-h">
      <div class="index-head reveal">
        <div><h2 id="ered-h" class="sec-h">20 azterketa-eredu</h2>
          <p>Bakoitzak 2025 edo 2026ko azterketa ofizial baten egitura jarraitzen du, 2027ra egokituta.</p></div>
        <div class="seg" role="group" aria-label="Iragazi egituraren arabera">
          ${filters.map(([k, l]) => `<button data-act="filter" data-v="${k}" aria-pressed="${ui.filter === k}">${esc(l)}</button>`).join('')}
        </div>
      </div>
      <ol class="index reveal" style="--i:1">
        ${list.map((m) => { const st = statusOf(m); return `<li><a href="${st.href}">
          <span class="t">${esc(m.title)}</span>
          <span class="meta">${parseInt(m.num, 10)}. eredua · ${esc(m.base)} · ${m.a1.type === 'test' ? 'testa' : 'galdera irekiak'}</span>
          <span class="st chip ${st.cls}">${esc(st.label)}</span></a></li>`; }).join('')}
      </ol>
    </section>

    <section class="back reveal" aria-labelledby="back-h">
      <h2 id="back-h">Zure gailuan, zure erritmoan</h2>
      <dl>
        <div><dt>Hizkuntza, automatikoki</dt><dd>Testa, sinonimoak, aditzak, akatsak eta eratorpena txantiloiarekin zuzentzen dira.</dd></div>
        <div><dt>Idazlana, gizartea eta literatura, zuk</dt><dd>Errubrika ofizialaren galderekin eta eredu-erantzunekin ebaluatzen duzu zure lana.</dd></div>
        <div><dt>Konturik gabe</dt><dd>Zure erantzunak nabigatzaile honetan gordetzen dira, eta ez dira inora bidaltzen. Ikusi <a href="#/pribatutasuna">pribatutasun-politika</a>.</dd></div>
      </dl>
    </section>
  </main>${siteFoot()}`;
  reveal(first);
}

/* ---------- azterketa ---------- */
function viewExam(m) {
  let att = getAtt(m.id);
  if (att && att.finished) { location.hash = `#/emaitza/${m.id}`; return; }
  if (!att) att = newAtt(m);
  fixAtt(att);
  const sec = att.section;
  const showReading = sec === 's11' || sec === 's21';
  const left0 = EXAM_MS - att.elapsed;
  app.innerHTML = `
  <div class="xbar"><div class="in">
    <a class="close" href="#/" aria-label="Itxi (zure erantzunak gordeta geratzen dira)">${icon.close}</a>
    <div class="title"><h1>${esc(m.title)}</h1><span>${parseInt(m.num, 10)}. eredua · ${esc(m.base)} egitura · erantzunak automatikoki gordetzen dira</span></div>
    <div class="tabs" role="tablist" aria-label="Azterketaren atalak">
      ${SECTIONS.map((s) => `<button role="tab" data-act="sec" data-v="${s.id}" aria-selected="${s.id === sec}" class="${hasAnswers(att, s.id) && s.id !== sec ? 'done' : ''}">${s.label}<small>${fmt(s.max)} p</small></button>`).join('')}
    </div>
    <span class="timer ${left0 < 10 * 60 * 1000 ? 'low' : ''}" id="timer" role="timer" aria-label="Geratzen den denbora">${left0 > 0 ? mmss(left0) : '+' + mmss(-left0)}</span>
  </div><div class="progress"><div id="prog" style="transform:scaleX(${Math.min(1, att.elapsed / EXAM_MS)})"></div></div></div>
  <div class="xbody ${showReading ? '' : 'solo'}">
    ${showReading ? `<aside class="paper reading" aria-label="Irakurgaia">${readingHtml(m)}</aside>` : ''}
    <main class="task" id="task">${sectionHtml(m, att, sec)}</main>
  </div>
  ${showReading ? `<button class="btn ink sheet-btn" data-act="sheet-open">${icon.book} Irakurgaia</button>
  <dialog class="sheet" id="sheet" aria-label="Irakurgaia"><div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head"><b>Irakurgaia</b><button data-act="sheet-close" aria-label="Itxi irakurgaia">${icon.close}</button></div>
    <div class="sheet-body">${readingHtml(m)}</div></dialog>` : ''}`;
  live(m, att);
  document.getElementById('sheet')?.addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
  ticker = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    att.elapsed += 1000;
    const left = EXAM_MS - att.elapsed;
    const t = document.getElementById('timer');
    if (!t) return;
    t.textContent = left > 0 ? mmss(left) : `+${mmss(-left)}`;
    t.classList.toggle('low', left < 10 * 60 * 1000);
    const p = document.getElementById('prog'); if (p) p.style.transform = `scaleX(${Math.min(1, att.elapsed / EXAM_MS)})`;
    if (left <= 5 * 60 * 1000 && !att.warned5) { att.warned5 = true; saveAtt(att); timerAlert(left > 0 ? '5 minutu geratzen dira. Errepasatu erantzunak.' : 'Denbora amaitu da. Jarrai dezakezu, baina azterketan ez zenuke gehiago izango.'); }
    if (left <= 0 && !att.warned0) { att.warned0 = true; saveAtt(att); timerAlert('Denbora amaitu da. Jarrai dezakezu, baina azterketan ez zenuke gehiago izango.'); }
    if (att.elapsed % 10000 === 0) saveAtt(att);
  }, 1000);
  app.dataset.model = m.id;
  currentAtt = att;
}
function timerAlert(text) {
  document.querySelector('.timer-alert')?.remove();
  const el = document.createElement('div');
  el.className = 'timer-alert'; el.setAttribute('role', 'alert'); el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 7000);
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
        <legend class="prompt" style="padding:0;margin-bottom:6px"><span class="muted num">${i + 1}.</span> ${md(q.q)}</legend>
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
    body += `<div class="ctx"><b>Testuingurua.</b> ${md(m.a2.context)}</div>
    <div class="q">${qhead('1.1 Gaia', '0,5 p · esaldi bakarra', 'a2-gaia')}
      <input type="text" id="a2-gaia" data-path="a2.gaia" value="${esc(a.a2.gaia)}" autocomplete="off">
      <div class="chips" id="gaia-live"></div></div>
    <div class="q">${qhead('1.1 Laburpena', '0,5 p · gehienez 60 hitz', 'a2-lab')}
      <p class="instr">Zure hitzekin. Ez kopiatu testuko esaldiak, eta ez erabili «egileak dioenez» erako egiturarik.</p>
      <textarea id="a2-lab" rows="7" data-path="a2.lab">${esc(a.a2.lab)}</textarea>
      <div id="lab-live" style="display:flex;flex-direction:column;gap:10px"></div></div>`;
  } else if (sec === 's21') {
    const ch = a.ch21;
    body = `<div class="ctx"><b>2.1 Hizkuntza · 1,5 p.</b> Bi galdera dituzu: aukeratu <b>bat</b> eta erantzun hari bakarrik.</div>
    <div class="choices">${[0, 1].map((i) => `<button class="choice" data-act="choose" data-k="ch21" data-v="${i}" aria-pressed="${ch === i}"><b>${i ? 'B' : 'A'} · ${esc(m.a3[i].title)}</b><span>${md(m.a3[i].instr)}</span></button>`).join('')}</div>
    ${ch === 0 || ch === 1 ? `<div class="q">${qhead(`2.1 ${m.a3[ch].title}`, '1,5 p · 0,3 itemeko')}<p class="instr">${md(m.a3[ch].instr)}</p>${a3Html(m, m.a3[ch], ch, a.a3[ch])}</div>` : ''}`;
  } else if (sec === 's22' || sec === 's3') {
    const pk = picks(m, BANKS)[sec];
    const ch = a['ch' + sec];
    const max = sec === 's22' ? '1,5' : '3';
    const qt = (q) => (sec === 's22' ? `${q.arloa} · ${q.izenburua}` : q.autorea ? `Gaitegia · ${q.autorea}` : `Irakurgaia · ${q.liburua}`);
    body = `<div class="ctx"><b>${sec === 's22' ? '2.2 Gizartea' : '3. Literatura'} · ${max} p.</b> Bi galdera dituzu: aukeratu <b>bat</b> eta erantzun hari bakarrik.</div>
    <div class="choices">${pk.map((q, i) => `<button class="choice" data-act="choose" data-k="ch${sec}" data-v="${i}" aria-pressed="${ch === i}"><b>${i ? 'B' : 'A'} · ${esc(qt(q))}</b><span>${esc(q.galdera)}</span></button>`).join('')}</div>
    ${ch === 0 || ch === 1 ? `<div class="q">${qhead(qt(pk[ch]), max + ' p', 'open-text')}
      ${pk[ch].testua ? `<blockquote style="white-space:pre-line">${esc(pk[ch].testua)}</blockquote>` : ''}
      <p class="prompt">${esc(pk[ch].galdera)}</p>
      <textarea id="open-text" rows="12" data-path="t${sec}">${esc(a['t' + sec] || '')}</textarea>
      <p class="muted small num" id="open-live"></p></div>` : ''}`;
  } else if (sec === 's12') {
    body = `<div class="ctx"><b>Testuingurua.</b> ${md(m.b1.context)}</div>
    <p class="note">${icon.info}<span><b>2027: idazlanak 2 puntu balio ditu.</b> Hitz-muga eta kenketak ez daude oraindik berretsita: hemen 2025–2026ko arauak aplikatzen dira (4 puntutan), eta emaitza erdira eskalatzen da.</span></p>
    <div class="choices">${m.b1.options.map((o) => `<button class="choice" data-act="genre" data-v="${o.label}" aria-pressed="${a.b1.opt === o.label}"><b>${o.label} · ${esc(o.genre)}</b><span>${md(o.desc.charAt(0).toUpperCase() + o.desc.slice(1))}</span></button>`).join('')}</div>
    <div class="b1grid"><div class="q">${qhead('1.2 Ekoizpen idatzia', '2 p · gutxienez 150 hitz', 'b1-text')}
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
    if (b.kind === 'sinonimoak') prompt = `<b style="font-family:var(--ui);font-weight:600">${esc(it.w)}</b>`;
    if (b.kind === 'definizioak') prompt = md(it.def);
    if (b.kind === 'aditzak') prompt = `${esc(it.sentence)} <span class="muted">(${esc(it.hint)})</span>`;
    if (b.kind === 'berridazketak') prompt = `${esc(it.sentence)}${it.element ? ` <span class="chip on">Erabili: ${esc(it.element)}</span>` : ''}`;
    const field = b.kind === 'berridazketak'
      ? `<textarea id="${id}" rows="2" data-path="${p(i)}">${esc(ans[i] || '')}</textarea>`
      : `<input type="text" id="${id}" data-path="${p(i)}" value="${esc(ans[i] || '')}" autocomplete="off">`;
    return `<div class="item"><span class="l">${LETTERS[i]})</span><div class="stack"><label class="prompt" for="${id}">${prompt}</label>${field}</div></div>`;
  }).join('')}</div>`;
}

function meterHtml(n, max, label) {
  const over = n > max;
  return `<div class="meter"><div class="bar"><div class="${over ? 'over' : ''}" style="width:${Math.min(100, (n / max) * 100)}%"></div></div><span>${n} / ${max}</span></div>${label || ''}`;
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
      <div class="wc"><b>${n}</b><span class="muted">hitz · ${n >= 150 ? 'nahikoa' : `${150 - n} falta 150era iristeko`}</span></div>
      <div class="bands" aria-label="Hitz-kopuruagatiko kenketak">${PENALTY_BANDS.map(([r, pen]) => `<div class="${pen === wp ? `on ${pen === 0 ? 'ok' : ''}` : ''}"><span>${r}</span><b>${pen ? '−' + fmt(pen) : '0'}</b></div>`).join('')}</div>
      <p style="font-size:16px">${n === 0 ? 'Idazten hasi ahala, hemen ikusiko duzu zenbat puntu galduko zenituzkeen hitz-kopuruagatik.' : wp ? `Orain bidaliz gero, <b>−${fmt(wp)} puntu</b> kenduko lizkizukete hitz-kopuruagatik, idazlana ona izanda ere.` : 'Ez dago hitz-kopuruagatiko kenketarik.'}</p>
      ${opt ? `<div style="display:flex;flex-direction:column;gap:8px"><span class="label">Generoaren konbentzioak · ${esc(opt.genre)}</span><div class="chips">${conv.map((c) => chip(c.ok, c.label)).join('')}</div>
        <p class="muted small">${conv.filter((c) => !c.ok).map((c) => `${esc(c.label)}: ${esc(c.hint)}`).join(' · ') || 'Konbentzio guztiak daudela dirudi.'}</p></div>`
        : '<p class="chip bad" style="align-self:flex-start">Aukeratu generoa goian</p>'}
      <div style="display:flex;flex-direction:column;gap:8px"><span class="label">Lokailuak · ${usedCount} desberdin</span>
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
const markOf = (state) => (state === 'ok' ? `<span class="mark ok" aria-label="Zuzena">${icon.tick}</span>` : state === 'todo' ? `<span class="mark todo" aria-label="Ebaluatzeko">${icon.ask}</span>` : `<span class="mark bad" aria-label="Okerra">${icon.cross}</span>`);
// 0,25eko urratsen erdiak (0,125, 0,625…) ere zehatz erakutsi, biribildu gabe
const fmt3 = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const scoreSpan = (v, max) => `<span class="score ${v === null ? 'none' : v >= max ? 'full' : ''}">${v === null ? '—' : fmt3(v)} / ${fmt(max)}</span>`;
const secHtml = (title, score, body) => `<section class="sheet-sec"><div class="qh"><h2>${title}</h2>${score}</div>${body}</section>`;

function viewResult(m) {
  const att = getAtt(m.id);
  if (!att) { location.hash = `#/azterketa/${m.id}`; return; }
  fixAtt(att);
  if (!att.finished) { att.finished = true; att.finishedAt = Date.now(); }
  const sc = score(m, att, BANKS);
  att.result = { total: sc.total, pending: sc.pending };
  saveAtt(att);
  const s = att.self;
  const first = firstTime('res:' + m.id);
  const tag = (p) => (p.pending ? `<em class="todo">${p.pending} ebaluatzeko</em>` : p.mode === 'auto' ? '<em>automatikoa</em>' : p.mode === 'mixed' ? '<em>automatikoa eta zuk</em>' : '<em>zuk ebaluatua</em>');
  const y = window.scrollY;
  app.innerHTML = `${top('home')}
  <main class="wrap ${first ? 'enter' : ''}" style="gap:16px">
    <section class="res-head" aria-labelledby="res-h">
      <div>
        <h1 id="res-h" class="rise">${esc(m.title)}</h1>
        <p class="meta rise" style="--i:1">${parseInt(m.num, 10)}. eredua · ${mmss(att.elapsed)} erabilita</p>
        <div class="grade rise" style="--i:2">
          <span class="ring ${first ? 'draw' : ''}" aria-label="Nota orientagarria: ${fmt(sc.total)} 10etik">${ringSvg}<span>${fmt(sc.total)}<small>/10</small></span></span>
          <p>${sc.pending ? `<b>Partziala.</b> ${sc.pending} zati falta zaizkizu ebaluatzeko. Jarraitu behean, eta nota eguneratu egingo da.` : 'Ebaluazio osoa. Idazlanaren eta galdera irekien puntuak zuk erabaki dituzu, errubrikarekin.'}</p>
        </div>
        <div class="row" style="margin-top:28px">
          <a class="btn primary" href="#/">Azterketak</a>
          <button class="btn ${ui.confirm === 'restart' ? 'red' : ''}" data-act="restart">${ui.confirm === 'restart' ? 'Ziur? Erantzun guztiak ezabatuko dira' : 'Berriz egin'}</button>
        </div>
      </div>
      <div class="receipt rise" style="--i:3">
        ${SECTIONS.map((sec) => { const p = sc.parts[sec.id]; return `<div class="leader"><span>${sec.label} ${esc(sec.name)}${tag(p)}</span><span>${fmt(p.pts)} / ${fmt(sec.max)}</span></div>`; }).join('')}
        <div class="leader"><span>Zuzentasuna<em>ortografia eta gramatika</em></span><span class="${sc.pen ? 'minus' : ''}">${sc.pen ? '−' + fmt(sc.pen) : '0'}</span></div>
        <div class="leader total"><span>Nota orientagarria</span><span>${fmt(sc.total)} / 10</span></div>
      </div>
    </section>

    ${resA1(m, att, s)}
    ${resA2(m, att, s)}
    ${resB1(m, att, s, sc.parts.s12.b1)}
    ${att.ans.ch21 === 0 || att.ans.ch21 === 1 ? resA3(m, att, att.ans.ch21) : secHtml('2.1 Hizkuntza', scoreSpan(0, 1.5), '<p class="muted">Ez duzu galderarik aukeratu: 0 puntu.</p>')}
    ${resOpen(m, att, s, 's22')}
    ${resOpen(m, att, s, 's3')}
    ${secHtml('Zuzentasuna', `<span class="score ${sc.pen ? '' : 'full'}">${sc.pen ? '−' + fmt(sc.pen) : '0'}</span>`, `
      <p class="muted">Irakurri berriro zure erantzunak eta zenbatu akatsak. Lehen akats ortografikoa doan da; akats bera errepikatuz gero, behin bakarrik zenbatzen da. Gehienez −2 puntu guztira, eta gramatikagatik −1.</p>
      <div class="counters">${[['ort', 'Akats ortografikoak'], ['gram', 'Gramatika-akatsak']].map(([k, l]) => `<div><span class="label" id="lbl-${k}">${l}</span>
        <div class="stepper" role="group" aria-labelledby="lbl-${k}"><button data-act="step" data-k="${k}" data-d="-1" aria-label="Bat gutxiago" ${(s[k] || 0) <= 0 ? 'disabled' : ''}>−</button><output aria-live="polite">${s[k] || 0}</output><button data-act="step" data-k="${k}" data-d="1" aria-label="Bat gehiago">+</button></div></div>`).join('')}</div>`)}
  </main>${siteFoot()}`;
  window.scrollTo(0, y);
}

const segBtns = (key, values, cur) => `<div class="seg">${values.map(([v, l]) => `<button data-act="self" data-k="${key}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
const yours = (t) => `<div class="yours"><span class="who">Zure erantzuna</span>${t ? esc(t) : '<span class="muted">(hutsik)</span>'}</div>`;
const model = (label, html) => `<div class="model"><span class="who">${label}</span>${html}</div>`;

function resA1(m, att, s) {
  const a = att.ans.a1;
  if (m.a1.type === 'test') {
    const ok = m.a1.questions.filter((q, i) => a[i] === q.correct).length;
    return secHtml('1.1 Ulermena · galderak', scoreSpan(ok * 0.2, 1), m.a1.questions.map((q, i) => {
      const good = a[i] === q.correct;
      const corr = q.options.find((o) => o.k === q.correct);
      return `<div class="res">${markOf(good ? 'ok' : 'bad')}<div class="body"><span>${i + 1}. ${md(q.q)}</span>
        <span class="muted">${a[i] ? `Zuk: ${a[i]})` : 'Erantzunik ez'}${good ? '' : ` · Zuzena: <b>${corr.k}) ${md(corr.t)}</b>`}</span></div><span class="pt">${good ? '0,2' : '0'}</span></div>`;
    }).join(''));
  }
  const v = m.a1.questions.every((q, i) => !norm(a[i]) || s.a1?.[i] !== undefined) ? (m.a1.questions.reduce((t, q, i) => t + (norm(a[i]) ? s.a1?.[i] || 0 : 0), 0) * 0.5) : null;
  return secHtml('1.1 Ulermena · galderak', scoreSpan(v, 1), `
    <p class="muted">Alderatu zure erantzuna ereduarekin. Zuzentzaileek ikuspegi zabala erabiltzen dute: ideia bera zure hitzekin badago, zuzena da.</p>
    ${m.a1.questions.map((q, i) => `<div class="stack"><b>${LETTERS[i]}) ${md(q.q)}</b>
      <div class="cmp">${yours(a[i])}${model('Erantzun-eredua', md(q.answer))}</div>
      ${norm(a[i]) ? segBtns(`a1.${i}`, [[0.5, 'Zuzena'], [0.25, 'Erdizka'], [0, 'Okerra']], s.a1?.[i]) : '<span class="muted">Erantzunik gabe: 0</span>'}</div>`).join('')}`);
}

function resA2(m, att, s) {
  const a = att.ans.a2;
  const n = countWords(a.lab);
  const labShown = n > 60 ? a.lab.trim().split(/\s+/).slice(0, 60).join(' ') + ' […]' : a.lab;
  const done = (!norm(a.gaia) || s.gaia !== undefined) && (!norm(a.lab) || s.lab !== undefined);
  const v = done ? ((norm(a.gaia) ? s.gaia || 0 : 0) + (norm(a.lab) ? (s.lab || 0) * 0.5 : 0)) : null;
  return secHtml('1.1 Ulermena · gaia eta laburpena', scoreSpan(v, 1), `
    <b>Gaia</b><div class="cmp">${yours(a.gaia)}${model('Eredua', md(m.a2.gaia))}</div>
    ${norm(a.gaia) ? segBtns('gaia', [[0.5, 'Zehatz · 0,5'], [0.25, 'Erdizka · 0,25'], [0, 'Ez · 0']], s.gaia) : ''}
    <b>Laburpena <span class="muted num" style="font-weight:500">· ${n} hitz${n > 60 ? ', lehen 60ak bakarrik' : ''}</span></b>
    <div class="cmp">${yours(labShown)}${model('Eredu-laburpena', md(m.a2.laburpena))}</div>
    <ul class="muted" style="margin:0;padding-left:20px"><li>Ideia nagusi guztiak jaso dituzu?</li><li>Zure hitzekin idatzi duzu, kopiatu gabe?</li><li>Trinkoa, koherentea eta kohesionatua da?</li></ul>
    ${norm(a.lab) ? segBtns('lab', [[1, 'Oso ona'], [0.75, 'Ona'], [0.5, 'Erdizka'], [0.25, 'Ahula'], [0, 'Ez']], s.lab) : ''}`);
}

function resA3(m, att, bi) {
  const b = m.a3[bi];
  const ans = att.ans.a3[bi];
  const r = gradeA3(m, bi, ans, att.self.a3);
  const rows = (b.kind === 'akatsak' || b.kind === 'eratorpena') ? ans : b.items;
  const okCount = r.items.filter((x) => x.state === 'ok').length;
  return secHtml(`2.1 Hizkuntza · ${esc(b.title)}`, scoreSpan(r.pending ? null : round(r.pts * 3), 1.5), `
  ${b.kind === 'akatsak' ? `<p class="muted">Akats guztiak: ${b.pairs.map((p) => `${esc(p.wrong)} → <b>${esc(p.right[0])}</b>`).join(' · ')}</p>` : ''}
  ${b.kind === 'eratorpena' ? `<p class="muted">Aukerak: ${b.options.map((o) => `${esc(o.suffix)} (${esc(o.words.join(', '))})`).join(' · ')}</p>` : ''}
  <div>${rows.map((row, i) => {
    const st = r.items[i];
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
    return `<div class="res">${markOf(st.state === 'empty' ? 'bad' : st.state)}<div class="body">${body}${act}</div><span class="pt">${st.state === 'ok' ? '0,3' : ''}</span></div>`;
  }).join('')}</div>
  ${b.kind !== 'berridazketak' ? `<p class="muted small">«Nirea ere zuzena da»: zuzentzaileek zerrendan ez dauden sinonimo edo forma zuzenak ere onartzen dituzte. Erabili zintzotasunez.${okCount > 5 ? ' Gehienez 5 item zenbatzen dira.' : ''}</p>` : ''}`);
}

function resB1(m, att, s, p) {
  const a = att.ans.b1;
  if (!p.opt || !p.words) {
    return secHtml('1.2 Idazlana', scoreSpan(0, 2), `<p class="muted">Ez duzu idazlanik idatzi${p.opt ? '' : ' edo generoa aukeratu'}: 0 puntu.</p>`);
  }
  const rub = RUBRIC.map((_, i) => s.rub?.[i]);
  const band = p.band;
  const steps = band && band.hi > 0 ? [band.lo, band.lo + 0.25, band.lo + 0.5, band.lo + 0.75, band.hi] : [];
  return secHtml(`1.2 Idazlana · ${esc(p.opt.genre)}`, scoreSpan(p.pending ? null : round(p.pts / 2), 2), `
    <div class="receipt">
      <div class="leader"><span>Hitz-kopurua: ${p.words}</span><span class="${p.wp ? 'minus' : ''}">${p.wp ? '−' + fmt(p.wp) : '0'}</span></div>
      <div class="leader"><span>Generoaren konbentzioak</span><span class="${p.convPen ? 'minus' : ''}">${p.convPen ? '−0,5' : '0'}</span></div>
    </div>
    <div class="chips">${p.conv.map((c) => chip(c.ok, c.label)).join('')}</div>
    ${p.conv.some((c) => !c.ok) ? `<label class="tick"><input type="checkbox" data-self="conv" ${s.conv ? 'checked' : ''}><span>Begiratu dut, eta konbentzio guztiak badaude (detektagailuak huts egin du).</span></label>` : ''}
    <details class="more"><summary>Ikusi zure idazlana</summary><div style="white-space:pre-wrap;font:400 var(--s-body)/1.6 var(--read);color:var(--pen);padding:4px 0 12px">${esc(a.text)}</div></details>
    <div><h3 class="label">Kokatu zure idazlana: errubrika ofiziala, galderatan</h3>
      ${RUBRIC.map(([q, note], i) => `<div class="crit"><span>${esc(q)}<small>${esc(note)}</small></span>
        <div class="seg" style="flex:none"><button data-act="self" data-k="rub.${i}" data-v="true" aria-pressed="${rub[i] === true}">Bai</button><button data-act="self" data-k="rub.${i}" data-v="false" aria-pressed="${rub[i] === false}">Ez</button></div></div>`).join('')}
    </div>
    ${band ? `<div class="bandbox ${band.hi >= 2 ? '' : 'bad'}"><span>Zure erantzunen arabera:</span><b style="font-size:21px;font-weight:600">${band.label}</b>
      ${steps.length ? `<span>Aukeratu puntuazioa banda barruan (4tik):</span>${segBtns('b1score', steps.map((v) => [v, fmt(v)]), p.chosen)}` : '<span>Generoa edo gaia betetzen ez bada, ariketa ez da puntuatzen.</span>'}
      <span class="small">Azken puntuazioa: ${fmt(p.chosen ?? 0)} ${p.wp ? `− ${fmt(p.wp)} (hitzak)` : ''} ${p.convPen ? '− 0,5 (konbentzioak)' : ''} = <b>${fmt(p.pts)}</b> 4tik, hau da, <b>${fmt(p.pts / 2)}</b> 2tik</span></div>`
      : '<p class="muted">Erantzun galdera guztiei banda ikusteko.</p>'}
    <details class="more"><summary>Txantiloiaren oharrak</summary><p style="padding-bottom:8px">${md(m.b1.notes)}</p></details>`);
}

function resOpen(m, att, s, id) {
  const max = id === 's22' ? 1.5 : 3;
  const name = id === 's22' ? '2.2 Gizartea' : '3. Literatura';
  const ch = att.ans['ch' + id];
  const text = att.ans['t' + id] || '';
  if (!(ch === 0 || ch === 1) || !norm(text)) return secHtml(name, scoreSpan(0, max), '<p class="muted">Ez duzu erantzunik idatzi: 0 puntu.</p>');
  const q = picks(m, BANKS)[id][ch];
  const ticks = s['k' + id];
  const v = keyScore(ticks, q.gakoak.length, max);
  const f = [...BANKS.ikasi.gizartea, ...BANKS.ikasi.literatura].find((x) => x.galderak.includes(q.id));
  return secHtml(`${name} · ${esc(q.izenburua)}`, scoreSpan(v, max), `
    <p class="prompt">${esc(q.galdera)}</p>
    ${f ? `<a class="linkbtn" href="#/ikasi/${f.id}" style="align-self:flex-start">Ikasi gai hau: ${esc(f.izenburua)}</a>` : ''}
    <div class="cmp">${yours(text)}${q.eredua ? model('Eredu-erantzuna', esc(q.eredua)) : model('Eredu-erantzunik ez', 'Irakurgaiei buruzko galderetan zure irakurketa da gakoa: erabili beheko zerrenda zure erantzuna ebaluatzeko.')}</div>
    <div><h3 class="label">Markatu zure erantzunak betetzen dituen gakoak · ${fmt(max)} p, proportzioan</h3>
      ${q.gakoak.map((g, i) => `<label class="tick"><input type="checkbox" data-tick="${id}" data-i="${i}" ${Array.isArray(ticks) && ticks[i] ? 'checked' : ''}><span>${esc(g)}</span></label>`).join('')}</div>
    ${Array.isArray(ticks) ? '' : `<button class="btn" data-act="tick-none" data-k="${id}" style="align-self:flex-start">Ez dut bat ere betetzen</button>`}`);
}

/* ---------- ikasi ---------- */
function practiceHtml(q) {
  return `<details class="practice"><summary>${esc(q.izenburua)}</summary>
    <div class="in">
      ${q.testua ? `<blockquote class="quote" style="white-space:pre-line">${esc(q.testua)}</blockquote>` : ''}
      <p class="prompt">${esc(q.galdera)}</p>
      <details class="more"><summary>Ikusi gakoak${q.eredua ? ' eta eredu-erantzuna' : ''}</summary>
        <ul style="margin:0 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:4px">${q.gakoak.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        ${q.eredua ? `<div class="cmp"><div class="model" style="grid-column:1/-1"><span class="who">Eredu-erantzuna</span>${esc(q.eredua)}</div></div>` : ''}
      </details></div></details>`;
}

const LEARN = [['gizartea', '2.2 Gizartea'], ['literatura', '3. Literatura']];
const findQ = (qid) => [...BANKS.gizartea, ...BANKS.literatura.gaitegia, ...BANKS.literatura.irakurgaiak].find((q) => q.id === qid);

function viewLearn(id) {
  const L = LEARN.flatMap(([k]) => BANKS.ikasi[k]);
  const i = L.findIndex((x) => x.id === id);
  if (i < 0) {
    const first = firstTime('learn');
    app.innerHTML = `${top('learn')}<main class="wrap ${first ? 'enter' : ''}">
      <div class="page-h"><h1 class="rise">Ikasi</h1>
        <p class="rise" style="--i:1">2027ko USaPeko eduki berriak, EHUren gaitegiaren ordenan. Fitxa bakoitzaren amaieran, gai horretako galderak dituzu praktikatzeko.</p></div>
      ${LEARN.map(([k, title]) => { const F = BANKS.ikasi[k]; return `<section class="learn-part reveal" aria-labelledby="lh-${k}"><h2 id="lh-${k}">${title}</h2>
        <div class="topics">${[...new Set(F.map((x) => x.arloa))].map((g) => `<div><h3>${esc(g)}</h3><ul>
          ${F.filter((x) => x.arloa === g).map((x) => `<li><a href="#/ikasi/${x.id}"><span class="n">${esc(x.gaia)}</span><span class="t">${esc(x.izenburua)}</span><span class="c">${x.galderak.length} galdera</span></a></li>`).join('')}
        </ul></div>`).join('')}</div>
      </section>`; }).join('')}
    </main>${siteFoot()}`;
    reveal(first);
    return;
  }
  const f = L[i], prev = L[i - 1], next = L[i + 1];
  const qs = f.galderak.map(findQ).filter(Boolean);
  app.innerHTML = `${top('learn')}<main class="wrap narrow">
    <a class="linkbtn" href="#/ikasi" style="align-self:flex-start">Ikasi: gai guztiak</a>
    <div class="page-h"><h1 style="font-size:clamp(34px,5vw,60px)">${esc(f.izenburua)}</h1><p>${esc(f.arloa)} · ${esc(f.gaia)}. gaia</p></div>
    <div class="article">${f.testua.map((p) => `<p>${md(p)}</p>`).join('')}</div>
    <section class="stack"><h2 style="font-size:28px">Kontzeptu nagusiak</h2>
      <dl class="concepts">${f.kontzeptuak.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></section>
    <section class="stack"><h2 style="font-size:28px">Gogoratu</h2>
      <ul class="remember">${f.gogoratu.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>
    ${qs.length ? `<section class="stack"><h2 style="font-size:28px">Praktikatu</h2>${qs.map(practiceHtml).join('')}</section>` : ''}
    <div class="navrow">${prev ? `<a class="btn" href="#/ikasi/${prev.id}">← ${esc(prev.izenburua)}</a>` : '<span></span>'}${next ? `<a class="btn primary" href="#/ikasi/${next.id}">${esc(next.izenburua)} →</a>` : ''}</div>
  </main>${siteFoot()}`;
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
      out.push({ prompt: sent ? highlight(sent, it.w) : `<mark>${esc(it.w)}</mark>`, ask: `Eman «${it.w}» hitzaren sinonimo bat, testuinguru honetan.`, accepted: it.accepted, match: (a, acc) => synonym(a, acc, it.w), src: m });
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
  const first = firstTime('gym');
  app.innerHTML = `${top('gym')}
  <main class="wrap ${first ? 'enter' : ''}">
    <div class="page-h"><h1 class="rise">Gimnasioa</h1>
      <p class="rise" style="--i:1">2.1 Hizkuntzako ariketak banan-banan, 20 ereduetako item guztiekin. Saio bakoitza 10 itemekoa da, eta berehala ikusiko duzu zuzena den.</p></div>
    <div class="gyms">${Object.entries(GYM).map(([k, g], i) => {
      const st = stats[k] || { ok: 0, total: 0 };
      const pct = st.total ? Math.round((st.ok / st.total) * 100) : 0;
      const items = pool(k);
      return `<section class="gym rise" style="--i:${i + 2}" aria-labelledby="g-${k}"><h2 id="g-${k}">${g.name}</h2>
        <p class="muted">${g.desc} ${items.length} item.</p>
        <p class="sample">${items[0] ? items[0].prompt : ''}</p>
        <div class="stack" style="gap:8px"><div class="pct"><span>${st.total ? `${st.total} item eginda` : 'Hasi gabe'}</span><b>${st.total ? pct + '%' : '—'}</b></div>
          <div class="meter"><div class="bar"><div style="width:${pct}%"></div></div></div></div>
        <a class="btn primary" href="#/gimnasioa/${k}">Hasi saioa</a></section>`;
    }).join('')}</div>
  </main>${siteFoot()}`;
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
    app.innerHTML = `${top('gym')}<main class="wrap"><div class="drill pop">
      <h1 style="font-size:28px">${GYM[type].name}: saioa amaituta</h1>
      <div class="row" style="align-items:baseline"><span class="big">${ok}</span><span class="muted" style="font-size:24px">/ ${g.items.length}</span></div>
      <p style="font-size:var(--s-lead)">${ok >= 8 ? 'Oso ondo! Azterketan ' + fmt(Math.min(5, ok / 2) * 0.3) + ' puntu inguru ziurtatuta 2.1ean.' : 'Jarraitu entrenatzen: errepikatutako item zailak gogoratzen errazagoak izango dira.'}</p>
      <div class="row"><button class="btn primary" data-act="gym-again">Beste saio bat</button><a class="btn" href="#/gimnasioa">Gimnasioa</a></div>
    </div></main>${siteFoot()}`;
    return;
  }
  const it = g.items[g.i];
  app.innerHTML = `${top('gym')}<main class="wrap"><div class="drill">
    <div class="row" style="justify-content:space-between"><h1 class="label">${GYM[type].name} · <span class="num">${g.i + 1} / ${g.items.length}</span></h1><a class="linkbtn" href="#/gimnasioa">Utzi saioa</a></div>
    <div class="meter"><div class="bar"><div style="width:${(g.i / g.items.length) * 100}%"></div></div></div>
    <div class="q">
      <p class="prompt">${it.prompt}</p>
      ${it.para ? `<blockquote class="quote">${esc(it.para)}</blockquote>` : ''}
      <label for="gym-in" class="instr">${esc(it.ask)}</label>
      <form id="gym-form" class="row" style="align-items:stretch">
        <input type="text" id="gym-in" value="${esc(g.answer)}" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1 1 220px" ${g.checked ? 'readonly' : ''}>
        ${g.checked ? '' : '<button class="btn primary" type="submit">Egiaztatu</button>'}
      </form>
      ${g.checked ? `<div class="fb ${g.ok ? 'ok' : 'bad'} pop"><b>${g.ok ? 'Zuzena' : 'Ez da zerrendakoa'}</b><span>Onartuak: ${esc(it.accepted.join(', '))}</span><span class="muted small">${parseInt(it.src.num, 10)}. eredua · ${esc(it.src.title)}</span>
        ${g.ok ? '' : '<button class="linkbtn" data-act="gym-ovr" style="align-self:flex-start">Nirea ere zuzena da</button>'}</div>
        <button class="btn primary" data-act="gym-next" id="gym-next">${g.i + 1 < g.items.length ? 'Hurrengoa' : 'Ikusi emaitza'}</button>` : ''}
    </div></div></main>${siteFoot()}`;
  const input = document.getElementById('gym-in');
  if (!g.checked) input.focus({ preventScroll: true }); else document.getElementById('gym-next')?.focus({ preventScroll: true });
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
  if (el.id === 'demo-words') {
    const n = Number(el.value);
    const prev = wordPenalty(Number(el.dataset.n || DEMO_WORDS));
    el.dataset.n = n;
    document.getElementById('demo-out').textContent = `${n} hitz`;
    document.getElementById('demo').innerHTML = demoHtml(n);
    // marka gorria berriz marraztu kenketa aldatzen denean bakarrik
    if (wordPenalty(n) !== prev) document.getElementById('demo-ring')?.classList.add('redraw');
    return;
  }
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
  if (act === 'sheet-open') {
    const d = document.getElementById('sheet');
    d.showModal();
    return;
  }
  if (act === 'sheet-close') { document.getElementById('sheet')?.close(); return; }
  if (act === 'erase') {
    if (ui.confirm !== 'erase') { ui.confirm = 'erase'; viewPrivacy(); return; }
    storedKeys().forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
    ui.confirm = null; ui.gym = null; viewPrivacy();
    document.getElementById('erase-st').textContent = 'Eginda: gailu honetako USaPeuskarako datu guztiak ezabatu dira.';
    return;
  }
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
    document.querySelectorAll('.choice[data-act="genre"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.dataset.v)));
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
  if (act === 'step' && m) {
    const att = getAtt(m.id);
    const k = el.dataset.k;
    att.self[k] = Math.min(20, Math.max(0, (att.self[k] || 0) + Number(el.dataset.d)));
    saveAtt(att); viewResult(m);
    app.querySelector(`[data-act="step"][data-k="${k}"][data-d="${el.dataset.d}"]`)?.focus({ preventScroll: true });
    return;
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
Promise.all([getJSON('data/ereduak.json'), getJSON('data/gizartea.json'), getJSON('data/literatura.json'), getJSON('data/ikasi.json')])
  .then(([data, gizartea, literatura, ikasi]) => { MODELS = data; BANKS = { gizartea, literatura, ikasi }; route(); })
  .catch(() => { app.innerHTML = '<p class="loading">Ezin izan dira ereduak kargatu. Freskatu orria, mesedez.</p>'; });
