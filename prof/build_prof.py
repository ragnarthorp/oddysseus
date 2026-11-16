#!/usr/bin/env python3
"""Myndrænt krossapróf úr Ódysseifskviðu (40 spurningar), í anda Trójuprófsins.

    python3 prof/build_prof.py

Býr til (í prof/):
    odysseifskvida-prof.html / .pdf       prófið: ein lárétt A4-glæra á spurningu
    odysseifskvida-svarlykill.pdf         svarlykill með tilvísun í kafla endursagnarinnar

Allar spurningar byggja á endursögninni (data/odysseifskvida.json). PDF er búið til með Chromium
(Playwright). Kort: Natural Earth (public domain), prof/gogn/strendur.json.
"""
import html
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INK = '#1b1b1b'
PINK, RED, ORANGE, TEAL = '#EE4F9E', '#DC3B27', '#F4AE3D', '#6FE0D2'
COLORS = [PINK, RED, ORANGE, TEAL]
BEIGE, MAP, CARD, MUTED = '#EEE6D6', '#D4CBA8', '#FDFBF6', '#8a8070'
W, H = 1000, 425  # hnitakerfi myndflatar

esc = html.escape


# ---------------------------------------------------------------- grunnform
def dot(x, y, c, r=15):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="#fff" stroke-width="3.5"/>'


def ring(x, y, c, r=26):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#fff" stroke-width="9"/><circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{c}" stroke-width="5"/>'


def text(x, y, s, size=22, weight=700, fill=INK, anchor='middle', family='Inter', style='', extra=''):
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
            f'text-anchor="{anchor}" dominant-baseline="middle" {extra} style="{style}">{esc(s)}</text>')


def lines_text(x, y, lines, size=22, weight=700, lh=1.2, **kw):
    out = ''
    y0 = y - (len(lines) - 1) * size * lh / 2
    for i, ln in enumerate(lines):
        out += text(x, y0 + i * size * lh, ln, size, weight, **kw)
    return out


def card(x, y, w, h, label, color=None, size=24, num=None):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>'
    if color:
        s += f'<circle cx="{x + 26}" cy="{y + 26}" r="14" fill="{color}" stroke="{INK}" stroke-width="2"/>'
    if num is not None:
        s += f'<circle cx="{x + 24}" cy="{y + 24}" r="15" fill="{INK}"/>' + text(x + 24, y + 25, str(num), 18, 800, '#fff')
    lines = label if isinstance(label, list) else [label]
    s += lines_text(x + w / 2, y + h / 2 + (6 if (color or num is not None) else 0), lines, size)
    return s


def four_cards(labels, size=24):
    pos = [(150, 40), (520, 40), (150, 225), (520, 225)]
    return ''.join(card(x, y, 330, 150, labels[i], COLORS[i], size) for i, (x, y) in enumerate(pos))


def arrow(x1, y1, x2, y2, c=INK, w=3, bend=0, dash=None, head=14, outline=False):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    cx, cy = mx - dy / L * bend, my + dx / L * bend
    # stefna í lokin
    tx, ty = x2 - cx, y2 - cy
    tl = math.hypot(tx, ty) or 1
    ux, uy = tx / tl, ty / tl
    bx, by = x2 - ux * head, y2 - uy * head
    d = f'M{x1},{y1} Q{cx},{cy} {bx},{by}'
    da = f' stroke-dasharray="{dash}"' if dash else ''
    hp = f'{x2},{y2} {bx - uy * head * .6},{by + ux * head * .6} {bx + uy * head * .6},{by - ux * head * .6}'
    s = ''
    if outline:
        s += f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{w + 4}" stroke-linecap="round"/>'
        s += f'<polygon points="{hp}" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>'
    s += f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round"{da}/>'
    s += f'<polygon points="{hp}" fill="{c}"/>'
    return s


def person(x, base, h=150, c=INK, arms='down', crown=False, hat=False, flip=False, wide=1.0):
    """Einföld skuggamynd: höfuð og trapisulaga kyrtill (eins og í Trójuprófinu)."""
    r = h * 0.11
    hy = base - h + r
    neck = hy + r * 1.1
    tw, bw = h * 0.10 * wide, h * 0.22 * wide
    s = f'<circle cx="{x}" cy="{hy}" r="{r}" fill="{c}"/>'
    s += f'<polygon points="{x - tw},{neck} {x + tw},{neck} {x + bw},{base} {x - bw},{base}" fill="{c}"/>'
    aw = max(3, h * 0.035)
    if arms == 'up':
        s += f'<path d="M{x - tw},{neck + 6} L{x - h * .26},{neck - h * .2} M{x + tw},{neck + 6} L{x + h * .26},{neck - h * .2}" stroke="{c}" stroke-width="{aw}" stroke-linecap="round"/>'
    elif arms == 'out':
        s += f'<path d="M{x - tw},{neck + 8} L{x - h * .3},{neck + h * .12} M{x + tw},{neck + 8} L{x + h * .3},{neck + h * .12}" stroke="{c}" stroke-width="{aw}" stroke-linecap="round"/>'
    elif arms == 'point':
        sgn = -1 if flip else 1
        s += f'<path d="M{x + sgn * tw},{neck + 8} L{x + sgn * h * .34},{neck + h * .06}" stroke="{c}" stroke-width="{aw}" stroke-linecap="round"/>'
    if crown:
        cy = hy - r * 0.6
        s += f'<polygon points="{x - r},{cy + r * .4} {x - r},{cy - r * .5} {x - r * .5},{cy} {x},{cy - r * .7} {x + r * .5},{cy} {x + r},{cy - r * .5} {x + r},{cy + r * .4}" fill="{c}"/>'
    if hat:  # vængjaður hattur Hermesar
        s += f'<ellipse cx="{x}" cy="{hy - r * .6}" rx="{r * 1.5}" ry="{r * .45}" fill="{c}"/>'
        s += f'<path d="M{x + r * 1.1},{hy - r * .8} q{r * .9},{-r * 1.2} {r * 1.6},{-r * .5} q{-r * .5},{r * .1} {-r * .4},{r * .5} q{-r * .6},{0} {-r * 1.2},{0}z" fill="{c}"/>'
    return s


def ship(x, y, s=1.0, c=INK, sail=True, mast=True, fill_sail=CARD):
    out = f'<path d="M{x - 110 * s},{y} L{x + 110 * s},{y} Q{x + 95 * s},{y + 38 * s} {x + 60 * s},{y + 40 * s} L{x - 70 * s},{y + 40 * s} Q{x - 100 * s},{y + 38 * s} {x - 110 * s},{y}z" fill="{c}"/>'
    out += f'<path d="M{x + 110 * s},{y} q{18 * s},{-8 * s} {22 * s},{-30 * s}" stroke="{c}" stroke-width="{6 * s}" fill="none" stroke-linecap="round"/>'
    if mast:
        out += f'<rect x="{x - 4 * s}" y="{y - 150 * s}" width="{8 * s}" height="{150 * s}" fill="{c}"/>'
    if sail:
        out += f'<path d="M{x - 70 * s},{y - 135 * s} L{x + 70 * s},{y - 135 * s} Q{x + 78 * s},{y - 80 * s} {x + 66 * s},{y - 40 * s} L{x - 66 * s},{y - 40 * s} Q{x - 78 * s},{y - 80 * s} {x - 70 * s},{y - 135 * s}z" fill="{fill_sail}" stroke="{c}" stroke-width="{3 * s}"/>'
    return out


def waves(y, x1=30, x2=970, c='#9a8f78', n=3, gap=16, amp=6, period=40):
    out = ''
    for k in range(n):
        yy = y + k * gap
        d = f'M{x1},{yy}'
        x = x1
        while x < x2:
            d += f' q{period / 4},{-amp} {period / 2},0 t{period / 2},0'
            x += period
        out += f'<path d="{d}" fill="none" stroke="{c}" stroke-width="2.2"/>'
    return out


def ground(y, x1=60, x2=940):
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{INK}" stroke-width="3"/>'


