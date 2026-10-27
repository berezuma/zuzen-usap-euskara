// Zuzenketa-logika: funtzio puruak, nabigatzailerik gabe probatzeko modukoak.
// Irizpideak: 2025 eta 2026ko USaPeko zuzenketa-irizpide ofizialak.

// 2027ko egitura (EHU, 2025eko azaroko argibideak).
export const SECTIONS = [
  { id: 's11', label: '1.1', name: 'Ulermena', max: 2 },
  { id: 's12', label: '1.2', name: 'Idazlana', max: 2 },
  { id: 's21', label: '2.1', name: 'Hizkuntza', max: 1.5 },
  { id: 's22', label: '2.2', name: 'Gizartea', max: 1.5 },
  { id: 's3', label: '3', name: 'Literatura', max: 3 },
];

/** Eredu bakoitzari 2.2 eta 3. ataletako bi galdera esleitzen zaizkio (ikasleak bat aukeratzen du). */
export function picks(m, banks) {
  const i = parseInt(m.num, 10) - 1;
  const g = banks.gizartea, gt = banks.literatura.gaitegia, ir = banks.literatura.irakurgaiak;
  const p = (i % Math.floor(g.length / 2)) * 2;
  return { s22: [g[p], g[p + 1]], s3: [gt[i % gt.length], ir[i % ir.length]] };
}

/** Galdera irekien autoebaluazioa: betetako gakoen proportzioa, 0,25eko urratsetan. */
export function keyScore(ticks, total, max) {
  if (!Array.isArray(ticks)) return null;
  const n = ticks.filter(Boolean).length;
  return Math.round((max * n / total) * 4) / 4;
}

export const RUBRIC = [
  ['Eskatutako generoa idatzi dut, eta gaiari lotzen natzaio.', 'Ez bada: ariketak 0 puntu.'],
  ['Sarrera, garapena eta ondorioa ditu.', 'Antolaketa'],
  ['Gutxienez bi argudio edo ideia ditut, bakoitza adibide edo azalpen batekin garatuta.', 'Ideien garapena'],
  ['Gutxienez lau lokailu desberdin erabili ditut.', 'Kohesioa'],
  ['Menderagailuak erabili ditut (-lako, -nez, nahiz eta, -n arren…).', 'Egitura aberatsak'],
  ['Erregistroa egokia da: ez dut ahozko edo kaleko hizkerarik erabili.', 'Erregistroa'],
  ['Ez dut ideiarik edo hitzik behin eta berriz errepikatu.', 'Koherentzia eta lexikoa'],
];

export const CONNECTORS = ['hala ere', 'gainera', 'beraz', 'izan ere', 'ordea', 'aldiz', 'bestalde', 'alde batetik',
  'beste alde batetik', 'azken batean', 'nahiz eta', 'horregatik', 'hots', 'esate baterako', 'adibidez', 'ondorioz',
  'laburbilduz', 'hortaz', 'horrez gain', 'baizik eta', 'azkenik', 'lehenik', 'bigarrenik', 'dena den'];

