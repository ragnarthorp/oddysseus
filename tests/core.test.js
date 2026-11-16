/* Próf fyrir textagögn, tengingar, glósur, vinnuskrá og Markdown-útflutning.  Keyrsla: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../js/core.js');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'odysseifskvida.json'), 'utf8'));
const index = C.buildIndex(DATA);
const sec = id => index.sectionById.get(id);
const clone = o => JSON.parse(JSON.stringify(o));

test('textagögn: allir 24 þættir og aðrir kaflar', () => {
  const chapters = DATA.sections.filter(s => s.kind === 'thattur');
  assert.equal(chapters.length, 24);
  chapters.forEach((c, i) => {
    assert.equal(c.number, i + 1);
    assert.equal(c.id, `thattur-${String(i + 1).padStart(2, '0')}`);
    assert.ok(c.tocConfirmed, `${c.id} staðfestur í efnisyfirliti`);
    assert.ok(c.units.some(u => u.type === 'efnisgrein'), `${c.id} hefur meginmál`);
  });
  assert.equal(chapters[0].title, 'Aþena kemur til Íþöku');
  assert.equal(chapters[9].title, 'Ajólos, Læstrýgónar og Kirka');
  assert.equal(chapters[11].title, 'Sírenur, Skylla og naut Helíosar');
  assert.equal(chapters[23].title, 'Friður');
  for (const id of ['titill', 'formali', 'nofn', 'um-bokina']) assert.ok(sec(id), id);
  assert.equal(sec('nofn').units.length, 17);
  assert.ok(sec('nofn').units.every(u => u.type === 'nafn' && u.termLength > 0 && u.text[u.termLength - 1] === ':'));
  assert.equal(sec('nofn').units[0].text, 'Ódysseifur: konungur á Íþöku, frægur fyrir brögð sín');
  assert.equal(DATA.document.pdfPages, 51);
});

test('textagögn: myndatextar og myndaskrá eru ekki í lestrartexta', () => {
  const all = DATA.sections.flatMap(s => s.units.map(u => u.text)).join('\n');
  for (const bad of ['Bouguereau', 'Waterhouse', 'Böcklin', 'Lastman', 'Turner', 'Füssli', 'Boulanger', 'Primaticcio', 'Penelópumálarans', 'Leirker', 'Forsíða:', 'Myndir']) {
    assert.ok(!all.includes(bad), `„${bad}“ á ekki heima í lestrartexta`);
  }
  // „Texti og myndir“: textinn um endursögn og þýðingu er varðveittur
  const ub = sec('um-bokina').units.map(u => u.text).join(' ');
  assert.match(ub, /endursögð og stytt/);
  assert.match(ub, /Sveinbjarnar Egilssonar \(1791–1852\)/);
  assert.match(ub, /Úrfellingar eru merktar með þremur punktum\.$/);
});

test('textagögn: tilvitnanir og heimildarlínur aðgreindar', () => {
  let quotes = 0;
  for (const s of DATA.sections) s.units.forEach((u, i) => {
    if (u.type === 'tilvitnun') {
      quotes++;
      assert.ok(u.text.startsWith('„') && u.text.endsWith('“'), u.id);
      const src = s.units[i + 1];
      assert.equal(src.type, 'heimild', `${u.id} fylgir heimildarlína`);
      assert.equal(src.quoteId, u.id);
      assert.equal(u.sourceId, src.id);
      assert.match(src.text, /· þýðing Sveinbjarnar Egilssonar$/);
    }
    if (u.type === 'efnisgrein') assert.ok(!/þýðing Sveinbjarnar Egilssonar$/.test(u.text), `${u.id} er ekki heimildarlína`);
  });
  assert.ok(quotes >= 25);
  // aldrað orðalag helst
  const q = sec('thattur-05').units.find(u => u.type === 'tilvitnun').text;
  assert.match(q, /vil eg og þrey eg eftir því alla daga/);
});

test('textagögn: stöðug auðkenni, síður og íslenskir stafir', () => {
  const ids = new Set();
  for (const s of DATA.sections) s.units.forEach((u, i) => {
    assert.ok(!ids.has(u.id)); ids.add(u.id);
    assert.equal(u.n, i + 1);
    assert.equal(u.id, `${s.id}-${String(i + 1).padStart(3, '0')}`);
    assert.ok(u.pages.length >= 1 && u.pages[0].offset === 0);
    for (const p of u.pages) {
      assert.ok(p.pdfPage >= 1 && p.pdfPage <= 51);
      if (p.printedPage != null) assert.equal(p.printedPage, p.pdfPage);
    }
    assert.equal(u.text, u.text.normalize('NFC'));
    assert.ok(!/\s{2,}|^\s|\s$/.test(u.text), `${u.id} án tvöfaldra bila`);
  });
  assert.equal(sec('titill').units[0].pages[0].printedPage, null, 'forsíða hefur ekkert prentað númer');
  const all = DATA.sections.flatMap(s => s.units.map(u => u.text)).join('');
  for (const ch of 'ðþæöÞÖÁÍÓÚáéíóúý„“…–') assert.ok(all.includes(ch), ch);
  assert.ok(!/\b\d{1,2}\s*$/.test(sec('thattur-01').units.at(-1).text), 'síðunúmer ekki í texta');
});

test('tenging: val innan efnisgreinar', () => {
  const u = sec('thattur-01').units[0];
  const start = u.text.indexOf('Póseidon');
  const end = start + 'Póseidon, sem hatar Ódysseif'.length;
  const r = C.makeAnchor(index, { unitId: u.id, offset: start }, { unitId: u.id, offset: end });
  assert.ok(r.ok);
  assert.equal(r.anchor.quote, 'Póseidon, sem hatar Ódysseif');
  assert.deepEqual(r.anchor.pdfPages, [6, 6]);
  assert.deepEqual(r.anchor.printedPages, [6, 6]);
  assert.deepEqual(r.anchor.paragraphs, [1, 1]);
  assert.equal(r.anchor.docId, 'odysseifskvida-endursogn');
  assert.ok(r.anchor.prefix.endsWith('Ólympsfjalli. '));
  assert.ok(r.anchor.suffix.startsWith(', er fjarverandi'));
  const loc = C.locationParts(index, r.anchor);
  assert.equal(loc.section, 'I. þáttur — Aþena kemur til Íþöku');
  assert.equal(loc.pages, 'Bls. 6');
  assert.equal(loc.paras, 'Efnisgrein 1');
  assert.ok(C.verifyAnchor(index, r.anchor).ok);
});

test('tenging: bil í endum vals eru klippt og öfugt val snúið við', () => {
  const u = sec('thattur-01').units[0];
  const r = C.makeAnchor(index, { unitId: u.id, offset: 20 }, { unitId: u.id, offset: 8 });
  assert.ok(r.ok);
  const raw = u.text.slice(8, 20);
  assert.equal(r.anchor.start.offset, 8 + (raw.length - raw.trimStart().length));
  assert.equal(r.anchor.quote, raw.trim());
  assert.ok(!C.makeAnchor(index, { unitId: u.id, offset: 5 }, { unitId: u.id, offset: 5 }).ok);
  const sp = u.text.indexOf(' ');
  assert.ok(!C.makeAnchor(index, { unitId: u.id, offset: sp }, { unitId: u.id, offset: sp + 1 }).ok, 'aðeins bil er ekki gilt val');
});

test('tenging: val yfir efnisgreinar og síðuskil fær rétt bil', () => {
  // II. þáttur: síðasta efnisgrein á síðu 7 → fyrsta efnisgrein á síðu 8
  const s = sec('thattur-02');
  const last7 = s.units.filter(u => u.pages[0].pdfPage === 7).at(-1);
  const first8 = s.units.find(u => u.pages[0].pdfPage === 8);
  assert.ok(last7 && first8);
  const r = C.makeAnchor(index, { unitId: last7.id, offset: last7.text.length - 20 }, { unitId: first8.id, offset: 15 });
  assert.ok(r.ok);
  assert.deepEqual(r.anchor.pdfPages, [7, 8]);
  assert.deepEqual(r.anchor.printedPages, [7, 8]);
  assert.deepEqual(r.anchor.unitIds, [last7.id, first8.id]);
  assert.deepEqual(r.anchor.paragraphs, [last7.n, first8.n]);
  assert.equal(r.anchor.quote, last7.text.slice(-20) + '\n\n' + first8.text.slice(0, 15));
  const loc = C.locationParts(index, r.anchor);
  assert.equal(loc.pages, 'Bls. 7–8');
  assert.equal(loc.paras, `Efnisgreinar ${last7.n}–${first8.n}`);
  // val sem endar í upphafi einingar (offset 0) dregst til baka að fyrri einingu
  const r2 = C.makeAnchor(index, { unitId: last7.id, offset: 0 }, { unitId: first8.id, offset: 0 });
  assert.deepEqual(r2.anchor.unitIds, [last7.id]);
  assert.deepEqual(r2.anchor.pdfPages, [7, 7]);
});

test('tenging: síðuskil innan einingar (kort af stafabilum)', () => {
  // tilbúin eining sem nær yfir tvær síður – staðfestir að síðukortið sé notað
  const d = clone(DATA);
  const u = d.sections.find(s => s.id === 'thattur-03').units[0];
  const cut = 40;
  u.pages = [{ offset: 0, pdfPage: 9, printedPage: 9 }, { offset: cut, pdfPage: 10, printedPage: 10 }];
  const ix = C.buildIndex(d);
  const a = C.makeAnchor(ix, { unitId: u.id, offset: 2 }, { unitId: u.id, offset: 30 }).anchor;
  assert.deepEqual(a.pdfPages, [9, 9]);
  const b = C.makeAnchor(ix, { unitId: u.id, offset: cut + 2 }, { unitId: u.id, offset: cut + 20 }).anchor;
  assert.deepEqual(b.pdfPages, [10, 10]);
  const c = C.makeAnchor(ix, { unitId: u.id, offset: 5 }, { unitId: u.id, offset: cut + 10 }).anchor;
  assert.deepEqual(c.pdfPages, [9, 10]);
  const e = C.makeAnchor(ix, { unitId: u.id, offset: 5 }, { unitId: u.id, offset: cut }).anchor;
  assert.deepEqual(e.pdfPages, [9, 9], 'val sem endar nákvæmlega á síðuskilum er á fyrri síðu');
  assert.equal(C.pageAt(u, cut).pdfPage, 10);
});

test('tenging: ekki yfir kaflaskil, og úrelt tenging greinist', () => {
  const a = sec('thattur-01').units[0], b = sec('thattur-02').units[0];
  assert.ok(!C.makeAnchor(index, { unitId: a.id, offset: 0 }, { unitId: b.id, offset: 5 }).ok);
  const good = C.anchorForUnit(index, a.id).anchor;
  assert.equal(good.quote, a.text);
  const bad1 = Object.assign({}, good, { quote: good.quote + 'x' });
  assert.ok(!C.verifyAnchor(index, bad1).ok);
  const bad2 = Object.assign({}, good, { docVersion: 'sha256-0000' });
  assert.match(C.verifyAnchor(index, bad2).reason, /aðra útgáfu/);
  const bad3 = Object.assign({}, good, { start: { unitId: 'thattur-01-999', offset: 0 } });
  assert.ok(!C.verifyAnchor(index, bad3).ok);
});

test('glósur: óbreytt endurvinnsla verður Tilvitnun, breytt helst Endurvinnsla', () => {
  const a = C.anchorForUnit(index, sec('thattur-01').units[1].id).anchor;
  const n1 = C.finalizeNote(C.newNote(a, { type: 'endurvinnsla', body: a.quote + '  \n', origin: 'recycle', insertedText: a.quote }));
  assert.equal(n1.type, 'tilvitnun');
  assert.ok(n1.unchangedCopy);
  const n2 = C.finalizeNote(C.newNote(a, { type: 'endurvinnsla', body: 'Þeir eyða eigum hans. ' + a.quote.slice(30), origin: 'recycle', insertedText: a.quote }));
  assert.equal(n2.type, 'endurvinnsla');
  const n3 = C.finalizeNote(C.newNote(a, { type: 'spurning', body: '', origin: 'own' }));
  assert.equal(n3.type, 'spurning', 'tóm glósa er vistuð, ekkert mat');
  assert.equal(n2.anchor.quote, a.quote, 'upprunalega valið varðveitt');
});

test('glósur: röð í textanum, síur og margar glósur á sama stað', () => {
  const u1 = sec('thattur-01').units[0], u3 = sec('thattur-01').units[2], f = sec('formali').units[0];
  const mk = (anchor, type, t) => Object.assign(C.newNote(anchor, { type }), { createdAt: t });
  const n1 = mk(C.anchorForUnit(index, u3.id).anchor, 'spurning', '2026-01-01T10:00:00.000Z');
  const n2 = mk(C.makeAnchor(index, { unitId: u1.id, offset: 10 }, { unitId: u1.id, offset: 40 }).anchor, 'athugasemd', '2026-01-01T09:00:00.000Z');
  const n3 = mk(C.makeAnchor(index, { unitId: u1.id, offset: 0 }, { unitId: u1.id, offset: 30 }).anchor, 'endursogn', '2026-01-01T11:00:00.000Z');
  const n4 = mk(C.anchorForUnit(index, f.id).anchor, 'athugasemd', '2026-01-01T12:00:00.000Z');
  const sorted = C.sortNotes(index, [n1, n2, n3, n4]);
  assert.deepEqual(sorted.map(n => n.id), [n4.id, n3.id, n2.id, n1.id]);
  assert.deepEqual(C.sortNotes(index, [n1, n2, n3, n4], 'stofnun').map(n => n.id), [n2.id, n1.id, n3.id, n4.id]);
  assert.equal(C.filterNotes([n1, n2, n3, n4], { sectionId: 'thattur-01' }).length, 3);
  assert.equal(C.filterNotes([n1, n2, n3, n4], { sectionId: 'thattur-01', type: 'athugasemd' }).length, 1);
  assert.equal(C.notesForUnit([n1, n2, n3, n4], u1.id).length, 2, 'skarandi val á sama textabút');
});

function sampleState() {
  const s1 = sec('thattur-01'), s2 = sec('thattur-02');
  const a1 = C.makeAnchor(index, { unitId: s1.units[0].id, offset: 0 }, { unitId: s1.units[1].id, offset: 25 }).anchor;
  const a2 = C.anchorForUnit(index, s2.units[0].id).anchor;
  const long = 'Þetta er löng glósa með ð, þ, æ og ö. '.repeat(400);
  return {
    settings: { fontSize: 24, font: 'sans', lineHeight: 'rumt', width: 'breidur', theme: 'dokkt', cornell: true, lang: 'is' },
    position: { sectionId: 'thattur-02', unitId: s2.units[1].id },
    notes: [
      C.finalizeNote(C.newNote(a1, { type: 'endurvinnsla', body: 'Guðirnir funda.\n\nAþena fær Seif til að leyfa heimferð.', origin: 'recycle', insertedText: a1.quote })),
      C.newNote(a2, { type: 'spurning', body: long }),
      C.newNote(a2, { type: 'athugasemd', body: '# ekki fyrirsögn\n> ekki tilvitnun\n<b>ekki html</b>' }),
    ],
  };
}

test('vinnuskrá: fram og til baka án gagnataps', () => {
  const st = sampleState();
  const wf = C.makeWorkfile(index, st);
  assert.equal(wf.format, 'odysseifskvida-vinnuskra');
  assert.equal(wf.formatVersion, 1);
  assert.equal(wf.document.id, DATA.document.id);
  assert.equal(wf.document.version, DATA.document.version);
  const res = C.parseWorkfile(index, JSON.stringify(wf));
  assert.ok(res.ok, res.errors.join('; '));
  assert.deepEqual(res.data.notes, JSON.parse(JSON.stringify(st.notes)));
  assert.deepEqual(res.data.settings, st.settings);
  assert.deepEqual(res.data.position, st.position);
});

test('vinnuskrá: rangar og skemmdar skrár hafna án breytinga', () => {
  const st = sampleState();
  const good = C.makeWorkfile(index, st);
  const cases = [
    ['{ekki json', /skemmd/],
    ['[]', /ekki vinnuskrá/],
    [JSON.stringify(Object.assign({}, good, { format: 'annad' })), /ekki vinnuskrá/],
    [JSON.stringify(Object.assign({}, good, { formatVersion: 99 })), /nýrra sniði/],
    [JSON.stringify(Object.assign({}, good, { document: Object.assign({}, good.document, { id: 'iliónskviða' }) })), /annað skjal/],
    [JSON.stringify(Object.assign({}, good, { document: Object.assign({}, good.document, { version: 'sha256-ffff' }) })), /aðra útgáfu/],
    [JSON.stringify(Object.assign({}, good, { notes: 'x' })), /Glósulista vantar/],
  ];
  for (const [txt, re] of cases) {
    const r = C.parseWorkfile(index, txt);
    assert.equal(r.ok, false);
    assert.match(r.errors.join(' '), re);
  }
  const bad = clone(good); bad.notes[1].type = 'mat';
  assert.match(C.parseWorkfile(index, JSON.stringify(bad)).errors[0], /Glósa 2: óþekkt tegund/);
  const bad2 = clone(good); bad2.notes[0].anchor.quote = 'Annar texti';
  assert.match(C.parseWorkfile(index, JSON.stringify(bad2)).errors[0], /stemmir ekki/);
  const bad3 = clone(good); bad3.notes[0].anchor.docVersion = 'sha256-gamalt';
  assert.match(C.parseWorkfile(index, JSON.stringify(bad3)).errors[0], /aðra útgáfu/);
  const bad4 = clone(good); bad4.notes[2].id = bad4.notes[1].id;
  assert.match(C.parseWorkfile(index, JSON.stringify(bad4)).errors[0], /tvítekið/);
  const trunc = JSON.stringify(good).slice(0, 500);
  assert.equal(C.parseWorkfile(index, trunc).ok, false);
  // stillingar úr skrá eru hreinsaðar
  const odd = clone(good); odd.settings = { fontSize: 999, theme: 'neon' };
  assert.deepEqual(C.parseWorkfile(index, JSON.stringify(odd)).data.settings, Object.assign({}, C.DEFAULT_SETTINGS, { fontSize: C.FONT_MAX }));
});

test('vinnuskrá: tóm staða', () => {
  const wf = C.makeWorkfile(index, { notes: [], settings: null, position: null });
  const r = C.parseWorkfile(index, JSON.stringify(wf));
  assert.ok(r.ok);
  assert.equal(r.data.notes.length, 0);
  assert.equal(C.toMarkdown(C.exportModel(index, [])).includes('Engar glósur.'), true);
});

test('Markdown-útflutningur: allar glósur, aðgreindur frumtexti, íslenskir stafir og langar glósur', () => {
  const st = sampleState();
  const model = C.exportModel(index, st.notes, { includeQuote: true });
  assert.equal(model.count, 3);
  const md = C.toMarkdown(model);
  assert.match(md, /^# Ódysseifskviða – endursögn/);
  assert.match(md, /## I\. þáttur — Aþena kemur til Íþöku/);
  assert.match(md, /## II\. þáttur — Þingið á Íþöku/);
  // ein stutt kóðalína á glósu; númer byrja upp á nýtt í hverjum kafla
  assert.match(md, /\n1 · bls\. 6 · ¶ 1–2 · \(ev\)\n\n> „Guðirnir sitja/);
  assert.match(md, /\n1 · bls\. 7 · ¶ 1 · \(s\)\n/);
  assert.match(md, /\n2 · bls\. 7 · ¶ 1 · \(a\)\n/);
  assert.match(md, /Sjálf heldur Aþena til Íþ“\n\nGuðirnir funda\./, 'glósan kemur beint á eftir frumtexta');
  assert.match(md, /Skýringar: bls\. = blaðsíða .*¶ = efnisgrein .*\(e\) endursögn · \(a\) athugasemd · \(s\) spurning · \(ev\) endurvinnsla · \(t\) tilvitnun/);
  assert.ok(!/Tegund:|Valinn frumtexti|Mín glósa|### Glósa/.test(md), 'engar langar merkingar');
  assert.equal((md.match(/^\d+ · (bls|pdf-s)\. /gm) || []).length, 3, 'engin glósa týnist');
  assert.ok(md.includes('Þetta er löng glósa með ð, þ, æ og ö.'.repeat(1)));
  assert.ok(md.length > 15000);
  assert.match(md, /\\# ekki fyrirsögn/);
  assert.match(md, /\\> ekki tilvitnun/);
  assert.ok(md.includes('\\<b>ekki html'), 'HTML í glósu er táknað sem texti (\\<)');
  // margra efnisgreina val: hver lína frumtexta í tilvitnun
  assert.match(md, /> „Guðirnir[^\n]*\n>\n> Sjálf heldur/);
  const noQ = C.toMarkdown(C.exportModel(index, st.notes, { includeQuote: false }));
  assert.ok(!noQ.includes('> „'));
  assert.equal((noQ.match(/^\d+ · bls\. /gm) || []).length, 3);
  // tilvitnun sem byrjar þegar á gæsalöppum fær ekki tvöfaldar
  const qa = C.anchorForUnit(index, sec('thattur-01').units.find(u => u.type === 'tilvitnun').id).anchor;
  const mdq = C.toMarkdown(C.exportModel(index, [C.newNote(qa, { body: 'x' })]));
  assert.ok(!mdq.includes('„„'));
});

test('útflutningur: PDF-síða notuð þegar prentað númer er óstaðfest', () => {
  const a = C.anchorForUnit(index, sec('titill').units[0].id).anchor;
  assert.equal(a.printedPages, null);
  assert.equal(C.locationParts(index, a).pages, 'PDF-síða 1');
  assert.equal(C.locationCode(a), 'pdf-s. 1 · ¶ 1');
  const md = C.toMarkdown(C.exportModel(index, [C.newNote(a, { type: 'tilvitnun', body: 'x' })]));
  assert.match(md, /\n1 · pdf-s\. 1 · ¶ 1 · \(t\)\n/);
});

function cornellNotes() {
  const s1 = sec('thattur-01'), s2 = sec('thattur-02');
  const a = C.makeAnchor(index, { unitId: s1.units[0].id, offset: 0 }, { unitId: s1.units[0].id, offset: 59 }).anchor;
  const full = C.anchorForUnit(index, s1.units[2].id).anchor;
  return [
    C.newNote(C.anchorForSection(index, 'thattur-01').anchor, { kind: 'samantekt', type: 'athugasemd', body: 'Kaflinn kynnir vandann á Íþöku.\nAþena tekur málin í sínar hendur.' }),
    C.finalizeNote(C.newNote(a, { kind: 'cornell', cue: 'Hver hatar Ódysseif?', type: 'endurvinnsla', body: 'Póseidon | hatar Ódysseif og er fjarri.', origin: 'recycle', insertedText: a.quote })),
    C.finalizeNote(C.newNote(full, { kind: 'cornell', cue: 'Telemakkos', type: 'endurvinnsla', body: full.quote, origin: 'recycle', insertedText: full.quote })),
    C.newNote(C.anchorForUnit(index, s1.units[3].id).anchor, { type: 'spurning', body: 'Hvað eru bernskubrögð?' }),
    C.finalizeNote(C.newNote(C.anchorForUnit(index, s2.units[0].id).anchor, { kind: 'cornell', cue: 'Þingið', type: 'endurvinnsla', body: 'Telemakkos kallar saman þing.', origin: 'recycle', insertedText: s2.units[0].text })),
  ];
}

test('Cornell: kaflatenging, gerðir glósa og röð (athugasemd við kaflann aftast)', () => {
  const ns = cornellNotes();
  assert.equal(ns[1].type, 'endurvinnsla', 'umorðaður texti');
  assert.equal(ns[2].type, 'tilvitnun', 'óbreyttur texti');
  assert.equal(ns[1].cue, 'Hver hatar Ódysseif?');
  const sa = ns[0].anchor;
  assert.ok(C.isSectionAnchor(sa));
  assert.deepEqual(sa.printedPages, [6, 6]);
  assert.ok(C.verifyAnchor(index, sa).ok);
  assert.ok(!C.verifyAnchor(index, Object.assign({}, sa, { sectionId: 'titill' })).ok);
  assert.equal(C.locationParts(index, sa).paras, 'Allur kaflinn');
  const sorted = C.sortNotes(index, ns);
  assert.equal(sorted[3].kind, 'samantekt', 'athugasemd við kaflann kemur á eftir glósum kaflans');
  assert.equal(sorted[4].anchor.sectionId, 'thattur-02');
  assert.equal(C.notesForUnit(ns, sec('thattur-01').units[0].id).length, 1);
});

test('Cornell: vinnuskrá varðveitir lykilorð og gerð; ógildar Cornell-glósur hafnað', () => {
  const ns = cornellNotes();
  const wf = C.makeWorkfile(index, { notes: ns, settings: { cornell: true } });
  const r = C.parseWorkfile(index, JSON.stringify(wf));
  assert.ok(r.ok, r.errors.join('; '));
  assert.deepEqual(r.data.notes, JSON.parse(JSON.stringify(ns)));
  assert.equal(r.data.settings.cornell, true);
  const bad = clone(wf); bad.notes[0].kind = 'eitthvad';
  assert.match(C.parseWorkfile(index, JSON.stringify(bad)).errors[0], /óþekkt gerð/);
  const bad2 = clone(wf); bad2.notes[1].anchor = clone(wf.notes[0].anchor);
  assert.match(C.parseWorkfile(index, JSON.stringify(bad2)).errors[0], /kaflatenging/);
  const bad3 = clone(wf); bad3.notes[0].anchor = clone(wf.notes[1].anchor);
  assert.match(C.parseWorkfile(index, JSON.stringify(bad3)).errors[0], /án kaflatengingar/);
  const bad4 = clone(wf); bad4.notes[0].anchor.docVersion = 'sha256-x';
  assert.match(C.parseWorkfile(index, JSON.stringify(bad4)).errors[0], /aðra útgáfu/);
});

test('Cornell-útflutningur (Markdown): tafla með lykilorði vinstra megin og athugasemd í lok kafla', () => {
  const ns = cornellNotes();
  const m = C.cornellModel(index, ns, { includeQuote: true });
  assert.equal(m.count, ns.length);
  assert.deepEqual(m.sections.map(g => g.id), ['thattur-01', 'thattur-02']);
  const md = C.toCornellMarkdown(m);
  assert.match(md, /^# Ódysseifskviða – endursögn – Cornell-glósur/);
  const ch1 = md.split('## I. þáttur — Aþena kemur til Íþöku')[1].split('## II.')[0];
  assert.match(ch1, /\| Lykilorð \/ spurning \| Glósa \|\n\|---\|---\|/);
  assert.match(ch1, /\| Hver hatar Ódysseif\?<br>bls\. 6 · ¶ 1 \| Póseidon \\\| hatar Ódysseif og er fjarri\.<br><br>\*„Guðirnir sitja/, 'umorðað: frumtexti fylgir');
  assert.match(ch1, /\| Telemakkos<br>bls\. 6 · ¶ 3 \| Telemakkos, sonur Ódysseifs[^|]*burt\. \|\n/, 'óbreyttur texti án tvítekningar');
  assert.match(ch1, /\| \*\(s\) spurning\*<br>bls\. 6 · ¶ 4 \| Hvað eru bernskubrögð\?/);
  assert.ok(ch1.indexOf('**Athugasemdir við kaflann**') > ch1.lastIndexOf('| '), 'athugasemd í lok kaflans');
  assert.match(ch1, /\*\*Athugasemdir við kaflann\*\*\n\nKaflinn kynnir vandann á Íþöku\. {2}\nAþena/);
  const ch2 = md.split('## II. þáttur — Þingið á Íþöku')[1];
  assert.match(ch2, /\*\(engar athugasemdir\)\*/);
  const noQ = C.toCornellMarkdown(C.cornellModel(index, ns, { includeQuote: false }));
  assert.ok(!noQ.includes('„Guðirnir sitja'));
  assert.match(C.toCornellMarkdown(C.cornellModel(index, [])), /Engar glósur\./);
  // venjulegur útflutningur sýnir lykilorð og athugasemd við kaflann
  const plain = C.toMarkdown(C.exportModel(index, ns));
  assert.match(plain, /\*\*Hver hatar Ódysseif\?\*\*/);
  assert.match(plain, /4 · kaflinn · \(a\) · athugasemdir við kaflann/);
});