def bubble(x, y, w, h, label, size=34, tail='left'):
    tx = x + (w * .25 if tail == 'left' else w * .75)
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>'
            f'<polygon points="{tx - 12},{y + h - 2} {tx + 12},{y + h - 2} {tx - 22 if tail == "left" else tx + 22},{y + h + 26}" fill="{CARD}" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<rect x="{tx - 11}" y="{y + h - 5}" width="22" height="6" fill="{CARD}"/>'
            + text(x + w / 2, y + h / 2 + 2, label, size, 800))


def qmark(x, y, size=110, c=INK):
    return text(x, y, '?', size, 900, c)


def tree(x, base, h=110, c=INK, fruit=None):
    s = f'<rect x="{x - h * .05}" y="{base - h * .45}" width="{h * .1}" height="{h * .45}" fill="{c}"/>'
    s += f'<circle cx="{x}" cy="{base - h * .7}" r="{h * .3}" fill="{c}"/>'
    if fruit:
        for dx, dy in [(-.12, -.72), (.1, -.82), (.05, -.6), (-.05, -.88)]:
            s += f'<circle cx="{x + dx * h}" cy="{base + dy * h}" r="{h * .035}" fill="{fruit}"/>'
    return s


# ---------------------------------------------------------------- kort
STRENDUR = json.load(open(os.path.join(HERE, 'gogn', 'strendur.json')))['polygons']


def map_svg(lon0, lat0, latspan, inner):
    lat1 = lat0 + latspan / 2
    lonspan = latspan * (W / H) / math.cos(math.radians(lat0))
    lonmin = lon0 - lonspan / 2

    def P(lon, lat):
        return (round((lon - lonmin) / lonspan * W, 1), round((lat1 - lat) / latspan * H, 1))

    d = []
    for poly in STRENDUR:
        for ring_ in poly:
            xs = [p[0] for p in ring_]
            ys = [p[1] for p in ring_]
            if max(xs) < lonmin - 1 or min(xs) > lonmin + lonspan + 1 or max(ys) < lat1 - latspan - 1 or min(ys) > lat1 + 1:
                continue
            pts = [P(*p) for p in ring_]
            d.append('M' + ' L'.join(f'{x},{y}' for x, y in pts) + 'Z')
    land = f'<path d="{" ".join(d)}" fill="none" stroke="#5f5844" stroke-width="0.9" stroke-linejoin="round"/>'
    return land + inner(P)


# ---------------------------------------------------------------- spurningar
Q = []


def add(visual, question, options, answer, ref, panel='beige'):
    Q.append(dict(visual=visual, question=question, options=options, answer=answer, ref=ref, panel=panel))


COLOR_OPTS = 'colors'

# 1 – grískt nafn
def greek_word(parts, size=190, y=None):
    """Grískt orð í einni línu; hver hluti í sínum lit með svartri útlínu (eins og í fyrirmyndinni)."""
    spans = ''.join(f'<tspan fill="{c}">{esc(p)}</tspan>' for p, c in parts)
    return (f'<text x="{W / 2}" y="{y or H / 2 + 10}" font-family="FreeSerif" font-size="{size}" stroke="{INK}" stroke-width="3" '
            f'paint-order="stroke" text-anchor="middle" dominant-baseline="middle">{spans}</text>')


add(greek_word([('Ὀ', PINK), ('δυ', RED), ('σσ', ORANGE), ('εύς', TEAL)]),
    'Gríska endingin -εύς verður „-eifur“ á íslensku, eins og þegar Ζεύς varð Seifur. Hvaða litur sýnir þann hluta nafnsins?',
    COLOR_OPTS, 'D', 'Heiti verksins')

add(greek_word([('Ἰ', PINK), ('θ', RED), ('ά', ORANGE), ('κη', TEAL)], y=175) + arrow(W / 2, 280, W / 2, 325, INK, 4) + text(W / 2, 365, 'Íþaka', 56, 400, INK, family='FreeSerif'),
    'Hvaða litur sýnir gríska stafinn sem varð að Þ í íslenska heitinu Íþaka?',
    COLOR_OPTS, 'B', 'I. þáttur')

add(four_cards([['Þýddi kviðuna', 'í bundnu máli'], ['Þýddi Ódysseifskviðu', 'á íslensku'], ['Vann að þýðingunni', 'á Bessastöðum'], 'Var uppi 1791–1852'], 23),
    'Þrennt af þessu á við Sveinbjörn Egilsson. Hvaða litur á EKKI við hann?',
    COLOR_OPTS, 'A', 'Formáli; Texti og myndir')

GREECE = (23.6, 38.3, 7.6)
add(map_svg(*GREECE, lambda P: dot(*P(20.68, 38.37), ORANGE) + dot(*P(21.70, 36.93), PINK) + dot(*P(22.43, 37.08), TEAL) + dot(*P(26.24, 39.96), RED)),
    'Hvaða litur er á Íþöku, heimili Ódysseifs?', COLOR_OPTS, 'C', 'I. þáttur', panel='map')


def tele_arrows(P):
    ith, pyl, spa = P(20.68, 38.37), P(21.70, 36.93), P(22.43, 37.08)
    cape = P(22.48, 36.30)
    s = arrow(*ith, *pyl, PINK, 6, bend=110, outline=True)                       # sjóleið Íþaka → Pýlos (vestan við ströndina)
    s += arrow(*pyl, *spa, RED, 6, bend=-40, outline=True)                       # landleið Pýlos → Sparta
    s += f'<path d="M{pyl[0]},{pyl[1]} Q{pyl[0] + 10},{cape[1] + 25} {cape[0]},{cape[1] + 20}" stroke="#fff" stroke-width="10" fill="none"/>'
    s += f'<path d="M{pyl[0]},{pyl[1]} Q{pyl[0] + 10},{cape[1] + 25} {cape[0]},{cape[1] + 20}" stroke="{ORANGE}" stroke-width="6" fill="none"/>'
    s += arrow(cape[0], cape[1] + 20, spa[0] + 25, spa[1] + 70, ORANGE, 6, bend=-40, outline=True)   # sjóleið suður fyrir höfða
    s += arrow(*ith, *spa, TEAL, 6, bend=-40, outline=True)                      # Íþaka → Sparta
    for p in (ith, pyl, spa):
        s += f'<circle cx="{p[0]}" cy="{p[1]}" r="9" fill="{INK}" stroke="#fff" stroke-width="3"/>'
    return s


PELOPS = (21.95, 37.22, 2.45)
add(map_svg(*PELOPS, tele_arrows),
    'Telemakkos siglir frá Íþöku til Pýlos og fer þaðan landleiðina til Spörtu. Hvaða ör sýnir landleiðina?',
    COLOR_OPTS, 'B', 'II.–III. þáttur', panel='map')


def timeline():
    s = text(W / 2, 50, 'Tuttugu ár að heiman', 30, 800)
    x0, y0, cw, ch = 70, 175, 43, 60
    for i in range(20):
        fill = '#D9CDB5' if i < 10 else CARD
        s += f'<rect x="{x0 + i * cw}" y="{y0}" width="{cw}" height="{ch}" fill="{fill}" stroke="{INK}" stroke-width="2"/>'
        s += text(x0 + i * cw + cw / 2, y0 + ch / 2, str(i + 1), 16, 600)
    s += text(x0 + 5 * cw, y0 + ch + 40, 'Stríðið um Tróju', 20, 600, MUTED)
    s += text(x0 + 15 * cw, y0 + ch + 40, 'Heimferðin', 20, 600, MUTED)
    for yr, c in [(1, PINK), (10, RED), (13, ORANGE), (20, TEAL)]:
        cx = x0 + (yr - .5) * cw
        s += f'<polygon points="{cx - 14},{y0 - 34} {cx + 14},{y0 - 34} {cx},{y0 - 6}" fill="{c}" stroke="{INK}" stroke-width="2"/>'
    s += text(x0, y0 + ch + 80, 'Ódysseifur fer að heiman', 18, 600, MUTED, anchor='start')
    s += text(x0 + 20 * cw, y0 + ch + 80, 'Ódysseifur kemur heim', 18, 600, MUTED, anchor='end')
    return s


add(timeline(),
    'Ódysseifur var tíu ár í stríðinu og tíu ár á heimleið. Hvaða litur sýnir hvar Ódysseifskviða hefst?',
    COLOR_OPTS, 'D', 'Formáli')


