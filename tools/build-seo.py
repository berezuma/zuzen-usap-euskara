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
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', esc(s))


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def slug_of(m):
    return f"{m['num']}-{slugify(m['title'])}"


def page(title, desc, path, body, jsonld=None):
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
</style>
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


def a1_html(a1):
    out = []
    for q in a1.get('questions', []):
        opts = ''
        if q.get('options'):
            opts = '<ol>' + ''.join(f"<li>{md(o['t'])}</li>" for o in q['options']) + '</ol>'
        out.append(f"<li>{md(q['q'])}{opts}</li>")
    kind = 'test-galderak' if a1.get('type') == 'test' else 'galdera irekiak'
    return f"<p class=\"st-muted\">Ulermena: {kind}.</p><ol class=\"st-list\">{''.join(out)}</ol>"


def model_page(m):
    t = m['text']
    path = f"/ereduak/{slug_of(m)}/"
    n = int(m['num'])
    title = f"USaP Euskara azterketa-eredua {n}: {m['title']}"
    first = t['paragraphs'][0] if t.get('paragraphs') else ''
    desc = (f"USaP Euskara eta Literatura II azterketaren {n}. eredua ({m['base']} egitura): "
            f"«{m['title']}». Testua eta galderak; simulatu azterketa 90 minututan eta zuzendu irizpide ofizialekin.")
    paras = ''.join(f"<p>{md(p)}</p>" for p in t.get('paragraphs', []))
    a2 = m.get('a2') or {}
    a3 = ''.join(
        f"<li><strong>{md(x.get('title', ''))}.</strong> {md(x.get('instr', ''))}</li>" for x in m.get('a3', []))
    b1 = m.get('b1') or {}
    b1opts = ''.join(f"<li><strong>{md(o['genre'])}</strong>, {md(o['desc'])}</li>" for o in b1.get('options', []))
    b2 = m.get('b2') or {}
    poem = '\n'.join(esc(l) for l in b2.get('lines', []))
    cta = f'<a class="st-cta" href="/#/azterketa/{esc(m["id"])}">Egin azterketa hau simulazio gisa</a>'
    body = f"""<div class="page-h">
  <p class="st-muted">{n}. eredua · {esc(m['base'])} egitura · Euskara eta Literatura II</p>
  <h1>{esc(m['title'])}</h1>
  <p>USaP Euskara azterketa-eredua, 2027ko azterketarako egokitua. Hemen testua eta galderak dituzu; erantzun eta zuzendu, puntuz puntu, aplikazioan.</p>
  {cta}
</div>
<div class="st-body">
<section class="st-read" aria-labelledby="t-h"><h2 id="t-h">Testua</h2>{paras}</section>
<section aria-labelledby="a1-h"><h2 id="a1-h">1.1 Testuaren ulermena</h2>{a1_html(m.get('a1') or {})}</section>
<section aria-labelledby="a2-h"><h2 id="a2-h">1.2 Gaia eta laburpena</h2><p>{md(a2.get('context', ''))}</p></section>
<section aria-labelledby="a3-h"><h2 id="a3-h">Hizkuntza-ariketak</h2><ul class="st-list">{a3}</ul></section>
<section aria-labelledby="b1-h"><h2 id="b1-h">Idazlana</h2><p>{md(b1.get('context', ''))}</p><ul class="st-list">{b1opts}</ul></section>
<section aria-labelledby="b2-h"><h2 id="b2-h">Literatura</h2><p>{md(b2.get('intro', ''))}</p><p class="st-poem">{poem}</p></section>
<section><p class="st-muted">Eredu-erantzunak, zuzenketa automatikoa eta errubrika ofiziala aplikazioan daude. Zure erantzunak gailu honetan bakarrik gordetzen dira.</p>{cta}
<p><a href="/ereduak/">← USaP Euskara azterketa-eredu guztiak</a></p></section>
</div>"""
    ld = {
        '@context': 'https://schema.org', '@type': 'Quiz', 'name': title, 'description': desc,
        'inLanguage': 'eu', 'url': BASE + path, 'educationalLevel': 'Batxilergoa 2',
        'about': 'USaP Euskara eta Literatura II', 'learningResourceType': 'Azterketa-eredua',
        'isAccessibleForFree': True, 'author': {'@type': 'Person', 'name': 'Beñat Erezuma', 'url': 'https://berezuma.com/'},
    }
    return path, page(title, desc, path, body, ld)


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
  <p>Euskara eta Literatura II azterketa prestatzeko 20 eredu. Bakoitzak 2025 edo 2026ko azterketa ofizial baten egitura jarraitzen du, 2027ra egokituta: 90 minutu, bost atal eta 10 puntu.</p>
  <a class="st-cta" href="/">Ireki simulatzailea</a>
</div>
<div class="st-body">
<section aria-labelledby="l-h"><h2 id="l-h">20 eredu</h2><ol class="st-idx">{items}</ol></section>
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
    models = json.loads((ROOT / 'data' / 'ereduak.json').read_text(encoding='utf-8'))
    if OUT.exists():
        shutil.rmtree(OUT)
    paths = []
    for builder in [lambda: index_page(models)] + [lambda m=m: model_page(m) for m in models]:
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