test('úkraínska: merkingar, kóðar, kaflaþýðingar, villuboð og útflutningur', () => {
  const I = C.I18n;
  I.setLang('uk');
  try {
    const s1 = sec('thattur-01');
    assert.equal(C.sectionLabel(s1), 'Розділ I — Aþena kemur til Íþöku');
    assert.equal(C.sectionLabelTr(index, 'thattur-01'), 'Розділ I — Aþena kemur til Íþöku («Афіна прибуває на Ітаку»)');
    assert.equal(I.sectionTr('thattur-24'), 'Мир');
    for (const s of DATA.sections) assert.ok(I.sectionTr(s.id), `þýðing á ${s.id}`);
    assert.deepEqual(C.NOTE_TYPES.map(t => t.label), ['Переказ', 'Коментар', 'Питання', 'Переробка', 'Цитата']);
    assert.equal(new Set(C.NOTE_TYPES.map(t => t.code)).size, 5, 'ólíkir kóðar');
    const a = C.makeAnchor(index, { unitId: s1.units[0].id, offset: 0 }, { unitId: s1.units[1].id, offset: 10 }).anchor;
    const loc = C.locationParts(index, a);
    assert.equal(loc.pages, 'С. 6'); assert.equal(loc.paras, 'Абзаци 1–2');
    assert.equal(C.locationCode(a), 'с. 6 · ¶ 1–2');
    assert.equal(I.t('filter.total', { n: 1 }), '1 нотатка у порядку тексту.');
    assert.equal(I.t('filter.total', { n: 3 }), '3 нотатки у порядку тексту.');
    assert.equal(I.t('filter.total', { n: 5 }), '5 нотаток у порядку тексту.');
    assert.equal(I.t('filter.total', { n: 21 }), '21 нотатка у порядку тексту.');
    assert.equal(I.t('filter.total', { n: 12 }), '12 нотаток у порядку тексту.');
    assert.match(C.parseWorkfile(index, '{').errors[0], /Файл пошкоджений/);
    const ns = [C.newNote(a, { type: 'spurning', body: 'Чому Посейдон ненавидить Одіссея? ð þ' })];
    const md = C.toMarkdown(C.exportModel(index, ns));
    assert.match(md, /\*Мої нотатки · Усі нотатки · 1 нотатка · /);
    assert.match(md, /## Розділ I — Aþena kemur til Íþöku \(«Афіна прибуває на Ітаку»\)/);
    assert.match(md, /\n1 · с\. 6 · ¶ 1–2 · \(п\)\n/);
    assert.match(md, /> „Guðirnir sitja/, 'frumtexti helst á íslensku');
    assert.match(md, /Чому Посейдон ненавидить Одіссея\? ð þ/);
    const cm = C.toCornellMarkdown(C.cornellModel(index, ns));
    assert.match(cm, /\| Ключове слово \/ питання \| Нотатка \|/);
    assert.match(cm, /\*\*Коментарі до розділу\*\*\n\n\*\(коментарів немає\)\*/);
    // íslenskur texti sleppur ekki inn í úkraínsk viðmótsorð
    for (const [k, v] of Object.entries(I._dicts.uk)) if (!/^lang\./.test(k)) assert.ok(!/[ðþæ]/i.test(v.replace(/Ódysseifskviða/g, '')), `${k} er á íslensku`);
    assert.deepEqual(Object.keys(I._dicts.uk).sort(), Object.keys(I._dicts.is).sort(), 'sömu lyklar á báðum tungumálum');
  } finally { I.setLang('is'); }
  assert.equal(C.sectionLabel(sec('thattur-01')), 'I. þáttur — Aþena kemur til Íþöku');
});

test('skyndiminni: allar staðbundnar skrár í index.html bera útgáfunúmer forritsins', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|data)\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 7);
  for (const r of refs) assert.ok(r.endsWith('?v=' + C.APP.version), `${r} vantar ?v=${C.APP.version}`);
});