def wooden_horse(x, base, s=1.0):
    o = f'<rect x="{x - 150 * s}" y="{base - 30 * s}" width="{300 * s}" height="{22 * s}" fill="{INK}"/>'
    for wx in (-115, -40, 40, 115):
        o += f'<circle cx="{x + wx * s}" cy="{base - 6 * s}" r="{17 * s}" fill="{CARD}" stroke="{INK}" stroke-width="{5 * s}"/>'
    for lx in (-95, -60, 55, 90):
        o += f'<rect x="{x + lx * s}" y="{base - 120 * s}" width="{20 * s}" height="{92 * s}" fill="{INK}"/>'
    o += f'<rect x="{x - 110 * s}" y="{base - 200 * s}" width="{230 * s}" height="{95 * s}" rx="{40 * s}" fill="{INK}"/>'
    o += f'<polygon points="{x + 60 * s},{base - 190 * s} {x + 110 * s},{base - 300 * s} {x + 150 * s},{base - 290 * s} {x + 120 * s},{base - 175 * s}" fill="{INK}"/>'
    o += f'<rect x="{x + 100 * s}" y="{base - 320 * s}" width="{95 * s}" height="{48 * s}" rx="{18 * s}" fill="{INK}" transform="rotate(18 {x + 147 * s} {base - 296 * s})"/>'
    o += f'<polygon points="{x + 108 * s},{base - 318 * s} {x + 118 * s},{base - 350 * s} {x + 132 * s},{base - 316 * s}" fill="{INK}"/>'
    o += f'<path d="M{x - 108 * s},{base - 175 * s} q{-50 * s},{20 * s} {-40 * s},{95 * s}" stroke="{INK}" stroke-width="{12 * s}" fill="none" stroke-linecap="round"/>'
    o += f'<rect x="{x - 40 * s}" y="{base - 175 * s}" width="{40 * s}" height="{34 * s}" fill="{CARD}"/>'
    return o


add(wooden_horse(W / 2, 390, 1.0) + qmark(800, 170),
    'Hver átti hugmyndina að tréhestinum sem felldi Tróju?',
    ['Menelás', 'Príamos', 'Kassandra', 'Ódysseifur'], 'D', 'Formáli')

add(person(220, 390, 230, arms='out') + bubble(250, 40, 170, 90, '!!!', 50)
    + ''.join(person(560 + i * 85, 390, 190 - (i % 2) * 12) for i in range(5)),
    'Kassandra varaði Trójumenn við hestinum. Hvers vegna hlustaði enginn á hana?',
    ['Á henni hvíldi bölvun: enginn trúði orðum hennar', 'Hún talaði aðeins grísku', 'Príamos bannaði fólki að hlusta', 'Hún sagði ekkert fyrr en of seint'], 'A', 'Formáli')


def sequence(labels, qpos):
    s = ''
    n = len(labels)
    bw, gap = 190, 50
    x0 = (W - (n * bw + (n - 1) * gap)) / 2
    for i, lab in enumerate(labels):
        x = x0 + i * (bw + gap)
        if i == qpos:
            s += f'<rect x="{x}" y="135" width="{bw}" height="160" rx="14" fill="none" stroke="{INK}" stroke-width="3" stroke-dasharray="10 8"/>' + qmark(x + bw / 2, 218, 100)
        else:
            s += card(x, 135, bw, 160, lab, size=20)
        if i < n - 1:
            s += arrow(x + bw + 6, 215, x + bw + gap - 6, 215, INK, 3, head=12)
    return s


add(sequence([['Guðirnir', 'á þingi'], ['Aþena kemur', 'í gervi', 'Mentesar'], None, ['Telemakkos', 'siglir af stað', 'að nóttu']], 2),
    'Hvað vantar í atburðarásina?',
    ['Biðlarnir fara heim', 'Penelópa velur sér biðil', 'Telemakkos kallar saman þing', 'Ódysseifur kemur heim'], 'C', 'I.–II. þáttur')


def loom(x, y, w=200, h=200, woven=1.0):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{INK}" stroke-width="8"/>'
    for i in range(1, 12):
        s += f'<line x1="{x + i * w / 12}" y1="{y}" x2="{x + i * w / 12}" y2="{y + h}" stroke="{INK}" stroke-width="1.5"/>'
    s += f'<rect x="{x + 4}" y="{y + 4}" width="{w - 8}" height="{(h - 8) * woven}" fill="#C9B994"/>'
    for i in range(int(10 * woven)):
        s += f'<line x1="{x + 4}" y1="{y + 14 + i * 18}" x2="{x + w - 4}" y2="{y + 14 + i * 18}" stroke="#a8956c" stroke-width="2"/>'
    return s


def sun(x, y, r=34, c=ORANGE):
    s = f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{INK}" stroke-width="2.5"/>'
    for k in range(10):
        a = k * math.pi / 5
        s += f'<line x1="{x + math.cos(a) * (r + 8)}" y1="{y + math.sin(a) * (r + 8)}" x2="{x + math.cos(a) * (r + 22)}" y2="{y + math.sin(a) * (r + 22)}" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
    return s


def moon(x, y, r=34):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>'
            f'<circle cx="{x + r * .45}" cy="{y - r * .25}" r="{r * .9}" fill="{BEIGE}"/>')


add(sun(230, 75) + loom(130, 150, 200, 210, 0.85) + person(395, 375, 180) + text(500, 255, '→', 80, 400)
    + moon(700, 75) + loom(600, 150, 200, 210, 0.15) + person(865, 375, 180) + qmark(705, 300, 70),
    'Hvað gerði Penelópa á næturnar til að draga biðlana á svari?',
    ['Hún skrifaði bréf til Ódysseifs', 'Hún bað til Aþenu', 'Hún rakti upp vefinn sem hún hafði ofið um daginn', 'Hún faldi sig í herbergjum sínum'], 'C', 'II. þáttur')


def crowd():
    s = ''
    for row in range(3):
        for i in range(17):
            s += person(95 + i * 50 + (row % 2) * 25, 150 + row * 105, 85)
    s += f'<rect x="740" y="330" width="230" height="80" rx="14" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>' + text(855, 371, '= ?', 44, 900)
    return s


add(crowd(),
    'Telemakkos telur biðlana upp fyrir föður sínum. Hve margir eru þeir, fyrir utan þjóna?',
    ['12', '24', '50', '1000'], 'E', 'XVI. þáttur')


def eagle(x, y, s=1.0, flip=False, c=INK):
    sg = -1 if flip else 1
    p = (f'M{x},{y} q{sg * 60 * s},{-70 * s} {sg * 150 * s},{-60 * s} q{-sg * 50 * s},{20 * s} {-sg * 70 * s},{45 * s} '
         f'q{sg * 40 * s},{5 * s} {sg * 60 * s},{30 * s} q{-sg * 60 * s},{0} {-sg * 80 * s},{10 * s} '
         f'l{-sg * 30 * s},{40 * s} l{-sg * 10 * s},{-40 * s} q{-sg * 50 * s},{-5 * s} {-sg * 80 * s},{-10 * s} '
         f'q{-sg * 20 * s},{-30 * s} {sg * 20 * s},{-45 * s}z')
    return f'<path d="{p}" fill="{c}"/><circle cx="{x - sg * 25 * s}" cy="{y + 2 * s}" r="{13 * s}" fill="{c}"/><polygon points="{x - sg * 36 * s},{y - 2 * s} {x - sg * 52 * s},{y + 6 * s} {x - sg * 36 * s},{y + 10 * s}" fill="{ORANGE}"/>'


add(eagle(330, 150, 1.1) + eagle(690, 150, 1.1, flip=True) + text(510, 110, '⚡', 60, 400, RED)
    + ''.join(person(160 + i * 75, 400, 120) for i in range(4)) + ''.join(person(620 + i * 75, 400, 120) for i in range(4)),
    'Tveir ernir fljúga yfir þingið og rífa hvor annan. Hvað boðar það að sögn gamla spámannsins?',
    ['Að stríð sé að hefjast við Pýlos', 'Að Telemakkos verði konungur', 'Að stormur skelli á', 'Að Ódysseifur sé á heimleið og biðlunum bani búinn'], 'D', 'II. þáttur')

