# Próf úr Ódysseifskviðu

Myndrænt krossapróf með 40 spurningum, í anda Trójuprófsins. Hver spurning er ein lárétt A4-glæra: ljós myndflötur með teikningu eða korti og síðan spurning með svarmöguleikum A–D (litir eða texti) og „E: Ekkert svar er rétt“.

- `odysseifskvida-prof.pdf` – prófið (40 síður, A4 lárétt).
- `odysseifskvida-svarlykill.pdf` – svarlykill með réttu svari og tilvísun í kafla endursagnarinnar.
- `build_prof.py` – býr prófið til: `python3 prof/build_prof.py`. Það þarf Python 3 og Node með Playwright/Chromium (`print_pdf.js`).
- `gogn/strendur.json` – strandlínur Miðjarðarhafs úr Natural Earth (public domain), klipptar og einfaldaðar.

Allar spurningar byggja á endursögninni sem nemendur lesa í lestrarstofunni (formáli, þættir I–XXIV, „Helstu nöfn“, „Texti og myndir“). Svörin dreifast á A–E og tvær spurningar hafa svarið E.

Spurningum er breytt í `build_prof.py`. Hver spurning er eitt `add(mynd, spurning, svarmöguleikar, rétt svar, kafli)`.
