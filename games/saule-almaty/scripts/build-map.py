"""Render a geographic game map from an Overpass snapshot, without inventing geography.
Usage: python3 build-map.py /path/to/osm.json
Requires Pillow. Map-derived data is licensed ODbL 1.0.
"""
from pathlib import Path
import json, math, sys
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]; ASSETS=ROOT/'dist'/'assets'
S,WEST,N,E=43.2418,76.9461,43.2542,76.9592
FACTOR=220000; COS=math.cos(math.radians((S+N)/2))
WIDTH=round((E-WEST)*FACTOR*COS);HEIGHT=round((N-S)*FACTOR)
raw=json.load(open(sys.argv[1])); source=raw['elements']
def project(lat,lon):return [round((lon-WEST)*FACTOR*COS,2),round((N-lat)*FACTOR,2)]
def inside(lat,lon):return S<=lat<=N and WEST<=lon<=E
def geoms(e):
 if e['type']=='node':return [project(e['lat'],e['lon'])]
 return [project(p['lat'],p['lon']) for p in e.get('geometry',[])]
def intersects(pts):return pts and min(p[0] for p in pts)<WIDTH and max(p[0] for p in pts)>0 and min(p[1] for p in pts)<HEIGHT and max(p[1] for p in pts)>0
streets=[];buildings=[];areas=[];trees=[];landmarks=[]
for e in source:
 t=e.get('tags',{});pts=geoms(e)
 if not pts:continue
 if e['type']=='node':
  if not inside(e['lat'],e['lon']):continue
  if t.get('natural')=='tree':trees.append(pts[0])
  continue
 if not intersects(pts):continue
 if 'highway' in t and t['highway'] not in ('construction','platform','corridor'):
  streets.append({'id':e['id'],'kind':t['highway'],'name':t.get('name:ru',t.get('name','')),'points':pts})
 if 'building' in t and e['type']=='way' and len(pts)>3:
  buildings.append({'id':e['id'],'points':pts,'name':t.get('name:ru',t.get('name','')),'house':t.get('addr:housenumber',''),'levels':t.get('building:levels',''),'roof':t.get('roof:colour','')})
 if e['type']=='way' and e.get('nodes',[0])[0]==e.get('nodes',[1])[-1] and len(pts)>3:
  kind=t.get('leisure',t.get('landuse',t.get('natural','')))
  if kind in ('park','garden','grass','forest','wood','water','playground','pitch'):
   areas.append({'id':e['id'],'kind':kind,'name':t.get('name:ru',t.get('name','')),'points':pts})
# Landmark coordinates come directly from identified OSM node/polygon features.
poi=[('tsoy',9721566077,'Памятник Виктору Цою','Цой','♪','Здесь, на Тулебаева, стоит памятник Виктору Цою.'),('park',1458336153,'Парк Д. Кунаева','Парк Кунаева','✿','Парк Д. Кунаева — зелёная остановка в центре Алматы.'),('auezov',248868009,'Дом-музей М. Ауэзова','Дом Ауэзова','⌂','Сауле дошла до дома-музея Мухтара Ауэзова.')]
for ident,oid,name,short,icon,message in poi:
 e=next(e for e in source if e['id']==oid);ps=geoms(e);x=sum(p[0] for p in ps)/len(ps);y=sum(p[1] for p in ps)/len(ps)
 # Game visitation is at the public walkway nearest the real feature, not inside its building.
 target=(x,y);best=(float('inf'),x,y)
 for road in streets:
  if road['kind'] not in ('footway','pedestrian','path','residential','tertiary','service'):continue
  for a,b in zip(road['points'],road['points'][1:]):
   dx,dy=b[0]-a[0],b[1]-a[1];l=dx*dx+dy*dy
   u=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/l)) if l else 0
   px,py=a[0]+u*dx,a[1]+u*dy;dist=math.hypot(px-x,py-y)
   if dist<best[0]:best=(dist,px,py)
 landmarks.append({'id':ident,'osmId':oid,'name':name,'short':short,'icon':icon,'message':message,'x':round(best[1],2),'y':round(best[2],2),'feature':target})
# Collectibles are on real, named street segments; choose each target then snap to its street.
stars=[]
stars_geo=[(43.24975,76.94914,'Тулебаева'),(43.2484,76.94934,'Тулебаева'),(43.24665,76.94955,'Тулебаева'),(43.24485,76.94982,'Тулебаева'),(43.24295,76.9501,'Тулебаева'),(43.24485,76.9515,'Курмангазы'),(43.24675,76.9513,'Шевченко'),(43.24835,76.9511,'Жамбыла'),(43.2502,76.951,'Кабанбай'),(43.25182,76.9507,'Карасай'),(43.25175,76.949,'Тулебаева'),(43.2529,76.9491,'Тулебаева')]
for lat,lon,key in stars_geo:
 x,y=project(lat,lon);best=(float('inf'),x,y)
 for road in streets:
  if key not in road['name']:continue
  for a,b in zip(road['points'],road['points'][1:]):
   dx,dy=b[0]-a[0],b[1]-a[1];l=dx*dx+dy*dy;u=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/l)) if l else 0;px,py=a[0]+u*dx,a[1]+u*dy;dist=math.hypot(px-x,py-y)
   if dist<best[0]:best=(dist,px,py)
 stars.append([round(best[1],2),round(best[2],2)])