add(four_cards(['Mentes, vinur föðurins', 'Mentor', 'Ungur fjárhirðir', 'Gamall betlari'], 24),
    'Aþena birtist í mörgum gervum í sögunni. Hvaða litur sýnir gervi sem hún notar EKKI?',
    COLOR_OPTS, 'D', 'I., II., XIII. og XXII. þáttur')


def family():
    s = ''
    boxes = {'Laertes': (210, 40), 'Antíkleia': (560, 40), 'Ódysseifur': (210, 175), 'Penelópa': (560, 175), 'Telemakkos': (385, 305)}
    bw, bh = 230, 80
    for a, b in (('Laertes', 'Antíkleia'), ('Ódysseifur', 'Penelópa')):
        (x1, y1), (x2, _) = boxes[a], boxes[b]
        s += f'<line x1="{x1 + bw}" y1="{y1 + bh / 2}" x2="{x2}" y2="{y1 + bh / 2}" stroke="{INK}" stroke-width="4"/>'
    s += f'<path d="M{(210 + bw + 560) / 2},{80} V{150} H{325} V{175}" stroke="{INK}" stroke-width="4" fill="none"/>'
    s += f'<path d="M{(210 + bw + 560) / 2},{215} V{305}" stroke="{INK}" stroke-width="4" fill="none"/>'
    cols = {'Laertes': PINK, 'Antíkleia': RED, 'Penelópa': ORANGE, 'Telemakkos': TEAL}
    for name, (x, y) in boxes.items():
        s += card(x, y, bw, bh, name, cols.get(name), 24)
    return s


add(family(),
    'Hver í fjölskyldu Ódysseifs dó úr söknuði eftir honum meðan hann var í burtu?',
    COLOR_OPTS, 'B', 'XI. þáttur')


def kylix(x, y, s=1.0):
    return (f'<path d="M{x - 150 * s},{y} Q{x},{y + 120 * s} {x + 150 * s},{y}z" fill="{INK}"/>'
            f'<rect x="{x - 10 * s}" y="{y + 55 * s}" width="{20 * s}" height="{70 * s}" fill="{INK}"/>'
            f'<ellipse cx="{x}" cy="{y + 130 * s}" rx="{70 * s}" ry="{14 * s}" fill="{INK}"/>'
            f'<path d="M{x - 150 * s},{y + 4} q{-40 * s},{-5 * s} {-35 * s},{35 * s}" stroke="{INK}" stroke-width="{9 * s}" fill="none"/>'
            f'<path d="M{x + 150 * s},{y + 4} q{40 * s},{-5 * s} {35 * s},{35 * s}" stroke="{INK}" stroke-width="{9 * s}" fill="none"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{150 * s}" ry="{16 * s}" fill="{RED}" stroke="{INK}" stroke-width="3"/>')


add(kylix(380, 200, 1.1) + person(700, 395, 250, arms='point', flip=True, crown=True) + text(650, 70, 'Helena', 26, 700, MUTED),
    'Hvað gerir lyfið sem Helena blandar í vínið?',
    ['Það lætur menn sofna', 'Það breytir mönnum í svín', 'Það tekur burt alla sorg um stund', 'Það gerir menn ósýnilega'], 'C', 'IV. þáttur')

MED = (21.5, 35.6, 14.0)
add(map_svg(*MED, lambda P: dot(*P(30.9, 30.5), PINK) + dot(*P(24.9, 35.25), RED) + dot(*P(14.3, 37.5), ORANGE) + dot(*P(26.24, 39.96), TEAL)),
    'Menelás náði sjávaröldungnum Próteifi á sitt vald og fékk hjá honum fréttir af Ódysseifi. Hvaða litur er á landinu þar sem það gerðist (Egyptalandi)?',
    COLOR_OPTS, 'A', 'IV. þáttur', panel='map')

add(four_cards(['Ljón', 'Slanga', 'Örn', 'Vatn'], 30),
    'Próteifur breytti sér í ýmislegt áður en hann gafst upp. Hvaða litur á EKKI við?',
    COLOR_OPTS, 'C', 'IV. þáttur')


def island(x, base, w=360):
    s = f'<path d="M{x - w / 2},{base} Q{x},{base - 110} {x + w / 2},{base}z" fill="#C9B994" stroke="{INK}" stroke-width="2.5"/>'
    s += f'<path d="M{x + 40},{base - 52} q10,-90 -10,-150" stroke="{INK}" stroke-width="10" fill="none"/>'
    for a in (-60, -20, 25, 70, 130):
        r = math.radians(a)
        s += f'<path d="M{x + 30},{base - 202} q{math.cos(r) * 45},{-30} {math.cos(r) * 90},{math.sin(r) * 30 + 15}" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>'
    return s


def calendar(x, y, label):
    return (f'<rect x="{x}" y="{y}" width="190" height="200" rx="12" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
            f'<rect x="{x}" y="{y}" width="190" height="52" rx="12" fill="{RED}" stroke="{INK}" stroke-width="3"/>'
            f'<rect x="{x + 2}" y="{y + 36}" width="186" height="16" fill="{RED}"/>'
            + text(x + 95, y + 130, label, 56, 900))


add(waves(330, n=3) + island(330, 330) + person(250, 325, 120) + calendar(640, 90, '? ár'),
    'Hve lengi hafði Ódysseifur setið fastur hjá gyðjunni Kalypsó þegar sagan hefst?',
    ['1 ár', '3 ár', '5 ár', '7 ár'], 'D', 'I. og V. þáttur')


def stars(n=26, seed=3, y1=20, y2=200):
    import random
    rnd = random.Random(seed)
    return ''.join(f'<circle cx="{rnd.randint(30, 970)}" cy="{rnd.randint(y1, y2)}" r="{rnd.choice([2, 2.5, 3.5])}" fill="#fff"/>' for _ in range(n))


def raft(x, y):
    s = ''.join(f'<rect x="{x - 120 + i * 30}" y="{y}" width="26" height="22" rx="5" fill="#7a6a4c" stroke="{INK}" stroke-width="2"/>' for i in range(8))
    s += f'<rect x="{x - 4}" y="{y - 140}" width="8" height="140" fill="{INK}"/>'
    s += f'<path d="M{x + 6},{y - 130} L{x + 90},{y - 50} L{x + 6},{y - 40}z" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>'
    s += person(x - 60, y + 2, 100)
    return s


add(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#1d2b4a"/>' + stars() + waves(330, c='#7c8bb0', n=3) + raft(480, 305)
    + f'<rect x="740" y="60" width="200" height="110" rx="14" fill="{CARD}"/>' + text(840, 116, '? dagar', 40, 900),
    'Í hve marga daga sigldi Ódysseifur á flekanum eftir stjörnunum áður en hann sá land?',
    ['4', '7', '9', '18'], 'E', 'V. þáttur', panel='night')


def river_scene():
    s = f'<path d="M0,300 C250,260 450,350 1000,290 L1000,425 L0,425z" fill="#a9c4c0" stroke="{INK}" stroke-width="2.5"/>'
    s += f'<circle cx="520" cy="330" r="22" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
    s += f'<path d="M505,322 q15,-12 30,0 M505,338 q15,12 30,0" stroke="{INK}" stroke-width="2" fill="none"/>'
    for i, x in enumerate((180, 260, 340)):
        s += person(x, 285, 150, arms='up')
    s += f'<path d="M760,290 q-40,-70 10,-120 q60,-40 110,10 q40,60 -10,110z" fill="#5f6f3e" stroke="{INK}" stroke-width="3"/>'
    s += text(820, 230, 'zZ', 40, 900, CARD)
    s += arrow(400, 150, 500, 300, INK, 3, bend=-40, dash='8 8')
    return s


add(river_scene(),
    'Hvað vakti Ódysseif þegar hann svaf í runnanum við árósinn á Skeríu?',
    ['Boltinn lenti í ánni og stúlkurnar hrópuðu upp', 'Hundar geltu að honum', 'Aþena hvíslaði að honum', 'Þruma af heiðum himni'], 'A', 'VI. þáttur')


