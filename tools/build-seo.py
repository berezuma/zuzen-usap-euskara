#!/usr/bin/env python3
"""Bilatzaileentzako orri estatikoak sortzen ditu data/ereduak.json-etik.

Aplikazioa hash-ibilbideetan doa (#/azterketa/e01), eta Google-k ezin ditu
horiek orri bereizi gisa indexatu. Script honek URL erreal bat sortzen du
eredu bakoitzeko (/ereduak/01-loa-.../), testuarekin eta galderekin, baina
ERANTZUNIK GABE (erantzunak aplikazioan bakarrik daude). Gainera,
/ereduak/ aurkibidea, sitemap.xml eta robots.txt sortzen ditu.

Erabilera (app/ karpetatik):
    python3 tools/build-seo.py
Ereduak aldatzen diren bakoitzean, build-data.py-ren ondoren exekutatu.
QR kodeak (qr/eNN.svg) sortzeko segno behar da (pip install segno); ez badago,
lehendik dauden QR fitxategiak erabiltzen dira.
"""
import html
import json
import re
import shutil
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://usapeuskara.berezuma.com'
OUT = ROOT / 'ereduak'
GC = ('<script data-goatcounter="https://usapeuskara.goatcounter.com/count" '
      'async src="/count.js"></script>')
FAMILIA = ('<script src="https://berezuma.com/wp-content/themes/berezuma/assets/familia.js" '
           'data-ildoa="euskara" defer></script>')


def esc(s):
    return html.escape(str(s), quote=True)


def md(s):
    """Testu laua + **lodia** → HTML segurua."""
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', esc(s))
    return re.sub(r'(^|[\s(])\*(\S.*?\S|\S)\*(?=[\s).,;:]|$)', r'\1<em>\2</em>', s)


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def slug_of(m):
    return f"{m['num']}-{slugify(m['title'])}"


