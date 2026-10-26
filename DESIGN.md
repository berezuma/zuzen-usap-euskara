---
name: USaPeuskara
description: USaPeko Euskara eta Literatura II azterketa-orria, ikaslearen tinta urdinez idatzia eta zuzentzailearen boligrafo gorriz zuzendua.
colors:
  desk: "#E7EAF0"
  paper: "#FFFFFF"
  paper-2: "#F3F5F8"
  paper-3: "#E3E7EE"
  ink: "#151A2C"
  muted: "#4F566B"
  faint: "#747B8F"
  pen: "#1E43B5"
  pen-soft: "#E4EAFA"
  red: "#C01B2C"
  red-soft: "#FBE6E7"
  ok: "#17734A"
  ok-soft: "#E1F2E8"
  night: "#0F1322"
  night-2: "#1A2034"
  night-ink: "#EEF0F5"
  night-muted: "#A9B0C4"
  highlight: "#FFE58A"
typography:
  display:
    fontFamily: "General Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(52px, 8vw, 124px)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  heading:
    fontFamily: "General Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(28px, 20px + 2.4vw, 46px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  lead:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(19px, 17.6px + .45vw, 23px)"
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: "General Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(17px, 16.4px + .15vw, 18px)"
    fontWeight: 400
    lineHeight: 1.5
  reading:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(18px, 17px + .3vw, 20px)"
    fontWeight: 400
    lineHeight: 1.7
  small:
    fontFamily: "General Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  r: "4px"
  sheet: "12px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  section: "48px"
  stack: "12px"
components:
  button-primary:
    backgroundColor: "{colors.pen}"
    textColor: "{colors.paper}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  button-default:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.r}"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.r}"
    height: "48px"
  field:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.pen}"
    typography: "{typography.reading}"
    rounded: "{rounded.r}"
    height: "48px"
  chip-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    rounded: "{rounded.r}"
  chip-bad:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red}"
    rounded: "{rounded.r}"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.r}"
    padding: "clamp(20px, 4vw, 40px)"
---

# Design System: USaPeuskara

## Overview

USaPeuskara USaPeko azterketa-orria da, pantailan. Hiru tinta daude, azterketa-gelan bezala: paper zuria, ikaslearen boligrafo urdina eta zuzentzailearen boligrafo gorria. Mahaia (`desk`) urdin-gris hotza da, eta orri bakoitza (`paper`) haren gainean dago, itzalik gabe.

Hasierako orria (Persuade) gau-urdin ilun batean irekitzen da: izenburu handia eta bost karpetaz osatutako pila. Karpeta bakoitza azterketaren atal bat da, bere hegalarekin. Aurrean azterketaren azala dago, ekintza bakarrarekin. Azterketa, Ikasi eta Gimnasioa (Operate/Read) lasaiak dira: munduak letra-motak, paleta eta zirkulu gorria bakarrik ematen ditu, eta gainerakoa ohiko aplikazio-pantaila da.

## Colors