def palace(x, base, w=520):
    s = f'<rect x="{x - w / 2}" y="{base - 30}" width="{w}" height="30" fill="{INK}"/>'
    s += f'<polygon points="{x - w / 2 - 10},{base - 250} {x},{base - 340} {x + w / 2 + 10},{base - 250}" fill="{INK}"/>'
    s += f'<rect x="{x - w / 2}" y="{base - 255}" width="{w}" height="26" fill="{INK}"/>'
    for i in range(6):
        cx = x - w / 2 + 30 + i * (w - 60) / 5
        s += f'<rect x="{cx - 16}" y="{base - 228}" width="32" height="198" fill="{INK}"/>'
    s += f'<rect x="{x - 45}" y="{base - 170}" width="90" height="140" fill="#E2B33C" stroke="{INK}" stroke-width="3"/>'
    for dx in (-110, 110):
        s += f'<path d="M{x + dx - 30},{base - 30} l0,-30 l15,-20 l10,0 l5,-25 l10,10 l10,0 l0,35 l10,0 l0,30z" fill="#CFCFCF" stroke="{INK}" stroke-width="2.5"/>'
    return s


add(palace(420, 400) + tree(810, 400, 170, '#4b5a33', fruit=RED) + tree(900, 400, 120, '#4b5a33', fruit=ORANGE),
    'Höll Alkínóosar konungs er ólík öllu sem Ódysseifur hefur séð. Úr hverju eru veggirnir?',
    ['Gulli', 'Silfri', 'Eiri', 'Marmara'], 'C', 'VII. þáttur')


def robe(x, y, s=1.0, c=TEAL):
    return (f'<path d="M{x - 60 * s},{y} L{x - 150 * s},{y + 60 * s} L{x - 120 * s},{y + 110 * s} L{x - 80 * s},{y + 85 * s} '
            f'L{x - 90 * s},{y + 300 * s} L{x + 90 * s},{y + 300 * s} L{x + 80 * s},{y + 85 * s} L{x + 120 * s},{y + 110 * s} '
            f'L{x + 150 * s},{y + 60 * s} L{x + 60 * s},{y} Q{x},{y + 40 * s} {x - 60 * s},{y}z" fill="{c}" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M{x - 85 * s},{y + 250 * s} L{x + 85 * s},{y + 250 * s}" stroke="{INK}" stroke-width="3" stroke-dasharray="6 6"/>')


add(robe(320, 70, 1.05) + person(700, 395, 260, crown=True) + bubble(760, 40, 120, 80, '?', 50),
    'Hvernig vissi Areta drottning að gesturinn hafði hitt Násíku, dóttur hennar?',
    ['Hún þekkti fötin, því hún hafði ofið þau sjálf', 'Násíka hafði sagt henni frá honum', 'Hana hafði dreymt það', 'Hundarnir þekktu lyktina af honum'], 'A', 'VII. þáttur')


def lyre(x, y, s=1.0):
    return (f'<path d="M{x - 70 * s},{y + 160 * s} Q{x - 110 * s},{y + 40 * s} {x - 60 * s},{y - 40 * s}" stroke="{INK}" stroke-width="{14 * s}" fill="none" stroke-linecap="round"/>'
            f'<path d="M{x + 70 * s},{y + 160 * s} Q{x + 110 * s},{y + 40 * s} {x + 60 * s},{y - 40 * s}" stroke="{INK}" stroke-width="{14 * s}" fill="none" stroke-linecap="round"/>'
            f'<rect x="{x - 80 * s}" y="{y - 30 * s}" width="{160 * s}" height="{14 * s}" fill="{INK}"/>'
            f'<ellipse cx="{x}" cy="{y + 165 * s}" rx="{85 * s}" ry="{30 * s}" fill="{INK}"/>'
            + ''.join(f'<line x1="{x + d * s}" y1="{y - 16 * s}" x2="{x + d * s}" y2="{y + 150 * s}" stroke="{INK}" stroke-width="2"/>' for d in (-36, -12, 12, 36)))


add(lyre(140, 160, 0.95) + ''.join(card(x, y, 330, 150, lab, COLORS[i], 21) for i, ((x, y), lab) in enumerate(zip(
        [(270, 40), (640, 40), (270, 225), (640, 225)],
        [['Deila Ódysseifs og', 'Akkillesar'], ['Ástir Aresar og', 'Afródítu'], ['Sagan af', 'tréhestinum'], ['Brúðkaup Þetisar', 'og Pelefs']]))),
    'Demódókos syngur þrjú kvæði í veislunni. Hvaða kvæði bað Ódysseifur hann sjálfur að syngja?',
    COLOR_OPTS, 'C', 'VIII. þáttur')

add(''.join(card(x, y, 330, 150, lab, None, 28, num=i + 1) for i, ((x, y), lab) in enumerate(zip(
    [(150, 40), (520, 40), (150, 225), (520, 225)], ['Kýklópar', 'Kirka', 'Lótusætur', 'Ajólos']))),
    'Í hvaða röð koma þessir staðir í frásögn Ódysseifs?',
    ['1 → 3 → 4 → 2', '3 → 1 → 4 → 2', '3 → 4 → 1 → 2', '4 → 3 → 1 → 2'], 'B', 'IX.–X. þáttur')

add(f'<text x="80" y="150" font-family="FreeSerif" font-size="110" fill="{INK}">❝</text>'
    + f'<text x="190" y="170" font-family="FreeSerif" font-style="italic" font-size="40" fill="{INK}">„Nafn mitt er</text>'
    + '<rect x="440" y="135" width="200" height="56" rx="8" fill="#fff" stroke="#999" stroke-width="2" stroke-dasharray="6 5"/>'
    + f'<text x="655" y="170" font-family="FreeSerif" font-style="italic" font-size="40" fill="{INK}">, og Engi kallar mig</text>'
    + f'<text x="190" y="235" font-family="FreeSerif" font-style="italic" font-size="40" fill="{INK}">móðir mín og faðir minn og allir vinir mínir.“</text>'
    + text(190, 300, 'Ódysseifur við Pólýfemos – þýðing Sveinbjarnar Egilssonar', 20, 500, MUTED, anchor='start'),
    'Hvaða orð vantar í tilvitnunina?',
    ['Ódysseifur', 'Útlagi', 'Laertesson', 'Enginn'], 'D', 'IX. þáttur')


def sheep(x, y, s=1.0):
    bumps = ''.join(f'<circle cx="{x + dx * s}" cy="{y + dy * s}" r="{34 * s}" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
                    for dx, dy in [(-110, 0), (-60, -30), (0, -40), (60, -30), (110, 0), (60, 25), (0, 30), (-60, 25)])
    body = f'<ellipse cx="{x}" cy="{y}" rx="{130 * s}" ry="{60 * s}" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
    legs = ''.join(f'<rect x="{x + lx * s}" y="{y + 40 * s}" width="{16 * s}" height="{90 * s}" fill="{INK}"/>' for lx in (-95, -60, 45, 80))
    head = f'<ellipse cx="{x + 150 * s}" cy="{y - 30 * s}" rx="{38 * s}" ry="{26 * s}" fill="{INK}" transform="rotate(20 {x + 150 * s} {y - 30 * s})"/>'
    return legs + bumps + body + head


add(sheep(470, 190, 1.15) + f'<path d="M335,268 L600,268" stroke="{INK}" stroke-width="24" stroke-linecap="round"/>'
    + f'<circle cx="628" cy="262" r="19" fill="{INK}"/>' + f'<path d="M560,262 l20,-40 M400,262 l-10,-40" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>' + ground(345, 200, 760)
    + dot(470, 100, PINK, 18) + dot(470, 262, RED, 18) + dot(250, 200, ORANGE, 18) + dot(760, 230, TEAL, 18),
    'Hvernig sluppu mennirnir út úr helli Pólýfemosar? Hvaða litur sýnir hvar þeir voru?',
    COLOR_OPTS, 'B', 'IX. þáttur')


def wind_bag(x, y):
    s = (f'<path d="M{x - 30},{y - 120} q-120,40 -110,160 q10,110 140,110 q130,0 140,-110 q10,-120 -110,-160z" fill="#a98c5a" stroke="{INK}" stroke-width="3"/>'
         f'<rect x="{x - 40}" y="{y - 140}" width="80" height="26" rx="8" fill="{RED}" stroke="{INK}" stroke-width="3"/>')
    for k, (dx, dy) in enumerate([(200, -60), (230, 10), (200, 80)]):
        s += f'<path d="M{x + 120},{y + dy / 2} q60,{-20} 110,{dy / 3} q30,20 0,40" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>'
    return s