test('úkraínsk textaútgáfa: sama bygging, auðkenni og síður; glósur tengdar sinni útgáfu', () => {
  const UK = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'odysseifskvida.uk.json'), 'utf8'));
  const isIx = C.buildIndex(DATA), ukIx = C.buildIndex(UK);
  C.linkEditions([isIx, ukIx]);
  assert.equal(ukIx.edition, 'uk');
  assert.equal(UK.document.id, DATA.document.id);
  assert.equal(UK.document.baseVersion, DATA.document.version);
  assert.notEqual(UK.document.version, DATA.document.version);
  assert.deepEqual(UK.sections.map(s => s.id), DATA.sections.map(s => s.id));
  UK.sections.forEach((s, i) => {
    const o = DATA.sections[i];
    assert.deepEqual(s.units.map(u => [u.id, u.type, u.n, u.pages[0].pdfPage, u.pages[0].printedPage]), o.units.map(u => [u.id, u.type, u.n, u.pages[0].pdfPage, u.pages[0].printedPage]), s.id);
    for (const u of s.units) {
      if (u.id !== 'titill-003' && u.id !== 'um-bokina-002') assert.ok(!/[ðþæÐÞÆ]/.test(u.text), `${u.id} á úkraínsku`);
      if (u.type === 'tilvitnun') assert.ok(u.text.startsWith('«') && u.text.endsWith('»'), u.id);
      if (u.type === 'nafn') assert.equal(u.text[u.termLength - 1], ':', u.id);
    }
  });
  assert.equal(ukIx.sectionById.get('thattur-01').title, 'Афіна прибуває на Ітаку');
  assert.match(ukIx.unitById.get('thattur-09-004').unit.text, /Ніхто/);
  // glósa við úkraínskan texta
  const u = ukIx.unitById.get('thattur-01-001').unit;
  const st = u.text.indexOf('Посейдона'), en = st + 'Посейдона'.length;
  const a = C.makeAnchor(ukIx, { unitId: u.id, offset: st }, { unitId: u.id, offset: en }).anchor;
  assert.equal(a.textLang, 'uk'); assert.equal(a.quote, 'Посейдона'); assert.deepEqual(a.printedPages, [6, 6]);
  assert.ok(C.verifyAnchor(isIx, a).ok, 'sannprófuð við úkraínsku útgáfuna þótt íslenska sé sýnd');
  assert.ok(C.verifyAnchor(ukIx, a).ok);
  // glósa við íslenskan texta sannprófuð þegar úkraínska er sýnd
  const b = C.anchorForUnit(isIx, 'thattur-01-001').anchor;
  assert.equal(b.textLang, 'is');
  assert.ok(C.verifyAnchor(ukIx, b).ok);
  assert.ok(!C.verifyAnchor(ukIx, Object.assign({}, a, { quote: 'Зевса' })).ok);
  assert.ok(!C.verifyAnchor(ukIx, Object.assign({}, a, { docVersion: 'uk-gamalt' })).ok, 'eldri þýðing tengist ekki í hljóði');
  // eldri glósur án textLang teljast íslenskar
  const old = Object.assign({}, b); delete old.textLang;
  assert.ok(C.verifyAnchor(ukIx, old).ok);
  // vinnuskrá með glósum úr báðum útgáfum
  const ns = [C.newNote(a, { type: 'spurning', body: 'Чому?' }), C.newNote(b, { type: 'athugasemd', body: 'Íslensk glósa' }),
    C.newNote(C.anchorForSection(ukIx, 'thattur-01').anchor, { kind: 'samantekt', type: 'athugasemd', body: 'Підсумок' })];
  const wf = C.makeWorkfile(ukIx, { notes: ns, settings: { lang: 'uk' } });
  assert.equal(wf.document.version, DATA.document.version, 'vinnuskrá vísar í íslenska frumtextann');
  assert.equal(wf.document.editions.uk, UK.document.version);
  const r = C.parseWorkfile(isIx, JSON.stringify(wf));
  assert.ok(r.ok, r.errors.join('; '));
  assert.deepEqual(r.data.notes, JSON.parse(JSON.stringify(ns)));
  // útflutningur: gæsalappir fylgja tungumáli textans
  const md = C.toMarkdown(C.exportModel(ukIx, ns));
  assert.match(md, /> «Посейдона»/);
  assert.match(md, /> „Guðirnir sitja/);
  assert.match(md, /^# Одіссея – переказ/);
});

