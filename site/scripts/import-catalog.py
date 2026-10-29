#!/usr/bin/env python3
"""Read source XLSX files without modifying them; retain one retail item per source SKU.
Usage: python3 site/scripts/import-catalog.py [directory containing source workbooks]
Existing enrichment on stable razliv IDs is preserved on reruns.
"""
import collections, hashlib, json, pathlib, re, sys, unicodedata, zipfile
import xml.etree.ElementTree as ET
SITE=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path.home()/'Downloads'
OWNER_NAMES={'U-032':('CREED','Silver Mountain Water'),'U-040':('TOM FORD','Lost Cherry')}
EXCLUDED_CODES={'W-044':'Удалено по указанию владельца после проверки таблиц стойкости и шлейфа','F-029':'По указанию владельца удалена позиция с названием бренда без аромата','W-006':'Удалено по указанию владельца','W-003':'Удалено по указанию владельца','W-045':'Удалено по указанию владельца','W-026':'Удалено по указанию владельца; в источнике отсутствует','W-053':'Удалено по указанию владельца; в источнике отсутствует','U-051':'Повтор: по указанию владельца сохранён SU-079','SU-078':'Повтор: по указанию владельца сохранён U-035'}
FILES={'female':'JENSKIE(2).xlsx','male':'MUJSKIE (3).xlsx','niche':'NISHEVIE (4).xlsx','universal':'UNIVERSALNIE (5).xlsx'}
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
BRANDS=[('Parfums de Marley','PARFUMS DE MARLY'),('Perfum de Marley','PARFUMS DE MARLY'),('Maison Martin Margiela','MAISON MARGIELA'),('Maison Francis Kurkdjian','MAISON FRANCIS KURKDJIAN'),('Marc-Antoine Barrois','MARC-ANTOINE BARROIS'),('Boadicea The Victorious','BOADICEA THE VICTORIOUS'),('Juliette Has a Gun','JULIETTE HAS A GUN'),('Zielinski & Rozen','ZIELINSKI & ROZEN'),('Essentials Parfums','ESSENTIAL PARFUMS'),('Escentric Molecules','ESCENTRIC MOLECULES'),('Victoria s secret',"VICTORIA’S SECRET"),('Christian Richard','CHRISTIAN RICHARD'),('Clive Christian','CLIVE CHRISTIAN'),('Christian Dior','DIOR'),('Yves Saint Laurent','YVES SAINT LAURENT'),('Giorgio Armani','GIORGIO ARMANI'),('Emporio Armani','EMPORIO ARMANI'),('Carolina Herrera','CAROLINA HERRERA'),('Antonio Banderas','ANTONIO BANDERAS'),('Tiziana Teranzi','TIZIANA TERENZI'),('Tiziana Terenzi','TIZIANA TERENZI'),('Attar Collection','ATTAR COLLECTION'),('Masion Crivelli','MAISON CRIVELLI'),('Maison Crivelli','MAISON CRIVELLI'),('GABA HORMONE','HORMONE PARIS'),('Donna Karan','DKNY'),('Paco Rbanne','RABANNE'),('Paco Rabanne','RABANNE'),('Dolce & Gabbana','DOLCE&GABBANA'),('Dolce Gabbana','DOLCE&GABBANA'),('Louis Vuitton','LOUIS VUITTON'),('Vilhelm Parfumerie','VILHELM PARFUMERIE'),('Frank Olivier','FRANCK OLIVIER'),('Thomas Kosmala','THOMAS KOSMALA'),('Al Majed Oud','AL MAJED OUD'),('Arabian Oud','ARABIAN OUD'),('Initio Prives','INITIO'),('Roja Dove','ROJA'),('Hugo Boss','HUGO BOSS'),('Tom Ford','TOM FORD'),('Le Labo','LE LABO'),('Orto Parisi','ORTO PARISI'),('Jo Malone London','JO MALONE LONDON'),('Jo Malone','JO MALONE LONDON'),('JPG','JEAN PAUL GAULTIER'),('YSL','YVES SAINT LAURENT')]
BRANDS +=[(v,v.upper()) for v in ['Burberry','Givenchy','Prada','Moschino','Bvlgari','Kajal','Lattafa','MEMO','Kenzo','Incanto','Dior','Lanvin','Chanel','Lacoste','Versace','Montale','Lancome','Gucci','Shiseido','Escada','Armand Basi','Kilian','Byredo','Nishane','Chloe','Chopard','Xerjoff','Initio','Zielinski','Amouage','Creed','Mancera','AFNAN','Nasomatto','Ex Nihilo','Guerlain','Vertus','ZARKOPERFUME','Roja','Valentino']]
def split_name(raw):
 name=raw.strip()
 if name.casefold()=='devil s intrigue':return 'HAUTE FRAGRANCE COMPANY', 'Devil’s Intrigue'
 if name.casefold().startswith('miss dior '):return 'DIOR',name
 # These two source rows put the house after the fragrance name.
 for exact,brand,title in [('Luna Rossa Ocean Prada','PRADA','Luna Rossa Ocean'),('Gold Knight By Kilian','KILIAN','Gold Knight'),('Legend Montblanc','MONTBLANC','Legend'),('Bleu de Chanel','CHANEL','Bleu de Chanel')]:
  if name.casefold()==exact.casefold():return brand,title
 for prefix,brand in BRANDS:
  if name.casefold().startswith(prefix.casefold()+' '):return brand,name[len(prefix):].strip()
 return '',name

