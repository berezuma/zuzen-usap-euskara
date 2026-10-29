# USaPeuskara · USaP Euskara entrenagailua

USaPeko Euskara eta Literatura II azterketa simulatzeko web aplikazio estatikoa. Ez du zerbitzaririk, datu-baserik ezta adimen artifizialik: ikaslearen aurrerapena nabigatzailean gordetzen da (`localStorage`, `zuzen:` aurrizkiarekin; ez aldatu, ikasleen aurrerapena gal ez dadin). Ez du hirugarrenen baliabiderik kargatzen: letra-motak `fonts/` karpetan daude eta bisita-kontagailuaren script-a `count.js` da (DBEO). Bisitak GoatCounter-ekin zenbatzen dira (https://usapeuskara.goatcounter.com), cookierik gabe: orri-mota eta `azterketa-hasi/NN` eta `azterketa-bukatu/NN` gertaerak bakarrik (`track()`, `app.js`), inoiz ez erantzunik. Localhost-en ez du zenbatzen. Pribatutasun-politika eta lege-oharra: `#/pribatutasuna` eta `#/lege-oharra`.

## Fitxategiak

- `index.html`, `styles.css`, `app.js`: interfazea (hasiera, simulazioa, emaitzak eta autoebaluazioa, gimnasioa)
- `count.js`: GoatCounter-en script-a (ISC lizentzia), webgune beretik zerbitzatzeko kopiatuta
- `grading.js`: zuzenketa-logika (2025–2026ko irizpide ofizialak)
- `data/ereduak.json`: ereduak, `../ereduak/*.md` fitxategietatik sortuak
- `tools/build-data.py`: Markdown → JSON bihurgailua

## Ereduak aldatzeko

1. Editatu `../ereduak/NN-izena.md` (egitura bera mantenduz).
2. Sortu berriro datuak:
   ```
   python3 tools/build-data.py ../ereduak data/ereduak.json
   ```

## Lokalean probatzeko

```
python3 -m http.server 8765 --directory .
```
eta ireki http://127.0.0.1:8765

## Argitaratzeko

GitHub Pages-en argitaratzen da `gh-pages` adarretik (domeinua: https://usapeuskara.berezuma.com, `CNAME` fitxategian). `main`-era push egiteak **ez du** webgunea eguneratzen; horretarako, biltegiaren errotik:

```
git push origin main
git subtree push --prefix app origin gh-pages
```

GitHub Pages-ek minutu bat edo gehiago behar izan dezake aldaketak erakusteko; nabigatzaileak bertsio zaharra erakusten badu, freskatu Ctrl+Shift+R eginez.

Ez du build urratsik: beste edozein hosting estatikok ere balio du (Vercel, Netlify…), karpeta hau bere horretan igota.