def page(title, desc, path, body, jsonld=None, extra_head=''):
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ''
    return f"""<!doctype html>
<html lang="eu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="author" content="Beñat Erezuma">
<meta name="theme-color" content="#0F1322">
<link rel="canonical" href="{BASE}{path}">
<meta property="og:type" content="website">
<meta property="og:locale" content="eu_ES">
<meta property="og:site_name" content="USaP Euskara">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{BASE}{path}">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230F1322'/%3E%3Ctext x='14' y='23' font-family='sans-serif' font-size='20' font-weight='700' fill='%23fff' text-anchor='middle'%3EU%3C/text%3E%3Ccircle cx='24' cy='21' r='2.6' fill='%23E5394A'/%3E%3C/svg%3E">
<style>
.st-body {{ display: flex; flex-direction: column; gap: 36px; }}
.st-body section {{ display: flex; flex-direction: column; gap: 14px; }}
.st-body h2 {{ font-size: clamp(22px, 2.4vw, 30px); }}
.st-read p, .st-read li {{ font-family: var(--read); line-height: 1.6; }}
.st-read p + p {{ margin-top: .9em; }}
.st-list {{ margin: 0; padding-left: 1.3em; display: flex; flex-direction: column; gap: 10px; }}
.st-list ol {{ list-style: lower-alpha; margin: 6px 0 0; padding-left: 1.3em; }}
.st-cta {{ display: inline-block; align-self: flex-start; background: var(--pen); color: var(--pen-ink); padding: 12px 20px; border-radius: var(--r); font-weight: 600; text-decoration: none; }}
.st-muted {{ color: var(--muted); }}
.st-idx {{ list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border-top: 1px solid var(--paper-3); }}
.st-idx li {{ border-bottom: 1px solid var(--paper-3); }}
.st-idx a {{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; padding: 14px 0; text-decoration: none; color: var(--ink); }}
.st-idx a span:first-child {{ font-weight: 600; }}
.st-idx a span:last-child {{ color: var(--muted); }}
.st-poem {{ font-family: var(--read); white-space: pre-line; padding-left: 16px; border-left: 3px solid var(--paper-3); }}
.st-btns {{ display: flex; flex-wrap: wrap; gap: 10px; }}
.st-btn2 {{ font: 600 16px/1 var(--ui); background: transparent; color: var(--pen); border: 1.5px solid var(--pen); padding: 11px 18px; border-radius: var(--r); cursor: pointer; }}
.st-num {{ color: var(--faint); font-family: var(--ui); font-size: 13px; margin-right: 8px; }}
.st-pts {{ font: 500 15px var(--ui); color: var(--muted); margin-left: 10px; letter-spacing: 0; }}
.st-ctx {{ background: var(--paper-2); padding: 14px 16px; border-radius: var(--r); }}
.st-quote {{ font-family: var(--read); padding-left: 16px; border-left: 3px solid var(--paper-3); white-space: pre-line; }}
.st-opt {{ display: flex; flex-direction: column; gap: 10px; padding: 14px 0; border-top: 1px solid var(--paper-3); }}
.st-opt h3 {{ font-size: 18px; }}
.st-print-only {{ display: none; }}
@page {{ size: A4; margin: 16mm 16mm 18mm; @bottom-right {{ content: counter(page) " / " counter(pages); font: 9pt sans-serif; color: #555; }} }}
@media print {{
  :root {{ --ink: #000; --muted: #333; --faint: #555; --paper-2: #fff; --paper-3: #999; --desk: #fff; --pen: #000; }}
  html, body {{ background: #fff !important; color: #000; }}
  body {{ font-size: 10.5pt; }}
  .top, .site-foot, .bzf, .st-noprint, script + div[class^="bzf"] {{ display: none !important; }}
  .wrap {{ padding: 0; max-width: none; gap: 14px; }}
  .st-print-only {{ display: block; }}
  .page-h h1 {{ font-size: 22pt; line-height: 1.05; }}
  .page-h p {{ font-size: 10.5pt; }}
  .st-body {{ gap: 16px; }}
  .st-body h2 {{ font-size: 13pt; border-bottom: 1px solid #000; padding-bottom: 3px; }}
  .st-read p, .st-read li, .st-quote {{ line-height: 1.45; }}
  .st-ctx {{ border: 1px solid #999; padding: 8px 10px; }}
  .st-list li, .st-opt, .st-ctx, .st-quote {{ break-inside: avoid; }}
  .st-body h2, .st-opt h3 {{ break-after: avoid; }}
  a {{ color: #000; text-decoration: none; }}
  .st-phead {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }}
  .st-phead .who {{ font: 10pt var(--ui); display: flex; flex-direction: column; gap: 10px; }}
  .st-phead .qr {{ display: flex; gap: 10px; align-items: center; font: 9pt/1.3 var(--ui); max-width: 78mm; }}
  .st-phead .qr img {{ width: 24mm; height: 24mm; }}
}}
</style>
{extra_head}
{ld}
</head>
<body>
<header class="top"><div class="in">
  <a class="wordmark" href="/">USaPeuskara<span>.</span></a>
  <nav class="nav" aria-label="Nagusia">
    <a href="/ereduak/">Ereduak</a>
    <a href="/#/ikasi">Ikasi</a>
    <a href="/#/gimnasioa">Gimnasioa</a>
  </nav></div></header>
<main class="wrap narrow">
{body}
</main>
<footer class="site-foot"><div class="in">
  <p class="name" aria-hidden="true">USaPeuskara<span>.</span></p>
  <nav class="foot-links" aria-label="Oina">
    <a href="/ereduak/">USaP Euskara azterketa-ereduak</a>
    <a href="/#/iturriak">Iturriak eta irizpideak</a>
    <a href="/#/pribatutasuna">Pribatutasuna</a>
  </nav>
  <div class="foot-notes">
    <p>Beñat Erezumaren doako proiektu pertsonala, EHUrekin lotura ofizialik gabea. Nota orientagarria da, ez ofiziala.</p>
  </div>
</div></footer>
{GC}
{FAMILIA}
</body>
</html>
"""


def pts(t):
    return f'<span class="st-pts">{t}</span>'


