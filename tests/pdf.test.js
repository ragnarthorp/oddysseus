/* PDF-útflutningur: raunveruleg PDF-skrá með innfelldu letri, íslenskum stöfum, línu- og síðuskiptingu.
   Notar sama jsPDF og letur og vefurinn (vendor/). Textinn er lesinn aftur úr PDF með pdftotext ef það er til. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('../js/core.js');
const P = require('../js/pdfexport.js');

global.window = global;
require('../vendor/pdf-fonts.js');
const { jsPDF } = require('../vendor/jspdf.umd.min.js');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'odysseifskvida.json'), 'utf8'));
const index = C.buildIndex(DATA);

function havePdftotext() { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true; } catch (e) { return false; } }

function notes() {
  const out = [];
  for (const s of DATA.sections.filter(x => x.kind === 'thattur')) {
    const u = s.units[0];
    const a = C.makeAnchor(index, { unitId: u.id, offset: 0 }, { unitId: u.id, offset: Math.min(60, u.text.length) }).anchor;
    out.push(C.newNote(a, { type: C.TYPE_IDS[s.number % 5], body: `Glósa við ${s.numeral}. þátt: ð þ æ ö Ð Þ Æ Ö – „gæsalappir“ …` }));
  }
  const q = DATA.sections.find(s => s.id === 'thattur-05').units.find(u => u.type === 'tilvitnun');
  out.push(C.newNote(C.anchorForUnit(index, q.id).anchor, { type: 'tilvitnun', body: 'Löng glósa. ' + 'Ódysseifur þráir að komast heim til Íþöku og sjá heimfarardaginn. '.repeat(150) + 'ENDIR' }));
  out.push(C.newNote(C.anchorForUnit(index, q.id).anchor, { type: 'spurning', body: 'Broskarl 😀 og annað sem letrið hefur ekki.' }));
  return out;
}

test('PDF: raunveruleg skrá með mörgum síðum, innfelldu letri og öllum glósum', () => {
  const ns = notes();
  const model = C.exportModel(index, ns, { includeQuote: true });
  const doc = P.build(jsPDF, window.NASA_PDF_FONTS, model);
  const buf = Buffer.from(doc.output('arraybuffer'));
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
  const pages = doc.getNumberOfPages();
  assert.ok(pages >= 4, `margar síður (${pages})`);
  const raw = buf.toString('latin1');
  assert.match(raw, /FontFile2/, 'letur er innfellt');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ody-')), 'glosur.pdf');
  fs.writeFileSync(file, buf);
  if (!havePdftotext()) return;
  const txt = execFileSync('pdftotext', ['-enc', 'UTF-8', file, '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').replace(/\s+/g, ' ');
  assert.match(txt, /Ódysseifskviða – endursögn/);
  assert.match(txt, /I\. þáttur — Aþena kemur til Íþöku/);
  assert.match(txt, /XXIV\. þáttur — Friður/);
  assert.match(txt, /1 · bls\. 6 · ¶ 1 · \((e|a|s|ev|t)\)/);
  assert.match(txt, /Skýringar: bls\. = blaðsíða/);
  assert.ok(!/Tegund:|Valinn frumtexti:|Mín glósa:/.test(txt), 'engar langar merkingar');
  assert.match(txt, /ð þ æ ö Ð Þ Æ Ö – „gæsalappir“ …/);
  assert.match(txt, /„… hún er dauðleg, en þú ódauðleg og eldist eigi\./, 'tilvitnun án tvöfaldra gæsalappa');
  assert.match(txt, /ENDIR/, 'löng glósa skilar sér til enda');
  assert.equal((txt.match(/\d+ · bls\. \d+(–\d+)? · ¶ \d+(–\d+)? · \((e|a|s|ev|t)\)/g) || []).length, ns.length, 'engin glósa týnist');
  assert.match(txt, /1 · bls\. 11 · ¶ 1 · \(\w+\).*2 · bls\. 12 · ¶ \d+ · \(t\).*3 · bls\. 12 · ¶ \d+ · \(s\)/, 'þrjár glósur í V. þætti fá númer 1–3 innan kaflans');
  assert.match(txt, /1 · bls\. 13 · ¶ 1 /, 'númerun byrjar aftur í VI. þætti');
  assert.match(txt, new RegExp(`Síða ${pages} af ${pages}`));
});

test('PDF: án frumtexta og tómt', () => {
  const doc = P.build(jsPDF, window.NASA_PDF_FONTS, C.exportModel(index, notes().slice(0, 2), { includeQuote: false }));
  assert.ok(doc.getNumberOfPages() >= 1);
  const empty = P.build(jsPDF, window.NASA_PDF_FONTS, C.exportModel(index, []));
  assert.equal(empty.getNumberOfPages(), 1);
  assert.throws(() => P.build(jsPDF, null, C.exportModel(index, [])), /Leturgerð/);
});

test('Cornell-PDF: dálkar, lykilorð, athugasemd við kaflann og síðuskil', () => {
  const s1 = DATA.sections.find(s => s.id === 'thattur-01'), s2 = DATA.sections.find(s => s.id === 'thattur-02');
  const a = C.anchorForUnit(index, s1.units[0].id).anchor;
  const ns = [
    C.finalizeNote(C.newNote(a, { kind: 'cornell', cue: 'Þing guðanna – hvað gerist?', type: 'endurvinnsla', body: 'Aþena fær Seif til að leyfa heimferð. ð þ æ ö', insertedText: a.quote })),
    C.newNote(C.anchorForSection(index, 'thattur-01').anchor, { kind: 'samantekt', type: 'athugasemd', body: 'Samantekt I. þáttar: biðlarnir og Telemakkos.' }),
    C.finalizeNote(C.newNote(C.anchorForUnit(index, s2.units[1].id).anchor, { kind: 'cornell', cue: 'Vefur Penelópu', type: 'endurvinnsla', body: 'Penelópa rekur upp vefinn á nóttunni. '.repeat(120) + 'LOKAORÐ', insertedText: s2.units[1].text })),
  ];
  const doc = P.buildCornell(jsPDF, window.NASA_PDF_FONTS, C.cornellModel(index, ns, { includeQuote: true }));
  assert.ok(doc.getNumberOfPages() >= 2, 'langur dálkur flæðir yfir síðuskil');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ody-')), 'cornell.pdf');
  fs.writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  if (!havePdftotext()) return;
  const txt = execFileSync('pdftotext', ['-enc', 'UTF-8', file, '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').replace(/\s+/g, ' ');
  assert.match(txt, /Cornell-glósur/);
  assert.match(txt, /LYKILORÐ \/ SPURNING GLÓSA/);
  assert.match(txt, /Þing guðanna – hvað gerist\?/);
  assert.match(txt, /Aþena fær Seif til að leyfa heimferð\. ð þ æ ö/);
  assert.match(txt, /„Guðirnir sitja á þingi/, 'umorðað: frumtexti fylgir');
  assert.match(txt, /Athugasemdir við kaflann Samantekt I\. þáttar/);
  assert.match(txt, /LOKAORÐ/);
  assert.ok(txt.indexOf('Samantekt I. þáttar') < txt.indexOf('II. þáttur'), 'athugasemd í lok I. þáttar');
  assert.match(txt, /\(engar athugasemdir\)/);
});