def rows(path):
 with zipfile.ZipFile(path) as z:
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist(): strings=[''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
  workbook=ET.fromstring(z.read('xl/workbook.xml'))
  rels={x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  for sheet in workbook.findall('s:sheets/s:sheet',NS):
   rid=sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'];target=rels[rid]
   target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
   for row in ET.fromstring(z.read(target)).findall('.//s:row',NS):
    values={}
    for c in row.findall('s:c',NS):
     v=c.find('s:v',NS);inline=c.find('s:is',NS)
     text=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else ''
     if c.attrib.get('t')=='s': text=strings[int(text)]
     values[re.sub(r'\d','',c.attrib['r'])]=text
    if any(values.values()):yield sheet.attrib['name'],int(row.attrib['r']),values

def normalized(name):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower())
def main():
 output=SITE/'data/products.json';existing=json.loads(output.read_text()) if output.exists() else [];old={p['id']:p for p in existing};
 enrichment=json.loads((SITE/'scripts/catalog-enrichment.json').read_text()) if (SITE/'scripts/catalog-enrichment.json').exists() else {};kept=[] # Owner explicitly removed all 15 previous demo products without source SKUs.
 imported=[];skipped=[];excluded=[];counts={};seen=set()
 for collection,filename in FILES.items():
  counts[collection]=0
  for sheet,row,cells in rows(SOURCE/filename):
   if row==1 and cells.get('B')=='Наименование':continue
   sku=cells.get('A','').strip();name=cells.get('B','').strip();price=cells.get('D','')
   if not name and not sku:
    skipped.append(f'{filename}, {sheet}!{row}: нет наименования и артикула ({cells})');continue
   if not sku or not name or not price or cells.get('C','').strip()!='мл':raise ValueError(f'Incomplete source row: {filename}:{row}: {cells}')
   if sku in EXCLUDED_CODES:
    excluded.append(f'{filename}, {sheet}!{row}: {sku} — {name}; {EXCLUDED_CODES[sku]}');continue
   if not re.fullmatch(r'\d+',str(price)):raise ValueError(f'Noninteger price: {filename}:{row}: {price}')
   price=int(price);identifier='razliv-'+collection+'-'+re.sub(r'[^a-z0-9]+','-',sku.lower()).strip('-')
   if identifier in seen:raise ValueError(f'Duplicate SKU in collection: {identifier}')
   seen.add(identifier);brand,title=split_name(name)
   title=re.sub(r'\s+ОРИГ\b','',title).strip()
   product={'id':identifier,'code':sku,'type':'raspiv' if sku=='OF-001' else 'razliv','collection':collection,'brand':brand,'name':title,'originalName':name,'pricePerMl':price,'notes':'','description':f'Направление {name.replace(" ОРИГ", "")}. Разлив от 5 мл.','categories':[],'image':None,'featured':False,'referenceImage':False,'variants':[{'ml':ml,'price':ml*price} for ml in [5,10,20,30]],'source':{'file':filename,'sheet':sheet,'row':row,'sku':sku,'priceCell':f'D{row}'}}
   previous={**enrichment.get(identifier,{}),**old.get(identifier,{})}
   for field in ['notes','description','categories','image','referenceImage','referenceName','referenceSource','officialSource','imageSource','notesSource','matchStatus','audience','audienceSource','audienceBasis','brand','name','longevity','sillage','performanceSource','descriptionParagraphs','notePyramid','olfactoryProfile','descriptionSources','contentVersion','notePyramidBasis','keyNotes']:
    if field in previous:product[field]=previous[field]
   if sku in OWNER_NAMES:
    product['brand'],product['name']=OWNER_NAMES[sku]
    product['source']['ownerConfirmedName']=product['brand']+' '+product['name']
    if not product.get('contentVersion'):product['description']='Направление '+product['brand']+' '+product['name']+'.'+(' Ориентиры композиции: '+product['notes'].lower().replace(' · ', ', ')+'.' if product['notes'] else '')
   if not old.get(identifier):
    for field in ['brand','name']:
     if field in enrichment.get(identifier,{}):product[field]=enrichment[identifier][field]
   if sku=='OF-001':
    product['referenceImage']=False
    product['description']=product['description'].replace('Направление ', 'Аромат ',1)
    product['source']['ownerConfirmedType']='raspiv'
   imported.append(product);counts[collection]+=1
 duplicates=collections.defaultdict(list)
 for p in imported:duplicates[normalized(p['originalName'])].append(p)
 duplicate_groups=[v for v in duplicates.values() if len(v)>1]
 conflicts=[group for group in duplicate_groups if len({p['pricePerMl'] for p in group})>1]
 if conflicts:raise ValueError('Price conflicts require owner decision: '+repr([(p['originalName'],p['code'],p['pricePerMl']) for g in conflicts for p in g]))
 output.write_text(json.dumps(kept+imported,ensure_ascii=False,indent=2)+'\n')
 report=SITE.parent/'docs/catalog-import.md';report.parent.mkdir(exist_ok=True)
 lines=['# Импорт каталога из Excel','','Все цены импортированы как целые KZT за 1 мл. Исходные файлы не изменялись. Один SKU даёт одну товарную карточку. Одинаковые названия не объединяются.','','| Группа | Файл | Товаров |','| --- | --- | --- |']
 lines +=[f'| {c} | {f} | {counts[c]} |' for c,f in FILES.items()]
 lines +=['',f'Импортировано {len(imported)} позиций: 189 разлива и OF-001 на распив по подтверждению владельца. Прежние 15 демопозиций исключены. Всего {len(kept)+len(imported)}.','', '## Идентификаторы и значения','','`id = razliv-{collection}-{sku}`. Поле `code` сохраняет исходный артикул (без крайних пробелов), включая SW/SF/SU/W/F/U/OF. `originalName` сохраняет исходное написание. `type=razliv`, кроме подтверждённого владельцем OF-001 (`raspiv`); группа отдельно в `collection`. Цена объёмов 5/10/20/30 мл равна `pricePerMl × ml`. Никакой цены из другой карточки или группы не подставляется.','','## Повторы и вопросы','','Оставшиеся точные повторы (разные SKU не объединяются без указания владельца):']
 if not duplicate_groups:lines +=['Не обнаружены.']
 lines +=['- '+', '.join(f"{p['code']} ({p['originalName']}, {p['pricePerMl']} KZT/мл)" for p in group) for group in duplicate_groups]
 lines +=['','Исключено по прямому указанию владельца после проверки повторов:']+['- '+x for x in excluded]+['- W-026 и W-053 запрошены к удалению, но отсутствуют во всех исходных файлах.','- Все 15 прежних демонстрационных товаров без исходных артикулов удалены из каталога. Файлы фотографий сохранены для подтверждённых ссылок новых карточек.']
 lines +=['','Конфликтов цен для точных нормализованных совпадений не найдено. Возможные синонимы и неполные названия не объединялись. Владелец подтвердил OF-001 как оригинал на распив: позиция перенесена в раздел «Распив», исходный код, идентификатор и цена сохранены.','','## Пропущенные служебные ячейки','']+['- '+x for x in skipped]
 lines +=['','## Уточнения владельца\n\nU-032: Creed Silver → Creed Silver Mountain Water. U-040: Tom Ford Cherry → Tom Ford Lost Cherry. В originalName сохранён текст Excel, подтверждённое имя показано в name и source.ownerConfirmedName. F-029 «Antonio Banderas» удалён.\n\n## Фото и описания','','Фото брендовых флаконов — иллюстрации направления аромата, а не фотография продаваемого товара разлива. Подтверждённая страница записывается в referenceSource/notesSource, URL фото в imageSource. Неподтверждённым названиям не назначаются чужие фото или выдуманные ноты. Пустое image даёт нейтральное оформление карточки.','','## Воспроизведение','','`python3 site/scripts/import-catalog.py /путь/к/исходным/xlsx` повторно читает все листы, проверяет строки и цены, сохраняет подтверждённое обогащение по стабильному id. Исходные XLSX не входят в публичную сборку.']
 covered=sum(bool(p.get('image')) for p in imported)
 lines +=['','## Проверка покрытия','',f'Фотографии: {covered} из {len(imported)} карточек. Описания с проверенными нотами: {sum(bool(p.get("notes")) and bool(p.get("notesSource")) for p in imported)} из {len(imported)}. Неоднозначные позиции не сопоставляются автоматически.']
 lines +=['- '+p['code']+' — '+p['originalName'] for p in imported if not p.get('image')]
 report.write_text('\n'.join(lines)+'\n')
 print(json.dumps({'counts':counts,'imported':len(imported),'preserved':len(kept),'total':len(kept)+len(imported),'duplicateGroups':[[p['code'] for p in g] for g in duplicate_groups]},ensure_ascii=False))
if __name__=='__main__':main()
