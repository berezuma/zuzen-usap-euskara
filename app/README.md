# USaPeuskara · USaP Euskara entrenagailua

USaPeko Euskara eta Literatura II azterketa simulatzeko web aplikazio estatikoa. Ez du zerbitzaririk, datu-baserik ezta adimen artifizialik: ikaslearen aurrerapena nabigatzailean gordetzen da (`localStorage`, `zuzen:` aurrizkiarekin; ez aldatu, ikasleen aurrerapena gal ez dadin). Ez du hirugarrenen baliabiderik kargatzen: letra-motak `fonts/` karpetan daude (DBEO). Pribatutasun-politika eta lege-oharra: `#/pribatutasuna` eta `#/lege-oharra`.

## Fitxategiak

- `index.html`, `styles.css`, `app.js`: interfazea (hasiera, simulazioa, emaitzak eta autoebaluazioa, gimnasioa)
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

Edozein hosting estatikok balio du (Vercel, Netlify, GitHub Pages…): igo karpeta hau bere horretan. Ez du build urratsik.
