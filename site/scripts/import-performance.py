#!/usr/bin/env python3
# coding: utf-8
"""Import owner-supplied 0–10 scores by exact SKU without changing prices or IDs."""
import importlib.util
import json
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / 'Downloads'
spec = importlib.util.spec_from_file_location('catalog_import', SITE / 'scripts/import-catalog.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
products = json.loads((SITE / 'data/products.json').read_text())
by_code = {p['code']: p for p in products}
enrichment_file = SITE / 'scripts/catalog-enrichment.json'
enrichment = json.loads(enrichment_file.read_text())
scores = {}
for prefix in ['JENSKIE', 'MUJSKIE', 'NISHEVIE', 'UNIVERSALNIE']:
    files = [p for p in SOURCE.glob(prefix + '*.xlsx') if 'кость' in p.name]
    if len(files) != 1:
        raise ValueError('Expected one performance workbook: ' + prefix)
    file = files[0]
    for sheet, row, cells in reader.rows(file):
        code = cells.get('A', '').strip()
        if not code or code == 'Артикул':
            continue
        if code not in by_code or code in scores:
            raise ValueError('Unknown or duplicate performance SKU: ' + code)
        values = []
        for column in ['C', 'D']:
            match = re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*из\s*10\s*', cells.get(column, ''))
            if not match:
                raise ValueError(f'Invalid score: {code}, {column}{row}')
            value = float(match[1].replace(',', '.'))
            if not 0 <= value <= 10:
                raise ValueError('Score out of range: ' + code)
            values.append(int(value) if value.is_integer() else value)
        scores[code] = {'longevity': values[0], 'sillage': values[1], 'performanceSource': {
            'file': file.name, 'sheet': sheet, 'sku': code,
            'longevityCell': 'C' + str(row), 'sillageCell': 'D' + str(row), 'scale': 10,
        }}
for code, fields in scores.items():
    product = by_code[code]
    product.update(fields)
    enrichment.setdefault(product['id'], {}).update(fields)
(SITE / 'data/products.json').write_text(json.dumps(products, ensure_ascii=False, indent=2) + '\n')
enrichment_file.write_text(json.dumps(enrichment, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'matched': len(scores), 'missing': [p['code'] for p in products if p['code'] not in scores]}, ensure_ascii=False))
