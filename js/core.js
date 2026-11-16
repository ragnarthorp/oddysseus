/* Kjarni lestrarstofunnar: textagögn, tengingar glósa við texta, glósulíkan, vinnuskrá og útflutningur.
   Hreinar aðgerðir án DOM svo hægt sé að prófa þær í Node (tests/core.test.js).
   Staðsetningar eru stafastaðsetningar (UTF-16, eins og JavaScript-strengir) í `unit.text`
   í textagögnunum – ekki skjáhnit – og breytast því ekki við leturstillingu eða gluggabreytingu. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OdyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const I = (typeof module === 'object' && module.exports) ? require('./i18n.js') : self.OdyI18n;
  const T = I.t;

  const APP = { name: 'Lestrarstofa – Ódysseifskviða', version: '1.0.0' };
  const WORKFILE_FORMAT = 'odysseifskvida-vinnuskra';
  const WORKFILE_VERSION = 1;
  const CONTEXT_CHARS = 40;
  const MAX_BODY = 200000;

  // Heiti, skýring og kóði fylgja tungumáli viðmóts (sjá js/i18n.js).
  const NOTE_TYPES = ['endursogn', 'athugasemd', 'spurning', 'endurvinnsla', 'tilvitnun'].map(id => ({
    id,
    get label() { return T('type.' + id); },
    get hint() { return T('hint.' + id); },
    get code() { return T('tcode.' + id); },
  }));
  const TYPE_IDS = NOTE_TYPES.map(t => t.id);
  const typeLabel = id => (NOTE_TYPES.find(t => t.id === id) || { label: id }).label;
  const typeCode = id => (NOTE_TYPES.find(t => t.id === id) || { code: '?' }).code;
  /* Skýringar á kóðum í útflutningi (birtast einu sinni efst). */
  const exportLegend = () => T('legend.prefix') + NOTE_TYPES.map(t => `(${t.code}) ${t.label.toLowerCase()}`).join(' · ');

  /* Stuttur staðarkóði: „bls. 6–7 · ¶ 3–4“. */
  function locationCode(anchor) {
    if (isSectionAnchor(anchor)) return T('code.chapter');
    const pg = anchor.printedPages ? T('code.page') + ' ' + range(anchor.printedPages[0], anchor.printedPages[1]) : T('code.pdf') + ' ' + range(anchor.pdfPages[0], anchor.pdfPages[1]);
    return `${pg} · ¶ ${range(anchor.paragraphs[0], anchor.paragraphs[1])}`;
  }


  const DEFAULT_SETTINGS = { fontSize: 20, font: 'serif', lineHeight: 'venjulegt', width: 'midlungs', theme: 'ljost', cornell: false, lang: 'is' };
  const SETTING_OPTIONS = {
    font: ['serif', 'sans'],
    lineHeight: ['thett', 'venjulegt', 'rumt'],
    width: ['mjor', 'midlungs', 'breidur'],
    theme: ['ljost', 'hlytt', 'dokkt'],
  };
  const FONT_MIN = 14, FONT_MAX = 36;

  function sanitizeSettings(s) {
    const out = Object.assign({}, DEFAULT_SETTINGS);
    if (!s || typeof s !== 'object') return out;
    const fs = Number(s.fontSize);
    if (Number.isFinite(fs)) out.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(fs)));
    for (const k of Object.keys(SETTING_OPTIONS)) if (SETTING_OPTIONS[k].includes(s[k])) out[k] = s[k];
    out.cornell = s.cornell === true;
    out.lang = I.LANGS.includes(s.lang) ? s.lang : 'is';
    return out;
  }

  /* ---------- textagögn ---------- */
  function buildIndex(data) {
    const sections = data.sections;
    const sectionById = new Map();
    const unitById = new Map();
    sections.forEach((s, si) => {
      sectionById.set(s.id, s);
      s.units.forEach((u, ui) => unitById.set(u.id, { unit: u, section: s, si, ui }));
    });
    return { data, doc: data.document, sections, sectionById, unitById };
  }

  function sectionLabel(s) {
    if (!s) return '';
    if (s.kind === 'thattur') return T('sec.thattur', { num: s.numeral, t: s.title });
    if (s.kind === 'formali') return T('sec.formali', { t: s.title });
    if (s.kind === 'nofn') return s.title;
    if (s.kind === 'um-bokina') return T('sec.umBokina', { t: s.title });
    return s.title;
  }
  /* Kaflaheiti með þýðingu þegar viðmótið er ekki á íslensku (t.d. í útflutningi). */
  function sectionLabelTr(index, sid) {
    const sec = index.sectionById.get(sid);
    if (!sec) return '';
    const tr = I.sectionTr(sid);
    return tr && I.getLang() !== 'is' ? `${sectionLabel(sec)} («${tr}»)` : sectionLabel(sec);
  }
  function sectionShort(s) {
    if (!s) return '';
    if (s.kind === 'thattur') return T('short.thattur', { num: s.numeral });
    if (s.kind === 'formali') return T('short.formali');
    if (s.kind === 'um-bokina') return T('short.umBokina');
    if (s.kind === 'titill') return T('short.titill');
    return s.title;
  }

  /* Síða sem stafur nr. `offset` í einingu er á. */
  function pageAt(unit, offset) {
    let p = unit.pages[0];
    for (const q of unit.pages) if (q.offset <= offset) p = q;
    return p;
  }

  function cmpPos(index, a, b) {
    const A = index.unitById.get(a.unitId), B = index.unitById.get(b.unitId);
    if (A.si !== B.si) return A.si - B.si;
    if (A.ui !== B.ui) return A.ui - B.ui;
    return a.offset - b.offset;
  }

  /* Býr til tengingu (anchor) úr upphafs- og endastöðu. Skilar {ok, anchor} eða {ok:false, reason}. */
  function makeAnchor(index, startPos, endPos) {
    let a = Object.assign({}, startPos), b = Object.assign({}, endPos);
    const A0 = index.unitById.get(a.unitId), B0 = index.unitById.get(b.unitId);
    if (!A0 || !B0) return { ok: false, reason: T('anchor.outside') };
    if (A0.section !== B0.section) return { ok: false, reason: T('anchor.crossSection') };
    if (cmpPos(index, a, b) > 0) { const t = a; a = b; b = t; }
    const sec = A0.section;
    const units = sec.units;
    let si = index.unitById.get(a.unitId).ui, ei = index.unitById.get(b.unitId).ui;
    a.offset = clamp(a.offset, 0, units[si].text.length);
    b.offset = clamp(b.offset, 0, units[ei].text.length);
    // færa upphaf fram yfir bil og tómar endastöður
    while (si <= ei) {
      const t = units[si].text;
      while (a.offset < t.length && /\s/.test(t[a.offset])) a.offset++;
      if (a.offset < t.length && !(si === ei && a.offset >= b.offset)) break;
      si++; a = { unitId: units[si] ? units[si].id : a.unitId, offset: 0 };
    }
    if (si > ei) return { ok: false, reason: T('anchor.nothing') };
    while (ei >= si) {
      const t = units[ei].text;
      while (b.offset > 0 && /\s/.test(t[b.offset - 1])) b.offset--;
      if (b.offset > 0 && !(si === ei && b.offset <= a.offset)) break;
      ei--; b = { unitId: units[ei] ? units[ei].id : b.unitId, offset: units[ei] ? units[ei].text.length : 0 };
    }
    if (ei < si || (si === ei && b.offset <= a.offset)) return { ok: false, reason: T('anchor.nothing') };
    a.unitId = units[si].id; b.unitId = units[ei].id;
    const unitIds = units.slice(si, ei + 1).map(u => u.id);
    const parts = units.slice(si, ei + 1).map((u, i) => {
      const from = i === 0 ? a.offset : 0;
      const to = i === ei - si ? b.offset : u.text.length;
      return u.text.slice(from, to);
    });
    const quote = parts.join('\n\n');
    const su = units[si], eu = units[ei];
    const prefix = su.text.slice(Math.max(0, a.offset - CONTEXT_CHARS), a.offset);
    const suffix = eu.text.slice(b.offset, b.offset + CONTEXT_CHARS);
    const p1 = pageAt(su, a.offset), p2 = pageAt(eu, Math.max(0, b.offset - 1));
    const anchor = {
      docId: index.doc.id,
      docVersion: index.doc.version,
      sectionId: sec.id,
      start: { unitId: su.id, offset: a.offset },
      end: { unitId: eu.id, offset: b.offset },
      unitIds,
      quote,
      prefix,
      suffix,
      pdfPages: [p1.pdfPage, p2.pdfPage],
      printedPages: p1.printedPage != null && p2.printedPage != null ? [p1.printedPage, p2.printedPage] : null,
      paragraphs: [su.n, eu.n],
    };
    return { ok: true, anchor };
  }

  function anchorForUnit(index, unitId) {
    const e = index.unitById.get(unitId);
    if (!e) return { ok: false, reason: T('anchor.noPara') };
    return makeAnchor(index, { unitId, offset: 0 }, { unitId, offset: e.unit.text.length });
  }

  /* Tenging við heilan kafla („Athugasemdir við kaflann“) – ekkert textaval. */
  const isSectionAnchor = a => !!a && a.scope === 'kafli';
  function anchorForSection(index, sectionId) {
    const s = index.sectionById.get(sectionId);
    if (!s || s.kind === 'titill' || !s.units.length) return { ok: false, reason: T('anchor.noSection') };
    const first = s.units[0].pages[0];
    const lastU = s.units[s.units.length - 1];
    const last = lastU.pages[lastU.pages.length - 1];
    return {
      ok: true,
      anchor: {
        scope: 'kafli', docId: index.doc.id, docVersion: index.doc.version, sectionId: s.id,
        unitIds: [], quote: '',
        pdfPages: [first.pdfPage, last.pdfPage],
        printedPages: first.printedPage != null && last.printedPage != null ? [first.printedPage, last.printedPage] : null,
      },
    };
  }

  /* Staðfestir að tenging vísi enn á sama texta. */
  function verifyAnchor(index, anchor) {
    if (!anchor || typeof anchor !== 'object') return { ok: false, reason: T('verify.missing') };
    if (isSectionAnchor(anchor)) {
      if (anchor.docId !== index.doc.id) return { ok: false, reason: T('verify.otherDoc') };
      if (anchor.docVersion !== index.doc.version) return { ok: false, reason: T('verify.otherVersion') };
      return anchorForSection(index, anchor.sectionId);
    }
    if (anchor.docId !== index.doc.id) return { ok: false, reason: T('verify.otherDoc') };
    if (anchor.docVersion !== index.doc.version) return { ok: false, reason: T('verify.otherVersion') };
    if (!anchor.start || !anchor.end) return { ok: false, reason: T('verify.incomplete') };
    const A = index.unitById.get(anchor.start.unitId), B = index.unitById.get(anchor.end.unitId);
    if (!A || !B) return { ok: false, reason: T('verify.noUnit') };
    if (A.section.id !== anchor.sectionId || B.section.id !== anchor.sectionId) return { ok: false, reason: T('verify.sectionMismatch') };
    if (!Number.isInteger(anchor.start.offset) || !Number.isInteger(anchor.end.offset)) return { ok: false, reason: T('verify.badPos') };
    const re = makeAnchor(index, anchor.start, anchor.end);
    if (!re.ok) return re;
    if (re.anchor.quote !== anchor.quote) return { ok: false, reason: T('verify.quoteMismatch') };
    if (re.anchor.start.offset !== anchor.start.offset || re.anchor.end.offset !== anchor.end.offset) return { ok: false, reason: T('verify.posMismatch') };
    return { ok: true, anchor: re.anchor };
  }

  function range(a, b) { return a === b ? `${a}` : `${a}–${b}`; }
  function locationParts(index, anchor) {
    const sec = index.sectionById.get(anchor.sectionId);
    if (isSectionAnchor(anchor)) {
      const pg = anchor.printedPages ? T('loc.pages', { r: range(anchor.printedPages[0], anchor.printedPages[1]) }) : T('loc.pdfPage', { r: range(anchor.pdfPages[0], anchor.pdfPages[1]) });
      return { section: sec ? sectionLabel(sec) : anchor.sectionId, sectionShort: sec ? sectionShort(sec) : '', pages: pg, paras: T('loc.whole') };
    }
    const pages = anchor.printedPages
      ? T('loc.pages', { r: range(anchor.printedPages[0], anchor.printedPages[1]) })
      : T('loc.pdfPage', { r: range(anchor.pdfPages[0], anchor.pdfPages[1]) });
    const paras = T(anchor.paragraphs[0] === anchor.paragraphs[1] ? 'loc.para' : 'loc.paras', { r: range(anchor.paragraphs[0], anchor.paragraphs[1]) });
    return { section: sec ? sectionLabel(sec) : anchor.sectionId, sectionShort: sec ? sectionShort(sec) : '', pages, paras };
  }

  /* ---------- glósur ---------- */
  function uid() {
    const r = Math.random().toString(36).slice(2, 10);
    return 'g-' + Date.now().toString(36) + '-' + r;
  }

  function newNote(anchor, opts) {
    const now = new Date().toISOString();
    return {
      id: uid(),
      type: opts && opts.type || 'athugasemd',
      body: opts && opts.body || '',
      origin: opts && opts.origin || 'own',
      insertedText: opts && opts.insertedText != null ? opts.insertedText : null,
      ...(opts && opts.kind ? { kind: opts.kind } : {}),
      ...(opts && opts.kind === 'cornell' ? { cue: opts.cue || '' } : {}),
      createdAt: now,
      updatedAt: now,
      anchor,
    };
  }

  const normWs = s => String(s || '').replace(/\s+/g, ' ').trim();
  /* Ef innsett afrit er enn óbreytt við vistun er glósan merkt „Tilvitnun“. Ekkert annað mat fer fram. */
  function finalizeNote(note) {
    const n = Object.assign({}, note);
    if (n.insertedText != null && normWs(n.body) === normWs(n.insertedText)) {
      n.type = 'tilvitnun';
      n.unchangedCopy = true;
    } else {
      delete n.unchangedCopy;
    }
    return n;
  }

  function noteSortKey(index, n) {
    if (n.anchor && isSectionAnchor(n.anchor)) {
      const s = index.sectionById.get(n.anchor.sectionId);
      return s ? [index.sections.indexOf(s), 1e6, 0, n.createdAt || ''] : [1e9, 0, 0, n.createdAt || ''];
    }
    const e = n.anchor && index.unitById.get(n.anchor.start && n.anchor.start.unitId);
    if (!e) return [1e9, 0, 0, n.createdAt || ''];
    return [e.si, e.ui, n.anchor.start.offset, n.createdAt || ''];
  }
  function sortNotes(index, notes, order) {
    const arr = notes.slice();
    if (order === 'stofnun') return arr.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return arr.sort((a, b) => {
      const A = noteSortKey(index, a), B = noteSortKey(index, b);
      for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
      return String(A[3]).localeCompare(String(B[3]));
    });
  }
  function filterNotes(notes, f) {
    return notes.filter(n => (!f || !f.sectionId || (n.anchor && n.anchor.sectionId === f.sectionId)) && (!f || !f.type || n.type === f.type));
  }
  function notesForUnit(notes, unitId) {
    return notes.filter(n => n.anchor && Array.isArray(n.anchor.unitIds) && n.anchor.unitIds.includes(unitId));
  }

  /* ---------- vinnuskrá ---------- */
  function makeWorkfile(index, state) {
    return {
      format: WORKFILE_FORMAT,
      formatVersion: WORKFILE_VERSION,
      savedAt: new Date().toISOString(),
      app: APP,
      document: { id: index.doc.id, version: index.doc.version, sha256: index.doc.sha256, title: index.doc.title },
      settings: sanitizeSettings(state.settings),
      readingPosition: state.position || null,
      notes: state.notes || [],
    };
  }

  const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
  function validateNote(index, n, i) {
    const where = T('note.where', { i: i + 1 });
    const V = (k, x) => T(k, Object.assign({ w: where }, x));
    if (!n || typeof n !== 'object') return V('val.invalid');
    if (typeof n.id !== 'string' || !n.id || n.id.length > 100) return V('val.noId');
    if (!TYPE_IDS.includes(n.type)) return V('val.badType', { t: String(n.type).slice(0, 30) });
    if (typeof n.body !== 'string' || n.body.length > MAX_BODY) return V('val.badBody');
    if (n.insertedText != null && typeof n.insertedText !== 'string') return V('val.badInserted');
    if (n.kind != null && !['cornell', 'samantekt'].includes(n.kind)) return V('val.badKind');
    if (n.cue != null && (typeof n.cue !== 'string' || n.cue.length > 5000)) return V('val.badCue');
    if (n.kind === 'samantekt' && !isSectionAnchor(n.anchor)) return V('val.summaryNoSection');
    if (n.kind !== 'samantekt' && isSectionAnchor(n.anchor)) return V('val.sectionWrongNote');
    if (typeof n.createdAt !== 'string' || !ISO.test(n.createdAt)) return V('val.noDate');
    if (n.updatedAt != null && (typeof n.updatedAt !== 'string' || !ISO.test(n.updatedAt))) return V('val.badDate');
    const v = verifyAnchor(index, n.anchor);
    if (!v.ok) return `${where}: ${v.reason}`;
    return null;
  }

  /* Les vinnuskrá. Breytir engu – skilar {ok, errors, data}. */
  function parseWorkfile(index, text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: [T('wf.corrupt')] }; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: [T('wf.notWorkfile')] };
    if (obj.format !== WORKFILE_FORMAT) return { ok: false, errors: [T('wf.notOurs')] };
    if (!Number.isInteger(obj.formatVersion)) return { ok: false, errors: [T('wf.noVersion')] };
    if (obj.formatVersion > WORKFILE_VERSION) return { ok: false, errors: [T('wf.newer', { v: obj.formatVersion, s: WORKFILE_VERSION })] };
    if (obj.formatVersion < 1) return { ok: false, errors: [T('wf.badVersion')] };
    const d = obj.document;
    if (!d || typeof d !== 'object') return { ok: false, errors: [T('wf.noDoc')] };
    if (d.id !== index.doc.id) return { ok: false, errors: [T('wf.otherDoc', { id: String(d.id).slice(0, 60) })] };
    if (d.version !== index.doc.version) return { ok: false, errors: [T('wf.otherVersion')] };
    if (!Array.isArray(obj.notes)) return { ok: false, errors: [T('wf.noNotes')] };
    const errors = [];
    const ids = new Set();
    obj.notes.forEach((n, i) => {
      const e = validateNote(index, n, i);
      if (e) errors.push(e);
      else if (ids.has(n.id)) errors.push(T('val.dupId', { w: T('note.where', { i: i + 1 }) }));
      else ids.add(n.id);
    });
    if (errors.length) return { ok: false, errors: errors.slice(0, 10).concat(errors.length > 10 ? [T('wf.more', { n: errors.length - 10 })] : []) };
    let position = null;
    const p = obj.readingPosition;
    if (p && typeof p === 'object' && index.sectionById.has(p.sectionId)) {
      position = { sectionId: p.sectionId, unitId: index.unitById.has(p.unitId) ? p.unitId : null };
    }
    const notes = obj.notes.map(n => ({
      id: n.id, type: n.type, body: n.body, origin: ['own', 'recycle', 'paragraph'].includes(n.origin) ? n.origin : 'own',
      insertedText: n.insertedText == null ? null : n.insertedText,
      createdAt: n.createdAt, updatedAt: n.updatedAt || n.createdAt, anchor: verifyAnchor(index, n.anchor).anchor,
      ...(n.unchangedCopy ? { unchangedCopy: true } : {}),
      ...(n.kind ? { kind: n.kind } : {}),
      ...(n.kind === 'cornell' ? { cue: typeof n.cue === 'string' ? n.cue : '' } : {}),
    }));
    return { ok: true, errors: [], data: { notes, settings: sanitizeSettings(obj.settings), position, savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : null } };
  }

  /* ---------- útflutningur ---------- */
  function exportModel(index, notes, opts) {
    const o = Object.assign({ includeQuote: true, order: 'texti', scopeLabel: T('ex.scopeAll') }, opts);
    const sorted = sortNotes(index, notes, o.order);
    const perSection = new Map();
    const items = sorted.map((n, i) => {
      const loc = n.anchor ? locationParts(index, n.anchor) : { section: T('ex.unknownPlace'), pages: '', paras: '' };
      if (n.anchor) loc.section = sectionLabelTr(index, n.anchor.sectionId) || loc.section;
      const num = (perSection.get(loc.section) || 0) + 1; // númer innan kafla
      perSection.set(loc.section, num);
      const code = [String(num), n.anchor ? locationCode(n.anchor) : null, `(${typeCode(n.type)})`, n.orphan ? T('ex.orphan') : null].filter(Boolean).join(' · ');
      return {
        n: i + 1,
        num,
        code,
        work: index.doc.title,
        section: loc.section,
        location: [loc.pages, loc.paras].filter(Boolean).join(' · '),
        type: typeLabel(n.type),
        quote: o.includeQuote && n.anchor && !isSectionAnchor(n.anchor) ? withQuoteMarks(n.anchor.quote) : null,
        cue: n.kind === 'cornell' ? (n.cue || '') : null,
        kind: n.kind || null,
        // óbreyttur frumtexti er ekki endurtekinn sem glósutexti þegar frumtextinn fylgir
        sameAsQuote: !!(o.includeQuote && n.anchor && !isSectionAnchor(n.anchor) && normWs(n.body) === normWs(n.anchor.quote)),
        body: n.body,
        orphan: !!n.orphan,
      };
    });
    return { title: index.doc.title, generatedAt: new Date(), scopeLabel: o.scopeLabel, includeQuote: o.includeQuote, legend: exportLegend(), items, count: items.length };
  }

  /* Cornell-uppsetning: í hverjum kafla er tafla (lykilorð/spurning vinstra megin, texti hægra megin)
     og athugasemdir við kaflann í lokin. Aðrar glósur fá tegund sína vinstra megin. */
  function cornellModel(index, notes, opts) {
    const o = Object.assign({ includeQuote: true, order: 'texti', scopeLabel: T('ex.scopeAll') }, opts);
    const sorted = sortNotes(index, notes, o.order);
    const sections = [];
    const bySec = new Map();
    for (const n of sorted) {
      const sid = n.anchor ? n.anchor.sectionId : '?';
      let g = bySec.get(sid);
      if (!g) {
        const sec = index.sectionById.get(sid);
        g = { id: sid, label: sec ? sectionLabelTr(index, sid) : T('ex.unknownPlace'), rows: [], summaries: [] };
        bySec.set(sid, g); sections.push(g);
      }
      if (n.kind === 'samantekt') { g.summaries.push(n.body); continue; }
      const loc = n.anchor ? locationCode(n.anchor) : '';
      const quote = n.anchor ? n.anchor.quote : '';
      const reworded = normWs(n.body) !== normWs(quote);
      const row = {
        cue: n.kind === 'cornell' ? (n.cue || '').trim() : '',
        cueIsType: n.kind !== 'cornell',
        typeLabel: `(${typeCode(n.type)}) ${typeLabel(n.type).toLowerCase()}`,
        loc: loc + (n.orphan ? ' · ' + T('ex.orphan') : ''),
        text: n.body,
        quote: o.includeQuote && quote && reworded ? withQuoteMarks(quote) : null,
      };
      g.rows.push(row);
    }
    const count = sorted.length;
    return { title: index.doc.title, generatedAt: new Date(), scopeLabel: o.scopeLabel, sections, count };
  }
  function mdCell(s) {
    return String(s).replace(/\r\n?/g, '\n').trim().replace(/[\\|*_`<>[\]]/g, c => '\\' + c).replace(/\n+/g, '<br>');
  }
  function toCornellMarkdown(m) {
    const out = [`# ${m.title} – ${T('c.title')}`, '', `*${T('md.meta', { scope: m.scopeLabel, n: m.count, date: fmtDate(m.generatedAt) })}*`, ''];
    if (!m.sections.length) out.push(T('md.none'), '');
    for (const g of m.sections) {
      out.push(`## ${g.label}`, '');
      if (g.rows.length) {
        out.push(`| ${T('c.cue')} | ${T('c.note')} |`, '|---|---|');
        for (const r of g.rows) {
          const left = (r.cueIsType ? '*' + mdCell(r.typeLabel) + '*' : mdCell(r.cue || '–')) + '<br>' + mdCell(r.loc);
          let right = mdCell(r.text || T('md.empty'));
          if (r.quote) right += '<br><br>*' + mdCell(r.quote) + '*';
          out.push(`| ${left} | ${right} |`);
        }
        out.push('');
      }
      out.push(`**${T('chap.notesTitle')}**`, '');
      out.push(g.summaries.filter(s => s.trim()).length ? g.summaries.filter(s => s.trim()).map(mdParagraphs).join('\n\n') : `*${T('c.none')}*`, '');
    }
    return out.join('\n');
  }

  function withQuoteMarks(q) {
    const t = String(q);
    return t.startsWith('„') && t.endsWith('“') ? t : '„' + t + '“';
  }
  function mdEscapeLine(line) {
    return line.replace(/^(\s*)([#>+\-*]|\d+[.)]|=+$|`{3,}|~{3,})/, '$1\\$2');
  }
  function mdParagraphs(text) {
    // Línuskil nemandans haldast: tvö bil + nýlína = harð línuskil í Markdown.
    return String(text).replace(/\r\n?/g, '\n').split('\n').map(l => mdEscapeLine(l).replace(/</g, '\\<')).join('  \n').replace(/( {2}\n){2,}/g, '\n\n');
  }
  function toMarkdown(model) {
    const out = [`# ${model.title}`, '', `*${T('md.myNotes')} · ${T('md.meta', { scope: model.scopeLabel, n: model.count, date: fmtDate(model.generatedAt) })}*`, ''];
    if (model.items.length) out.push(`*${T('md.legend', { l: model.legend })}*`, '');
    let cur = null;
    if (!model.items.length) out.push(T('md.none'), '');
    for (const it of model.items) {
      if (it.section !== cur) { out.push(`## ${it.section}`, ''); cur = it.section; }
      out.push(it.kind === 'samantekt' ? it.code + ' · ' + T('md.chapterNote') : it.code, '');
      if (it.cue) out.push('**' + mdEscapeLine(it.cue.replace(/\s+/g, ' ').trim()).replace(/</g, '\\<').replace(/\*/g, '\\*') + '**', '');
      if (it.quote != null) out.push(it.quote.split('\n').map(l => (l ? '> ' + mdEscapeLine(l) : '>')).join('\n'), '');
      if (!it.sameAsQuote) out.push(it.body.trim() ? mdParagraphs(it.body) : `*${T('md.empty')}*`, '');
    }
    return out.join('\n');
  }

  function fmtDate(d) {
    const x = d instanceof Date ? d : new Date(d);
    const p = n => String(n).padStart(2, '0');
    return `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()} ${T('date.at')} ${p(x.getHours())}:${p(x.getMinutes())}`;
  }
  function fileStamp(d) {
    const x = d || new Date();
    const p = n => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  return {
    APP, WORKFILE_FORMAT, WORKFILE_VERSION, NOTE_TYPES, TYPE_IDS, typeLabel,
    get RECYCLE_GUIDANCE() { return T('guide.recycle'); },
    get EXPORT_LEGEND() { return exportLegend(); },
    I18n: I, sectionLabelTr,
    DEFAULT_SETTINGS, SETTING_OPTIONS, FONT_MIN, FONT_MAX, sanitizeSettings,
    buildIndex, sectionLabel, sectionShort, pageAt, makeAnchor, anchorForUnit, verifyAnchor, locationParts,
    newNote, finalizeNote, sortNotes, filterNotes, notesForUnit,
    makeWorkfile, parseWorkfile, exportModel, cornellModel, toCornellMarkdown, isSectionAnchor, anchorForSection, withQuoteMarks, typeCode, locationCode, toMarkdown, fmtDate, fileStamp,
  };
});
