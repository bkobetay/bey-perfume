#!/usr/bin/env python3
"""Download approved official reference images. No inferred/fuzzy product matching.
Feed files are explicitly selected official brand responses; source URLs persist on items.
The supplier's razliv is described as a direction, never claimed to be a branded original.
"""
import concurrent.futures,json,pathlib,urllib.request
SITE=pathlib.Path(__file__).resolve().parents[1]
FEEDS=pathlib.Path('/tmp/arafan-official-feeds')
# SKU: official domain, exact product handle, independently checked Russian notes.
APPROVED={
 'U-040':('www.tomfordbeauty.com','lost-cherry-eau-de-parfum','Чёрная вишня · горький миндаль · сандал',['oriental','woody']),
 'SU-067':('hormoneparis.com','this-is-not-gaba','Маракуйя · жасмин · амбровые ноты',['fresh','floral','oriental']),
 'SU-089':('hormoneparis.com','this-is-not-caffeine','Кофе · корица · кедр',['oriental','spicy','woody']),
 'SW-056':('www.kajalperfumes.com','almaz-by-kajal','Бергамот · чёрная смородина · ваниль',['fresh','floral','oriental']),
 'SW-069':('us.parfums-de-marly.com','valaya','Мандарин · белые цветы · мускус',['fresh','floral']),
 'W-051':('us.parfums-de-marly.com','delina','Личи · дамасская роза · мускус',['floral']),
 'SU-002':('us.parfums-de-marly.com','althair','Ваниль · пралине · цветок апельсина',['oriental','floral']),
 'SU-090':('us.parfums-de-marly.com','layton','Яблоко · лаванда · пачули',['fresh','woody']),
 'SW-072':('www.memoparis.com','marfa-eau-de-parfum-75ml','Тубероза',['floral']),
 'SW-074':('us.juliettehasagun.com','not-a-perfume-superdose','Cetalox',['woody','oriental']),
 'SU-004':('www.essentialparfums.com','bois-imperial-eau-de-parfum-vaporisateur-rechargeable-100-ml','Базилик · ветивер · Akigalawood',['woody','spicy']),
 'SU-058':('www.boadiceaperfume.com','hanuman','Лимон · чёрная смородина · ветивер',['fresh','woody','floral']),
 'SU-060':('www.clivechristian.com','jump-up-and-kiss-me-hedonistic','Мате · жасмин · табак',['woody','oriental']),
 'SU-063':('www.tomfordbeauty.com','oud-wood-eau-de-parfum','Кардамон · уд · сандал',['woody','spicy']),
 'SU-066':('www.xerjoff.com-page2','naxos-eau-de-parfum','',['oriental']),
 'SU-068':('maisoncrivelli.com','hibiscus-mahajad','Гибискус · роза · ваниль',['floral','oriental']),
 'SU-070':('initioparfums.com','rehab','Бергамот · лаванда · сандал',['fresh','woody']),
 'SU-071':('www.tomfordbeauty.com','black-orchid-eau-de-parfum','Иланг-иланг · орхидея · пачули',['floral','oriental']),
 'SU-072':('www.xerjoff.com-page2','torino21-eau-de-parfum','',['fresh']),
 'SU-074':('www.clivechristian.com','art-deco-blonde-amber-1','Горький апельсин · табак · бобы тонка',['oriental','woody']),
 'SU-075':('initioparfums.com','side-effect','Табак · ваниль · ром',['oriental','spicy']),
 'SU-080':('www.amouage.com','interlude-man-100ml','Орегано · ладан · уд',['woody','spicy']),
 'SU-084':('maisoncrivelli.com','safran-secret','Шафран · древесные ноты',['spicy','woody']),
 'SU-085':('www.xerjoff.com-page2','erba-pura-eau-de-parfum','',[]),
 'SU-093':('www.kajalperfumes.com','dahab-by-kajal','Яблоко · маракуйя · кедр',['fresh','woody']),
 'U-018':('www.tomfordbeauty.com','tobacco-vanille-eau-de-parfum','Бобы тонка · ваниль · какао',['oriental','woody']),
 'U-022':('initioparfums.com','oud-for-greatness','Уд · лаванда · шафран',['woody','spicy']),
 'U-042':('www.vilhelmparfumerie.com','mango-skin-50-ml','Манго · ежевика · ваниль',['floral','oriental']),
 'U-052':('maisoncrivelli.com','oud-maracuja','Маракуйя · уд',['fresh','woody']),
 'U-053':('www.amouage.com','100ml-guidance','Роза · ладан · амбра',['floral','oriental']),
 'U-001':('www.escentric.com','molecule-01','Iso E Super',['woody']),
 'U-002':('www.escentric.com','molecule-01-mandarin','Iso E Super · мандарин',['fresh','woody']),
 'U-003':('www.nasomatto.com','black-afgano','',[]),
 'U-019':('www.tomfordbeauty.com','bitter-peach-eau-de-parfum','Персик · красный апельсин · пачули',['oriental','fresh']),
 'U-020':('www.tomfordbeauty.com','ombre-leather-parfum','Кожа · лист фиалки · кедр',['leather','woody']),
 'U-037':('www.escentric.com','molecule-2','Ambroxan',['fresh']),
 'SF-043':('www.rojaparfums.com','isola-blu','',[]),
}