add(wind_bag(400, 220) + person(170, 395, 230, crown=True) + qmark(760, 210, 140),
    'Hvað var bundið í belgnum sem Ajólos gaf Ódysseifi að skilnaði?',
    ['Gull', 'Töfrajurt', 'Allir mótvindar', 'Vín'], 'C', 'X. þáttur')


def pig(x, y, s=1.0):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{150 * s}" ry="{85 * s}" fill="{PINK}" stroke="{INK}" stroke-width="3"/>'
            + ''.join(f'<rect x="{x + lx * s}" y="{y + 55 * s}" width="{26 * s}" height="{70 * s}" fill="{PINK}" stroke="{INK}" stroke-width="3"/>' for lx in (-110, -60, 40, 90))
            + f'<ellipse cx="{x + 165 * s}" cy="{y - 5 * s}" rx="{30 * s}" ry="{36 * s}" fill="{PINK}" stroke="{INK}" stroke-width="3"/>'
            + f'<circle cx="{x + 160 * s}" cy="{y - 10 * s}" r="5" fill="{INK}"/><circle cx="{x + 176 * s}" cy="{y + 2 * s}" r="5" fill="{INK}"/>'
            + f'<circle cx="{x + 105 * s}" cy="{y - 35 * s}" r="7" fill="{INK}"/>'
            + f'<polygon points="{x + 80 * s},{y - 70 * s} {x + 105 * s},{y - 120 * s} {x + 125 * s},{y - 65 * s}" fill="{PINK}" stroke="{INK}" stroke-width="3"/>'
            + f'<path d="M{x - 150 * s},{y - 10 * s} q-30,-30 -10,-50 q20,-10 10,20" stroke="{INK}" stroke-width="3" fill="none"/>')


add(pig(400, 230) + f'<ellipse cx="720" cy="110" rx="140" ry="80" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
    + f'<circle cx="610" cy="200" r="16" fill="{CARD}" stroke="{INK}" stroke-width="3"/><circle cx="575" cy="230" r="9" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
    + qmark(720, 115, 100) + ground(370, 220, 620),
    'Menn Ódysseifs urðu að svínum hjá Kirku. Hvað héldu þeir óskertu, samkvæmt Sveinbirni?',
    ['Vitinu', 'Röddinni', 'Hárinu', 'Höfðinu'], 'A', 'X. þáttur')


def herb(x, base):
    s = f'<path d="M{x},{base} q-6,-90 4,-170" stroke="#3d5a2a" stroke-width="7" fill="none"/>'
    for i, (dx, dy) in enumerate([(-50, -60), (45, -95), (-45, -130), (40, -160)]):
        s += f'<ellipse cx="{x + dx / 2}" cy="{base + dy}" rx="32" ry="13" fill="#5b8a3c" stroke="{INK}" stroke-width="2" transform="rotate({-30 if dx < 0 else 30} {x + dx / 2} {base + dy})"/>'
    s += f'<circle cx="{x + 4}" cy="{base - 182}" r="16" fill="#fff" stroke="{INK}" stroke-width="2.5"/>'
    return s + f'<path d="M{x - 30},{base} q30,20 60,0" stroke="{INK}" stroke-width="3" fill="none"/>'


add(person(250, 395, 270, hat=True, arms='point') + herb(480, 380) + person(760, 395, 270) + kylix(760, 60, .45),
    'Hvað verndaði Ódysseif gegn drykk Kirku og galdri hennar?',
    ['Vax í eyrunum', 'Skjöldur Aþenu', 'Töfrajurt sem Hermes gaf honum', 'Sverð Akkillesar'], 'C', 'X. þáttur')


def pit_scene():
    s = f'<rect x="0" y="0" width="{W}" height="{H}" fill="#5b5752"/>'
    s += f'<ellipse cx="500" cy="330" rx="160" ry="40" fill="{RED}" stroke="{INK}" stroke-width="4"/>'
    for i, x in enumerate((140, 230, 770, 860)):
        s += person(x, 330, 200, c='#b9b4aa')
    s += person(500, 270, 220, arms='out', c=INK)
    s += f'<line x1="540" y1="160" x2="640" y2="250" stroke="#ddd" stroke-width="7" stroke-linecap="round"/>'
    return s


add(pit_scene(),
    'Ódysseifur grefur gryfju og lætur blóð renna í hana. Hvers vegna sækja sálir hinna dauðu í blóðið?',
    ['Þær eru þyrstar eftir langa göngu', 'Sá sem drekkur það fær mál og minni um stund', 'Það gerir þær lifandi á ný', 'Til að hefna sín á Ódysseifi'], 'B', 'XI. þáttur', panel='dark')


def siren_ship():
    s = waves(355, n=2, gap=18)
    s += ship(500, 320, 1.25, sail=False)
    s += f'<rect x="495" y="80" width="10" height="240" fill="{INK}"/>'
    s += person(500, 300, 170)
    s += ''.join(f'<path d="M{480 + k * 6},{200 + k * 30} L{520 - k * 6},{200 + k * 30}" stroke="{ORANGE}" stroke-width="6"/>' for k in range(3))
    for x in (300, 370, 640, 710):
        s += person(x, 320, 100)
    s += dot(500, 103, RED, 14)                 # eyru Ódysseifs
    s += dot(300, 232, PINK, 13)                # eyru ræðara
    s += dot(500, 30, TEAL, 14)                 # efst í siglutré
    s += dot(800, 330, ORANGE, 14)              # skutur
    s += ''.join(f'<text x="{860 + i * 30}" y="{110 + i * 25}" font-size="42" fill="{INK}">♪</text>' for i in range(3))
    return s


add(siren_ship(),
    'Ódysseifur vildi sjálfur heyra söng sírenanna. Hvar var vaxinu troðið? Veldu lit sem sýnir það.',
    COLOR_OPTS, 'A', 'XII. þáttur')


def strait():
    s = f'<path d="M0,0 L250,0 C230,120 300,250 230,425 L0,425z" fill="#a49779" stroke="{INK}" stroke-width="3"/>'
    s += f'<path d="M1000,0 L760,0 C780,140 700,260 780,425 L1000,425z" fill="#a49779" stroke="{INK}" stroke-width="3"/>'
    s += f'<ellipse cx="160" cy="170" rx="50" ry="70" fill="{INK}"/>'
    for i in range(6):
        a = -70 + i * 22
        x2, y2 = 160 + math.cos(math.radians(a)) * 150, 170 + math.sin(math.radians(a)) * 110
        s += f'<path d="M180,170 Q{(180 + x2) / 2 + 30},{(170 + y2) / 2 - 30} {x2},{y2}" stroke="{INK}" stroke-width="7" fill="none"/><circle cx="{x2}" cy="{y2}" r="11" fill="{INK}"/>'
    for r in (70, 48, 26):
        s += f'<ellipse cx="740" cy="220" rx="{r * 1.4}" ry="{r * .6}" fill="none" stroke="#3b5e78" stroke-width="5"/>'
    s += text(170, 395, 'Skylla', 22, 800, INK)
    s += text(740, 395, 'Karybdís', 22, 800, INK)
    for c, x in [(PINK, 340), (RED, 500), (ORANGE, 650)]:
        s += arrow(x, 410, x + (10 if x != 340 else -20), 40, c, 6, bend=8 if x != 650 else -10, outline=True)
    s += arrow(520, 300, 560, 410, TEAL, 6, bend=60, outline=True)
    return s


add(strait(),
    'Kirka ráðlagði Ódysseifi hvar hann ætti að sigla um sundið. Hvaða ör fylgir ráði hennar?',
    COLOR_OPTS, 'A', 'XII. þáttur')


