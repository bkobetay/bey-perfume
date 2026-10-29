#!/usr/bin/env python3
"""Explicitly approved encyclopedia fallback references; no fuzzy matching is published."""
import concurrent.futures,csv,io,json,pathlib,urllib.request,importlib.util
SITE=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('official',SITE/'scripts/enrich-catalog.py');official=importlib.util.module_from_spec(spec);spec.loader.exec_module(official)
# Mapping manually checked for the same scent; flankers/concentrations are not substituted.
MATCHES={'SW-057':'Goddess Burberry','SW-061':'Prada Paradoxe Prada','W-024':'Bright Crystal Versace','W-027':'Acqua di Gioia Giorgio Armani','W-029':'Si Giorgio Armani','W-031':'La Vie Est Belle Lancôme','W-041':'Good Girl Carolina Herrera','W-046':'Good Girl Gone Bad By Kilian','W-048':'Blanche Byredo','W-052':'Black Opium Yves Saint Laurent','F-002':'Allure Homme Sport Chanel','F-003':'Bleu de Chanel Chanel','F-005':'Versace Man Eau Fraiche Versace','F-007':'Sauvage Dior','F-015':'Invictus Rabanne','F-018':'Acqua di Gio Giorgio Armani','F-021':'Luna Rossa Ocean Prada','SF-035':'Le Male Elixir Jean Paul Gaultier','SF-042':'Eros Versace','SU-081':'Tilia Marc-Antoine Barrois','SU-086':'Smoking Hot By Kilian','SU-091':'Another 13 Le Labo','U-024':'Megamare Orto Parisi','U-035':'Kirke Tiziana Terenzi','U-045':'Ganymede Marc-Antoine Barrois','U-012':"Bal d'Afrique Byredo",'U-017':'Gentle Fluidity Gold Maison Francis Kurkdjian'}
TRANSLATIONS={'Bergamot':'Бергамот','Mandarin Orange':'Мандарин','Orange':'Апельсин','Lemon':'Лимон','Vanilla':'Ваниль','Madagascar Vanilla':'Мадагаскарская ваниль','Vanilla Absolute':'Абсолют ванили','Lavender':'Лаванда','Jasmine':'Жасмин','Rose':'Роза','Musk':'Мускус','White Musk':'Белый мускус','Patchouli':'Пачули','Sandalwood':'Сандал','Cedar':'Кедр','Virginia Cedar':'Виргинский кедр','Vetiver':'Ветивер','Ambroxan':'Ambroxan','Iso E Super':'Iso E Super','Amber':'Амбра','Ambergris':'Серая амбра','Tonka Bean':'Бобы тонка','Orange Blossom':'Цветок апельсина','Tuberose':'Тубероза','Coffee':'Кофе','Dark Coffee':'Кофе','Black Currant':'Чёрная смородина','Blackcurrant':'Чёрная смородина','Pear':'Груша','Apple':'Яблоко','Pineapple':'Ананас','Peach':'Персик','Passionfruit':'Маракуйя','Passion Fruit':'Маракуйя','Peony':'Пион','Yuzu':'Юдзу','Water Notes':'Водные ноты','Sea Notes':'Морские ноты','Seaweed':'Водоросли','Calone':'Калон','Pink Pepper':'Розовый перец','Black Pepper':'Чёрный перец','Pepper':'Перец','Cinnamon':'Корица','Cardamom':'Кардамон','Ginger':'Имбирь','Aldehydes':'Альдегиды','Neroli':'Нероли','Grapefruit':'Грейпфрут','Grapefruit blossom':'Цветок грейпфрута','Cashmeran':'Кашмеран','Cashmere Wood':'Кашемировое дерево','Cashmere Musk':'Кашемировый мускус','Oakmoss':'Дубовый мох','Orris':'Ирис','Iris':'Ирис','Orris Root':'Корень ириса','Violet':'Фиалка','Violet Leaf':'Лист фиалки','White Flowers':'Белые цветы','Lime':'Лайм','Mint':'Мята','Geranium':'Герань','Clary Sage':'Мускатный шалфей','Sage':'Шалфей','Cypress':'Кипарис','Rosemary':'Розмарин','Hedione':'Гедион','Hedion':'Гедион','Leather':'Кожа','Tobacco':'Табак','Rum':'Ром','Saffron':'Шафран','Akigalawood':'Akigalawood','Immortelle':'Бессмертник','Ambrette (Musk Mallow)':'Амбретта','Ambrette':'Амбретта','Davana':'Давана','Cocoa':'Какао','Magnolia':'Магнолия','Lotus':'Лотос','Dew Drop':'Капля росы','Raspberry':'Малина','Incense':'Ладан','Olibanum':'Олибанум','Suede':'Замша','Salt':'Соль','Angelica':'Дягиль','Coconut':'Кокос','Honey':'Мёд','Guaiac Wood':'Гваяковое дерево','Opoponax':'Опопонакс','Ylang-Ylang':'Иланг-иланг','Caramel':'Карамель','Osmanthus':'Османтус','Narcissus':'Нарцисс','Freesia':'Фрезия'}
def main():
 cache=pathlib.Path('/tmp/arafan-perfume-metadata.csv')
 if not cache.exists():cache.write_bytes(urllib.request.urlopen('https://huggingface.co/datasets/MrBob23/perfume-description/resolve/main/perfume_metadata.csv',timeout=30).read())
 rows={r['title']:r for r in csv.DictReader(io.StringIO(cache.read_text()))}
 file=SITE/'data/products.json';products=json.loads(file.read_text())
 tasks=[(p,rows[MATCHES[p['code']]]) for p in products if p.get('code') in MATCHES and not p.get('image')]
 manifest=json.loads((SITE/'scripts/catalog-photo-sources.json').read_text())
 for entry in manifest:
  product=next((p for p in products if p.get('code')==entry['code']),None)
  if not product or product.get('image'):continue
  notes=entry.get('notesEn',[])+['','','']
  tasks.append((product,{'title':entry['title'],'url':entry['source'],'image_url':entry['image'],'top_notes':notes[0],'middle_notes':notes[1],'base_notes':notes[2],'officialSource':entry.get('officialSource')}))
 def process(task):
  p,r=task
  try:
   filename,url=official.get_image(r['image_url'],SITE/'dist/assets/products'/p['id'])
   notes=[]
   for field in ['top_notes','middle_notes','base_notes']:
    for value in r[field].split(', '):
     if value in TRANSLATIONS and TRANSLATIONS[value] not in notes:notes.append(TRANSLATIONS[value]);break
   p.update(image=filename,imageSource=url,referenceSource=r['url'],notesSource=r['url'],referenceName=r['title'],referenceImage=True,matchStatus='encyclopedia-direction-reference',notes=' · '.join(notes))
   if r.get('officialSource'):p['officialSource']=r['officialSource']
   p['description']='Направление '+p['originalName'].replace(' ОРИГ','')+'.'+(' Ориентиры композиции: '+', '.join(notes).lower()+'.' if notes else '')
   return p['code'],'ok'
  except Exception as e:return p['code'],str(e)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for result in pool.map(process,tasks):print(*result,flush=True)
 file.write_text(json.dumps(products,ensure_ascii=False,indent=2)+'\n')
 print('photo-covered',sum(bool(p.get('image')) for p in products),'of',len(products))
if __name__=='__main__':main()