export const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/[.,;:!?¡¿«»"“”'’()[\]…—–\-_/]/g, ' ').replace(/\s+/g, ' ').trim();

export const countWords = (t) => (String(t ?? '').trim().match(/\S+/g) || []).length;

export const round = (n) => Math.round(n * 100) / 100;
export const fmt = (n) => String(round(n)).replace('.', ',');

const stemOf = (w) => (w.length > 5 ? w.slice(0, w.length - 2) : w);

/** Sinonimoak eta definizioak: lema soila nahiz deklinatuta onartzen da. */
export function loose(answer, accepted) {
  const a = norm(answer), b = norm(accepted);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(stemOf(b)) && a.length <= b.length + 8;
}

/** Aditz-formak: forma osoa behar da (esaldi osoa idatzi badu ere, barruan bilatzen da). */
export function exact(answer, accepted) {
  const a = norm(answer), b = norm(accepted);
  return !!a && !!b && (a === b || (' ' + a + ' ').includes(' ' + b + ' '));
}

const firstSeg = (s) => norm(String(s).split('…')[0]);

// Akatsa: ikasleak zati bat edo testuinguru gehiago idatz dezake. Zuzenketa: forma osoa behar da.
function overlaps(expected, given, strict = false) {
  const a = firstSeg(expected), b = norm(given);
  if (!a || b.length < 2) return false;
  if (strict) return a === b || (' ' + b + ' ').includes(' ' + a + ' ') || a.endsWith(' ' + b);
  return a === b || a.includes(b) || b.includes(a);
}

/** A.3 akatsak: errenkada bakoitza (akatsa → zuzenketa) bikote batekin lotzen da, behin bakarrik. */
export function gradeAkatsak(block, rows) {
  const used = new Set();
  return rows.map((row) => {
    if (!norm(row.w) && !norm(row.r)) return { state: 'empty' };
    const idx = block.pairs.findIndex((p, i) => !used.has(i) && overlaps(p.wrong, row.w)
      && norm(row.r) !== norm(row.w) && p.right.some((r) => overlaps(r, row.r, true)));
    if (idx >= 0) { used.add(idx); return { state: 'ok', pair: idx }; }
    return { state: 'bad' };
  });
}

/** A.3 eratorpena: atzizkia zerrendan egon, hitzak atzizkia izan, hitza testuan egon, atzizkia ez errepikatu. */
export function gradeEratorpena(block, rows, textNorm) {
  const used = new Set();
  return rows.map((row) => {
    const w = norm(row.word), s = norm(row.suf);
    if (!w && !s) return { state: 'empty' };
    const opt = block.options.find((o) => norm(o.suffix) === s);
    const inText = w.length >= 4 && textNorm.includes(w.slice(0, Math.max(4, w.length - 2)));
    const has = !!s && w.includes(s);
    let reason = null;
    if (!opt) reason = 'Atzizki hori ez dago zerrendan.';
    else if (!has) reason = 'Hitzak ez du atzizki hori.';
    else if (!inText) reason = 'Hitza ez dago testuan.';
    else if (used.has(s)) reason = 'Atzizki bera bi aldiz.';
    if (reason) return { state: 'bad', reason };
    used.add(s);
    return { state: 'ok' };
  });
}

export function wordPenalty(n) {
  if (n >= 150) return 0;
  if (n >= 139) return 0.5;
  if (n >= 129) return 1;
  if (n >= 119) return 1.5;
  return 2.5;
}

export const PENALTY_BANDS = [['150+', 0], ['139–149', 0.5], ['129–138', 1], ['119–128', 1.5], ['≤118', 2.5]];

/** Generoaren konbentzioak, heuristika sinpleekin. Ikasleak berak berresten du emaitzetan. */
export function conventions(genre, text) {
  const t = String(text ?? '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines[0] || '', last = lines[lines.length - 1] || '';
  const head = lines.slice(0, 4).join('\n');
  const fw = countWords(first), lw = countWords(last);
  const g = norm(genre);
  const title = lines.length > 1 && fw > 0 && fw <= 10 && !/[.:;,]$/.test(first);
  const sign = lines.length > 2 && lw >= 2 && lw <= 4 && /^\p{Lu}\S*(\s+\p{Lu}\S*)+$/u.test(last);
  const greet = /(kaixo|egun on|arratsalde on|estimatu|agurgarri|jaun|andre|maite)/i;
  const bye = /(agur bero|agur bat|adeitasunez|besarkada|ondo izan|zain geratzen|eskerrik asko|mila esker|zure zain)/i;
  if (g.includes('artikulu')) {
    return [
      { label: 'Izenburua', ok: title, hint: 'Lehen lerroan, puntu gabe.' },
      { label: 'Egilearen izen-deiturak', ok: sign, hint: 'Azken lerroan, adibidez «Maite Arregi».' },
    ];
  }
  if (g.includes('mezu')) {
    return [
      { label: 'Hartzailea', ok: /(^|\n)\s*(nori|hartzailea)\s*:/i.test(t), hint: 'Adibidez «Nori: zuzendaritza@ikastetxea.eus».' },
      { label: 'Gaia', ok: /(^|\n)\s*gaia\s*:/i.test(t), hint: 'Adibidez «Gaia: Proposamen bat».' },
      { label: 'Hasierako agurra', ok: greet.test(head), hint: 'Erregistro egokian.' },
      { label: 'Amaierako agurra', ok: bye.test(t), hint: 'Adibidez «Adeitasunez» edo «Agur bero bat».' },
    ];
  }
  if (g.includes('gutun')) {
    const date = /\b(19|20)\d{2}\b|urtarril|otsail|martxo|apiril|maiatz|ekain|uztail|abuztu|irail|urri|azaro|abendu/i;
    return [
      { label: 'Lekua eta data', ok: date.test(lines.slice(0, 3).join(' ')), hint: 'Hasieran, adibidez «Tolosan, 2027ko maiatzaren 3an».' },
      { label: 'Hasierako agurra', ok: greet.test(head), hint: 'Adibidez «Alkate jaun agurgarria:».' },
      { label: 'Amaierako agurra eta sinadura', ok: bye.test(t) && lw >= 1 && lw <= 4, hint: 'Agurra eta, azken lerroan, izena.' },
    ];
  }
  if (g.includes('dekalogo')) {
    const numbered = lines.filter((l) => /^\d+\s*[.)-]/.test(l)).length;
    return [
      { label: 'Aurkezpena edo sarrera', ok: lines.length > 2 && !/^\d/.test(first), hint: 'Zenbakitu gabeko lehen paragrafo bat.' },
      { label: 'Puntu nagusiak', ok: numbered >= 4, hint: 'Zenbakituta: «1. …», «2. …» (ez dute zertan hamar izan).' },
      { label: 'Itxiera', ok: lines.length > 2 && !/^\d/.test(last), hint: 'Zenbakitu gabeko azken paragrafo bat.' },
    ];
  }
  if (g.includes('hitzaldi')) {
    return [
      { label: 'Entzuleei agurra', ok: /(egun on|arratsalde on|kaixo|ikaskide|entzule|irakasle|lagun maite)/i.test(head), hint: 'Adibidez «Egun on, ikaskide eta irakasle maiteok».' },
      { label: 'Amaierako eskerrak', ok: /(eskerrik asko|mila esker)/i.test(t), hint: 'Adibidez «Eskerrik asko entzuteagatik».' },
    ];
  }
  return [];
}

export function usedConnectors(text) {
  const t = ' ' + norm(text) + ' ';
  return CONNECTORS.map((c) => ({ c, used: t.includes(' ' + c + ' ') }));
}

/** Testutik hitzez hitz kopiatutako segida (6 hitz edo gehiago). */
export function copiedChunk(answer, sourceNorm, n = 6) {
  const toks = norm(answer).split(' ').filter(Boolean);
  for (let i = 0; i + n <= toks.length; i++) {
    const chunk = toks.slice(i, i + n).join(' ');
    if (sourceNorm.includes(chunk)) return chunk;
  }
  return null;
}

export function bandFor(rub) {
  if (rub[0] === false) return { label: '0 puntu', lo: 0, hi: 0 };
  const yes = rub.slice(1).filter((x) => x === true).length;
  if (yes >= 6) return { label: '3–4 banda', lo: 3, hi: 4 };
  if (yes >= 4) return { label: '2–3 banda', lo: 2, hi: 3 };
  if (yes >= 2) return { label: '1–2 banda', lo: 1, hi: 2 };
  return { label: '0–1 banda', lo: 0, hi: 1 };
}

export function textNormOf(m) {
  return norm([m.text.title, ...m.text.paragraphs].join(' '));
}

/** A.3ko bloke baten zuzenketa: item bakoitzaren egoera eta puntuak (0,1 itemeko, gehienez 0,5). */
export function gradeA3(m, bi, ans, self = {}) {
  const block = m.a3[bi];
  const ov = self[bi] || {};
  let items;
  if (block.kind === 'akatsak') {
    items = gradeAkatsak(block, ans).map((r, i) => (r.state === 'bad' && ov[i] === true ? { state: 'ok', override: true } : r));
  } else if (block.kind === 'eratorpena') {
    items = gradeEratorpena(block, ans, textNormOf(m)).map((r, i) => (r.state === 'bad' && ov[i] === true ? { state: 'ok', override: true } : r));
  } else if (block.kind === 'berridazketak') {
    items = block.items.map((it, i) => {
      const a = ans[i] || '';
      if (!norm(a)) return { state: 'empty' };
      if (norm(a) === norm(it.sentence)) return { state: 'bad', reason: 'Jatorrizko esaldi bera da.' };
      if (ov[i] === true) return { state: 'ok', self: true };
      if (ov[i] === false) return { state: 'bad', self: true };
      return { state: 'todo' };
    });
  } else {
    const match = block.kind === 'aditzak' ? exact : loose;
    items = block.items.map((it, i) => {
      const a = ans[i] || '';
      if (!norm(a)) return { state: 'empty' };
      if (it.accepted.some((acc) => match(a, acc))) return { state: 'ok' };
      if (ov[i] === true) return { state: 'ok', override: true };
      return { state: 'bad' };
    });
  }
  const ok = items.filter((x) => x.state === 'ok').length;
  const pending = items.filter((x) => x.state === 'todo').length;
  return { items, pts: Math.min(5, ok) * 0.1, pending };
}

/** Nota osoa, 2027ko egituran. Zati zaharrak kalkulatu eta atal berrietara eskalatzen dira. */
export function score(m, att, banks) {
  const old = scoreOld(m, att);
  const s = att.self || {};
  const a = att.ans;
  const out = { parts: {}, pending: 0, old };
  // 1.1: galderak 1 p (2tik eskalatuta) + gaia 0,5 + laburpena 0,5 (1etik eskalatuta)
  const a1 = old.parts.a1.pts * 0.5;
  const gaia = norm(a.a2.gaia) && s.gaia !== undefined ? s.gaia : 0;
  const lab = norm(a.a2.lab) && s.lab !== undefined ? s.lab * 0.5 : 0;
  out.parts.s11 = { pts: a1 + gaia + lab, mode: old.parts.a1.mode === 'auto' ? 'mixed' : 'self', pending: (old.parts.a1.pending || 0) + old.parts.a2.pending };
  // 1.2: idazlana 4 puntutan ebaluatu eta erdira eskalatu
  out.parts.s12 = { pts: old.parts.b1.pts * 0.5, mode: 'self', pending: old.parts.b1.pending, b1: old.parts.b1 };
  // 2.1: aukeratutako blokea, 0,5etik 1,5era
  const ch = a.ch21;
  if (ch === 0 || ch === 1) {
    const r = gradeA3(m, ch, a.a3[ch], s.a3);
    out.parts.s21 = { pts: r.pts * 3, mode: 'auto', pending: r.pending };
  } else out.parts.s21 = { pts: 0, mode: 'auto', pending: 0 };
  // 2.2 eta 3: galdera irekiak, gakoen zerrendarekin
  const pk = banks ? picks(m, banks) : null;
  for (const [id, max] of [['s22', 1.5], ['s3', 3]]) {
    const q = pk && (a['ch' + id] === 0 || a['ch' + id] === 1) ? pk[id][a['ch' + id]] : null;
    const text = a['t' + id] || '';
    if (!q || !norm(text)) { out.parts[id] = { pts: 0, mode: 'self', pending: 0 }; continue; }
    const v = keyScore(s['k' + id], q.gakoak.length, max);
    out.parts[id] = { pts: v ?? 0, mode: 'self', pending: v === null ? 1 : 0 };
  }
  for (const sec of SECTIONS) out.pending += out.parts[sec.id].pending || 0;
  out.pen = old.pen;
  const sum = SECTIONS.reduce((acc, sec) => acc + out.parts[sec.id].pts, 0);
  out.total = round(Math.max(0, Math.min(10, sum - out.pen)));
  return out;
}

/** 2025–2026ko egiturako kalkulua (barne-erabilerarako). */
export function scoreOld(m, att) {
  const s = att.self || {};
  const out = { parts: {}, pending: 0 };
  // A.1
  if (m.a1.type === 'test') {
    const ok = m.a1.questions.filter((q, i) => att.ans.a1[i] === q.correct).length;
    out.parts.a1 = { pts: ok * 0.4, mode: 'auto' };
  } else {
    let pts = 0, pend = 0;
    m.a1.questions.forEach((q, i) => {
      if (!norm(att.ans.a1[i])) return;
      const v = s.a1?.[i];
      if (v === undefined) pend++; else pts += v;
    });
    out.parts.a1 = { pts, mode: 'self', pending: pend };
    out.pending += pend;
  }
  // A.2
  {
    let pts = 0, pend = 0;
    if (norm(att.ans.a2.gaia)) { if (s.gaia === undefined) pend++; else pts += s.gaia; }
    if (norm(att.ans.a2.lab)) { if (s.lab === undefined) pend++; else pts += s.lab; }
    out.parts.a2 = { pts, mode: 'self', pending: pend };
    out.pending += pend;
  }
  // A.3
  {
    let pts = 0, pend = 0;
    m.a3.forEach((b, bi) => { const r = gradeA3(m, bi, att.ans.a3[bi], s.a3); pts += r.pts; pend += r.pending; });
    out.parts.a3 = { pts, mode: 'auto', pending: pend };
    out.pending += pend;
  }
  // B.1
  {
    const text = att.ans.b1.text || '';
    const words = countWords(text);
    const opt = m.b1.options.find((o) => o.label === att.ans.b1.opt);
    const wp = wordPenalty(words);
    const conv = opt ? conventions(opt.genre, text) : [];
    const convOk = conv.every((c) => c.ok) || s.conv === true;
    const convPen = convOk ? 0 : 0.5;
    const rub = RUBRIC.map((_, i) => s.rub?.[i]);
    let pts = 0, pend = 0, band = null, chosen = null;
    if (opt && words > 0) {
      if (rub.some((x) => x === undefined) && rub[0] !== false) pend = 1;
      else {
        band = bandFor(rub);
        chosen = band.hi === 0 ? 0 : (s.b1score >= band.lo && s.b1score <= band.hi ? s.b1score : (band.lo + band.hi) / 2);
        pts = Math.max(0, chosen - wp - convPen);
      }
    }
    out.parts.b1 = { pts, mode: 'self', pending: pend, words, wp, convPen, conv, convOk, band, chosen, opt };
    out.pending += pend;
  }
  // B.2
  {
    let pts = 0, pend = 0;
    if (norm(att.ans.b2.text)) { if (s.b2 === undefined) pend++; else pts = s.b2; }
    out.parts.b2 = { pts, mode: 'self', pending: pend };
    out.pending += pend;
  }
  const ort = Math.max(0, (s.ort || 0) - 1) * 0.25;
  const gram = Math.min(1, (s.gram || 0) * 0.25);
  out.pen = Math.min(2, ort + gram);
  return out;
}

export function emptyAnswers(m) {
  return {
    a1: {},
    a2: { gaia: '', lab: '' },
    a3: m.a3.map((b) => {
      if (b.kind === 'akatsak') return Array.from({ length: 5 }, () => ({ w: '', r: '' }));
      if (b.kind === 'eratorpena') return Array.from({ length: 5 }, () => ({ word: '', suf: '' }));
      return b.items.map(() => '');
    }),
    b1: { opt: '', text: '' },
    b2: { text: '' },
    ch21: null, ch22: null, ch3: null, ts22: '', ts3: '',
  };
}