start=list(stars[0]);start[1]+=55
DATA={'width':WIDTH,'height':HEIGHT,'bounds':{'south':S,'west':WEST,'north':N,'east':E},'projection':{'unitsPerLatitudeDegree':FACTOR,'longitudeCorrection':COS},'source':'© OpenStreetMap contributors','license':'https://opendatacommons.org/licenses/odbl/1-0/','snapshot':raw.get('osm3s',{}).get('timestamp_osm_base','2026-10-09'),'start':start,'stars':stars,'landmarks':landmarks,'streets':streets,'buildings':buildings,'areas':areas,'trees':trees}
(ROOT/'dist'/'map-data.js').write_text('/* © OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright */\nwindow.SAULE_MAP = '+json.dumps(DATA,ensure_ascii=False,separators=(',',':'))+';\n')
# Cartographic rendering: polygons and polylines retain the source geometry.
im=Image.new('RGB',(WIDTH,HEIGHT),'#e9eadf');d=ImageDraw.Draw(im)
font=ImageFont.truetype(str(ASSETS/'manrope-semibold.ttf'),22);small=ImageFont.truetype(str(ASSETS/'manrope-regular.ttf'),16)
for a in areas:
 c={'water':'#a7d0dd','forest':'#8fbc89','wood':'#8fbc89','grass':'#c6d6a4','park':'#bdd29d','garden':'#bdcf9d','pitch':'#b0c5a4','playground':'#e4d5b0'}.get(a['kind'],'#bdd29d');d.polygon([tuple(p) for p in a['points']],fill=c)
widths={'secondary':44,'secondary_link':30,'tertiary':32,'residential':25,'living_street':20,'pedestrian':17,'service':13,'footway':8,'path':7,'cycleway':7,'steps':7,'track':8}
for r in sorted(streets,key=lambda r:widths.get(r['kind'],8)):
 pts=[tuple(p) for p in r['points']];w=widths.get(r['kind'],8);d.line(pts,fill='#b9b6a7',width=w+3,joint='curve');d.line(pts,fill='#fbf9ef' if w>15 else '#f5efdf',width=w,joint='curve')
for b in buildings:
 pts=[tuple(p) for p in b['points']];d.polygon([(x+3,y+5) for x,y in pts],fill='#b8b5a8');color=b['roof'] if b['roof'].startswith('#') and len(b['roof']) in (4,7) else '#d7c2ac';d.polygon(pts,fill=color,outline='#998d7e',width=1)
 # Readable house numbers on adequately large footprints.
 xs=[p[0] for p in pts];ys=[p[1] for p in pts]
 if b['house'] and max(xs)-min(xs)>40 and max(ys)-min(ys)>30:d.text(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2),b['house'],font=small,fill='#615a53',anchor='mm',stroke_width=1,stroke_fill=color)
for x,y in trees:
 d.ellipse((x-5,y-5,x+5,y+5),fill='#82a36f',outline='#6c8c5f')
# Label named streets by arclength so split OSM ways do not generate duplicate labels at junctions.
labelled={}
for r in sorted(streets,key=lambda r: -sum(math.dist(a,b) for a,b in zip(r['points'],r['points'][1:]))):
 if not r['name'] or r['kind'] not in ('secondary','tertiary','residential','pedestrian'):continue
 name=r['name'].replace('улица ','').replace('проспект ','пр. ').replace('Мукана ','');pts=r['points'];length=sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))
 if length<160:continue
 textw=font.getlength(name)
 if length<textw+25:continue
 distances=[length*.5] if length<800 else [length*.25,length*.65]
 for along in distances:
  cumulative=0
  for a,b in zip(pts,pts[1:]):
   seg=math.dist(a,b)
   if cumulative+seg>=along:
    u=(along-cumulative)/seg;x=a[0]+(b[0]-a[0])*u;y=a[1]+(b[1]-a[1])*u;ang=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]));break
   cumulative+=seg
  if not 30<x<WIDTH-30 or not 30<y<HEIGHT-30:continue
  if any(math.hypot(x-px,y-py)<330 for px,py in labelled.get(name,[])):continue
  labelled.setdefault(name,[]).append((x,y))
  if ang>90:ang-=180
  if ang<-90:ang+=180
  layer=Image.new('RGBA',(math.ceil(textw)+16,40));ld=ImageDraw.Draw(layer);ld.text((layer.width/2,20),name,font=font,fill='#46504a',anchor='mm',stroke_width=3,stroke_fill='#fbf9efe8');layer=layer.rotate(-ang,expand=True,resample=Image.Resampling.BICUBIC);im.paste(layer,(round(x-layer.width/2),round(y-layer.height/2)),layer)
im.save(ASSETS/'golden-square-map.png',optimize=True)
print('MAP',WIDTH,HEIGHT,'streets',len(streets),'buildings',len(buildings),'areas',len(areas),'trees',len(trees));print('START',start);print('LANDMARKS',[(p['name'],p['x'],p['y']) for p in landmarks]);print('STAR POSITIONS',stars)