### Primary
- **Ikaslearen tinta** (`pen`, #1E43B5): ekintza nagusia, fokua, aukeratutakoa eta ikaslearen idazkia (inputak, textareak, "Zure erantzuna").

### Secondary
- **Zuzentzailearen gorria** (`red`, #C01B2C): galdutako puntuak, kenketak, nota inguratzen duen zirkulua. Ez da inoiz apaingarri.

### Tertiary
- **Puntu irabaziak** (`ok`, #17734A): tika, eredu-erantzunen atzealdea (`ok-soft`), banda zuzena.

### Neutral
- `desk` mahaia, `paper` orria, `paper-2`/`paper-3` orri barruko tonu-urratsak, `ink` testua, `muted` bigarren mailako testua, `faint` zenbaki eta letra laguntzaileak, `night` hasierako eta azterketa-barraren eremua.

### Named Rules
- **Hiru tinten araua:** urdina ikaslearena da, gorria zuzentzailearena. Ez trukatu.
- **Gorriak puntuak kentzen ditu:** gorria agertzen bada, kenketa edo zuzenketa bat dago.
- Modu iluna token berberekin dago definituta (`prefers-color-scheme: dark`).

## Typography

**General Sans** (Fontshare, `app/fonts/`-en zerbitzatua) interfazerako eta izenburuetarako; **Literata** (`app/fonts/`-en zerbitzatua, OFL) irakurgaietarako, galderetarako eta ikaslearen erantzunetarako. Bi familia, ez gehiago. Zenbaki guztiak tabularrak dira (`font-variant-numeric: tabular-nums` body-n). Ez dago monospace-rik.

### Hierarchy
- Display (hasierako izenburua bakarrik), heading, lead (Literata), body (17–18 px), small (14 px). Ez jaitsi 14 px-tik behera irakurtzeko testurik.

### Named Rules
- **Ikaslearen idazkia Literata da, tinta urdinez.**
- Ez dago etiketa txiki maiuskularik edo izenburuaren gaineko etiketarik: informazioa izenburuan edo esaldi baten hasieran doa ("**Testuingurua.** …").

## Layout

Marjina bakarra (`--gutter`) pantaila guztietan. Hasieran atalen artean 48 px. Azterketan bi zutabe (irakurgaia + galderak) 980 px-tik gora; hortik behera zutabe bakarra eta irakurgaia beheko orri batean. 820–900 px-tik behera sare guztiak zutabe bakarrera pasatzen dira.

## Elevation & Depth

Gainazalak tonu-urratsez bereizten dira (desk → paper → paper-2 → paper-3), ez itzalez. Itzala benetan flotatzen dutenek bakarrik dute: "Irakurgaia" botoi flotatzaileak eta denbora-abisuak. Aplikazio-zerrendetan 1 px-ko bereizle lasaiak onartzen dira.

## Shapes

4 px-ko erradio bakarra kontroletan eta orrietan; 12 px beheko orriaren goiko ertzetan. Karpeta-hegalak trapezioak dira (`clip-path`).

## Components

### Buttons
Lauak, 48 px-ko altuera, 4 px-ko erradioa. Sakatzean `scale(.97)` 140 ms ease-out. Hover-a `(hover: hover) and (pointer: fine)` barruan bakarrik.

### Chips
Idazten ari zarela egoera erakusteko (ok/bad/on/new). Ez dira botoiak.

### Cards / Containers
`sheet-sec` eta `q`: paper orria, ertzik eta itzalik gabe. Ez dago txartelik txartel barruan.

### Inputs / Fields
Paper-2 atzealdea, beheko marra 2 px; fokuan marra urdina eta `pen-soft` atzealdea. Testua Literata eta urdina.

### Navigation
Barra zuria: wordmark-a ("USaPeuskara" + puntu gorria) eta hiru esteka. Azterketan barra iluna eta itsaskorra: itxi, izenburua (h1), bost atal-fitxa eta kronometroa.

### Oina
Gau-urdinezko eremua, "USaPeuskara." izena zabalera osoan, eta esteka hauek: Pribatutasuna, Lege-oharra eta posta. Azterketa-pantailan izan ezik, orri guztietan dago.

### Zuzentzailearen zirkulua (signature)
Eskuz marraztutako SVG obalo gorria, notaren edo kenketaren inguruan. Lehen aldiz marrazten da (`stroke-dashoffset`, 900 ms), eta hitz-kopuruaren demoan kenketa aldatzen denean bakarrik.

### Ordainagiria (leader)
Kontzeptua ezkerrean, balioa eskuinean, puntu-lerroa tartean; azken lerroa alderantzizkoa (ink gainean paper). Arauetan eta emaitzetan erabiltzen da.

## Do's and Don'ts

### Do:
- Erabili gorria kenketetarako eta zuzenketetarako bakarrik.
- Mantendu animazioak behin bakarrik (ikuspegi bakoitzaren lehen agerraldian) eta `prefers-reduced-motion` errespetatu.
- Mugikorrean, irakurgaia beti eskura (beheko orria).

### Don't:
- Ez erabili gradienterik, itzalik geldirik dauden elementuetan, monospace-rik edo etiketa txikirik izenburuen gainean.
- Ez animatu sarri egiten diren ekintzak (atal-aldaketa, galdera-aldaketa, teklatua).
- Ez asmatu testigantzarik, zifrarik edo irakasleen oniritzirik.