def a1_html(a1):
    out = []
    for q in a1.get('questions', []):
        opts = ''
        if q.get('options'):
            opts = '<ol>' + ''.join(f"<li>{md(o['t'])}</li>" for o in q['options']) + '</ol>'
        out.append(f"<li>{md(q['q'])}{opts}</li>")
    instr = ('Aukeratu erantzun zuzena (bakarra). Erantzun okerrek ez dute punturik kentzen.'
             if a1.get('type') == 'test' else 'Erantzun galderei zure hitzak erabiliz, testutik kopiatu gabe.')
    each = '0,2' if a1.get('type') == 'test' else '0,25'
    return (f"<h3>Ulermenari buruzko galderak{pts(f'1 p · {each} galderako')}</h3>"
            f"<p>{instr}</p><ol class=\"st-list\">{''.join(out)}</ol>")


def a3_html(b):
    k = b['kind']
    if k == 'akatsak':
        return f"<p class=\"st-quote\">{esc(b.get('text', ''))}</p>"
    if k == 'eratorpena':
        return ''
    rows = []
    for it in b.get('items', []):
        if k == 'sinonimoak':
            rows.append(f"<strong>{esc(it['w'])}</strong>")
        elif k == 'definizioak':
            rows.append(md(it['def']))
        elif k == 'aditzak':
            rows.append(f"{esc(it['sentence'])} <span class=\"st-muted\">({esc(it.get('hint', ''))})</span>")
        elif k == 'berridazketak':
            el = f" <span class=\"st-muted\">· Erabili: {esc(it['element'])}</span>" if it.get('element') else ''
            rows.append(esc(it['sentence']) + el)
    return '<ol class="st-list" type="a">' + ''.join(f'<li>{r}</li>' for r in rows) + '</ol>'


