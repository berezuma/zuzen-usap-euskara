# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Batxilergoko 2. mailako ikasleak, USaPeko Euskara eta Literatura II azterketa prestatzen. Gehienbat **mugikorrean** erabiltzen dute, etxean edo bidean, bakarka. Saio luzeak (90 minutuko simulazio osoa) eta laburrak (gimnasioko 10 item, Ikasi fitxa bat) txandakatzen dituzte. Azterketaren aurreko asteetan urduri egon ohi dira: nota eta denbora dira kezka nagusiak.

## Product Purpose

Zuzenek USaPeko azterketa etxean simulatzen du, 2027ko egituran (1.1/1.2, 2.1/2.2, 3), eta zuzentzaileen irizpide ofizialekin zuzentzen du. Helburua: ikasleak jakitea, puntuz puntu, non irabazten eta non galtzen dituen puntuak, azterketa-egunaren aurretik. Arrakasta: ikasleak "arau ezkutuak" (hitz-kopuruagatiko kenketak, generoaren konbentzioak, ortografia) azterketa baino lehen ezagutzea.

## Positioning

Zuzentzaileak berak kentzen dituen puntuak erakusten ditu, idazten ari zaren bitartean: hitz-kopuruaren bandak, generoaren konbentzioak, testutik kopiatutako zatiak. Ez da test-bilduma bat: azterketa osoa da, irizpide ofizialekin, eta autoebaluazioa errubrika ofizialaren galderetan banatuta.

## Operating Context

- USaPeko azterketa paperean egiten da, boligrafo urdinez; zuzentzaileak gorriz zuzentzen du. Ikasleek objektu hori ezagutzen dute.
- 90 minutu; atal batzuetan bi galderatik bat aukeratu behar da.
- Iturriak: EHUren 2025 eta 2026ko zuzenketa-irizpideak eta ebazpenak, eta 2027ko azterketa-ereduaren argibideak (2025eko azaroa). PDFak proiektuaren erroan daude.

## Capabilities and Constraints

- Simulazioa (5 atal, kronometroa, erantzunak automatikoki gordeta), emaitzak eta autoebaluazioa, gimnasioa (2.1eko itemak banan-banan) eta Ikasi (2.2 Gizartea eta 3. Literatura fitxak).
- Web estatikoa: HTML, CSS eta JavaScript modulu hutsak, build urratsik gabe. GitHub Pages-en argitaratzen da (`gh-pages` adarra, `app/` karpeta).
- Ez dago zerbitzaririk, konturik ez adimen artifizialik: dena `localStorage`-n (`zuzen:` aurrizkia, bateragarritasunagatik).
- DBEO: ez da datu pertsonalik biltzen; ez dago cookierik ez hirugarrenen baliabiderik (letra-motak eta `count.js` zerbitzari propiotik). Bisitak modu anonimoan zenbatzen dira GoatCounter-ekin (cookierik gabe, inoiz ez erantzunik); edozein datu berri bidali aurretik, eguneratu pribatutasun-politika. Pribatutasun-politika eta lege-oharra aplikazioaren barruan daude, eta erabiltzaileak bere datuak ezaba ditzake.
- Nota **orientagarria** da, ez ofiziala. 2027ko idazlanaren hitz-muga eta kenketak ez daude oraindik berretsita.
- Terminologia: atalak 1.1 Ulermena, 1.2 Idazlana, 2.1 Hizkuntza, 2.2 Gizartea, 3 Literatura. Ereduak 01–20. Interfaze osoa euskaraz.

## Brand Commitments

- Izena: **USaPeuskara** (wordmark "USaPeuskara."). Egilea eta titularra: Beñat Erezuma. Proiektu pertsonala, doakoa, irabazi-asmorik gabea. Webgunea: https://usapeuskara.berezuma.com. Harremanetarako: info@berezuma.com.
- EHUrekin ez du lotura ofizialik, eta hori lege-oharrean eta oinean esaten da.
- Ahotsa: zuzena, lasaigarria, ikaslearekin hika ez baina gertukoa ("zuk"); ez du sinesgarritasunik asmatzen.

## Evidence on Hand

- 20 eredu (`ereduak/*.md`, `app/data/ereduak.json`), Gizartea eta Literatura galdera-bankuak, Ikasi fitxak.
- Ez dago testigantzarik, erabiltzaile-zifrarik edo irakasleen oniritzirik: ez asmatu. Ez aipatu ereduak irakasle baten berrikuspenaren zain daudenik (egileak erabakita, 2026-10-29; "Probako bertsioa" oharra ere kendu zen, 2026-10-27).

## Product Principles

1. Azterketa errealari leial: egitura, puntuak eta arauak ofizialak dira, eta ziurtasunik ez dagoenean esan egiten da.
2. Puntuak non galtzen diren erakutsi, ez soilik nota.
3. Mugikorra lehenik: testua eta galdera beti eskura, erpurua erabiliz.
4. Ikaslearen lana ez da inoiz galtzen.
5. Lasaitasuna presiopean: kronometroak informatzen du, ez du beldurtzen.

## Accessibility & Inclusion

WCAG 2.1 AA: kontrastea, teklatua, fokua ikusgai, `prefers-reduced-motion` eta modu iluna. Testu luzeak irakurtzeko moduan (gutxienez 17 px mugikorrean).
