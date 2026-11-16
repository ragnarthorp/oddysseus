# Lestrarstofa – Ódysseifskviða

Rólegt lestrarumhverfi þar sem nemendur lesa *Ódysseifskviðu – endursögn* (formáli, 24 þættir, „Helstu nöfn“ og „Texti og myndir“), velja textabúta, endurvinna þá og skrá eigin glósur. Aðaltæki er iPad í Safari. Allt viðmót er á íslensku.

- Engin innskráning, engar greiddar þjónustur, engin AI-þjónusta í keyrslu og engar sendingar nemendagagna út af tækinu.
- Hreint HTML/CSS/JavaScript – ekkert build-skref. PDF-útflutningur notar `vendor/jspdf.umd.min.js` ([jsPDF](https://github.com/parallax/jsPDF) 2.5.1, MIT) og `vendor/pdf-fonts.js` (hlutmengi úr Liberation Sans, SIL OFL 1.1, styður íslensku); leyfin eru í `vendor/`.

## Keyrsla

Vefurinn er kyrrstæður. Opnaðu `index.html` beint í vafra, eða keyrðu lítinn vefþjón:

```bash
node tests/server.js 8765
```

og opnaðu `http://127.0.0.1:8765/`. Á iPad þarf síðuna hýsta, t.d. á innra neti skólans eða á GitHub Pages. Síðan hefur **ekki** verið birt opinberlega.

Það er ekkert build-skref.

## Frumtexti og útdráttur

- `heimild/Odysseifskvida-endursogn.pdf` er óbreytt frumskjal (SHA-256 `3dc9a938…c504c`).
- `tools/extract.py` er endurkeyranlegur útdráttur (Python 3 + `pdfplumber`):

  ```bash
  python3 tools/extract.py
  ```

  Hann skrifar `data/odysseifskvida.json` (frumgögn), `data/odysseifskvida.js` (sömu gögn fyrir vafrann) og `data/utdrattur-skyrsla.md` (yfirlit og óvissuatriði). Úttakið er ákvarðað: sama PDF gefur sömu skrár.
- Hlutverk texta eru greind eftir leturgerð og stærð (sjá haus skriftunnar): fyrirsögn, meginmál, tilvitnun (þýðing Sveinbjarnar Egilssonar), heimildarlína, nafnalistafærsla. Myndatextar (EB Garamond skáletur 9,6 pt) og myndaskráin í „Texti og myndir“ eru ekki í lestrartexta en þeir eru skráðir í skýrslunni.
- Efnisyfirlitið (PDF-síða 3) er tvídálka. Það er lesið dálk fyrir dálk og eingöngu notað til að sannprófa kaflaheitin. Öll 24 heitin stemma. Vefurinn býr til sitt eigið efnisyfirlit úr staðfestum kaflaheitum.
- Prentuð síðunúmer eru staðfest á PDF-síðum 3–51 (þau eru jöfn PDF-síðunni). Á síðum 1–2 er ekkert prentað númer og þar er „PDF-síða“ notað.
- Línur sem brotna vegna síðubreiddar eru sameinaðar. Ekkert er umorðað eða leiðrétt.
- Óvissa sem bíður yfirferðar er í `data/utdrattur-skyrsla.md`. Í þessu skjali endar engin efnisgrein á síðuskilum. Í tveimur tilvikum (síður 11→12 og 19→20) fyllir síðasta lína síðu línuna og endar á punkti. Það er túlkað sem ný efnisgrein og skráð sem óvissa.

### Gagnalíkan

Hver textaeining hefur `id` (t.d. `thattur-01-003`), kafla, `type` (`efnisgrein`, `tilvitnun`, `heimild`, `nafn`, `titill`), `n` (númer innan kaflans; allar einingar eru númeraðar í einni röð og sýndar sem „Efnisgrein n“) og `pages`: kort af stafabilum, `[{offset, pdfPage, printedPage}]`. Ef eining nær yfir síðuskil er nýtt bil skráð við þann staf þar sem næsta síða hefst, svo að val fái rétta síðu eða síðubil. Tilvitnun og heimildarlína eru tengdar með `sourceId`/`quoteId`. Skjalið hefur `document.id = "odysseifskvida-endursogn"` og `document.version = "sha256-…"` (fyrstu 16 stafir SHA-256 af PDF).

## Glósur og tengingar

Glósa geymir auðkenni og útgáfu skjals, kafla, upphaf og endi sem `{unitId, offset}` (stafastaðsetningar í texta einingar, ekki skjáhnit), lista eininga, óbreyttan valinn texta, 40 stafa samhengi á undan og eftir, PDF-síðubil og staðfest prentað síðubil, ásamt tegund, texta nemandans og innsettu afriti (við endurvinnslu). Tengingar breytast ekki við leturstillingar, gluggabreytingu eða endurhleðslu. Við hleðslu er hver tenging sannprófuð á móti textanum.

- **Textaval**: Venjulegt textaval Safari (löng snerting og valhandföng). Engir sérsmíðaðir snertigestir eru notaðir. Valstika birtist neðst með „Skrifa eigin glósu“ og „Endurvinna valinn texta“. Valið er tekið gilt aðeins ef báðir endar eru í lestrartextanum. Val yfir samliggjandi efnisgreinar innan kafla er stutt.
- **Varaleið**: Pennahnappurinn „Glósa við efnisgrein n“ við hverja efnisgrein.
- **Tegundir**: Endursögn, Athugasemd, Spurning, Endurvinnsla og Tilvitnun, hver með lit, tákni og heiti. Ef innsett afrit er óbreytt við vistun er glósan merkt „Tilvitnun“. Að öðru leyti er textinn ekki metinn og vistun aldrei hindruð.
- **Glósuspjald**: Glósur í röð textans, sía eftir kafla og tegund, breyta, eyða með „Afturkalla“ og „Fara á textastað“. Staðurinn er auðkenndur með CSS Custom Highlight API (Safari 17.2+), annars með auðkenningu efnisgreinar. Textanum er ekki breytt.

## Cornell-glósur

Hnappurinn **Cornell** í efstu stiku kveikir og slekkur á Cornell-ham. Stillingin er munuð í tækinu og fylgir vinnuskrá.

- **Lykilorð / spurning:** Textinn opnast eins og áður. Þegar texti er valinn birtist „Lykilorð / spurning“ í valstikunni, og penninn við efnisgrein gerir það sama fyrir alla efnisgreinina. Í ritspjaldinu er lykilorð eða spurning vinstra megin og valinn texti hægra megin. Nemandinn má umorða textann eða láta hann standa: umorðaður texti vistast sem „Endurvinnsla“ og óbreyttur sem „Tilvitnun“. Upprunalega valið varðveitist alltaf.
- **Athugasemdir við kaflann:** Neðst í hverjum kafla er hnappurinn „Athugasemdir við kaflann“ (ein athugasemd á kafla, sem má breyta). Hún er tengd kaflanum í heild en ekki textavali, og kemur á eftir öðrum glósum kaflans.
- **Útflutningur:** Í „Flytja út“ er valið „Uppsetning: Venjuleg / Cornell“, og Cornell er sjálfgefið í Cornell-ham. Bæði PDF og Markdown eru í boði.
  - Í hverjum kafla er tafla með lykilorði eða spurningu og staðarkóða (`bls. 6 · ¶ 1`) vinstra megin og völdum texta, með eða án umorðunar, hægra megin.
  - Athugasemdir við kaflann koma í lok hvers kafla.
  - Ef textinn var umorðaður og „Hafa valinn frumtexta með“ er valið fylgir frumtextinn skáletraður.
  - Aðrar glósur fá tegund sína vinstra megin, t.d. `(s) spurning`.
  - Í PDF flæða dálkarnir sjálfstætt yfir síðuskil.

## Úkraínsk útgáfa

Hnappurinn **[Ukr]** í efstu stiku skiptir yfir á úkraínsku og síðan opnast aftur á því máli. Á úkraínsku stendur **[Ísl]** á hnappnum og skiptir til baka. Tækið man valið og það fylgir vinnuskrá. Úkraínska útgáfan opnast líka beint með `?lang=uk` aftan við slóðina.

- **Texti kviðunnar á úkraínsku:** Úkraínska útgáfan sýnir úkraínska þýðingu á allri endursögninni: formála, öllum 24 þáttum, „Helstu nöfnum“ og „Texta og myndum“. Íslenska kaflaheitið sést til hliðsjónar undir því úkraínska. Tilvitnanirnar eru þýddar úr íslenskri þýðingu Sveinbjarnar Egilssonar, en ekki teknar úr grískum frumtexta eða úkraínskum útgáfum Hómers. Heimildarlínurnar segja það.
- **Uppruni þýðingarinnar:** Hún var gerð með gervigreind og hefur ekki verið yfirfarin af fagmanni. Það kemur fram á forsíðu og í „Про книгу“ í úkraínsku útgáfunni.
- **Sama bygging:** Úkraínski textinn hefur sömu kafla, efnisgreinar, auðkenni og síðutilvísanir (íslenska PDF-ið) og sá íslenski. „С. 6 · Абзац 3“ vísar því á sama stað og „Bls. 6 · Efnisgrein 3“.
- **Glósur:** Hver glósa man við hvora útgáfu textans hún var gerð (`textLang`). Glósur úr báðum útgáfum sjást alltaf, sannprófast, flytjast út og fylgja vinnuskrá. Glósa úr hinni útgáfunni er auðkennd sem heil efnisgrein.
- **Viðmót og útflutningur:** Á úkraínsku eru viðmót, leiðbeiningar, villuboð, glósutegundir og útflutningsmerkingar. Tegundakóðarnir eru `(пк)` переказ, `(к)` коментар, `(п)` питання, `(пр)` переробка og `(ц)` цитата. Gæsalappir í útflutningi fylgja tungumáli textans: „…“ fyrir íslensku og «…» fyrir úkraínsku.
- **Skrár:**
  - `translations/uk/*.json` – þýðingin, ein færsla á hverja textaeiningu.
  - `tools/build-translation.py` – sannprófar þýðinguna (allar einingar, tilvitnanir, heimildarlínur, nafnafærslur) og býr til `data/odysseifskvida.uk.{json,js}`.
  - `translations/uk.sources.json` – fingraför íslensku eininganna sem þýtt var eftir. Ef íslenski textinn breytist stöðvast smíðin og bendir á efnisgreinarnar sem þarf að þýða aftur.

  ```bash
  python3 tools/build-translation.py
  ```

- `js/i18n.js` geymir alla viðmótstexta, með sömu lyklum fyrir bæði tungumál.
- PDF-letrið var endurgert úr Liberation Sans 2.1.5 með kýrillísku (`tools/build-pdf-fonts.py`).

## Vistun, vinnuskrá og Drive

- Glósur, ritdrög, stillingar og lestrarstaður vistast sjálfkrafa í **IndexedDB** í þessum vafra á þessu tæki. Ef IndexedDB virkar ekki er localStorage notað sem varaleið. Ef hvorugt virkar birtist villuborði. „Vistað í þessu tæki“ birtist aðeins eftir að færslan hefur verið staðfest.
- Þetta er **ekki** sjálfvirk Drive-vistun. Safari getur hreinsað gögn vefsíðu sem hefur ekki verið opnuð í nokkra daga, og þau hverfa líka ef vafragögn eru hreinsuð. Nemendur eru því hvattir til að vista vinnuskrá.
- **Vista vinnuskrá**: JSON-skrá (`format: "odysseifskvida-vinnuskra"`, `formatVersion: 1`) með öllum glósum, tengingum, stillingum, lestrarstað og auðkenni og útgáfu skjals. Ef vafrinn styður Web Share með skrám birtist „Deila eða vista í Files…“. Þar má velja „Vista í Files“ og t.d. Google Drive, ef Drive-forritið er sett upp. „Sækja skrá“ er alltaf í boði. Vefurinn getur ekki staðfest hvar skráin endar og fullyrðir það ekki.
- **Opna vinnuskrá**: Staðlaður skráavalari (Files, þar með talið Drive ef það er tengt). Snið, útgáfa sniðs, skjalauðkenni, útgáfa texta og hver tenging eru sannprófuð. Röng eða skemmd skrá breytir engu. Skrá úr annarri útgáfu textans er hafnað í stað þess að tengja glósurnar í hljóði. Áður en glósum er skipt út er beðið um staðfestingu og boðið öryggisafrit. Vinnuskrár eru ekki sameinaðar í þessari útgáfu.

## Útflutningur

„Flytja út“ neðst í glósuspjaldinu býður upp á PDF eða Markdown (.md), allar glósur eða núverandi síu, röð í textanum (sjálfgefið) eða eftir stofnun, og hvort valinn frumtexti fylgi. Talið er sannreynt svo að engin vistuð glósa falli niður.

Útflutningurinn er hafður þjappaður svo glósurnar lesist án truflunar. Heiti verks og fyrirsagnir kafla (t.d. „I. þáttur — Aþena kemur til Íþöku“) haldast. Hver glósa fær aðeins eina stutta kóðalínu í lágstöfum, svo frumtextann (ef hann er valinn) og loks texta nemandans:

```
1 · bls. 6 · ¶ 1–2 · (e)
> „Guðirnir sitja á þingi á Ólympsfjalli. …“
Guðirnir funda og Aþena biður um heimferð Ódysseifs.
```

- Glósur eru númeraðar 1, 2, 3 … innan hvers kafla.
- `bls.` er staðfest prentað blaðsíðunúmer eða bil; `pdf-s.` er notað þegar prentað númer er óstaðfest. `¶` er efnisgrein eða bil.
- Tegundir: `(e)` endursögn, `(a)` athugasemd, `(s)` spurning, `(ev)` endurvinnsla, `(t)` tilvitnun.
- Skýringar á kóðunum standa einu sinni efst í skjalinu.

- PDF er búið til með jsPDF í vafranum. Textinn er raunverulegur vektor-texti með innfelldu Unicode-letri og sjálfvirkri línu- og síðuskiptingu, ekki skjáskot. Stafir sem letrið hefur ekki (t.d. broskarlar) falla út.
- Markdown er UTF-8 (með BOM svo eldri forrit lesi stafina rétt). Það hefur skýrar fyrirsagnir og frumtexta í `>`-tilvitnun. Merki í texta nemandans sem annars yrðu fyrirsagnir, tilvitnanir eða HTML eru gerð óvirk.
- Allur innfluttur texti og nemendatexti er meðhöndlaður sem gögn (`textContent`), aldrei sem HTML.

## Prófanir

```bash
npm test          # kjarni (tengingar, vinnuskrá, Markdown) og PDF: node --test
npm run test:ui   # viðmótspróf með Playwright (iPad-hermun)
```

- `tests/core.test.js`: Prófar að allir þættir og kaflar skili sér og að myndatextar séu ekki í meginmáli. Prófar einnig að tilvitnanir og heimildarlínur séu aðgreindar, stöðug auðkenni, síðukort, val yfir efnisgreina- og síðuskil, regluna um óbreytta endurvinnslu, röðun og síur, vinnuskrá fram og til baka, rangar og skemmdar skrár, tóma stöðu og Markdown (langar glósur, íslenskir stafir, óvirk merki).
- `tests/pdf.test.js`: Býr til raunverulegt margra síðna PDF með sama jsPDF og letri og les textann aftur með `pdftotext`.
- `tests/ui.test.js`: Prófar val, glósu, endurvinnslu, varaleið, skarandi glósur og val í valmynd sem verður ekki glósa. Prófar einnig leturstækkun og endurhleðslu, síu, breytingu, eyðingu og afturköllun, að fara á textastað, útflutning í MD og PDF og vinnuskrá (ranga, skemmda og rétta með öryggisafriti). Auk þess vistunarvillur (IndexedDB lokað og villa við skrif), ritdrög, lóðrétta og lárétta stöðu, lága sýnilega hæð (eins og með opið skjályklaborð), heiti hnappa og 44×44 snertifleti.
- Viðmótsprófin keyra í Chromium með iPad-hermun (snerting, iPad-skjástærð). WebKit er notað ef það er uppsett (`ODY_BROWSER=webkit`). **Hermun kemur ekki í stað prófunar á raunverulegu iPad.**

### Gátlisti fyrir prófun á iPad (Safari)

1. Opna síðuna, fara í gegnum efnisyfirlit og fyrri/næsta kafla, loka Safari og opna aftur: lestrarstaður og stillingar haldast.
2. Löng snerting á orði, draga valhandföngin yfir tvær efnisgreinar: valstika birtist neðst og Safari-valmyndin truflast ekki. „Endurvinna valinn texta“ setur textann í ritreit.
3. Með opið skjályklaborð (lóðrétt og lárétt, einnig með ytra lyklaborði og fljótandi lyklaborði): ritreitur og „Vista glósu“ sjást og hægt er að vista.
4. Pennahnappurinn við efnisgrein virkar með fingri og með VoiceOver (heiti „Glósa við efnisgrein n“).
5. Leturstækkun, Serif og Sans-serif, línubil, breidd og þrír bakgrunnar. Valáhersla sést vel í öllum. Klípuaðdráttur í Safari virkar.
6. Lárétt staða: glósuspjald birtist sem hliðarspjald. Lóðrétt staða: spjald birtist yfir textanum og textinn heldur breidd.
7. „Flytja út“ → PDF og MD → „Deila eða vista í Files…“ → Vista í Files / Drive. Opna skrána og athuga ð, þ, æ og ö og langar glósur.
8. „Vista vinnuskrá“ og síðan „Opna vinnuskrá“ úr Files eða Drive. Prófa líka ranga skrá.
9. Einkavafur (Private Browsing) og fullt geymslupláss: skýr villuskilaboð birtast.

## Uppfærslur og skyndiminni

Allar staðbundnar skrár í `index.html` bera útgáfunúmer (`?v=1.4.0`, sama og `APP.version` í `js/core.js`), svo Safari sæki nýjar skrár eftir uppfærslu í stað gamalla úr skyndiminni. Hækkið númerið á báðum stöðum við hverja útgáfu; próf gætir þess að þau stemmi. Útgáfan sést neðst í „Lestrarstillingum“.

Safari getur misst IndexedDB-tenginguna, t.d. eftir að flipi hefur verið í bakgrunni á iPad, og þá svara vistanir ekki. Hver vistun hefur því tímamörk. Mistakist hún er tengingin opnuð aftur og reynt á ný, og annars birtist villuborði. Tungumálaskipti bíða ekki eftir vistun.

## Þekktar takmarkanir

- Engin samstilling milli tækja. Vinnuskrá er leiðin til að flytja vinnu. Vinnuskrár eru ekki sameinaðar.
- Safari getur eytt staðbundnum gögnum vefsíðu eftir nokkra daga án notkunar (ITP), nema síðunni sé bætt við heimaskjá.
- Glósur úr vinnuskrá frá annarri útgáfu textans eru ekki fluttar inn (engin sjálfvirk endurtenging).
- Varanleg auðkenning glósustaða í textanum krefst CSS Custom Highlight API (Safari 17.2+). Í eldri vöfrum sést fjöldi glósa við pennahnappinn og staðurinn er auðkenndur sem heil efnisgrein.
- Letrið í PDF (Liberation Sans-hlutmengi) inniheldur ekki broskarla eða sjaldgæf tákn. Þau falla út í PDF en haldast í Markdown og vinnuskrá.
- Viðmótið hefur aðeins verið prófað sjálfvirkt í Chromium með iPad-hermun, ekki á raunverulegu iPad eða í WebKit.

## Skrár

- `index.html`, `css/app.css`
- `js/core.js`: Textagögn, tengingar, glósulíkan, vinnuskrá og Markdown. Hreinar aðgerðir, prófaðar í Node.
- `js/store.js`: IndexedDB-vistun með staðfestingu.
- `js/pdfexport.js`: PDF-útflutningur (jsPDF).
- `js/app.js`: Viðmót.
- `data/`: Útdregin textagögn og útdráttarskýrsla.
- `heimild/`: Óbreytt frumskjal.
- `tools/extract.py`: Útdráttur.
- `js/i18n.js`: Viðmótstextar á íslensku og úkraínsku og úkraínsk þýðing kaflaheita.
- `vendor/`: jsPDF og PDF-letur (latneskt letur og kýrillíska) ásamt leyfum.
- `tools/build-pdf-fonts.py`: Býr til PDF-letrið úr Liberation Sans.
- `tests/`: Próf og lítill vefþjónn.