def picks(m, banks):
    """grading.js-eko picks()-en kopia: eredu bakoitzari 2.2 eta 3. ataletako bi galdera."""
    i = int(m['num']) - 1
    g, gt, ir = banks['gizartea'], banks['literatura']['gaitegia'], banks['literatura']['irakurgaiak']
    p = (i % (len(g) // 2)) * 2
    return {'s22': [g[p], g[p + 1]], 's3': [gt[i % len(gt)], ir[i % len(ir)]]}


def qr_svg(m):
    """QR kodea (segno instalatuta badago); bestela lehendik dagoena erabiltzen da."""
    f = ROOT / 'qr' / f"{m['id']}.svg"
    try:
        import segno
        f.parent.mkdir(exist_ok=True)
        segno.make(f"{BASE}/#/azterketa/{m['id']}", error='m').save(str(f), scale=4, border=0, dark='#000')
    except ImportError:
        pass
    return f"/qr/{m['id']}.svg" if f.exists() else None


def model_page(m, banks):
    t = m['text']
    path = f"/ereduak/{slug_of(m)}/"
    n = int(m['num'])
    title = f"USaP Euskara azterketa-eredua {n}: {m['title']}"
    desc = (f"USaP Euskara eta Literatura II azterketaren {n}. eredua ({m['base']} egitura): "
            f"«{m['title']}». Testua eta galderak, inprimatzeko edo online simulatzeko, irizpide ofizialekin zuzenduta.")
    paras = ''.join(f"<p><span class=\"st-num\">{i + 1}</span>{md(p)}</p>" for i, p in enumerate(t.get('paragraphs', [])))
    a2 = m.get('a2') or {}
    b1 = m.get('b1') or {}
    pk = picks(m, banks)
    sim = f"/#/azterketa/{esc(m['id'])}"
    qr = qr_svg(m)
    qr_html = (f'<div class="qr"><img src="{qr}" alt="">'
               f'<span><strong>Zuzendu online.</strong> Eskaneatu kodea edo zoaz hona: usapeuskara.berezuma.com, {n}. eredua. '
               f'Idatzi zure erantzunak eta jaso zuzenketa eta eredu-erantzunak.</span></div>') if qr else ''
    a3_opts = ''.join(
        f"<div class=\"st-opt\"><h3>{'AB'[i]} · {esc(b['title'])}</h3><p>{md(b.get('instr', ''))}</p>{a3_html(b)}</div>"
        for i, b in enumerate(m.get('a3', [])[:2]))
    g_opts = ''.join(
        f"<div class=\"st-opt\"><h3>{'AB'[i]} · {esc(q['arloa'])} · {esc(q['izenburua'])}</h3><p>{esc(q['galdera'])}</p></div>"
        for i, q in enumerate(pk['s22']))
    lt = []
    for i, q in enumerate(pk['s3']):
        head = f"Gaitegia · {q['autorea']}" if q.get('autorea') else f"Irakurgaia · {q['liburua']}"
        txt = f"<p class=\"st-quote\">{esc(q['testua'])}</p>" if q.get('testua') else ''
        lt.append(f"<div class=\"st-opt\"><h3>{'AB'[i]} · {esc(head)}</h3>{txt}<p>{esc(q['galdera'])}</p></div>")
    b1opts = ''.join(f"<div class=\"st-opt\"><h3>{esc(o['label'])} · {esc(o['genre'])}</h3><p>{md(o['desc'][:1].upper() + o['desc'][1:])}</p></div>"
                     for o in b1.get('options', []))
    body = f"""<div class="st-print-only st-phead">
  <div class="who"><strong>USaP · Euskara eta Literatura II · {n}. eredua</strong><span>Izen-abizenak: ______________________________</span><span>Data: ____________ · 90 minutu · 10 puntu</span></div>
  {qr_html}
</div>
<div class="page-h">
  <p class="st-muted st-noprint">{n}. eredua · {esc(m['base'])} egitura · Euskara eta Literatura II</p>
  <h1>{esc(m['title'])}</h1>
  <p class="st-noprint">USaP Euskara azterketa-eredua, 2027ko azterketarako egokitua: 90 minutu, bost atal eta 10 puntu. Egin online, denbora neurtuta eta zuzenketa automatikoarekin, edo inprimatu eta egin paperean, benetako azterketan bezala.</p>
  <p class="st-print-only">Idatzi erantzunak aparteko orrietan. 2.1, 2.2 eta 3. ataletan, aukeratu galdera <strong>bat</strong> eta erantzun hari bakarrik.</p>
  <div class="st-btns st-noprint"><a class="st-cta" href="{sim}">Egin azterketa online</a><button class="st-btn2" type="button" onclick="window.print()">Inprimatu</button></div>
</div>
<div class="st-body">
<section class="st-read" aria-labelledby="t-h"><h2 id="t-h">{'Testua' if t.get('title', m['title']) == m['title'] else 'Testua: ' + esc(t['title'])}</h2>{paras}</section>
<section aria-labelledby="s11-h"><h2 id="s11-h">1.1 Ulermena{pts('2 p')}</h2>
  {a1_html(m.get('a1') or {})}
  <p class="st-ctx"><strong>Testuingurua.</strong> {md(a2.get('context', ''))}</p>
  <h3>Gaia{pts('0,5 p · esaldi bakarra')}</h3>
  <h3>Laburpena{pts('0,5 p · gehienez 60 hitz')}</h3>
  <p>Zure hitzekin. Ez kopiatu testuko esaldiak, eta ez erabili «egileak dioenez» erako egiturarik.</p>
</section>
<section aria-labelledby="s12-h"><h2 id="s12-h">1.2 Idazlana{pts('2 p · gutxienez 150 hitz')}</h2>
  <p class="st-ctx"><strong>Testuingurua.</strong> {md(b1.get('context', ''))}</p>{b1opts}</section>
<section aria-labelledby="s21-h"><h2 id="s21-h">2.1 Hizkuntza{pts('1,5 p · aukeratu bat')}</h2>{a3_opts}</section>
<section aria-labelledby="s22-h"><h2 id="s22-h">2.2 Gizartea{pts('1,5 p · aukeratu bat')}</h2>{g_opts}</section>
<section aria-labelledby="s3-h"><h2 id="s3-h">3. Literatura{pts('3 p · aukeratu bat')}</h2>{''.join(lt)}</section>
<section class="st-noprint"><p class="st-muted">Eredu-erantzunak, zuzenketa automatikoa eta errubrika ofiziala aplikazioan daude, azterketa bukatzean. Zure erantzunak gailu honetan bakarrik gordetzen dira.</p>
  <div class="st-btns"><a class="st-cta" href="{sim}">Egin azterketa online</a><button class="st-btn2" type="button" onclick="window.print()">Inprimatu</button></div>
  <p><a href="/ereduak/">← USaP Euskara azterketa-eredu guztiak</a></p></section>
</div>"""
    ld = {
        '@context': 'https://schema.org', '@type': 'Quiz', 'name': title, 'description': desc,
        'inLanguage': 'eu', 'url': BASE + path, 'educationalLevel': 'Batxilergoa 2',
        'about': 'USaP Euskara eta Literatura II', 'learningResourceType': 'Azterketa-eredua',
        'isAccessibleForFree': True, 'author': {'@type': 'Person', 'name': 'Beñat Erezuma', 'url': 'https://berezuma.com/'},
    }
    foot = f'usapeuskara.berezuma.com · USaP Euskara, {n}. eredua'
    extra = (f'<style>@page {{ @bottom-left {{ content: "{foot}"; font: 9pt sans-serif; color: #555; }} }}</style>\n'
             f'<script>addEventListener("beforeprint",function(){{try{{window.goatcounter&&goatcounter.count({{path:"inprimatu/{m["id"]}",event:true}})}}catch(e){{}}}});</script>')
    return path, page(title, desc, path, body, ld, extra)


def index_page(models):
    path = '/ereduak/'
    title = 'USaP Euskara azterketa-ereduak (2027): 20 eredu simulatzeko'
    desc = ('USaP Euskara eta Literatura II azterketaren 20 eredu, 2025 eta 2026ko azterketa ofizialen egituran '
            'eta 2027ra egokituak. Doan, konturik gabe, zuzenketa irizpide ofizialekin.')
    items = ''.join(
        f"<li><a href=\"/ereduak/{slug_of(m)}/\"><span>{int(m['num'])}. {esc(m['title'])}</span>"
        f"<span>{esc(m['base'])} egitura</span></a></li>" for m in models)
    body = f"""<div class="page-h">
  <h1>USaP Euskara azterketa-ereduak</h1>
  <p>Euskara eta Literatura II azterketa prestatzeko 20 eredu, online egiteko edo inprimatzeko. Bakoitzak 2025 edo 2026ko azterketa ofizial baten egitura jarraitzen du, 2027ra egokituta: 90 minutu, bost atal eta 10 puntu.</p>
  <a class="st-cta" href="/">Ireki simulatzailea</a>
</div>
<div class="st-body">
<section aria-labelledby="l-h"><h2 id="l-h">20 eredu</h2><p>Paperean egiteko, ireki eredu bat eta sakatu <strong>Inprimatu</strong>: azterketa-orri garbia aterako da, QR kode batekin, online zuzentzeko.</p><ol class="st-idx">{items}</ol></section>
<section aria-labelledby="z-h"><h2 id="z-h">Nola funtzionatzen du</h2>
<p>Aukeratu eredu bat eta egin azterketa denbora neurtuta. Hizkuntza-ariketak automatikoki zuzentzen dira; idazlana, gizartea eta literatura zuk ebaluatzen dituzu, errubrika ofizialaren galderekin eta eredu-erantzunekin. Bukatzean, puntuz puntu ikusiko duzu non irabazi eta non galdu duzun. Ez dago konturik: zure erantzunak gailu honetan gordetzen dira.</p></section>
</div>"""
    ld = {
        '@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'description': desc,
        'inLanguage': 'eu', 'url': BASE + path,
        'hasPart': [{'@type': 'Quiz', 'name': m['title'], 'url': f"{BASE}/ereduak/{slug_of(m)}/"} for m in models],
    }
    return path, page(title, desc, path, body, ld)


def main():
    load = lambda n: json.loads((ROOT / 'data' / f'{n}.json').read_text(encoding='utf-8'))
    models = load('ereduak')
    banks = {'gizartea': load('gizartea'), 'literatura': load('literatura')}
    if OUT.exists():
        shutil.rmtree(OUT)
    paths = []
    for builder in [lambda: index_page(models)] + [lambda m=m: model_page(m, banks) for m in models]:
        path, doc = builder()
        f = ROOT / path.strip('/') / 'index.html'
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(doc, encoding='utf-8')
        paths.append(path)
    today = date.today().isoformat()
    urls = ''.join(f"  <url><loc>{BASE}{p}</loc><lastmod>{today}</lastmod></url>\n" for p in ['/'] + paths)
    (ROOT / 'sitemap.xml').write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n',
        encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8')
    print(f'{len(paths)} orri, sitemap.xml eta robots.txt sortuta')


if __name__ == '__main__':
    main()
