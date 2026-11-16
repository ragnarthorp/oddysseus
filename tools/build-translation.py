#!/usr/bin/env python3
"""Býr til úkraínska útgáfu textans úr þýðingarskrám.

    python3 tools/build-translation.py           # sannprófar og skrifar data/odysseifskvida.uk.{json,js}
    python3 tools/build-translation.py --lock    # skráir núverandi íslenskan frumtexta sem grunn þýðingarinnar

Inntak:
    data/odysseifskvida.json         íslensku textagögnin (úr tools/extract.py)
    translations/uk/*.json           þýðingar: {"sections": {id: {kicker, title}}, "units": {unitId: texti}}
    translations/uk.sources.json     fingraför (hash) íslensku eininganna sem þýtt var eftir

Úkraínska útgáfan hefur nákvæmlega sömu kafla, einingar, auðkenni, röð og síðutilvísanir og sú íslenska
– aðeins textinn er annar. Ef íslenskur texti breytist síðar stöðvast smíðin og bendir á einingarnar
sem þarf að þýða aftur.
"""
import glob
import hashlib
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'odysseifskvida.json')
TR_DIR = os.path.join(ROOT, 'translations', 'uk')
LOCK = os.path.join(ROOT, 'translations', 'uk.sources.json')
OUT_JSON = os.path.join(ROOT, 'data', 'odysseifskvida.uk.json')
OUT_JS = os.path.join(ROOT, 'data', 'odysseifskvida.uk.js')
CYR = re.compile(r'[Ѐ-ӿ]')


def load_translations():
    sections, units = {}, {}
    for f in sorted(glob.glob(os.path.join(TR_DIR, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        for k, v in d.get('sections', {}).items():
            if k in sections: sys.exit(f'Kafli {k} tvítekinn ({f})')
            sections[k] = v
        for k, v in d.get('units', {}).items():
            if k in units: sys.exit(f'Eining {k} tvítekin ({f})')
            units[k] = v
    return sections, units


def main():
    base = json.load(open(SRC, encoding='utf-8'))
    tr_sections, tr_units = load_translations()
    src_hashes = {u['id']: u['hash'] for s in base['sections'] for u in s['units']}

    if '--lock' in sys.argv:
        json.dump(src_hashes, open(LOCK, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('Skráð:', os.path.relpath(LOCK, ROOT), len(src_hashes), 'einingar')
        return

    lock = json.load(open(LOCK, encoding='utf-8')) if os.path.exists(LOCK) else {}
    problems = []
    ids = set(src_hashes)
    for k in sorted(set(tr_units) - ids): problems.append(f'{k}: þýðing á einingu sem er ekki til')
    for k in sorted(ids - set(tr_units)): problems.append(f'{k}: þýðingu vantar')
    for k in sorted(ids & set(lock)):
        if lock[k] != src_hashes[k]: problems.append(f'{k}: íslenski textinn hefur breyst síðan þýtt var – þýðið aftur og keyrið --lock')
    for k in sorted(ids - set(lock)): problems.append(f'{k}: vantar í {os.path.relpath(LOCK, ROOT)} (keyrið --lock eftir yfirferð)')

    out_sections = []
    for s in base['sections']:
        ts = tr_sections.get(s['id'])
        if not ts or not ts.get('title') or not ts.get('kicker'):
            problems.append(f'{s["id"]}: kaflaheiti eða yfirfyrirsögn vantar')
            ts = {'title': s['title'], 'kicker': s['kicker']}
        ns = dict(s, title=ts['title'], kicker=ts['kicker'], units=[])
        ns.pop('tocConfirmed', None)
        for u in s['units']:
            text = unicodedata.normalize('NFC', re.sub(r'\s+', ' ', tr_units.get(u['id'], '')).strip())
            nu = dict(u, text=text, hash=hashlib.sha1(text.encode('utf-8')).hexdigest()[:12], srcHash=u['hash'])
            # einingar í þessu skjali eru allar á einni síðu; síðutilvísun fylgir íslensku einingunni
            nu['pages'] = [dict(u['pages'][0], offset=0)]
            if not text: problems.append(f'{u["id"]}: tóm þýðing')
            elif not CYR.search(text) and u['id'] != 'titill-003': problems.append(f'{u["id"]}: þýðingin virðist ekki á úkraínsku')
            if u['type'] == 'tilvitnun' and not (text.startswith('«') and text.endswith('»')):
                problems.append(f'{u["id"]}: tilvitnun á að byrja á « og enda á »')
            if u['type'] == 'heimild' and 'Свейнб’єрна Егільссона' not in text:
                problems.append(f'{u["id"]}: heimildarlína á að nefna Свейнб’єрна Егільссона')
            if u['type'] == 'nafn':
                i = text.find(':')
                if i < 0: problems.append(f'{u["id"]}: nafnafærsla án tvípunkts')
                nu['termLength'] = i + 1 if i >= 0 else 0
            ns['units'].append(nu)
        out_sections.append(ns)

    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(f'Þýðingin stóðst ekki sannprófun ({len(problems)} atriði).')

    payload = json.dumps({'s': tr_sections, 'u': tr_units}, ensure_ascii=False, sort_keys=True)
    version = 'uk-' + hashlib.sha256((base['document']['version'] + payload).encode('utf-8')).hexdigest()[:16]
    data = {
        'format': base['format'],
        'formatVersion': base['formatVersion'],
        'document': dict(base['document'], edition='uk', lang='uk', version=version,
                         baseVersion=base['document']['version'], title='Одіссея – переказ',
                         translation='Переклад ісландського переказу українською, підготовлений для цієї читальні.'),
        'printedPagesConfirmed': base['printedPagesConfirmed'],
        'sections': out_sections,
    }
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('/* Myndað af tools/build-translation.py – ekki breyta handvirkt. */\n')
        f.write('window.ODY_TEXT_UK = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    n = sum(len(s['units']) for s in out_sections)
    print(f'Úkraínsk útgáfa {version}: {len(out_sections)} kaflar, {n} einingar.')


if __name__ == '__main__':
    main()
