#!/usr/bin/env python3
"""Býr til þýddar útgáfur textans úr þýðingarskrám.

    python3 tools/build-translation.py              # öll mál: sannprófar og skrifar data/odysseifskvida.<mál>.{json,js}
    python3 tools/build-translation.py pl           # eitt mál
    python3 tools/build-translation.py pl --lock    # skráir núverandi íslenskan frumtexta sem grunn þýðingarinnar

Inntak (fyrir hvert mál, t.d. uk eða pl):
    data/odysseifskvida.json            íslensku textagögnin (úr tools/extract.py)
    translations/<mál>/*.json           þýðingar: {"sections": {id: {kicker, title}}, "units": {unitId: texti}}
    translations/<mál>.sources.json     fingraför (hash) íslensku eininganna sem þýtt var eftir

Þýdd útgáfa hefur nákvæmlega sömu kafla, einingar, auðkenni, röð og síðutilvísanir og sú íslenska
– aðeins textinn er annar. Ef íslenskur texti breytist síðar stöðvast smíðin og bendir á einingarnar
sem þarf að þýða aftur. Nýtt mál: bætið færslu í LANGS og búið til translations/<mál>/.
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
ICELANDIC_ONLY = re.compile('[ðþæÐÞÆ]')  # ð þ æ Ð Þ Æ
# íslensk sérnöfn sem mega standa óbreytt í þýðingu (staðarheiti og dæmi um rithátt)
ICELANDIC_NAMES = re.compile('Bessastaðir|Ódysseifur|Odysseifur|Menningarsjóður')

# Reglur hvers máls: gæsalappir tilvitnana, stafróf, nafn Sveinbjarnar í heimildarlínum, titill og lýsing.
LANGS = {
    'uk': {
        'quote': ('«', '»'),                      # « »
        'unit_re': re.compile('[Ѐ-ӿ]'),           # hver eining á kýrillísku
        'source_name': 'Свейнб’єрна Егільссона',
        'title': 'Одіссея – переказ',
        'translation': 'Переклад ісландського переказу українською, підготовлений для цієї читальні.',
    },
    'pl': {
        'quote': ('„', '”'),                      # „ ”
        'all_re': re.compile('[ąćęłńśźżĄĆĘŁŃŚŹŻ]'),         # pólskir stafir í textanum í heild
        'source_name': 'Sveinbjörna Egilssona',
        'title': 'Odyseja – opowieść',
        'translation': 'Przekład islandzkiej opowieści na język polski, przygotowany dla tej czytelni.',
    },
}


def paths(lang):
    return {
        'dir': os.path.join(ROOT, 'translations', lang),
        'lock': os.path.join(ROOT, 'translations', f'{lang}.sources.json'),
        'json': os.path.join(ROOT, 'data', f'odysseifskvida.{lang}.json'),
        'js': os.path.join(ROOT, 'data', f'odysseifskvida.{lang}.js'),
    }


def load_translations(tr_dir):
    sections, units = {}, {}
    for f in sorted(glob.glob(os.path.join(tr_dir, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        for k, v in d.get('sections', {}).items():
            if k in sections: sys.exit(f'Kafli {k} tvítekinn ({f})')
            sections[k] = v
        for k, v in d.get('units', {}).items():
            if k in units: sys.exit(f'Eining {k} tvítekin ({f})')
            units[k] = v
    return sections, units


def build(lang, lock_only):
    cfg = LANGS[lang]
    P = paths(lang)
    base = json.load(open(SRC, encoding='utf-8'))
    tr_sections, tr_units = load_translations(P['dir'])
    src_hashes = {u['id']: u['hash'] for s in base['sections'] for u in s['units']}

    if lock_only:
        json.dump(src_hashes, open(P['lock'], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('Skráð:', os.path.relpath(P['lock'], ROOT), len(src_hashes), 'einingar')
        return

    lock = json.load(open(P['lock'], encoding='utf-8')) if os.path.exists(P['lock']) else {}
    problems = []
    ids = set(src_hashes)
    for k in sorted(set(tr_units) - ids): problems.append(f'{k}: þýðing á einingu sem er ekki til')
    for k in sorted(ids - set(tr_units)): problems.append(f'{k}: þýðingu vantar')
    for k in sorted(ids & set(lock)):
        if lock[k] != src_hashes[k]: problems.append(f'{k}: íslenski textinn hefur breyst síðan þýtt var – þýðið aftur og keyrið --lock')
    for k in sorted(ids - set(lock)): problems.append(f'{k}: vantar í {os.path.relpath(P["lock"], ROOT)} (keyrið --lock eftir yfirferð)')

    q0, q1 = cfg['quote']
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
            if not text:
                problems.append(f'{u["id"]}: tóm þýðing')
            elif cfg.get('unit_re') and not cfg['unit_re'].search(text) and u['id'] != 'titill-003':
                problems.append(f'{u["id"]}: þýðingin virðist ekki á réttu máli ({lang})')
            if ICELANDIC_ONLY.search(ICELANDIC_NAMES.sub('', text)):
                problems.append(f'{u["id"]}: íslenskir stafir (ð/þ/æ) í þýðingu – óþýddur texti?')
            if u['type'] == 'tilvitnun' and not (text.startswith(q0) and text.endswith(q1)):
                problems.append(f'{u["id"]}: tilvitnun á að byrja á {q0} og enda á {q1}')
            if u['type'] == 'heimild' and cfg['source_name'] not in text:
                problems.append(f'{u["id"]}: heimildarlína á að nefna {cfg["source_name"]}')
            if u['type'] == 'nafn':
                i = text.find(':')
                if i < 0: problems.append(f'{u["id"]}: nafnafærsla án tvípunkts')
                nu['termLength'] = i + 1 if i >= 0 else 0
            ns['units'].append(nu)
        out_sections.append(ns)

    if cfg.get('all_re') and not cfg['all_re'].search(' '.join(tr_units.values())):
        problems.append(f'Textinn virðist ekki á réttu máli ({lang})')
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(f'Þýðingin ({lang}) stóðst ekki sannprófun ({len(problems)} atriði).')

    payload = json.dumps({'s': tr_sections, 'u': tr_units}, ensure_ascii=False, sort_keys=True)
    version = lang + '-' + hashlib.sha256((base['document']['version'] + payload).encode('utf-8')).hexdigest()[:16]
    data = {
        'format': base['format'],
        'formatVersion': base['formatVersion'],
        'document': dict(base['document'], edition=lang, lang=lang, version=version,
                         baseVersion=base['document']['version'], title=cfg['title'],
                         translation=cfg['translation']),
        'printedPagesConfirmed': base['printedPagesConfirmed'],
        'sections': out_sections,
    }
    with open(P['json'], 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    with open(P['js'], 'w', encoding='utf-8') as f:
        f.write('/* Myndað af tools/build-translation.py – ekki breyta handvirkt. */\n')
        f.write(f'(window.ODY_TEXTS = window.ODY_TEXTS || {{}}).{lang} = '
                + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    n = sum(len(s['units']) for s in out_sections)
    print(f'Útgáfa {version}: {len(out_sections)} kaflar, {n} einingar.')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    langs = args or [l for l in LANGS if os.path.isdir(paths(l)['dir'])]
    for l in langs:
        if l not in LANGS: sys.exit(f'Óþekkt mál: {l} (þekkt: {", ".join(LANGS)})')
        build(l, '--lock' in sys.argv)


if __name__ == '__main__':
    main()
