(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('world'), ctx=canvas.getContext('2d');
const geography=window.SAULE_MAP;
const W=geography.width,H=geography.height, keys=new Set(),held=new Set();
const map=new Image(),sprite=new Image();map.src='assets/golden-square-map.png';sprite.src='assets/saule-walk.png';
const initialStars=geography.stars;
const places=geography.landmarks;
let mode='intro',freeplay=false,stars=[],visits=new Set(),player,particles=[],clock=0,last=0,cw=0,ch=0,dpr=1,camera={x:geography.start[0],y:geography.start[1]},toastTimer;
const backgroundAudio=$('background-audio');backgroundAudio.volume=.35;
let musicEnabled=true;
function playMusic(){if(musicEnabled&&backgroundAudio.getAttribute('src'))backgroundAudio.play().catch(()=>{if(musicEnabled&&mode==='playing')notify('Нажми ♪, чтобы включить музыку.');});}
function reset(){player={x:geography.start[0],y:geography.start[1],energy:100,moving:false,running:false,face:1,steps:0};stars=initialStars.map(([x,y],i)=>({x,y,i,taken:false}));visits.clear();particles=[];freeplay=false;clock=0;camera={x:geography.start[0],y:geography.start[1]};keys.clear();held.clear();updateUI()}
function state(){return{mode,stars:stars.filter(s=>s.taken).length,totalStars:12,visited:places.filter(p=>visits.has(p.id)).map(p=>p.name),position:{x:Math.round(player.x),y:Math.round(player.y),latitude:+(geography.bounds.north-player.y/geography.projection.unitsPerLatitudeDegree).toFixed(6),longitude:+(geography.bounds.west+player.x/(geography.projection.unitsPerLatitudeDegree*geography.projection.longitudeCorrection)).toFixed(6)},energy:Math.round(player.energy),freeplay}}
function updateUI(){const n=stars.filter(s=>s.taken).length;$('score').textContent=n;$('objective').textContent=n<12?'Собери звёздочки по пути':visits.size<3?'Загляни во все три места':'Отличный день в Алматы!';for(const p of places)$(`place-${p.id}`).classList.toggle('visited',visits.has(p.id));$('energy').style.width=player.energy+'%'}
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000)}
function clearInput(){keys.clear();held.clear();for(const b of document.querySelectorAll('.held'))b.classList.remove('held')}
function setMode(next){mode=next;clearInput();$('intro').hidden=mode!=='intro';$('paused').hidden=mode!=='paused';$('complete').hidden=mode!=='complete';$('pause').textContent=mode==='paused'?'▷':'Ⅱ';$('pause').setAttribute('aria-label',mode==='paused'?'Продолжить прогулку':'Поставить на паузу');if(mode==='playing'){playMusic();canvas.focus({preventScroll:true});}else if(mode==='paused'){backgroundAudio.pause();$('resume').focus({preventScroll:true});}else if(mode==='complete')$('freeplay').focus({preventScroll:true})}
function start(){setMode('playing');notify('Сәлем! Пойдём гулять по Алматы.');return state()}
function pause(){if(mode==='playing')setMode('paused');else if(mode==='paused')setMode('playing');return state()}
function restart(){reset();setMode('playing');return state()}
// Spatial buckets keep collision checks local to the player's real building block.
const blockGrid=new Map();
for(const building of geography.buildings){
 const xs=building.points.map(p=>p[0]),ys=building.points.map(p=>p[1]);
 for(let gx=Math.floor(Math.min(...xs)/100);gx<=Math.floor(Math.max(...xs)/100);gx++)for(let gy=Math.floor(Math.min(...ys)/100);gy<=Math.floor(Math.max(...ys)/100);gy++){
  const key=gx+','+gy;const list=blockGrid.get(key)||[];list.push(building.points);blockGrid.set(key,list);
 }
}
function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
 const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
}return inside;}
function walkable(x,y){
 if(x<20||x>W-20||y<20||y>H-20)return false;
 // Stay on the Medeu side of Nazarbayev Avenue, including its pedestrian sidewalks.
 const lat=geography.bounds.north-y/geography.projection.unitsPerLatitudeDegree;
 const borderLon=76.9483395-(lat-43.2424111)*0.129;
 const borderX=(borderLon-geography.bounds.west)*geography.projection.unitsPerLatitudeDegree*geography.projection.longitudeCorrection;
 if(x<borderX-22)return false;
 for(const [dx,dy] of [[0,0],[6,0],[-6,0],[0,6],[0,-6]])for(const poly of blockGrid.get(Math.floor((x+dx)/100)+','+Math.floor((y+dy)/100))||[]){if(insidePolygon(x+dx,y+dy,poly))return false;}
 return !geography.areas.some(a=>a.kind==='water'&&insidePolygon(x,y,a.points));
}
function distanceToStreet(x,y,street){let nearest=Infinity;for(let i=1;i<street.points.length;i++){
 const [ax,ay]=street.points[i-1],[bx,by]=street.points[i];const dx=bx-ax,dy=by-ay;
 const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
 nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,y-ay-t*dy));
}return nearest;}
const namedStreets=geography.streets.filter(s=>s.name&&['residential','secondary','tertiary','pedestrian','footway'].includes(s.kind));
let streetClock=0,streetName='Тулебаева · Кабанбай батыра';
function move(dt){const active=k=>keys.has(k)||held.has(k);let dx=(active('right')?1:0)-(active('left')?1:0),dy=(active('down')?1:0)-(active('up')?1:0);const moving=!!(dx||dy);player.moving=moving;player.running=moving&&active('run')&&player.energy>2;if(moving){const norm=Math.hypot(dx,dy);dx/=norm;dy/=norm;const speed=player.running?275:145;const x=player.x+dx*speed*dt,y=player.y+dy*speed*dt;if(walkable(x,player.y))player.x=x;if(walkable(player.x,y))player.y=y;if(dx)player.face=dx<0?-1:1;player.steps+=dt*(player.running?11:7)}player.energy=Math.max(0,Math.min(100,player.energy+(player.running?-19:14)*dt));$('energy').style.width=player.energy+'%';
 for(const s of stars){if(!s.taken&&Math.hypot(s.x-player.x,s.y-player.y)<38){s.taken=true;burst(s.x,s.y,'#f7c94d');updateUI()}}
 streetClock+=dt;if(streetClock>.4){streetClock=0;let nearest=Infinity;for(const street of namedStreets){const d=distanceToStreet(player.x,player.y,street);if(d<nearest){nearest=d;streetName=street.name.replace('улица ','').replace('проспект ','пр. ').replace('Мукана ','');}}}
 let near=streetName;for(const p of places){const dist=Math.hypot(p.x-player.x,p.y-player.y);if(dist<200)near=p.name;if(dist<55&&!visits.has(p.id)){visits.add(p.id);notify(p.message);burst(p.x,p.y,'#b798e3');updateUI()}}
 $('district').textContent=near;
 if(!freeplay&&visits.size===3&&stars.every(s=>s.taken)){setMode('complete');}
}
function burst(x,y,color){for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*160,vy:(Math.random()-.6)*160,life:.7,color})}
function resize(){const r=canvas.getBoundingClientRect();cw=r.width;ch=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr)}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function round(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawStar(x,y,size,alpha=1){ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;ctx.shadowColor='#ffe079';ctx.shadowBlur=13;ctx.fillStyle='#ffcf49';ctx.strokeStyle='#b07826';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.46:size;const xx=Math.cos(a)*r,yy=Math.sin(a)*r;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function draw(dt){if(!cw)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#e9eadf';ctx.fillRect(0,0,cw,ch);const scale=cw<700?.85:1;const vw=cw/scale,vh=ch/scale;const tx=clamp(player.x,vw/2-110/scale,W-vw/2+110/scale),ty=clamp(player.y,vh/2-200/scale,H-vh/2+100/scale);camera.x+=(tx-camera.x)*Math.min(1,dt*9);camera.y+=(ty-camera.y)*Math.min(1,dt*9);const ox=cw/2-camera.x*scale,oy=ch/2-camera.y*scale;ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.fillStyle='#e9d8aa';ctx.fillRect(0,0,W,H);if(map.complete&&map.naturalWidth)ctx.drawImage(map,0,0,W,H);
 for(const s of stars)if(!s.taken)drawStar(s.x,s.y+Math.sin(clock*3+s.i)*4,17);
 for(const p of places){ctx.save();const visited=visits.has(p.id);ctx.fillStyle=visited?'#244b3aed':'#fffaebf5';ctx.strokeStyle=visited?'#f4c64e':'#7f9b66';ctx.lineWidth=2;round(p.x-83,p.y-56,166,34,12);ctx.fill();ctx.stroke();ctx.fillStyle=visited?'#fff8e8':'#34452d';ctx.font='600 14px Manrope, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((visited?'✓ ':p.icon+' ')+p.short,p.x,p.y-39);ctx.beginPath();ctx.arc(p.x,p.y,23+Math.sin(clock*2)*2,0,Math.PI*2);ctx.strokeStyle=visited?'#f4c64e88':'#af8dceaa';ctx.lineWidth=3;ctx.stroke();ctx.restore()}
 for(const p of particles){ctx.globalAlpha=p.life/.7;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 // Keep Saule's visible height consistent across desktop and phone viewports.
 const spriteHeight=(cw<700?146:156)/scale,spriteWidth=spriteHeight*(sprite.naturalWidth/4)/(sprite.naturalHeight||756);
 ctx.fillStyle='#26382640';ctx.beginPath();ctx.ellipse(player.x,player.y+3,25/scale,8/scale,0,0,Math.PI*2);ctx.fill();
 if(sprite.complete&&sprite.naturalWidth){const sw=sprite.naturalWidth/4,frame=player.moving?Math.floor(player.steps)%4:1;ctx.save();ctx.translate(player.x,player.y);ctx.scale(player.face,1);const bob=player.moving?Math.sin(player.steps*Math.PI)*2:0;
 ctx.shadowColor='#fff9e9';ctx.shadowBlur=5/scale;ctx.drawImage(sprite,frame*sw,0,sw,sprite.naturalHeight,-spriteWidth/2,-spriteHeight+8/scale+bob,spriteWidth,spriteHeight);ctx.restore();}
 ctx.restore();drawMiniMap();drawNameTag(ox+player.x*scale,oy+player.y*scale,oy+player.y*scale-spriteHeight*scale);
}
function drawNameTag(x,feetY,headY){
 ctx.save();ctx.font='600 14px Manrope, sans-serif';const width=ctx.measureText('Сауле').width+24,height=27;
 const left=clamp(x-width/2,10,cw-width-10);let top=feetY+13;if(top+height>ch-28)top=headY-height-8;top=clamp(top,12,ch-height-28);
 ctx.shadowColor='#17362340';ctx.shadowBlur=8;ctx.shadowOffsetY=3;ctx.fillStyle='#173d2df5';ctx.strokeStyle='#e5ce8599';ctx.lineWidth=1;round(left,top,width,height,13);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#fff7dc';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Сауле',left+width/2,top+height/2+.5);ctx.restore();
}
function drawMiniMap(){if(cw<300||mode!=='playing')return;const mw=cw<500?112:142,mh=cw<500?110:144,x=cw-mw-16,y=ch-mh-32;ctx.save();ctx.fillStyle='#fff9e9e8';ctx.strokeStyle='#79955e55';ctx.lineWidth=1;round(x,y,mw,mh,14);ctx.fill();ctx.stroke();const mx=x+10,my=y+10,sx=(mw-20)/W,sy=(mh-20)/H;ctx.strokeStyle='#aab58e';ctx.lineWidth=1.4;ctx.beginPath();for(const street of geography.streets){if(!['secondary','tertiary','residential','pedestrian'].includes(street.kind))continue;street.points.forEach(([px,py],i)=>i?ctx.lineTo(mx+px*sx,my+py*sy):ctx.moveTo(mx+px*sx,my+py*sy));}ctx.stroke();for(const s of stars)if(!s.taken){ctx.fillStyle='#b98122';ctx.beginPath();ctx.arc(mx+s.x*sx,my+s.y*sy,2.5,0,7);ctx.fill()}for(const p of places){ctx.fillStyle=visits.has(p.id)?'#476a3c':'#a27ec2';ctx.beginPath();ctx.arc(mx+p.x*sx,my+p.y*sy,3,0,7);ctx.fill()}ctx.fillStyle='#7853a5';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mx+player.x*sx,my+player.y*sy,4,0,7);ctx.fill();ctx.stroke();ctx.restore()}
function frame(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if(mode==='playing'){clock+=dt;move(dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}particles=particles.filter(p=>p.life>0)}draw(dt);requestAnimationFrame(frame)}
const mapping={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'run',ShiftRight:'run',Space:'run'};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat){if(mode==='playing'||mode==='paused')pause();return}const k=mapping[e.code];if(k&&mode==='playing'){e.preventDefault();keys.add(k)}});window.addEventListener('keyup',e=>{const k=mapping[e.code];if(k){keys.delete(k);if(mode==='playing')e.preventDefault()}});window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')setMode('paused')});
for(const b of document.querySelectorAll('[data-direction],#run')){const dir=b.dataset.direction||'run';b.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);held.add(dir);b.classList.add('held')});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{held.delete(dir);b.classList.remove('held')});b.addEventListener('contextmenu',e=>e.preventDefault())}
$('start').onclick=start;$('resume').onclick=()=>setMode('playing');$('pause').onclick=pause;$('restart').onclick=restart;$('again').onclick=restart;$('freeplay').onclick=()=>{freeplay=true;setMode('playing');notify('Гуляй сколько хочется.')} ;
$('sound').onclick=()=>{if(!backgroundAudio.getAttribute('src'))return;musicEnabled=!musicEnabled;$('sound').setAttribute('aria-pressed',String(musicEnabled));$('sound').setAttribute('aria-label',musicEnabled?'Выключить музыку':'Включить музыку');$('sound').textContent=musicEnabled?'♪':'♫';$('sound').style.background=musicEnabled?'#547247':'';if(musicEnabled&&mode==='playing')playMusic();else backgroundAudio.pause();if(mode==='playing')canvas.focus({preventScroll:true});};
$('sound').disabled=!backgroundAudio.getAttribute('src');
window.addEventListener('pagehide',()=>backgroundAudio.pause());
new ResizeObserver(resize).observe(canvas);reset();resize();requestAnimationFrame(frame);
window.sauleGame=Object.freeze({getState:state,start,pause,restart});
const mc=document.modelContext;if(mc?.registerTool){const life=new AbortController();const tools=[{name:'read_saule_walk',description:'Read Saule’s current position, collected stars, visited places and game mode.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>state()},{name:'start_saule_walk',description:'Start the walk from the introduction or resume a paused walk.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>{if(mode==='intro')return start();if(mode==='paused')setMode('playing');return state()}},{name:'walk_saule',description:'Move Saule through the same walkable paths as keyboard controls. Requires the game to be playing.',inputSchema:{type:'object',properties:{direction:{type:'string',enum:['up','down','left','right']},seconds:{type:'number',minimum:.1,maximum:3},run:{type:'boolean'}},required:['direction','seconds'],additionalProperties:false},async execute(input){if(!input||!['up','down','left','right'].includes(input.direction)||!Number.isFinite(input.seconds)||input.seconds<.1||input.seconds>3||input.run!==undefined&&typeof input.run!=='boolean')throw Error('Use a valid direction, seconds between 0.1 and 3, and optional boolean run.');if(mode!=='playing')throw Error('Start or resume the walk first.');held.add(input.direction);if(input.run)held.add('run');await new Promise(resolve=>setTimeout(resolve,input.seconds*1000));held.delete(input.direction);if(input.run)held.delete('run');return state()}}];for(const tool of tools){try{Promise.resolve(mc.registerTool({...tool,annotations:{readOnlyHint:false,untrustedContentHint:false,...tool.annotations}},{signal:life.signal})).catch(()=>{})}catch{}}window.addEventListener('pagehide',()=>life.abort(),{once:true})}
})();
