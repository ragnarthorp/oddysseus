/* Lestrarstofa – Ódysseifskviða: viðmót.
   Allur nemendatexti og innfluttur texti er settur inn sem texti (textContent), aldrei sem HTML. */
(function () {
  'use strict';
  const C = window.OdyCore;
  const I = window.OdyI18n;
  const t = I.t;
  const DATA = window.ODY_TEXT;
  const $ = id => document.getElementById(id);
  const VENDOR = 'vendor/';

  const LINE_HEIGHTS = { thett: 1.45, venjulegt: 1.7, rumt: 2.0 };
  const WIDTHS = { mjor: '28em', midlungs: '36em', breidur: '46em' };
  const SIDE_MIN = 1060; // lágmarksbreidd fyrir hliðarspjald (iPad lárétt)

  const ICONS = {
    endursogn: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    athugasemd: '<path d="M4 5h16v11H9l-5 4z"/>',
    spurning: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14"/><path d="M12 17.2v.3"/>',
    endurvinnsla: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
    tilvitnun: '<path d="M7 7H4v6h4v-1c0 2-1 3.5-3 4"/><path d="M17 7h-3v6h4v-1c0 2-1 3.5-3 4"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  };
  const svg = (name, cls) => `<svg aria-hidden="true" viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''}>${ICONS[name]}</svg>`;

  if (!DATA || !C) {
    document.body.textContent = I ? I.t('app.loadFail') : 'Textagögn hlóðust ekki.';
    return;
  }
  const index = C.buildIndex(DATA);
  const sections = index.sections;

  const state = {
    sectionId: 'titill',
    notes: [],
    settings: Object.assign({}, C.DEFAULT_SETTINGS),
    position: null,
    filter: { sectionId: '', type: '' },
    store: null,
    saveChain: Promise.resolve(),
    pending: null,          // gilt textaval {anchor}
    editor: null,           // {mode:'new'|'edit', noteId, anchor, origin, insertedText}
    lastDeleted: null,
    panelOpen: false,
  };

  /* ---------------- vistun ---------------- */
  function setSaveStatus(kind, text) {
    const el = $('saveStatus');
    el.className = 'save-status ' + (kind || '');
    el.textContent = text;
  }
  function persist(keys) {
    const entries = keys.map(k => [k, k === 'notes' ? state.notes : k === 'settings' ? state.settings : k === 'position' ? state.position : k === 'draft' ? state.draft || null : null]);
    // afrit tekið strax svo síðari breytingar hafi ekki áhrif á það sem er verið að vista
    const snapshot = entries.map(([k, v]) => [k, v == null ? null : JSON.parse(JSON.stringify(v))]);
    const isNotes = keys.includes('notes');
    if (isNotes) setSaveStatus('', t('save.saving'));
    const p = state.saveChain.then(async () => {
      if (!state.store) throw new Error(state.storeError || t('save.unavailable'));
      await state.store.setMany(snapshot);
    });
    state.saveChain = p.catch(() => {});
    return p.then(() => {
      clearBanner('save-error');
      if (isNotes || keys.includes('draft')) {
        const now = new Date();
        setSaveStatus('ok', t('save.savedAt', { time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` }));
      }
      return true;
    }, err => {
      setSaveStatus('error', t('save.failed'));
      showBanner('save-error', 'error', t('save.failedBanner', { err: err && err.message || err }),
        [{ label: t('btn.saveWorkfile'), action: saveWorkfile }]);
      return false;
    });
  }

  /* ---------------- borðar og tilkynningar ---------------- */
  function showBanner(id, kind, text, actions) {
    clearBanner(id);
    const b = document.createElement('div');
    b.className = 'banner ' + (kind || '');
    b.dataset.id = id;
    if (kind === 'error') b.setAttribute('role', 'alert');
    const p = document.createElement('p'); p.textContent = text; b.appendChild(p);
    for (const a of actions || []) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = a.label;
      btn.addEventListener('click', () => { if (a.close !== false) clearBanner(id); a.action(); });
      b.appendChild(btn);
    }
    $('banners').appendChild(b);
  }
  function clearBanner(id) { const b = $('banners').querySelector(`[data-id="${id}"]`); if (b) b.remove(); }

  let toastTimer = null;
  function toast(text, action, ms) {
    const t = $('toast');
    t.innerHTML = '';
    const p = document.createElement('p'); p.textContent = text; t.appendChild(p);
    if (action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => { hideToast(); action.run(); });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || (action ? 12000 : 3500));
  }
  function hideToast() { $('toast').hidden = true; }

  /* ---------------- stillingar ---------------- */
  function applySettings() {
    const s = state.settings;
    const r = document.documentElement;
    r.dataset.theme = s.theme;
    r.dataset.font = s.font;
    r.style.setProperty('--fs', s.fontSize + 'px');
    r.style.setProperty('--lh', LINE_HEIGHTS[s.lineHeight]);
    r.style.setProperty('--measure', WIDTHS[s.width]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(r).getPropertyValue('--bg').trim() || '#fbfaf7';
    r.dataset.cornell = s.cornell ? '1' : '0';
    $('btnCornell').setAttribute('aria-pressed', s.cornell ? 'true' : 'false');
    $('sbCue').hidden = !s.cornell;
    $('sbRecycle').hidden = s.cornell;
    $('sbOwn').classList.toggle('primary', !s.cornell);
    $('fsValue').textContent = s.fontSize + ' px';
    $('fsDown').disabled = s.fontSize <= C.FONT_MIN;
    $('fsUp').disabled = s.fontSize >= C.FONT_MAX;
    for (const name of ['font', 'lineHeight', 'width', 'theme']) {
      for (const inp of document.querySelectorAll(`#settingsDlg input[name="${name}"]`)) inp.checked = inp.value === s[name];
    }
    refreshHighlights();
  }
  function changeSetting(k, v) {
    const anchorUnit = currentTopUnit();
    state.settings = C.sanitizeSettings(Object.assign({}, state.settings, { [k]: v }));
    applySettings();
    if (anchorUnit) scrollToUnit(anchorUnit, false);
    persist(['settings']);
  }

  /* ---------------- birting kafla ---------------- */
  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v; else if (k === 'dataset') Object.assign(e.dataset, v); else e.setAttribute(k, v);
    }
    if (text != null) e.textContent = text;
    return e;
  }

  function noteButton(u) {
    const b = el('button', { type: 'button', class: 'nb', 'data-note-unit': u.id });
    b.innerHTML = svg('pen') + '<span class="c" aria-hidden="true"></span>';
    return b;
  }
  function unitRow(u, tag, wrapTag) {
    const row = el(wrapTag || 'div', { class: 'u-row', 'data-row': u.id });
    const t = el(tag, { class: 'u', 'data-unit': u.id, id: 'u-' + u.id });
    if (u.type === 'nafn' && u.termLength > 0) {
      t.appendChild(el('strong', null, u.text.slice(0, u.termLength)));
      t.appendChild(document.createTextNode(u.text.slice(u.termLength)));
    } else {
      t.textContent = u.text;
    }
    row.appendChild(t);
    row.appendChild(noteButton(u));
    return row;
  }

  function renderSection(id, opts) {
    const sec = index.sectionById.get(id) || sections[0];
    state.sectionId = sec.id;
    hideSelbar();
    const art = $('article');
    art.innerHTML = '';
    art.setAttribute('aria-labelledby', 'secTitle');
    art.lang = 'is';
    if (sec.kind === 'titill') renderCover(sec, art);
    else {
      const head = el('header', { class: 'sec-head' });
      head.appendChild(el('p', { class: 'kicker' }, sec.kicker));
      head.appendChild(el('h1', { id: 'secTitle' }, sec.title));
      const tr = I.sectionTr(sec.id);
      if (tr) head.appendChild(el('p', { class: 'sec-tr', lang: I.getLang() }, `${C.sectionShort(sec)} · ${tr}`));
      art.appendChild(head);
      let list = null;
      for (let i = 0; i < sec.units.length; i++) {
        const u = sec.units[i];
        if (u.type === 'tilvitnun') {
          const q = el('div', { class: 'qblock' });
          q.appendChild(unitRow(u, 'blockquote'));
          const nxt = sec.units[i + 1];
          if (nxt && nxt.type === 'heimild' && nxt.quoteId === u.id) { q.appendChild(unitRow(nxt, 'p')); i++; }
          art.appendChild(q);
        } else if (u.type === 'heimild') {
          const q = el('div', { class: 'qblock' }); q.appendChild(unitRow(u, 'p')); art.appendChild(q);
        } else if (u.type === 'nafn') {
          if (!list) { list = el('ul', { class: 'names' }); art.appendChild(list); }
          list.appendChild(unitRow(u, 'p', 'li'));
        } else {
          art.appendChild(unitRow(u, 'p'));
        }
      }
      for (const s of art.querySelectorAll('.qblock p.u')) s.classList.add('src');
      const cn = el('section', { class: 'chap-notes', id: 'chapNotes', 'aria-labelledby': 'chapNotesTitle', lang: I.getLang() });
      art.appendChild(cn);
      renderChapNotes();
    }
    renderChapnav(sec);
    $('curSection').textContent = sec.kind === 'titill' ? C.sectionShort(sec) : C.sectionLabel(sec);
    document.title = (sec.kind === 'titill' ? '' : C.sectionShort(sec) + ' · ') + t('doc.title');
    updateNoteButtons();
    refreshHighlights();
    renderToc();
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    if (!opts || !opts.noSave) { state.position = { sectionId: sec.id, unitId: null }; persist(['position']); }
  }

  function sectionSummaries(sid) {
    return state.notes.filter(n => n.kind === 'samantekt' && n.anchor && n.anchor.sectionId === sid);
  }
  function renderChapNotes() {
    const cn = $('chapNotes');
    if (!cn) return;
    cn.innerHTML = '';
    const sums = sectionSummaries(state.sectionId);
    cn.appendChild(el('h2', { id: 'chapNotesTitle', tabindex: '-1' }, t('chap.notesTitle')));
    if (sums.length) for (const n of sums) cn.appendChild(el('p', { class: 'cn-body', lang: 'und' }, n.body.trim() ? n.body : t('chap.empty')));
    else cn.appendChild(el('p', { class: 'cn-hint' }, t('chap.hint')));
    const b = el('button', { type: 'button', id: 'btnChapNotes', class: sums.length ? '' : 'primary' },
      sums.length ? t('chap.edit') : t('chap.notesTitle'));
    b.addEventListener('click', () => openChapNotes());
    cn.appendChild(b);
  }
  function openChapNotes() {
    const existing = sectionSummaries(state.sectionId)[0];
    if (existing) { openEditor({ mode: 'edit', noteId: existing.id }); return; }
    const res = C.anchorForSection(index, state.sectionId);
    if (res.ok) openEditor({ mode: 'new', anchor: res.anchor, origin: 'own', kind: 'samantekt' });
  }

  function renderCover(sec, art) {
    const wrap = el('div', { class: 'cover' });
    const units = sec.units;
    wrap.appendChild(el('p', { class: 'c-kicker' }, sec.kicker));
    wrap.appendChild(el('h1', { id: 'secTitle' }, sec.title));
    // titilsíðutexti úr PDF (síður 1–2)
    const sub = units.find(u => u.pages[0].pdfPage === 1 && /Tíu ára/.test(u.text));
    const sub2 = units.find(u => u.pages[0].pdfPage === 2 && /Saga Hómers/.test(u.text));
    const trans = units.find(u => /Sveinbjarnar/.test(u.text));
    if (sub) wrap.appendChild(el('p', { class: 'c-sub' }, sub.text));
    if (sub2) wrap.appendChild(el('p', { class: 'c-sub' }, sub2.text));
    if (trans) wrap.appendChild(el('p', { class: 'c-sub2' }, trans.text));

    const pos = state.position;
    if (pos && pos.sectionId && pos.sectionId !== 'titill' && index.sectionById.has(pos.sectionId)) {
      const b = el('button', { type: 'button', class: 'primary continue' }, t('cover.continue', { s: C.sectionLabel(index.sectionById.get(pos.sectionId)) }));
      b.addEventListener('click', () => goToSection(pos.sectionId, pos.unitId));
      wrap.appendChild(b);
    } else {
      const b = el('button', { type: 'button', class: 'primary continue' }, t('cover.start'));
      b.addEventListener('click', () => goToSection('formali'));
      wrap.appendChild(b);
    }

    const ln = t('cover.langNote');
    if (ln) wrap.appendChild(el('p', { class: 'lang-note', lang: I.getLang() }, ln));
    const how = el('section', { class: 'howto', 'aria-labelledby': 'howTitle', lang: I.getLang() });
    how.appendChild(el('h2', { id: 'howTitle' }, t('cover.howTitle')));
    const ol = el('ol');
    ['cover.how1', 'cover.how2', 'cover.how3', 'cover.how4'].forEach(k => ol.appendChild(el('li', null, t(k))));
    how.appendChild(ol);
    how.appendChild(el('p', null, t('cover.storage')));
    wrap.appendChild(how);

    wrap.appendChild(el('h2', { class: 'sr-only', lang: I.getLang() }, t('cover.toc')));
    const toc = el('ol', { class: 'toc', id: 'coverToc', lang: I.getLang() });
    wrap.appendChild(toc);
    art.appendChild(wrap);
  }

  function tocItems(list) {
    list.innerHTML = '';
    for (const s of sections) {
      if (s.kind === 'titill' && list.id === 'coverToc') continue;
      const li = el('li');
      const b = el('button', { type: 'button', 'data-goto': s.id });
      const num = s.kind === 'thattur' ? s.numeral : '';
      b.appendChild(el('span', { class: 'num' }, num));
      const label = s.kind === 'thattur' ? s.title : s.kind === 'titill' ? C.sectionShort(s) : s.kind === 'formali' ? t('toc.formali', { t: s.title }) : s.kind === 'um-bokina' ? t('toc.umBokina', { t: s.title }) : s.title;
      const lab = el('span', { class: 'tl' });
      lab.appendChild(el('span', { lang: 'is' }, label));
      const tr = s.kind !== 'titill' ? I.sectionTr(s.id) : '';
      if (tr) lab.appendChild(el('span', { class: 'tr' }, tr));
      b.appendChild(lab);
      const cnt = state.notes.filter(n => n.anchor && n.anchor.sectionId === s.id).length;
      b.appendChild(el('span', { class: 'cnt' }, cnt ? t('toc.count', { n: cnt }) : ''));
      if (s.kind === 'thattur') b.setAttribute('aria-label', t('toc.aria', { num: s.numeral, t: s.title + (tr ? ` (${tr})` : '') }) + (cnt ? ', ' + t('toc.count', { n: cnt }) : ''));
      if (s.id === state.sectionId) b.setAttribute('aria-current', 'true');
      li.appendChild(b);
      list.appendChild(li);
    }
  }
  function renderToc() {
    tocItems($('tocList'));
    const ct = $('coverToc');
    if (ct) tocItems(ct);
  }

  function renderChapnav(sec) {
    const nav = $('chapnav');
    nav.innerHTML = '';
    const i = sections.indexOf(sec);
    const mk = (s, cls, dir) => {
      const b = el('button', { type: 'button', class: cls, 'data-goto': s.id });
      b.appendChild(el('span', { class: 'dir' }, dir));
      b.appendChild(el('span', null, s.kind === 'titill' ? C.sectionShort(s) : C.sectionLabel(s)));
      return b;
    };
    if (i > 0) nav.appendChild(mk(sections[i - 1], 'prev', t('nav.prev')));
    if (i < sections.length - 1) nav.appendChild(mk(sections[i + 1], 'next', t('nav.next')));
  }

  function goToSection(id, unitId) {
    renderSection(id, { noSave: true });
    state.position = { sectionId: id, unitId: unitId || null };
    persist(['position']);
    if (unitId) requestAnimationFrame(() => scrollToUnit(unitId, false));
    else { const h = $('secTitle'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }

  function unitEl(unitId) { return $('u-' + unitId); }
  function topOffset() { return $('banners').getBoundingClientRect().bottom + 12; }
  function scrollToUnit(unitId, smooth) {
    const e = unitEl(unitId);
    if (!e) return;
    const y = e.getBoundingClientRect().top + window.scrollY - topOffset();
    window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
  }
  function currentTopUnit() {
    const top = topOffset();
    for (const e of document.querySelectorAll('#article [data-unit]')) {
      if (e.getBoundingClientRect().bottom > top) return e.dataset.unit;
    }
    return null;
  }
  let posTimer = null;
  window.addEventListener('scroll', () => {
    clearTimeout(posTimer);
    posTimer = setTimeout(() => {
      if (state.sectionId === 'titill') return;
      const u = currentTopUnit();
      if (!state.position || state.position.unitId !== u || state.position.sectionId !== state.sectionId) {
        state.position = { sectionId: state.sectionId, unitId: u };
        persist(['position']);
      }
    }, 700);
  }, { passive: true });

  /* ---------------- glósumerki í texta ---------------- */
  function updateNoteButtons() {
    for (const b of document.querySelectorAll('#article .nb')) {
      const uid = b.dataset.noteUnit;
      const u = index.unitById.get(uid).unit;
      const n = C.notesForUnit(state.notes, uid).length;
      b.classList.toggle('has', n > 0);
      b.querySelector('.c').textContent = n ? String(n) : '';
      const label = t('nb.label', { n: u.n }) + (n ? t('nb.existing', { c: n }) : '');
      b.setAttribute('aria-label', label);
      b.title = label;
    }
    $('noteCount').textContent = String(state.notes.length);
    $('btnNotes').setAttribute('aria-label', t('notes.aria', { n: state.notes.length }));
  }

  /* Breytir stafastaðsetningu innan einingar í DOM-staðsetningu (textahnút + hliðrun). */
  function domPoint(unitElement, offset) {
    const w = document.createTreeWalker(unitElement, NodeFilter.SHOW_TEXT);
    let left = offset, node, last = null;
    while ((node = w.nextNode())) {
      if (left <= node.length) return { node, offset: left };
      left -= node.length; last = node;
    }
    return last ? { node: last, offset: last.length } : { node: unitElement, offset: 0 };
  }
  function rangeForAnchor(a) {
    const s = unitEl(a.start.unitId), e = unitEl(a.end.unitId);
    if (!s || !e) return null;
    const p1 = domPoint(s, a.start.offset), p2 = domPoint(e, a.end.offset);
    const r = document.createRange();
    r.setStart(p1.node, p1.offset); r.setEnd(p2.node, p2.offset);
    return r;
  }
  const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  function refreshHighlights() {
    if (!HL) return;
    const ranges = [];
    for (const n of state.notes) {
      if (n.orphan || !n.anchor || n.anchor.sectionId !== state.sectionId || C.isSectionAnchor(n.anchor)) continue;
      const r = rangeForAnchor(n.anchor);
      if (r) ranges.push(r);
    }
    CSS.highlights.set('ody-notes', new Highlight(...ranges));
  }
  let flashTimer = null;
  function flashAnchor(a) {
    clearTimeout(flashTimer);
    for (const r of document.querySelectorAll('.u-row.flash')) r.classList.remove('flash');
    if (HL) {
      const r = rangeForAnchor(a);
      if (r) CSS.highlights.set('ody-flash', new Highlight(r));
    } else {
      for (const id of a.unitIds) { const row = document.querySelector(`[data-row="${id}"]`); if (row) row.classList.add('flash'); }
    }
    flashTimer = setTimeout(() => {
      if (HL) CSS.highlights.delete('ody-flash');
      for (const r of document.querySelectorAll('.u-row.flash')) r.classList.remove('flash');
    }, 4000);
  }

  /* ---------------- textaval ---------------- */
  /* Stafastaðsetning DOM-punkts innan einingar: lengd textans frá upphafi einingar að punktinum. */
  function offsetIn(unitElement, node, off) {
    const r = document.createRange();
    r.setStart(unitElement, 0);
    r.setEnd(node, off);
    return r.toString().length;
  }
  function pointToPos(node, off, isStart) {
    const art = $('article');
    if (!art.contains(node)) return null;
    const host = (node.nodeType === 1 ? node : node.parentElement).closest('[data-unit]');
    if (host && art.contains(host)) return { unitId: host.dataset.unit, offset: offsetIn(host, node, off) };
    // punktur utan textaeiningar (t.d. á hnappi eða bili milli efnisgreina) → næsta eining
    const pt = document.createRange();
    pt.setStart(node, off); pt.collapse(true);
    const units = Array.from(art.querySelectorAll('[data-unit]'));
    if (isStart) {
      for (const u of units) if (pt.comparePoint(u, 0) >= 0) return { unitId: u.dataset.unit, offset: 0 };
    } else {
      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (pt.comparePoint(u, u.childNodes.length) <= 0) return { unitId: u.dataset.unit, offset: u.textContent.length };
      }
    }
    return null;
  }
  function anchorFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (state.sectionId === 'titill') return null;
    const r = sel.getRangeAt(0);
    const a = pointToPos(r.startContainer, r.startOffset, true);
    const b = pointToPos(r.endContainer, r.endOffset, false);
    if (!a || !b) return null;
    const res = C.makeAnchor(index, a, b);
    return res.ok ? res.anchor : null;
  }

  let hideTimer = null, barPressed = false;
  document.addEventListener('selectionchange', () => {
    if (anyDialogOpen()) return;
    const a = anchorFromSelection();
    if (a) {
      clearTimeout(hideTimer);
      state.pending = a;
      showSelbar(a);
    } else if (state.pending && !barPressed) {
      clearTimeout(hideTimer);
      // Bið stutta stund: á iPad getur valið horfið rétt áður en ýtt er á hnapp í valstikunni.
      hideTimer = setTimeout(() => { if (!barPressed) hideSelbar(); }, 900);
    }
  });
  function showSelbar(a) {
    const loc = C.locationParts(index, a);
    const preview = a.quote.replace(/\s+/g, ' ');
    $('sbInfo').textContent = t('sel.info', { q: preview.length > 60 ? preview.slice(0, 60) + '…' : preview, pages: loc.pages, paras: loc.paras });
    $('selbar').hidden = false;
  }
  function hideSelbar() { $('selbar').hidden = true; state.pending = null; barPressed = false; }
  const selbar = $('selbar');
  selbar.addEventListener('pointerdown', () => { barPressed = true; clearTimeout(hideTimer); });
  selbar.addEventListener('mousedown', e => e.preventDefault()); // heldur valinu á borðtölvum
  $('sbCue').addEventListener('click', () => { const a = state.pending; hideSelbar(); if (a) openEditor({ mode: 'new', anchor: a, origin: 'recycle', kind: 'cornell' }); });
  $('sbOwn').addEventListener('click', () => { const a = state.pending; hideSelbar(); if (a) openEditor({ mode: 'new', anchor: a, origin: 'own' }); });
  $('sbRecycle').addEventListener('click', () => { const a = state.pending; hideSelbar(); if (a) openEditor({ mode: 'new', anchor: a, origin: 'recycle' }); });

  /* ---------------- ritspjald ---------------- */
  function buildTypeRow() {
    const row = $('edTypeRow');
    row.innerHTML = '';
    for (const t of C.NOTE_TYPES) {
      const lab = el('label', { class: 't-' + t.id });
      const inp = el('input', { type: 'radio', name: 'edType', value: t.id });
      const span = el('span');
      span.innerHTML = svg(t.id);
      span.appendChild(document.createTextNode(t.label));
      lab.title = `${t.label} – ${t.hint}`;
      lab.appendChild(inp); lab.appendChild(span);
      row.appendChild(lab);
      inp.addEventListener('change', () => { updateGuide(); saveDraftSoon(); });
    }
  }
  function selectedType() { const i = document.querySelector('input[name="edType"]:checked'); return i ? i.value : 'athugasemd'; }
  function setType(t) { for (const i of document.querySelectorAll('input[name="edType"]')) i.checked = i.value === t; updateGuide(); }

  function updateGuide() {
    const ed = state.editor;
    const kind = ed && ed.kind;
    if (kind === 'cornell' || kind === 'samantekt') {
      $('edGuide').hidden = false;
      $('edGuide').textContent = t(kind === 'cornell' ? 'guide.cornell' : 'guide.summary');
      $('edInsertRow').hidden = true;
      return;
    }
    const show = !!ed && (selectedType() === 'endurvinnsla' || ed.origin === 'recycle');
    $('edGuide').hidden = !show;
    $('edGuide').textContent = C.RECYCLE_GUIDANCE;
    $('edInsertRow').hidden = !ed || ed.insertedText != null;
  }

  function openEditor(opts) {
    const ed = Object.assign({ insertedText: null }, opts);
    const note = ed.noteId ? state.notes.find(n => n.id === ed.noteId) : null;
    if (note) { ed.anchor = note.anchor; ed.origin = note.origin; ed.kind = note.kind; if (!ed.restore) ed.insertedText = note.insertedText; }
    state.editor = ed;
    const a = ed.anchor;
    const kind = ed.kind || null;
    const loc = C.locationParts(index, a);
    $('edTitle').textContent = t(kind === 'samantekt' ? 'chap.notesTitle'
      : kind === 'cornell' ? (ed.mode === 'edit' ? 'ed.cornellEdit' : 'ed.cornellNew')
      : ed.mode === 'edit' ? 'ed.edit' : ed.origin === 'recycle' ? 'ed.recycle' : 'ed.new');
    $('edLoc').textContent = `${loc.section} · ${loc.pages} · ${loc.paras}`;
    $('edSrc').textContent = a.quote || '';
    $('edSrcWrap').hidden = kind === 'samantekt';
    $('edTypes').hidden = kind === 'cornell' || kind === 'samantekt';
    $('edCueWrap').hidden = kind !== 'cornell';
    $('edFields').classList.toggle('cornell', kind === 'cornell');
    $('edResetQuote').hidden = kind !== 'cornell';
    $('edBodyLabel').textContent = t(kind === 'cornell' ? 'ed.bodyCornell' : kind === 'samantekt' ? 'chap.notesTitle' : 'ed.bodyDefault');
    let body = '', type = 'athugasemd', cue = '';
    if (ed.restore) { body = ed.restore.body; type = ed.restore.type; cue = ed.restore.cue || ''; }
    else if (note) { body = note.body; type = note.type; cue = note.cue || ''; }
    else if (ed.origin === 'recycle') { body = a.quote; ed.insertedText = a.quote; type = 'endurvinnsla'; }
    $('edBody').value = body;
    $('edCue').value = cue;
    ed.initialBody = body;
    ed.initialCue = cue;
    setType(type);
    $('edNote').textContent = '';
    const dlg = $('editorDlg');
    $('edSrcWrap').open = window.innerHeight > 560 || ed.origin !== 'recycle';
    syncViewport();
    if (!dlg.open) dlg.showModal();
    const ta = $('edBody');
    if (kind === 'cornell') { $('edCue').focus(); ta.scrollTop = 0; saveDraftSoon(); return; }
    ta.focus();
    if (ed.origin === 'recycle' && !note) { try { ta.setSelectionRange(0, 0); } catch (e) { /* */ } ta.scrollTop = 0; }
    saveDraftSoon();
  }

  function closeEditor() {
    state.editor = null;
    state.draft = null;
    persist(['draft']);
    const dlg = $('editorDlg');
    if (dlg.open) dlg.close();
  }

  let draftTimer = null;
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const ed = state.editor;
      if (!ed) return;
      state.draft = { mode: ed.mode, noteId: ed.noteId || null, anchor: ed.anchor, origin: ed.origin, kind: ed.kind || null, insertedText: ed.insertedText, body: $('edBody').value, cue: $('edCue').value, type: selectedType(), savedAt: new Date().toISOString() };
      persist(['draft']);
    }, 400);
  }
  $('edBody').addEventListener('input', saveDraftSoon);
  $('edCue').addEventListener('input', saveDraftSoon);
  $('edResetQuote').addEventListener('click', () => {
    const ed = state.editor; if (!ed) return;
    $('edBody').value = ed.anchor.quote;
    ed.insertedText = ed.anchor.quote;
    $('edBody').focus();
    saveDraftSoon();
  });

  $('edInsert').addEventListener('click', () => {
    const ed = state.editor; if (!ed) return;
    const ta = $('edBody');
    const q = ed.anchor.quote;
    ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + '\n\n' + q : q;
    ed.insertedText = ta.value;
    ed.origin = 'recycle';
    setType('endurvinnsla');
    ta.focus();
    saveDraftSoon();
  });

  $('edSave').addEventListener('click', async () => {
    const ed = state.editor; if (!ed) return;
    clearTimeout(draftTimer);
    const body = $('edBody').value;
    const kind = ed.kind || null;
    // Cornell: umorðaður texti er „Endurvinnsla“, óbreyttur verður „Tilvitnun“ (finalizeNote). Kafla-athugasemd er „Athugasemd“.
    const type = kind === 'cornell' ? 'endurvinnsla' : kind === 'samantekt' ? 'athugasemd' : selectedType();
    const extra = kind === 'cornell' ? { kind, cue: $('edCue').value } : kind ? { kind } : {};
    let note;
    if (ed.mode === 'edit') {
      const old = state.notes.find(n => n.id === ed.noteId);
      if (!old) { closeEditor(); return; }
      note = C.finalizeNote(Object.assign({}, old, { body, type, insertedText: ed.insertedText, origin: ed.origin, updatedAt: new Date().toISOString() }, extra));
      state.notes = state.notes.map(n => (n.id === note.id ? note : n));
    } else {
      note = C.finalizeNote(C.newNote(ed.anchor, Object.assign({ type, body, origin: ed.origin, insertedText: ed.insertedText }, extra)));
      state.notes = state.notes.concat([note]);
    }
    state.draft = null;
    const anchorSection = note.anchor.sectionId;
    state.editor = null;
    $('editorDlg').close();
    afterNotesChanged();
    const ok = await persist(['notes', 'draft']);
    const msg = t(kind === 'samantekt' ? 'toast.summarySaved'
      : kind === 'cornell' ? (note.unchangedCopy ? 'toast.cornellSame' : 'toast.cornellSaved')
      : note.unchangedCopy ? 'toast.quoteSaved' : 'toast.saved');
    toast(ok ? msg + t('toast.savedDevice') : t('toast.memoryOnly'));
    if (anchorSection === state.sectionId && kind === 'samantekt') { const b = $('btnChapNotes'); if (b) b.focus({ preventScroll: true }); }
    else if (anchorSection === state.sectionId) {
      const b = document.querySelector(`.nb[data-note-unit="${note.anchor.start.unitId}"]`);
      if (b) b.focus({ preventScroll: true });
    }
  });

  $('edCancel').addEventListener('click', () => {
    const ed = state.editor;
    if (ed && (($('edBody').value !== ed.initialBody && $('edBody').value.trim()) || ($('edCue').value !== (ed.initialCue || '') && $('edCue').value.trim()))) {
      confirmDialog(t('cancel.title'), [txt(t('cancel.body'))],
        [{ id: 'back', label: t('cancel.back') }, { id: 'discard', label: t('cancel.discard'), primary: true }]).then(r => {
        if (r === 'discard') closeEditor(); else $('edBody').focus();
      });
      return;
    }
    closeEditor();
  });
  $('editorDlg').addEventListener('cancel', e => { e.preventDefault(); $('edCancel').click(); });

  /* visualViewport: ritspjaldið fylgir sýnilega svæðinu þegar skjályklaborð opnast */
  function syncViewport() {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    document.documentElement.style.setProperty('--vv-h', h + 'px');
    document.documentElement.style.setProperty('--vv-top', top + 'px');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }
  window.addEventListener('resize', () => { syncViewport(); layoutPanel(); });
  $('edBody').addEventListener('focus', () => setTimeout(() => { syncViewport(); $('edBody').scrollIntoView({ block: 'nearest' }); }, 350));

  /* ---------------- glósuspjald ---------------- */
  function afterNotesChanged() {
    renderChapNotes();
    updateNoteButtons();
    refreshHighlights();
    renderNotes();
    renderToc();
  }

  function renderFilters() {
    const fs = $('fSection');
    fs.innerHTML = '';
    fs.appendChild(el('option', { value: '' }, t('filter.allSections')));
    for (const s of sections) if (s.kind !== 'titill') fs.appendChild(el('option', { value: s.id }, s.kind === 'thattur' ? `${s.numeral}. ${s.title}` : C.sectionShort(s) === s.title ? s.title : `${C.sectionShort(s)}: ${s.title}`));
    fs.value = state.filter.sectionId;
    const ft = $('fType');
    ft.innerHTML = '';
    ft.appendChild(el('option', { value: '' }, t('filter.allTypes')));
    for (const t of C.NOTE_TYPES) ft.appendChild(el('option', { value: t.id }, t.label));
    ft.value = state.filter.type;
  }
  $('fSection').addEventListener('change', e => { state.filter.sectionId = e.target.value; renderNotes(); });
  $('fType').addEventListener('change', e => { state.filter.type = e.target.value; renderNotes(); });

  function filteredNotes() { return C.sortNotes(index, C.filterNotes(state.notes, state.filter)); }

  function renderNotes() {
    const list = $('noteList');
    list.innerHTML = '';
    const notes = filteredNotes();
    const total = state.notes.length;
    const filtered = !!(state.filter.sectionId || state.filter.type);
    $('filterInfo').textContent = filtered ? t('filter.showing', { a: notes.length, b: total }) : t('filter.total', { n: total });
    if (!notes.length) {
      list.appendChild(el('li', { class: 'empty' }, total ? t('list.noMatch') : t('list.empty')));
      return;
    }
    for (const n of notes) list.appendChild(noteCard(n));
  }

  function noteCard(n) {
    const li = el('li', { class: 'note-card t-' + n.type, 'data-note': n.id, tabindex: '-1' });
    const head = el('div', { class: 'nc-head' });
    const tag = el('span', { class: 'type-tag t-' + n.type });
    tag.innerHTML = svg(n.type);
    tag.appendChild(document.createTextNode(C.typeLabel(n.type)));
    head.appendChild(tag);
    if (n.kind === 'cornell') head.appendChild(el('span', { class: 'kind-tag' }, 'Cornell'));
    if (n.kind === 'samantekt') head.appendChild(el('span', { class: 'kind-tag' }, t('tag.chapter')));
    let locText = '';
    if (n.anchor) { const l = C.locationParts(index, n.anchor); locText = `${l.sectionShort} · ${l.pages} · ${l.paras}`; }
    head.appendChild(el('span', { class: 'nc-loc' }, locText));
    li.appendChild(head);
    if (n.orphan) li.appendChild(el('p', { class: 'nc-warn' }, t('card.orphan') + n.orphan));
    if (n.kind === 'cornell') li.appendChild(el('p', { class: 'nc-cue' }, (n.cue || '').trim() ? n.cue : t('card.noCue')));
    if (n.anchor && n.anchor.quote) li.appendChild(el('blockquote', { class: 'nc-quote' }, n.anchor.quote));
    const body = n.body.trim();
    li.appendChild(el('p', { class: 'nc-body' + (body ? '' : ' emptyb') }, body ? n.body : t('card.empty')));
    const act = el('div', { class: 'nc-actions' });
    const mk = (label, aria, fn, cls) => { const b = el('button', { type: 'button', 'aria-label': aria, class: cls || '' }, label); b.addEventListener('click', fn); act.appendChild(b); return b; };
    const short = locText;
    const go = mk(t('card.go'), t('card.goAria', { s: short }), () => goToNote(n.id));
    if (n.orphan) go.disabled = true;
    mk(t('card.edit'), t('card.editAria', { s: short }), () => openEditor({ mode: 'edit', noteId: n.id }));
    mk(t('card.del'), t('card.delAria', { s: short }), () => deleteNote(n.id));
    li.appendChild(act);
    return li;
  }

  function goToNote(id) {
    const n = state.notes.find(x => x.id === id);
    if (!n || !n.anchor || n.orphan) return;
    if (!isSide()) closePanel(false);
    if (state.sectionId !== n.anchor.sectionId) renderSection(n.anchor.sectionId, { noSave: true });
    if (C.isSectionAnchor(n.anchor)) {
      requestAnimationFrame(() => {
        const cn = $('chapNotes');
        if (cn) { cn.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('chapNotesTitle').focus({ preventScroll: true }); }
      });
      return;
    }
    requestAnimationFrame(() => {
      scrollToUnit(n.anchor.start.unitId, true);
      flashAnchor(n.anchor);
      const e = unitEl(n.anchor.start.unitId);
      if (e) { e.tabIndex = -1; e.focus({ preventScroll: true }); }
      state.position = { sectionId: n.anchor.sectionId, unitId: n.anchor.start.unitId };
      persist(['position']);
    });
  }

  async function deleteNote(id) {
    const i = state.notes.findIndex(n => n.id === id);
    if (i < 0) return;
    const removed = state.notes[i];
    state.notes = state.notes.filter(n => n.id !== id);
    state.lastDeleted = { note: removed, index: i };
    afterNotesChanged();
    const ok = await persist(['notes']);
    toast(ok ? t('toast.deleted') : t('toast.deletedNoSave'), { label: t('toast.undo'), run: undoDelete });
    const first = $('noteList').querySelector('button');
    if (first) first.focus(); else $('notesTitle').focus();
  }
  async function undoDelete() {
    const d = state.lastDeleted; if (!d) return;
    state.lastDeleted = null;
    if (state.notes.some(n => n.id === d.note.id)) return;
    const arr = state.notes.slice();
    arr.splice(Math.min(d.index, arr.length), 0, d.note);
    state.notes = arr;
    afterNotesChanged();
    await persist(['notes']);
    toast(t('toast.restored'));
    const card = document.querySelector(`[data-note="${d.note.id}"]`);
    if (card) card.focus();
  }

  const sideMQ = window.matchMedia(`(min-width: ${SIDE_MIN}px)`);
  function isSide() { return sideMQ.matches; }
  function layoutPanel() {
    const p = $('notesPanel');
    const side = isSide();
    p.classList.toggle('overlay', !side);
    document.body.classList.toggle('with-side', state.panelOpen && side);
    $('panelBackdrop').hidden = !(state.panelOpen && !side);
    p.setAttribute('role', side ? 'complementary' : 'dialog');
    if (!side) p.setAttribute('aria-modal', 'true'); else p.removeAttribute('aria-modal');
  }
  sideMQ.addEventListener ? sideMQ.addEventListener('change', layoutPanel) : sideMQ.addListener(layoutPanel);
  function openPanel() {
    state.panelOpen = true;
    $('notesPanel').hidden = false;
    $('btnNotes').setAttribute('aria-expanded', 'true');
    layoutPanel();
    renderNotes();
    $('notesTitle').focus();
    persistUi();
  }
  function closePanel(focusBack) {
    state.panelOpen = false;
    $('notesPanel').hidden = true;
    $('btnNotes').setAttribute('aria-expanded', 'false');
    layoutPanel();
    if (focusBack !== false) $('btnNotes').focus();
    persistUi();
  }
  function persistUi() { try { localStorage.setItem('odysseifskvida-lestrarstofa:panel', state.panelOpen ? '1' : '0'); } catch (e) { /* aðeins þægindi */ } }
  $('btnNotes').addEventListener('click', () => (state.panelOpen ? closePanel() : openPanel()));
  $('btnCloseNotes').addEventListener('click', () => closePanel());
  $('panelBackdrop').addEventListener('click', () => closePanel());
  $('notesPanel').addEventListener('keydown', e => { if (e.key === 'Escape' && !isSide()) closePanel(); });

  /* ---------------- gluggar ---------------- */
  function anyDialogOpen() { return !!document.querySelector('dialog[open]'); }
  for (const d of document.querySelectorAll('dialog')) {
    for (const b of d.querySelectorAll('[data-close]')) b.addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d && d.id !== 'editorDlg' && d.id !== 'confirmDlg') d.close(); });
  }
  function txt(s) { return document.createTextNode(s); }
  function confirmDialog(title, bodyNodes, buttons) {
    return new Promise(resolve => {
      const d = $('confirmDlg');
      $('cfTitle').textContent = title;
      const body = $('cfBody'); body.innerHTML = '';
      for (const n of bodyNodes) body.appendChild(typeof n === 'string' ? el('p', null, n) : n.nodeType === 3 ? el('p', null, n.textContent) : n);
      const act = $('cfActions'); act.innerHTML = '';
      let result = 'cancel';
      for (const b of buttons) {
        const btn = el('button', { type: 'button', class: b.primary ? 'primary' : '' }, b.label);
        btn.addEventListener('click', () => { result = b.id; d.close(); });
        act.appendChild(btn);
      }
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(result); });
      if (d.open) d.close();
      d.showModal();
      const prim = act.querySelector('.primary') || act.querySelector('button');
      if (prim) prim.focus();
    });
  }

  $('btnToc').addEventListener('click', () => { renderToc(); $('tocDlg').showModal(); const cur = $('tocList').querySelector('[aria-current="true"]'); if (cur) cur.focus(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-goto]');
    if (b) {
      if ($('tocDlg').open) $('tocDlg').close();
      goToSection(b.dataset.goto);
      return;
    }
    const nb = e.target.closest('.nb');
    if (nb) {
      const res = C.anchorForUnit(index, nb.dataset.noteUnit);
      if (res.ok) openEditor(state.settings.cornell
        ? { mode: 'new', anchor: res.anchor, origin: 'recycle', kind: 'cornell' }
        : { mode: 'new', anchor: res.anchor, origin: 'paragraph' });
    }
  });

  /* Tungumál: [Ukr] / [Ísl]. Stillingin vistast og síðan er hlaðin aftur á nýju tungumáli. */
  /* Skiptingin má aldrei stranda á vistun: tungumálið fer líka í slóðina (?lang=) og localStorage,
     og beðið er í mesta lagi stutta stund eftir IndexedDB áður en síðan er hlaðin aftur. */
  $('btnLang').addEventListener('click', async () => {
    const btn = $('btnLang');
    if (btn.disabled) return;
    btn.disabled = true;
    const next = I.getLang() === 'is' ? 'uk' : 'is';
    let target = location.pathname + (next === 'is' ? '' : '?lang=' + next) + location.hash;
    try {
      const url = new URL(location.href);
      if (next === 'is') url.searchParams.delete('lang'); else url.searchParams.set('lang', next);
      target = url.toString();
      state.settings = C.sanitizeSettings(Object.assign({}, state.settings, { lang: next }));
      try { localStorage.setItem('odysseifskvida-lestrarstofa:lang', next); } catch (e) { /* aðeins þægindi */ }
      await Promise.race([persist(['settings']), new Promise(r => setTimeout(r, 1200))]);
    } catch (e) { /* skipt um tungumál samt */ }
    location.replace(target);
  });
  $('btnCornell').addEventListener('click', () => {
    state.settings = C.sanitizeSettings(Object.assign({}, state.settings, { cornell: !state.settings.cornell }));
    applySettings();
    persist(['settings']);
    toast(t(state.settings.cornell ? 'cornell.on' : 'cornell.off'));
  });
  $('btnSettings').addEventListener('click', () => { applySettings(); $('settingsDlg').showModal(); });
  $('fsDown').addEventListener('click', () => changeSetting('fontSize', state.settings.fontSize - 1));
  $('fsUp').addEventListener('click', () => changeSetting('fontSize', state.settings.fontSize + 1));
  for (const inp of document.querySelectorAll('#settingsDlg input[type="radio"]')) inp.addEventListener('change', () => changeSetting(inp.name, inp.value));
  $('btnResetSettings').addEventListener('click', () => {
    const u = currentTopUnit();
    state.settings = Object.assign({}, C.DEFAULT_SETTINGS, { cornell: state.settings.cornell, lang: state.settings.lang });
    applySettings(); if (u) scrollToUnit(u, false);
    persist(['settings']);
    toast(t('toast.settingsReset'));
  });

  /* ---------------- skrár: deila / sækja ---------------- */
  let currentFile = null, shareFile = null;
  function canShareFile(f) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (e) { return false; }
  }
  function deliverFile(file, info) {
    currentFile = file;
    $('fileInfo').textContent = info;
    $('fileResult').textContent = '';
    // Sum tæki deila ekki .md/.json-skrám með sinni MIME-tegund; sama skrá sem text/plain er þá reynd.
    shareFile = canShareFile(file) ? file : null;
    if (!shareFile && file.type !== 'application/pdf') {
      const alt = new File([file], file.name, { type: 'text/plain' });
      if (canShareFile(alt)) shareFile = alt;
    }
    const canShare = !!shareFile;
    $('fileShare').hidden = !canShare;
    $('fileHelp').hidden = !canShare;
    if ($('exportDlg').open) $('exportDlg').close();
    $('fileDlg').showModal();
    ($('fileShare').hidden ? $('fileDownload') : $('fileShare')).focus();
  }
  $('fileShare').addEventListener('click', async () => {
    if (!shareFile) return;
    try {
      await navigator.share({ files: [shareFile], title: shareFile.name });
      $('fileResult').textContent = t('file.shareDone');
    } catch (e) {
      $('fileResult').textContent = t(e && e.name === 'AbortError' ? 'file.shareAbort' : 'file.shareFail');
    }
  });
  $('fileDownload').addEventListener('click', () => {
    if (!currentFile) return;
    const url = URL.createObjectURL(currentFile);
    const a = el('a', { href: url, download: currentFile.name });
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('fileResult').textContent = t('file.downloadStarted');
  });

  function workfileFile() {
    const wf = C.makeWorkfile(index, state);
    const json = JSON.stringify(wf, null, 2);
    return new File([json], `odysseifskvida-vinnuskra-${C.fileStamp()}.json`, { type: 'application/json' });
  }
  function saveWorkfile() {
    const f = workfileFile();
    deliverFile(f, t('file.workfileInfo', { n: state.notes.length, name: f.name }));
  }
  $('btnSaveWf').addEventListener('click', saveWorkfile);
  $('exWorkfile').addEventListener('click', saveWorkfile);

  /* ---------------- útflutningur ---------------- */
  $('btnExport').addEventListener('click', () => {
    const filtered = !!(state.filter.sectionId || state.filter.type);
    const nf = filteredNotes().length;
    $('exAllLabel').textContent = t('ex.allLabel', { n: state.notes.length });
    $('exFilterLabel').textContent = filtered ? t('ex.filterLabel', { n: nf }) : t('ex.noFilter');
    document.querySelector('input[name="exScope"][value="filter"]').disabled = !filtered;
    if (!filtered) document.querySelector('input[name="exScope"][value="all"]').checked = true;
    $('exError').hidden = true;
    for (const i of document.querySelectorAll('input[name="exLayout"]')) i.checked = i.value === (state.settings.cornell ? 'cornell' : 'venjuleg');
    $('exportDlg').showModal();
  });

  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => (test() ? ok() : no(new Error(t('ex.libFail', { src }))));
      s.onerror = () => no(new Error(t('ex.libLoadFail', { src })));
      document.head.appendChild(s);
    });
  }

  $('exBuild').addEventListener('click', async () => {
    const fmt = document.querySelector('input[name="exFormat"]:checked').value;
    const scope = document.querySelector('input[name="exScope"]:checked').value;
    const order = document.querySelector('input[name="exOrder"]:checked').value;
    const includeQuote = $('exQuote').checked;
    const notes = scope === 'filter' ? C.filterNotes(state.notes, state.filter) : state.notes.slice();
    const scopeLabel = scope === 'filter' ? filterLabel() : t('ex.scopeAll');
    const cornell = document.querySelector('input[name="exLayout"]:checked').value === 'cornell';
    const model = cornell ? C.cornellModel(index, notes, { includeQuote, order, scopeLabel }) : C.exportModel(index, notes, { includeQuote, order, scopeLabel });
    const stem = cornell ? 'odysseifskvida-cornell-' : 'odysseifskvida-glosur-';
    if (model.count !== notes.length) { showExError(t('ex.countMismatch')); return; }
    const btn = $('exBuild');
    btn.disabled = true; btn.textContent = t('ex.building');
    try {
      let file;
      if (fmt === 'md') {
        const md = cornell ? C.toCornellMarkdown(model) : C.toMarkdown(model);
        file = new File(['﻿' + md], `${stem}${C.fileStamp()}.md`, { type: 'text/markdown;charset=utf-8' });
      } else {
        await loadScript(VENDOR + 'jspdf.umd.min.js?v=' + C.APP.version, () => !!(window.jspdf && window.jspdf.jsPDF));
        await loadScript(VENDOR + 'pdf-fonts.js?v=' + C.APP.version, () => !!window.NASA_PDF_FONTS);
        const doc = (cornell ? window.OdyPdf.buildCornell : window.OdyPdf.build)(window.jspdf.jsPDF, window.NASA_PDF_FONTS, model);
        file = new File([doc.output('arraybuffer')], `${stem}${C.fileStamp()}.pdf`, { type: 'application/pdf' });
      }
      const kind = t(cornell ? (fmt === 'md' ? 'kind.cornellMd' : 'kind.cornellPdf') : (fmt === 'md' ? 'kind.md' : 'kind.pdf'));
      deliverFile(file, t('ex.fileInfo', { kind, n: model.count, scope: scopeLabel.toLowerCase(), name: file.name }));
    } catch (e) {
      showExError(t('ex.failed', { err: e && e.message || e }));
    } finally {
      btn.disabled = false; btn.textContent = t('ex.build');
    }
  });
  function showExError(m) { const e = $('exError'); e.textContent = m; e.hidden = false; }
  function filterLabel() {
    const parts = [];
    if (state.filter.sectionId) parts.push(C.sectionShort(index.sectionById.get(state.filter.sectionId)));
    if (state.filter.type) parts.push(C.typeLabel(state.filter.type));
    return t('ex.filterPrefix') + parts.join(', ');
  }

  /* ---------------- innflutningur vinnuskrár ---------------- */
  $('btnOpenWf').addEventListener('click', () => { $('fileInput').value = ''; $('fileInput').click(); });
  $('fileInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { await importError([t('imp.tooBig')]); return; }
    let text;
    try { text = await f.text(); } catch (err) { await importError([t('imp.readFail')]); return; }
    const res = C.parseWorkfile(index, text);
    if (!res.ok) { await importError(res.errors); return; }
    const cur = state.notes.length;
    const n = res.data.notes.length;
    const body = [
      t('imp.contains', { name: f.name, n, saved: res.data.savedAt ? t('imp.savedOn', { date: C.fmtDate(res.data.savedAt) }) : '' }),
      cur ? t('imp.current', { n: cur }) : t('imp.none'),
    ];
    let choice;
    for (;;) {
      const buttons = [{ id: 'cancel', label: t('imp.cancel') }];
      if (cur) buttons.push({ id: 'backup', label: t('imp.backup') });
      buttons.push({ id: 'replace', label: t(cur ? 'imp.replace' : 'imp.open'), primary: true });
      choice = await confirmDialog(t('imp.title'), body, buttons);
      if (choice === 'backup') {
        const bf = workfileFile();
        await new Promise(r => { deliverFile(bf, t('imp.backupInfo', { n: cur, name: bf.name })); $('fileDlg').addEventListener('close', r, { once: true }); });
        body[1] = t('imp.currentBackedUp', { n: cur });
        continue;
      }
      break;
    }
    if (choice !== 'replace') return;
    state.notes = res.data.notes;
    state.settings = res.data.settings;
    if (res.data.position) state.position = res.data.position;
    state.filter = { sectionId: '', type: '' };
    applySettings();
    renderFilters();
    afterNotesChanged();
    const ok = await persist(['notes', 'settings', 'position']);
    toast(t('imp.opened', { n }) + (ok ? t('toast.savedDevice') : ''));
  });
  function importError(errors) {
    const ul = el('ul');
    for (const e of errors) ul.appendChild(el('li', null, e));
    return confirmDialog(t('imp.errTitle'), [ul, t('imp.unchanged')], [{ id: 'ok', label: t('btn.ok'), primary: true }]);
  }

  /* ---------------- ræsing ---------------- */
  function markOrphans() {
    for (const n of state.notes) {
      const v = C.verifyAnchor(index, n.anchor);
      if (v.ok) delete n.orphan; else n.orphan = v.reason;
    }
  }

  function urlLang() {
    try { const l = new URL(location.href).searchParams.get('lang'); return I.LANGS.includes(l) ? l : null; } catch (e) { return null; }
  }
  function applyLanguage() {
    const l = I.getLang();
    document.documentElement.lang = l;
    I.applyHtml(document);
    $('appVersion').textContent = t('app.version', { v: C.APP.version });
    const b = $('btnLang');
    b.disabled = false;
    b.textContent = t('lang.switch');
    b.setAttribute('aria-label', t('lang.switchAria'));
    b.setAttribute('lang', t('lang.switchLang'));
    b.title = t('lang.switchAria');
    // Nemandi getur skrifað á íslensku eða úkraínsku; í úkraínskri útgáfu ræður vafrinn stafsetningarmáli.
    if (l !== 'is') for (const id of ['edBody', 'edCue']) $(id).removeAttribute('lang');
    buildTypeRow();
    renderFilters();
  }

  async function init() {
    syncViewport();
    let early = urlLang();
    if (!early) { try { early = localStorage.getItem('odysseifskvida-lestrarstofa:lang'); } catch (e) { early = null; } }
    I.setLang(early || 'is');
    try {
      const { backend, warning } = await window.OdyStore.openStore();
      state.store = backend;
      if (warning) showBanner('store-warning', '', warning, [{ label: t('btn.ok'), action: () => {} }]);
      const [notes, settings, position, draft] = await Promise.all(['notes', 'settings', 'position', 'draft'].map(k => backend.get(k)));
      if (Array.isArray(notes)) state.notes = notes;
      state.settings = C.sanitizeSettings(Object.assign({ lang: I.getLang() }, settings || {}));
      if (position && index.sectionById.has(position.sectionId)) state.position = position;
      state.draft = draft || null;
      setSaveStatus('ok', state.notes.length ? t('save.saved') : '');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      state.storeError = e && e.message || String(e);
      setSaveStatus('error', t('save.broken'));
      showBanner('save-error', 'error', t('save.brokenBanner', { err: state.storeError }), [{ label: t('btn.saveWorkfile'), action: saveWorkfile, close: false }]);
    }
    const fromUrl = urlLang();
    if (fromUrl && fromUrl !== state.settings.lang) { state.settings.lang = fromUrl; persist(['settings']); }
    I.setLang(state.settings.lang);
    try { localStorage.setItem('odysseifskvida-lestrarstofa:lang', state.settings.lang); } catch (e) { /* */ }
    applyLanguage();
    markOrphans();
    applySettings();
    const pos = state.position;
    if (pos && pos.sectionId !== 'titill') {
      renderSection(pos.sectionId, { noSave: true });
      if (pos.unitId) requestAnimationFrame(() => scrollToUnit(pos.unitId, false));
    } else renderSection('titill', { noSave: true });
    let panel = false;
    try { panel = localStorage.getItem('odysseifskvida-lestrarstofa:panel') === '1'; } catch (e) { /* */ }
    if (panel && isSide()) openPanel(); else layoutPanel();
    renderNotes();
    const d = state.draft;
    if (d && d.anchor && C.verifyAnchor(index, d.anchor).ok && ((d.body || '').trim() || (d.cue || '').trim())) {
      const l = C.locationParts(index, d.anchor);
      showBanner('draft', '', t('draft.found', { where: `${l.sectionShort} · ${l.paras}` }), [
        { label: t('btn.continue'), action: () => openEditor({ mode: d.mode, noteId: d.noteId, anchor: d.anchor, origin: d.origin, kind: d.kind || undefined, insertedText: d.insertedText, restore: { body: d.body, type: d.type, cue: d.cue } }) },
        { label: t('btn.discardDraft'), action: () => { state.draft = null; persist(['draft']); } },
      ]);
    }
    document.documentElement.dataset.ready = '1';
  }

  // til prófana (sjálfvirk viðmótspróf); ekki notað af viðmótinu sjálfu
  window.__ody = { state, index, anchorFromSelection, idle: () => state.saveChain };
  init();
})();