def get_image(url,target):
 if url.startswith('//'):url='https:'+url
 request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(request,timeout=30) as response:
  data=response.read();content=response.headers.get('Content-Type','').split(';')[0]
 if not content.startswith('image/') or len(data)<1000:raise ValueError('Response is not a product image')
 ext={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif'}.get(content)
 if not ext:raise ValueError('Unsupported photo format: '+content)
 path=target.with_suffix(ext);path.write_bytes(data);return path.name,url

def main():
 file=SITE/'data/products.json';products=json.loads(file.read_text());assets=SITE/'dist/assets/products';assets.mkdir(parents=True,exist_ok=True)
 feeds={};updates=[]
 for p in products:
  if p.get('type')!='razliv' or p.get('code') not in APPROVED:continue
  domain,handle,notes,categories=APPROVED[p['code']]
  if domain not in feeds:
   cache=FEEDS/(domain+'.json')
   if not cache.exists():
    FEEDS.mkdir(parents=True,exist_ok=True)
    url='https://'+domain.replace('-page2','')+'/products.json?limit=250'+('&page=2' if domain.endswith('-page2') else '')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as response:cache.write_bytes(response.read())
   feeds[domain]=json.loads(cache.read_text())['products']
  exact=[q for q in feeds[domain] if q['handle']==handle]
  if len(exact)!=1:raise ValueError('Official product missing: '+domain+'/'+handle)
  q=exact[0];image=q['images'][0]['src'];source='https://'+domain.replace('-page2','')+'/products/'+handle
  updates.append((p,q,image,source,notes,categories))
 def process(update):
  p,q,image,source,notes,categories=update
  try:
   if p.get('image') and p.get('imageSource')==image and (assets/p['image']).exists():filename,url=p['image'],image
   else:filename,url=get_image(image,assets/p['id'])
   note_source=source if notes else p.get('notesSource',source)
   notes=notes or p.get('notes','')
   p.update(image=filename,referenceImage=True,referenceName=q['title'],referenceSource=source,imageSource=url,notesSource=note_source,notes=notes,categories=categories or p.get('categories',[]),matchStatus='official-direction-reference')
   text=f'Направление {p["source"].get("ownerConfirmedName",p["originalName"]).replace(" ОРИГ", "")}.'
   if notes:text+=' Ориентиры композиции: '+notes.lower().replace(' · ', ', ')+'.'
   p['description']=text
   return p['code'],'ok'
  except Exception as error:return p['code'],str(error)
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  for result in pool.map(process,updates):print(*result,flush=True)
 # Explicit reuse of verified names already represented by existing local catalog photos.
 reuse={'SW-058':'libre','W-010':'jadore','W-018':'chance-eau-tendre','F-028':'aventus','SU-003':'hacivat','SU-057':'symphony','SU-061':'black-phantom','SU-083':'vetiver'}
 existing={p['id']:p for p in products if p.get('type')!='razliv'}
 for p in products:
  if p.get('type')=='razliv' and p.get('code') in reuse and not p.get('image'):
   original=existing[reuse[p['code']]]
   p.update(image=original['image'],notes=original.get('notes',''),categories=original.get('categories',[]),referenceImage=True,referenceName=original['brand']+' '+original['name'],matchStatus='existing-catalog-direction-reference',referenceSource='Existing catalog asset: '+original['id'])
   p['description']='Направление '+p['originalName']+'.'+(' Ориентиры композиции: '+p['notes'].lower().replace(' · ', ', ')+'.' if p['notes'] else '')
 file.write_text(json.dumps(products,ensure_ascii=False,indent=2)+'\n')
 print('photo-covered',sum(bool(p.get('image')) for p in products if p.get('type')=='razliv'))
if __name__=='__main__':main()