test('pólsk textaútgáfa: sama bygging, pólskar gæsalappir; þrjár útgáfur tengdar', () => {
  const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `odysseifskvida.${l}.json`), 'utf8'));
  const PL = load('pl'), UK = load('uk');
  const isIx = C.buildIndex(DATA), ukIx = C.buildIndex(UK), plIx = C.buildIndex(PL);
  const eds = C.linkEditions([isIx, ukIx, plIx]);
  assert.deepEqual(Object.keys(eds).sort(), ['is', 'pl', 'uk']);
  assert.equal(PL.document.baseVersion, DATA.document.version);
  assert.equal(PL.document.title, 'Odyseja – opowieść');
  PL.sections.forEach((s, i) => {
    const o = DATA.sections[i];
    assert.equal(s.id, o.id);
    assert.deepEqual(s.units.map(u => [u.id, u.type, u.n, u.pages[0].pdfPage]), o.units.map(u => [u.id, u.type, u.n, u.pages[0].pdfPage]), s.id);
    for (const u of s.units) {
      if (u.type === 'tilvitnun') assert.ok(u.text.startsWith('„') && u.text.endsWith('”'), u.id);
      if (u.type === 'heimild') assert.match(u.text, /z islandzkiego przekładu Sveinbjörna Egilssona$/, u.id);
      if (u.type === 'nafn') assert.equal(u.text[u.termLength - 1], ':', u.id);
    }
  });
  assert.equal(plIx.sectionById.get('thattur-09').title, 'Cyklop');
  assert.match(plIx.unitById.get('thattur-09-004').unit.text, /Nikt/);
  // glósur úr öllum þremur útgáfum sannprófast hver við sína útgáfu
  const mk = (ix, id, w) => { const u = ix.unitById.get(id).unit, st = u.text.indexOf(w); return C.makeAnchor(ix, { unitId: id, offset: st }, { unitId: id, offset: st + w.length }).anchor; };
  const aPl = mk(plIx, 'thattur-01-001', 'Posejdona'), aUk = mk(ukIx, 'thattur-01-001', 'Посейдона'), aIs = mk(isIx, 'thattur-01-001', 'Póseidon');
  assert.deepEqual([aPl.textLang, aUk.textLang, aIs.textLang], ['pl', 'uk', 'is']);
  for (const ix of [isIx, ukIx, plIx]) for (const a of [aPl, aUk, aIs]) assert.ok(C.verifyAnchor(ix, a).ok, `${a.textLang} í ${ix.edition}`);
  const ns = [aIs, aUk, aPl].map(a => C.newNote(a, { type: 'athugasemd', body: a.textLang }));
  const wf = C.makeWorkfile(plIx, { notes: ns });
  assert.deepEqual(Object.keys(wf.document.editions).sort(), ['is', 'pl', 'uk']);
  const r = C.parseWorkfile(ukIx, JSON.stringify(wf));
  assert.ok(r.ok, r.errors.join('; '));
  // gæsalappir í útflutningi fylgja tungumáli textans
  C.I18n.setLang('pl');
  try {
    const md = C.toMarkdown(C.exportModel(plIx, ns));
    assert.match(md, /> „Póseidon“/);
    assert.match(md, /> «Посейдона»/);
    assert.match(md, /> „Posejdona”/);
    assert.match(md, /^# Odyseja – opowieść/);
    assert.match(md, /## Rozdział I — Atena przybywa na Itakę\n/);
    assert.match(md, /\n1 · s\. 6 · ¶ 1 · \(k\)\n/);
  } finally { C.I18n.setLang('is'); }
});