def bull(x, base, s=1.0):
    return (f'<rect x="{x - 120 * s}" y="{base - 170 * s}" width="{240 * s}" height="{100 * s}" rx="{45 * s}" fill="{INK}"/>'
            + ''.join(f'<rect x="{x + lx * s}" y="{base - 90 * s}" width="{22 * s}" height="{90 * s}" fill="{INK}"/>' for lx in (-100, -65, 50, 85))
            + f'<ellipse cx="{x + 150 * s}" cy="{base - 160 * s}" rx="{45 * s}" ry="{35 * s}" fill="{INK}"/>'
            + f'<path d="M{x + 130 * s},{base - 190 * s} q-10,-40 30,-50 M{x + 170 * s},{base - 190 * s} q20,-35 50,-30" stroke="{INK}" stroke-width="{8 * s}" fill="none" stroke-linecap="round"/>')


add(bull(250, 370, 1.0) + sun(620, 90, 50) + bull(720, 370, 1.0)
    + f'<path d="M420,250 q20,-20 0,-40 q-20,-20 0,-40" stroke="{INK}" stroke-width="3" fill="none"/>' + ground(372, 80, 940),
    'Hvað gerðist eftir að menn Ódysseifs slátruðu nautum sólguðsins Helíosar?',
    ['Húðirnar skriðu og kjötið baulaði á teinunum', 'Nautin lifnuðu við og flúðu', 'Sólin hvarf af himni í heilan mánuð', 'Ekkert, Helíos tók ekki eftir því'], 'A', 'XII. þáttur')

AEGEAN = (26.5, 37.3, 8.6)
add(map_svg(*AEGEAN, lambda P: dot(*P(26.3, 39.2), PINK) + dot(*P(28.0, 36.25), RED) + dot(*P(33.1, 35.05), ORANGE) + dot(*P(24.9, 35.25), TEAL)),
    'Í lygasögum sínum segist Ódysseifur vera frá stórri eyju. Hvaða litur er á henni (Krít)?',
    COLOR_OPTS, 'D', 'XIII.–XIV. þáttur', panel='map')

add(waves(330, n=3) + ship(330, 300, 1.15, fill_sail=CARD) + text(560, 230, '→', 90, 400)
    + ship(780, 300, 1.15, c='#8a8a86', fill_sail='#b5b5b0') + qmark(780, 70, 70),
    'Fajakar flytja Ódysseif heim. Hvað gerir Póseidon við skip þeirra á leiðinni til baka?',
    ['Sökkvir því í storm', 'Kveikir í því', 'Gefur Ódysseifi það', 'Breytir því í stein'], 'D', 'XIII. þáttur')


def dog_heap(x, base):
    s = f'<path d="M{x - 190},{base} Q{x},{base - 70} {x + 190},{base}z" fill="#7a6243" stroke="{INK}" stroke-width="3"/>'
    s += f'<ellipse cx="{x}" cy="{base - 55}" rx="110" ry="32" fill="{INK}"/>'
    s += f'<ellipse cx="{x + 115}" cy="{base - 60}" rx="38" ry="26" fill="{INK}"/>'
    s += f'<polygon points="{x + 100},{base - 80} {x + 92},{base - 112} {x + 118},{base - 84}" fill="{INK}"/>'
    s += f'<path d="M{x - 110},{base - 60} q-40,-30 -30,-60" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>'
    return s


add(dog_heap(330, 370) + palace(780, 395, 300) + person(560, 395, 210) + bubble(410, 60, 150, 80, '…', 50),
    'Hvað gerist þegar gamli hundurinn Argos þekkir rödd húsbónda síns?',
    ['Hann geltir og vekur athygli biðlanna', 'Hann eltir Ódysseif inn í salinn', 'Hann dillar rófunni en deyr þegar Ódysseifur er genginn inn', 'Hann bítur Antínóos'], 'C', 'XVII. þáttur')


def standing_with_spots():
    x, base = 430, 395
    s = f'<circle cx="{x}" cy="{base - 330}" r="36" fill="{INK}"/>'
    s += f'<polygon points="{x - 38},{base - 290} {x + 38},{base - 290} {x + 78},{base - 150} {x - 78},{base - 150}" fill="{INK}"/>'
    s += f'<path d="M{x - 38},{base - 280} L{x - 105},{base - 190} M{x + 38},{base - 280} L{x + 105},{base - 190}" stroke="{INK}" stroke-width="16" stroke-linecap="round"/>'
    s += f'<rect x="{x - 50}" y="{base - 155}" width="30" height="155" rx="10" fill="{INK}"/><rect x="{x + 20}" y="{base - 155}" width="30" height="155" rx="10" fill="{INK}"/>'
    s += dot(x, base - 335, PINK, 16)           # andlit
    s += dot(x - 35, base - 105, RED, 16)       # ofan við hné
    s += dot(x + 105, base - 190, ORANGE, 16)   # hönd
    s += dot(x, base - 225, TEAL, 16)           # bringa
    s += f'<path d="M640,395 L660,300 L860,300 L880,395z" fill="#9cc3c7" stroke="{INK}" stroke-width="3"/>' + text(770, 345, 'vatn', 28, 700)
    return s


add(standing_with_spots(),
    'Gamla fóstran Evrýkleia þekkir Ódysseif þegar hún þvær fætur hans. Hvaða litur sýnir staðinn sem kom upp um hann?',
    COLOR_OPTS, 'B', 'XIX. þáttur')


def axes_scene():
    s = ground(380, 60, 940)
    for i in range(12):
        x = 210 + i * 52
        s += f'<rect x="{x - 4}" y="210" width="8" height="170" fill="#6b5236"/>'
        s += f'<path d="M{x - 4},212 q-34,-6 -38,-40 q20,8 38,10z" fill="{INK}"/>'
        s += f'<circle cx="{x}" cy="232" r="9" fill="{BEIGE}" stroke="{INK}" stroke-width="3"/>'
    s += f'<path d="M110,150 Q60,232 110,314" stroke="{INK}" stroke-width="10" fill="none"/>'
    s += f'<line x1="110" y1="150" x2="110" y2="314" stroke="{INK}" stroke-width="2"/>'
    s += arrow(120, 232, 900, 232, RED, 4, head=18)
    return s


add(axes_scene(),
    'Penelópa setur biðlunum þraut með boga Ódysseifs. Hvað þurfa þeir að gera til að vinna?',
    ['Spenna bogann og skjóta ör í gegnum tólf axir', 'Hitta mark á hinum enda salarins', 'Höggva tólf tré með einni öxi', 'Skjóta tólf örvum á tólf skildi'], 'A', 'XIX. og XXI. þáttur')


def bed_tree():
    s = f'<path d="M80,370 L920,370" stroke="{INK}" stroke-width="4"/>'
    s += f'<rect x="300" y="250" width="420" height="60" rx="10" fill="#8a6a43" stroke="{INK}" stroke-width="3"/>'
    s += f'<rect x="310" y="232" width="400" height="26" rx="10" fill="{CARD}" stroke="{INK}" stroke-width="3"/>'
    s += f'<rect x="690" y="140" width="50" height="230" fill="#6b5236" stroke="{INK}" stroke-width="3"/>'
    s += f'<rect x="290" y="200" width="30" height="170" fill="#6b5236" stroke="{INK}" stroke-width="3"/>'
    for dx in (-40, -10, 20, 50):
        s += f'<path d="M{715 + dx * .3},370 q{dx},20 {dx * 1.6},50" stroke="#6b5236" stroke-width="6" fill="none"/>'
    s += f'<ellipse cx="715" cy="90" rx="90" ry="55" fill="#6f8a4d" stroke="{INK}" stroke-width="3"/>'
    s += f'<line x1="60" y1="80" x2="60" y2="370" stroke="{INK}" stroke-width="6"/><line x1="960" y1="80" x2="960" y2="370" stroke="{INK}" stroke-width="6"/>'
    s += qmark(170, 230, 120)
    return s


add(bed_tree(),
    'Penelópa reynir Ódysseif með því að biðja um að rúmið hans sé borið út. Hvers vegna getur enginn maður fært það?',
    ['Það er of þungt', 'Það er neglt fast við gólfið', 'Aþena hefur lagt álög á það', 'Einn rúmstólpinn er ólífutré sem vex upp úr jörðinni'], 'D', 'XXIII. þáttur')


