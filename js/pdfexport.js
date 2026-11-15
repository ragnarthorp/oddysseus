/* PDF-útflutningur glósa með jsPDF (vendor/jspdf.umd.min.js) og innfelldu Unicode-letri
   (vendor/pdf-fonts.js: hlutmengi úr Liberation Sans, styður íslensku, „gæsalappir“, – og …).
   Texti er raunverulegur vektor-texti með sjálfvirkri línu- og síðuskiptingu – ekki skjáskot.
   Virkar bæði í vafra og í Node (sjá tests/pdf.test.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OdyPdf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INK = [28, 32, 36], MUTED = [92, 98, 104], ACCENT = [140, 74, 38], RULE = [205, 200, 192], QUOTE_BAR = [196, 140, 100];

  /* Fjarlægir stafi sem letrið hefur ekki (t.d. broskarla) í stað þess að þeir verði að rusli. */
  const SUPPORTED = /[\u0009\u000A -~ -ɏͰ-Ͽ -⁯⁰-₟₠-⃏℀-⅏⅐-↏←-⇿∀-⋿■-◿✓-✗]/u;
  function clean(s) {
    return Array.from(String(s == null ? '' : s).normalize('NFC').replace(/\r\n?/g, '\n').replace(/­/g, '').replace(/\t/g, '    '))
      .map(c => (SUPPORTED.test(c) ? c : (c.codePointAt(0) > 0xffff ? '' : '?'))).join('');
  }

  function build(jsPDF, fonts, model) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let FAM = 'helvetica';
    if (fonts && fonts.normal) {
      for (const st of ['normal', 'bold', 'italic', 'bolditalic']) {
        doc.addFileToVFS('ody-' + st + '.ttf', fonts[st]);
        doc.addFont('ody-' + st + '.ttf', 'OdySans', st);
      }
      FAM = 'OdySans';
    } else {
      throw new Error('Leturgerð fyrir PDF vantar; íslenskir stafir myndu ekki skila sér.');
    }
    doc.setProperties({ title: model.title + ' – mínar glósur', subject: 'Glósur nemanda', creator: 'Lestrarstofa – Ódysseifskviða' });
    doc.setLanguage && doc.setLanguage('is');

    const W = 210, H = 297, M = 20, CW = W - 2 * M, TOP = 22, BOTTOM = H - 20;
    let y = TOP;
    const lh = size => size * 0.3528 * 1.45;
    const font = (style, size, color) => { doc.setFont(FAM, style); doc.setFontSize(size); doc.setTextColor(...(color || INK)); };
    const newPage = () => { doc.addPage(); y = TOP; };
    const need = h => { if (y + h > BOTTOM) { newPage(); return true; } return false; };

    /* Skrifar texta með línuskiptingu; skiptir um síðu eftir þörfum. `bar` teiknar lóðrétta línu (tilvitnun). */
    function para(text, style, size, opts) {
      const o = Object.assign({ indent: 0, color: INK, gapAfter: 2, bar: null }, opts);
      font(style, size, o.color);
      const width = CW - o.indent;
      const blocks = clean(text).split('\n');
      const L = lh(size);
      for (const b of blocks) {
        const lines = b.length ? doc.splitTextToSize(b, width) : [''];
        for (const line of lines) {
          if (need(L)) font(style, size, o.color);
          if (o.bar) { doc.setDrawColor(...o.bar); doc.setLineWidth(0.8); doc.line(M + 1, y - L * 0.72, M + 1, y + L * 0.28); }
          doc.text(line, M + o.indent, y);
          y += L;
        }
      }
      y += o.gapAfter;
    }
    function rule(color) { need(4); doc.setDrawColor(...(color || RULE)); doc.setLineWidth(0.25); doc.line(M, y, W - M, y); y += 5; }

    // forsíðuhaus
    font('bold', 20, INK);
    y += 2;
    para(model.title, 'bold', 20, { gapAfter: 1 });
    para('Mínar glósur', 'normal', 13, { color: MUTED, gapAfter: 1 });
    para(`${model.scopeLabel} · ${model.count} ${model.count === 1 ? 'glósa' : 'glósur'} · ${fmt(model.generatedAt)}`, 'normal', 9.5, { color: MUTED, gapAfter: 3 });
    if (model.items.length) para('Skýringar: ' + model.legend + '. Frumtexti er skáletraður með striki á undan; glósan fylgir á eftir.', 'normal', 8.5, { color: MUTED, gapAfter: 2 });
    rule(ACCENT);
    if (!model.items.length) para('Engar glósur.', 'italic', 11);

    let cur = null;
    for (const it of model.items) {
      if (it.section !== cur) {
        need(lh(14) + lh(10) * 4);
        if (cur !== null) y += 3;
        para(it.section, 'bold', 14, { color: ACCENT, gapAfter: 2 });
        cur = it.section;
      }
      need(lh(8.5) + lh(10.5) * 2 + lh(11) * 2);
      para(it.kind === 'samantekt' ? it.code + ' · athugasemdir við kaflann' : it.code, 'normal', 8.5, { color: MUTED, gapAfter: 1 });
      if (it.quote != null) para(it.quote, 'italic', 10.5, { indent: 5, bar: QUOTE_BAR, color: [60, 60, 60], gapAfter: 1.5 });
      if (it.cue) para(it.cue, 'bold', 11, { gapAfter: 1 });
      if (it.sameAsQuote) y += 3.5;
      else para(it.body.trim() ? it.body : '(tóm glósa)', it.body.trim() ? 'normal' : 'italic', 11, { gapAfter: 5 });
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      font('normal', 8.5, MUTED);
      doc.text(clean(`${model.title} – mínar glósur`), M, H - 10);
      doc.text(clean(`Síða ${i} af ${pages}`), W - M, H - 10, { align: 'right' });
    }
    return doc;
  }

  /* Cornell-uppsetning: lykilorð/spurning í vinstri dálki, texti í hægri dálki,
     athugasemdir við kaflann í lok hvers kafla. Dálkar flæða sjálfstætt yfir síðuskil. */
  function buildCornell(jsPDF, fonts, model) {
    if (!fonts || !fonts.normal) throw new Error('Leturgerð fyrir PDF vantar; íslenskir stafir myndu ekki skila sér.');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (const st of ['normal', 'bold', 'italic', 'bolditalic']) { doc.addFileToVFS('ody-' + st + '.ttf', fonts[st]); doc.addFont('ody-' + st + '.ttf', 'OdySans', st); }
    doc.setProperties({ title: model.title + ' – Cornell-glósur', subject: 'Cornell-glósur nemanda', creator: 'Lestrarstofa – Ódysseifskviða' });
    const W = 210, H = 297, M = 18, TOP = 20, BOTTOM = H - 20, LW = 55, GAP = 6;
    const XL = M, XR = M + LW + GAP, RW = W - M - XR;
    let y = TOP;
    const lh = s => s * 0.3528 * 1.42;
    const font = (style, size, color) => { doc.setFont('OdySans', style); doc.setFontSize(size); doc.setTextColor(...(color || INK)); };
    const newPage = () => { doc.addPage(); y = TOP; };
    const lines = (text, style, size, width, color, gapAfter) => {
      font(style, size, color);
      const out = [];
      for (const b of clean(text).split('\n')) for (const l of (b.length ? doc.splitTextToSize(b, width) : [''])) out.push({ t: l, style, size, color });
      if (out.length) out[out.length - 1].gap = gapAfter || 0;
      return out;
    };
    const vline = (a, b) => { doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.line(XR - GAP / 2, a, XR - GAP / 2, b); };
    const hline = (c, w) => { doc.setDrawColor(...(c || RULE)); doc.setLineWidth(w || 0.25); doc.line(M, y, W - M, y); };
    function block(text, style, size, color, gapAfter, opts) {
      for (const ln of lines(text, style, size, W - 2 * M - (opts && opts.indent || 0), color, gapAfter)) {
        if (y + lh(size) > BOTTOM) newPage();
        font(ln.style, ln.size, ln.color);
        if (opts && opts.bar) { doc.setDrawColor(...QUOTE_BAR); doc.setLineWidth(0.8); doc.line(M + 1, y - lh(size) * 0.72, M + 1, y + lh(size) * 0.28); }
        doc.text(ln.t, M + (opts && opts.indent || 0), y); y += lh(size) + (ln.gap || 0);
      }
    }
    function row(L, R) {
      if (y + lh(11) * 2 > BOTTOM) newPage();
      hline(); y += 5;
      let yl = y, yr = y, i = 0, j = 0, seg = y - 5;
      for (;;) {
        while (i < L.length && yl + lh(L[i].size) <= BOTTOM) { font(L[i].style, L[i].size, L[i].color); doc.text(L[i].t, XL, yl); yl += lh(L[i].size) + (L[i].gap || 0); i++; }
        while (j < R.length && yr + lh(R[j].size) <= BOTTOM) { font(R[j].style, R[j].size, R[j].color); doc.text(R[j].t, XR, yr); yr += lh(R[j].size) + (R[j].gap || 0); j++; }
        if (i >= L.length && j >= R.length) break;
        vline(seg, BOTTOM); newPage(); yl = yr = y; seg = y - 4;
      }
      y = Math.max(yl, yr);
      vline(seg, y - 2);
      y += 1;
    }

    font('bold', 18); block(model.title, 'bold', 18, INK, 1);
    block('Cornell-glósur', 'normal', 12, MUTED, 1);
    block(`${model.scopeLabel} · ${model.count} ${model.count === 1 ? 'glósa' : 'glósur'} · ${fmt(model.generatedAt)}`, 'normal', 9, MUTED, 2);
    block('bls. = blaðsíða · pdf-s. = PDF-síða · ¶ = efnisgrein. Hægra megin er valinn texti, með eða án umorðunar; frumtexti fylgir skáletraður ef textinn var umorðaður.', 'normal', 8.5, MUTED, 3);
    hline(ACCENT, 0.4); y += 6;
    if (!model.sections.length) block('Engar glósur.', 'italic', 11, INK, 0);
    for (const g of model.sections) {
      if (y + 30 > BOTTOM) newPage();
      block(g.label, 'bold', 14, ACCENT, 2);
      if (g.rows.length) {
        font('bold', 8.5, MUTED);
        doc.text('LYKILORÐ / SPURNING', XL, y); doc.text('GLÓSA', XR, y); y += 2;
        for (const r of g.rows) {
          const L = (r.cueIsType ? lines(r.typeLabel, 'italic', 10, LW, MUTED, 1) : lines(r.cue || '–', 'bold', 10.5, LW, INK, 1))
            .concat(lines(r.loc, 'normal', 8.5, LW, MUTED, 0));
          let R = lines(r.text.trim() ? r.text : '(tóm glósa)', r.text.trim() ? 'normal' : 'italic', 11, RW, INK, r.quote ? 1.5 : 0);
          if (r.quote) R = R.concat(lines(r.quote, 'italic', 9.5, RW, MUTED, 0));
          row(L, R);
        }
        hline(); y += 6;
      }
      if (y + 20 > BOTTOM) newPage();
      hline(ACCENT, 0.5); y += 5;
      block('Athugasemdir við kaflann', 'bold', 10.5, ACCENT, 1.5);
      const sums = g.summaries.filter(s => s.trim());
      if (sums.length) sums.forEach(s => block(s, 'normal', 11, INK, 2));
      else block('(engar athugasemdir)', 'italic', 10, MUTED, 0);
      y += 8;
    }
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); font('normal', 8.5, MUTED);
      doc.text(clean(`${model.title} – Cornell-glósur`), M, H - 10);
      doc.text(clean(`Síða ${p} af ${pages}`), W - M, H - 10, { align: 'right' });
    }
    return doc;
  }

  function fmt(d) {
    const x = d instanceof Date ? d : new Date(d);
    const p = n => String(n).padStart(2, '0');
    return `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()} kl. ${p(x.getHours())}:${p(x.getMinutes())}`;
  }

  return { build, buildCornell, clean };
});