test('pólska: viðmótstextar, fleirtölur, kóðar og villuboð', () => {
  const I = C.I18n;
  const keys = o => Object.keys(o).sort();
  for (const l of I.LANGS) assert.deepEqual(keys(I._dicts[l]), keys(I._dicts.is), `sömu lyklar: ${l}`);
  assert.deepEqual(I.LANGS, ['is', 'uk', 'pl']);
  assert.deepEqual(I.LANGS.map(l => I.LANG_META[l].short), ['Ísl', 'Ukr', 'PL']);
  I.setLang('pl');
  try {
    const cases = { 1: 'notatka', 2: 'notatki', 4: 'notatki', 5: 'notatek', 12: 'notatek', 14: 'notatek', 21: 'notatek', 22: 'notatki', 25: 'notatek', 102: 'notatki', 112: 'notatek' };
    for (const [n, w] of Object.entries(cases)) assert.equal(I.t('toc.count', { n: Number(n) }), `${n} ${w}`);
    assert.deepEqual(C.NOTE_TYPES.map(t => t.label), ['Parafraza', 'Komentarz', 'Pytanie', 'Przetworzenie', 'Cytat']);
    assert.equal(new Set(C.NOTE_TYPES.map(t => t.code)).size, 5);
    const a = C.makeAnchor(index, { unitId: 'thattur-02-003', offset: 0 }, { unitId: 'thattur-02-004', offset: 5 }).anchor;
    assert.equal(C.locationParts(index, a).paras, 'Akapity 3–4');
    assert.equal(C.locationCode(a), 's. 8 · ¶ 3–4');
    assert.match(C.parseWorkfile(index, '{').errors[0], /Plik jest uszkodzony/);
    for (const [k, v] of Object.entries(I._dicts.pl)) assert.ok(!/[ðþæ]/i.test(v.replace(/Ódysseifskviða/g, '')), `${k} er á íslensku`);
  } finally { I.setLang('is'); }
});