def tree_groups():
    s = ''
    groups = [(13, 200, RED), (10, 500, ORANGE), (40, 800, '#6b3f6b')]
    for n, cx, c in groups:
        s += tree(cx, 300, 150, '#4b5a33', fruit=c)
        s += f'<rect x="{cx - 70}" y="320" width="140" height="70" rx="12" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>' + text(cx, 356, str(n), 40, 900)
    s += qmark(900, 120, 80)
    return s


add(tree_groups(),
    'Laertes gaf Ódysseifi tré þegar hann var lítill drengur. Af hvaða tegund voru fjörutíu þeirra?',
    ['Perutré', 'Eplatré', 'Fíkjutré', 'Ólífutré'], 'C', 'XXIV. þáttur')


# ---------------------------------------------------------------- HTML
MEANDER = ''.join(
    f'<path d="M{x},415 v-14 h14 v10 h-8 v-5" fill="none" stroke="#c9bda4" stroke-width="1.6"/>' for x in range(4, W, 20))


def panel_svg(q, num):
    bg = {'beige': BEIGE, 'map': MAP, 'night': '#1d2b4a', 'dark': '#5b5752'}[q['panel']]
    meander = MEANDER if q['panel'] == 'beige' else ''
    numtxt = (f'<text x="22" y="62" font-family="Inter" font-weight="900" font-size="64" fill="{INK}" stroke="#fff" '
              f'stroke-width="7" paint-order="stroke">{num}</text>')
    return (f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg"><rect width="{W}" height="{H}" fill="{bg}"/>'
            f'<g>{q["visual"]}</g>{meander}{numtxt}</svg>')


def options_html(q):
    if q['options'] == COLOR_OPTS:
        return '<div class="colors">' + ''.join(f'<div class="co"><b>{L}</b><span style="background:{c}"></span></div>' for L, c in zip('ABCD', COLORS)) + '</div>'
    return '<div class="texts">' + ''.join(f'<div class="to"><b>{L}</b><span>{esc(t)}</span></div>' for L, t in zip('ABCD', q['options'])) + '</div>'


CSS = """
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, 'Liberation Sans', sans-serif; color: #1b1b1b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width: 297mm; height: 210mm; padding: 6mm 9mm 6mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
.slide:last-child { page-break-after: auto; }
.panel svg { display: block; width: 100%; height: auto; }
.q { font-weight: 800; font-size: 19pt; line-height: 1.22; margin: 6mm 2mm 0; }
.colors { display: flex; gap: 0; margin: 6mm 2mm 0; }
.co { flex: 1; display: flex; align-items: center; gap: 4mm; font-size: 24pt; font-weight: 900; }
.co span { display: inline-block; width: 13mm; height: 13mm; border-radius: 50%; }
.texts { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 10mm; margin: 5mm 2mm 0; }
.to { display: flex; gap: 3mm; font-size: 14pt; line-height: 1.25; }
.to b { font-weight: 900; min-width: 6mm; }
.e { margin: auto 2mm 0; font-size: 10pt; font-weight: 800; }
.cover { justify-content: center; align-items: flex-start; padding: 25mm 30mm; background: #EEE6D6; }
.cover h1 { font-size: 48pt; margin: 0 0 4mm; font-weight: 900; }
.cover p { font-size: 16pt; margin: 2mm 0; max-width: 200mm; }
"""


def build_html():
    slides = []
    for i, q in enumerate(Q, 1):
        slides.append(f'<section class="slide"><div class="panel">{panel_svg(q, i)}</div>'
                      f'<div class="q">{esc(q["question"])}</div>{options_html(q)}'
                      f'<div class="e">E: Ekkert svar er rétt</div></section>')
    return f'<!doctype html><html lang="is"><head><meta charset="utf-8"><title>Ódysseifskviða – próf</title><style>{CSS}</style></head><body>{"".join(slides)}</body></html>'


def build_key_html():
    rows = ''.join(f'<tr><td>{i}</td><td><b>{q["answer"]}</b></td><td>{esc(answer_text(q))}</td><td>{esc(q["ref"])}</td></tr>' for i, q in enumerate(Q, 1))
    counts = {L: sum(1 for q in Q if q['answer'] == L) for L in 'ABCDE'}
    css = """@page { size: A4 portrait; margin: 14mm; } body { font-family: Inter, sans-serif; font-size: 9.5pt; color:#1b1b1b }
    h1 { font-size: 18pt; margin: 0 0 2mm } p { margin: 0 0 4mm; color:#555 } table { border-collapse: collapse; width: 100% }
    td, th { border-bottom: 1px solid #ddd; padding: 1.4mm 2mm; text-align: left; vertical-align: top } th { font-size: 8.5pt; color:#555 }
    td:nth-child(1), td:nth-child(2) { width: 9mm; font-weight: 800 }"""
    dist = ' · '.join(f'{L}: {n}' for L, n in counts.items())
    return (f'<!doctype html><html lang="is"><head><meta charset="utf-8"><title>Ódysseifskviða – svarlykill</title><style>{css}</style></head><body>'
            f'<h1>Ódysseifskviða – svarlykill</h1><p>40 spurningar · dreifing svara: {dist}. Kafli vísar í endursögnina sem nemendur lesa.</p>'
            f'<table><tr><th>Nr.</th><th>Svar</th><th>Rétt svar</th><th>Kafli</th></tr>{rows}</table></body></html>')


COLOR_NAMES = {'A': 'bleikur', 'B': 'rauður', 'C': 'appelsínugulur', 'D': 'grænblár'}


def answer_text(q):
    if q['answer'] == 'E':
        return 'Ekkert svar er rétt – ' + E_REASONS.get(id(q), '')
    if q['options'] == COLOR_OPTS:
        return COLOR_NAMES[q['answer']] + ' – ' + COLOR_EXPLAIN.get(Q.index(q) + 1, '')
    return q['options']['ABCD'.index(q['answer'])]


E_REASONS = {}
COLOR_EXPLAIN = {
    1: 'εύς', 2: 'θ (þeta)', 3: 'hann þýddi í lausu máli', 4: 'Íþaka', 5: 'Pýlos → Sparta', 6: 'ár 20, fáeinar vikur eftir',
    13: 'gamall betlari er gervi Ódysseifs', 14: 'Antíkleia', 16: 'Egyptaland', 17: 'örn', 23: 'sagan af tréhestinum',
    26: 'undir kviði sauðanna', 31: 'í eyru ræðaranna, ekki Ódysseifs', 32: 'nær Skyllu: betra að missa sex en alla',
    34: 'Krít', 37: 'örið ofan við hnéð',
}


def main():
    if len(Q) != 40:
        sys.exit(f'Spurningar eru {len(Q)}, ekki 40.')
    missing = [i for i, q in enumerate(Q, 1) if q['options'] == COLOR_OPTS and i not in COLOR_EXPLAIN]
    if missing:
        sys.exit(f'Skýringu á litasvari vantar í svarlykil: {missing}')
    for q in Q:
        if q['answer'] == 'E':
            E_REASONS[id(q)] = {'Telemakkos telur biðlana upp fyrir föður sínum. Hve margir eru þeir, fyrir utan þjóna?': 'þeir eru 108 (XVI. þáttur)',
                                'Í hve marga daga sigldi Ódysseifur á flekanum eftir stjörnunum áður en hann sá land?': 'hann sigldi í 17 daga og sá land á 18. degi (V. þáttur)'}[q['question']]
    out_html = os.path.join(HERE, 'odysseifskvida-prof.html')
    open(out_html, 'w', encoding='utf-8').write(build_html())
    key_html = os.path.join(HERE, 'odysseifskvida-svarlykill.html')
    open(key_html, 'w', encoding='utf-8').write(build_key_html())
    import subprocess
    js = os.path.join(HERE, 'print_pdf.js')
    for src, dst, orient in [(out_html, 'odysseifskvida-prof.pdf', 'landscape'), (key_html, 'odysseifskvida-svarlykill.pdf', 'portrait')]:
        subprocess.run(['node', js, src, os.path.join(HERE, dst), orient], check=True)
    os.remove(key_html)
    print('Skrifað: prof/odysseifskvida-prof.pdf, prof/odysseifskvida-svarlykill.pdf')


if __name__ == '__main__':
    main()
