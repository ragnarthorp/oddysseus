// Prentar HTML í PDF með Chromium (Playwright). Notkun: node prof/print_pdf.js inn.html út.pdf [landscape|portrait]
'use strict';
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [src, dst, orient] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(src));
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: dst, format: 'A4', landscape: orient !== 'portrait', printBackground: true, preferCSSPageSize: true });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
