#!/usr/bin/env python3
"""Býr til vendor/pdf-fonts.js: hlutmengi úr Liberation Sans 2.1.5 (SIL OFL 1.1) fyrir PDF-útflutning.

Inniheldur latneskt letur (íslenska), grísku, kýrillísku (úkraínska), almenn greinarmerki o.fl.
Keyrsla:  pip install fonttools && python3 tools/build-pdf-fonts.py [mappa-með-LiberationSans-*.ttf]
"""
import base64, io, json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype/liberation'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'vendor', 'pdf-fonts.js')
RANGES = [(0x20, 0x7E), (0xA0, 0x24F), (0x370, 0x3FF), (0x400, 0x4FF), (0x2000, 0x206F), (0x2070, 0x209F),
          (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2190, 0x21FF), (0x2200, 0x22FF), (0x25A0, 0x25FF), (0x2713, 0x2717)]
FILES = {'normal': 'Regular', 'bold': 'Bold', 'italic': 'Italic', 'bolditalic': 'BoldItalic'}

out = {}
for key, style in FILES.items():
    font = TTFont(os.path.join(SRC, f'LiberationSans-{style}.ttf'))
    opts = subset.Options()
    opts.name_IDs = ['*']; opts.name_languages = ['*']; opts.notdef_outline = True; opts.layout_features = ['kern', 'liga']; opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=[u for a, b in RANGES for u in range(a, b + 1)])
    s.subset(font)
    buf = io.BytesIO(); font.save(buf)
    out[key] = base64.b64encode(buf.getvalue()).decode('ascii')
    print(key, len(buf.getvalue()), 'bæti')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Leturgerðir fyrir PDF: hlutmengi úr Liberation Sans 2.1.5 (SIL Open Font License 1.1, sjá vendor/pdf-fonts-LICENSE.txt).\n')
    f.write('// Latneskt letur, gríska og kýrillíska. Myndað af tools/build-pdf-fonts.py.\n')
    f.write('window.NASA_PDF_FONTS=' + json.dumps(out) + ';\n')
print('Skrifað:', OUT)
