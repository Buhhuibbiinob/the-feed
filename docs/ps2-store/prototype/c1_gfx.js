/* ===== renderer: low-res target + dither/posterize post pass (PS2-ish) ===== */
const canvas=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);
let RW=480,RH=270;
const rt=new THREE.WebGLRenderTarget(RW,RH,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
const post={scene:new THREE.Scene(),cam:new THREE.OrthographicCamera(-1,1,1,-1,0,1)};
post.mat=new THREE.ShaderMaterial({uniforms:{t:{value:rt.texture},res:{value:new THREE.Vector2(RW,RH)},fade:{value:1},tint:{value:new THREE.Vector3(1,.97,.9)}},
 vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D t;uniform vec2 res;uniform float fade;uniform vec3 tint;varying vec2 v;
 void main(){vec3 c=texture2D(t,v).rgb;vec2 p=floor(v*res);
 float d=fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))))-.5;
 c=floor(c*31.+.5+d*.9)/31.;
 float g=dot(c,vec3(.3,.59,.11));c=mix(vec3(g),c,1.08)*tint;
 float vg=1.-.42*pow(length(v-.5)*1.3,2.2);c*=vg;
 c*=mix(.93,1.,mod(p.y,2.));
 gl_FragColor=vec4(c*fade,1.);}`,depthTest:false,depthWrite:false});
post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),post.mat));
const cams=[];
function fitRenderer(){const W=innerWidth,H=innerHeight;RH=clamp(Math.round(H/2.3),210,300);RW=Math.round(RH*W/H);renderer.setSize(RW,RH,false);rt.setSize(RW,RH);post.mat.uniforms.res.value.set(RW,RH);cams.forEach(c=>{c.aspect=W/H;c.updateProjectionMatrix()})}
window.addEventListener('resize',()=>{fitRenderer();if(typeof onResize==='function')onResize()});

/* ===== texture + material helpers ===== */
function mkTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1])}t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapNearestFilter;return t}
function speckle(c,w,h,n,cols,sz=1){for(let i=0;i<n;i++){c.fillStyle=cols[i%cols.length];c.fillRect(Math.random()*w,Math.random()*h,sz,sz)}}
const L=(o)=>new THREE.MeshLambertMaterial(typeof o==='object'&&!(o instanceof THREE.Texture)?o:(o instanceof THREE.Texture?{map:o}:{color:o}));
const PH=(color,o={})=>new THREE.MeshPhongMaterial(Object.assign({color,shininess:35,specular:0x665544},o));
const EM=(color)=>new THREE.MeshBasicMaterial({color});
function box(w,h,d,m,x=0,y=0,z=0,p){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(p)p.add(o);return o}
function cyl(r,h,m,x=0,y=0,z=0,p,seg=16,r2){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r2===undefined?r:r2,h,seg),m);o.position.set(x,y,z);if(p)p.add(o);return o}
function plane(w,h,m,x=0,y=0,z=0,p,sx=1,sy=1){const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h,sx,sy),m);o.position.set(x,y,z);if(p)p.add(o);return o}
const T={};
T.shelf=mkTex(128,128,(c,w,h)=>{c.fillStyle='#d9a44a';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=2){c.fillStyle=`rgba(${120+Math.random()*30},${70+Math.random()*20},20,${.12+Math.random()*.14})`;c.fillRect(0,y,w,1)}speckle(c,w,h,260,['#b8802c','#e8bc66','#9c6a22'],2)},[1,1]);
T.shelfDark=mkTex(128,128,(c,w,h)=>{c.fillStyle='#4a2c14';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=3){c.fillStyle=`rgba(0,0,0,${.1+Math.random()*.2})`;c.fillRect(0,y,w,1)}speckle(c,w,h,200,['#5e3a1c','#3a2210'],2)},[1,1]);
T.wall=mkTex(128,128,(c,w,h)=>{c.fillStyle='#5a2a1c';c.fillRect(0,0,w,h);c.fillStyle='#6a3322';for(let x=0;x<w;x+=16){c.fillRect(x,0,8,h)}speckle(c,w,h,320,['#3e1c10','#7a4430'],1);c.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<h;y+=32)c.fillRect(0,y,w,2)},[10,3]);
T.wainscot=mkTex(64,64,(c,w,h)=>{c.fillStyle='#35200f';c.fillRect(0,0,w,h);c.fillStyle='#4a2d16';c.fillRect(2,2,w-4,h-4);c.fillStyle='#2a1809';c.fillRect(w/2-1,0,2,h);speckle(c,w,h,100,['#3a2210','#5a3a1c'])},[24,1]);
T.floor=mkTex(64,64,(c,w,h)=>{c.fillStyle='#2b2018';c.fillRect(0,0,w,h);c.fillStyle='#c8b080';c.fillRect(0,0,32,32);c.fillRect(32,32,32,32);c.fillStyle='#1a1410';c.fillRect(32,0,32,32);c.fillRect(0,32,32,32);speckle(c,w,h,220,['rgba(0,0,0,.25)','rgba(255,255,255,.1)'])},[22,5]);
T.ceil=mkTex(64,64,(c,w,h)=>{c.fillStyle='#1a1210';c.fillRect(0,0,w,h);speckle(c,w,h,120,['#2a1c16','#120c0a'])},[20,3]);
T.glow=mkTex(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,190,100,.9)');g.addColorStop(.5,'rgba(255,150,60,.35)');g.addColorStop(1,'rgba(255,120,30,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
T.glow.minFilter=T.glow.magFilter=THREE.LinearFilter;
T.blob=mkTex(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
T.blob.minFilter=T.blob.magFilter=THREE.LinearFilter;
T.beam=mkTex(32,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,200,120,.5)');g.addColorStop(1,'rgba(255,170,80,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
T.beam.minFilter=T.beam.magFilter=THREE.LinearFilter;
T.shine=mkTex(64,64,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.35,'rgba(255,255,255,.05)');g.addColorStop(.5,'rgba(255,255,255,.2)');g.addColorStop(.6,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.12)');c.fillStyle=g;c.fillRect(0,0,w,h)});
T.shine.minFilter=T.shine.magFilter=THREE.LinearFilter;
function labelTex(text,w=128,h=24,bg='#1f4fa8',fg='#fff'){return mkTex(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle='#8fb4f0';c.fillRect(0,0,w,2);c.fillStyle=fg;c.font=`700 ${h*.72}px "Chakra Petch",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+1)})}
function signTex(text,w=256,h=64,bg='#3a2210',fg='#f2b24a',sub){return mkTex(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(5,5,w-10,h-10);c.fillStyle=fg;c.font=`700 ${sub?h*.4:h*.5}px "Chakra Petch",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,sub?h*.38:h/2+2);if(sub){c.font=`${h*.2}px "Share Tech Mono",monospace`;c.fillText(sub,w/2,h*.74)}})}
const texCache={};
function coverTex(it){if(!texCache[it.id]){const t=new THREE.CanvasTexture(getCover(it));t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapNearestFilter;texCache[it.id]=t}return texCache[it.id]}
coverTexCbs.push(it=>{if(texCache[it.id])texCache[it.id].needsUpdate=true});
function spineTex(it,w,h,horizontalFlip){return mkTex(w,h,(c)=>{c.fillStyle=it.c2;c.fillRect(0,0,w,h);c.fillStyle=it.c1;c.fillRect(0,0,w,h*.1);c.fillRect(0,h*.9,w,h*.1);c.save();c.translate(w/2,h/2);c.rotate(-Math.PI/2);c.fillStyle=lum(it.c2)<.5?'#fff6e0':'#1a1208';let fs=w*.62;c.font=`700 ${fs}px "Chakra Petch",Arial,sans-serif`;while(c.measureText(it.title).width>h*.76&&fs>5){fs-=1;c.font=`700 ${fs}px "Chakra Petch",Arial,sans-serif`}c.textAlign='center';c.textBaseline='middle';c.fillText(it.title,0,0);c.restore()})}
const discTex=mkTex(128,128,(c,w,h)=>{c.fillStyle='#c9ccd2';c.beginPath();c.arc(64,64,63,0,7);c.fill();for(let i=0;i<48;i++){c.fillStyle=`hsla(${i*7.5},70%,70%,.28)`;c.beginPath();c.moveTo(64,64);c.arc(64,64,63,i/48*6.283,(i+1)/48*6.283);c.fill()}c.fillStyle='#e8e8ec';c.beginPath();c.arc(64,64,24,0,7);c.fill();c.fillStyle='#222';c.beginPath();c.arc(64,64,7,0,7);c.fill();c.strokeStyle='rgba(0,0,0,.3)';c.beginPath();c.arc(64,64,24,0,7);c.stroke()});
function vinylTex(label){return mkTex(128,128,(c)=>{c.fillStyle='#0a0a0c';c.beginPath();c.arc(64,64,63,0,7);c.fill();for(let r=22;r<62;r+=1.6){c.strokeStyle=`rgba(255,255,255,${.04+Math.random()*.07})`;c.beginPath();c.arc(64,64,r,0,7);c.stroke()}c.fillStyle=label;c.beginPath();c.arc(64,64,21,0,7);c.fill();c.fillStyle='#fff6e0';c.fillRect(46,58,36,3);c.fillRect(50,66,28,2);c.fillStyle='#000';c.beginPath();c.arc(64,64,3,0,7);c.fill()})}
function tapeLabelTex(){return mkTex(128,80,(c,w,h)=>{c.fillStyle='#d8d4c8';c.fillRect(0,0,w,h);c.fillStyle='#22222a';c.fillRect(8,10,112,34);c.fillStyle='#e8e4d8';c.beginPath();c.arc(36,27,13,0,7);c.arc(92,27,13,0,7);c.fill();c.fillStyle='#22222a';c.beginPath();c.arc(36,27,5,0,7);c.arc(92,27,5,0,7);c.fill();c.fillRect(8,52,112,2);c.fillRect(8,60,70,2)})}

/* ===== media models (front faces +z) ===== */
const DIM={cd:[1.42,1.25,.12],vinyl:[3.1,3.1,.07],tape:[1.08,.69,.17],mixtape:[1.08,.69,.17],dvd:[1.35,1.9,.15]};
function buildItem(it){
  const g=new THREE.Group(),[W,H,D]=DIM[it.kind],front=L(coverTex(it));
  const plastic=PH(0x1b1b20,{shininess:60,specular:0x888888}),dark=L(0x141416);
  let mats,media=new THREE.Group();
  if(it.kind==='cd'){
    mats=[plastic,L(spineTex(it,24,192)),plastic,plastic,front,dark];
    const d=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.012,22),[L(0x888888),new THREE.MeshLambertMaterial({map:discTex}),L(0x888888)]);media.add(d);media.userData.disc=d;
  }else if(it.kind==='dvd'){
    mats=[PH(0x0c0c10,{shininess:70}),L(spineTex(it,24,226)),PH(0x0c0c10),PH(0x0c0c10),front,PH(0x0c0c10)];
    const d=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.012,22),[L(0x888888),new THREE.MeshLambertMaterial({map:discTex}),L(0x888888)]);media.add(d);media.userData.disc=d;
  }else if(it.kind==='vinyl'){
    mats=[L(0x1a1612),L(spineTex(it,16,192)),L(0x1a1612),L(0x1a1612),front,L(0x22201c)];
    const d=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,.02,34),[L(0x0a0a0c),new THREE.MeshLambertMaterial({map:vinylTex(it.c1)}),L(0x0a0a0c)]);media.add(d);media.userData.disc=d;
  }else{
    mats=[plastic,L(spineTex(it,24,64)),plastic,plastic,front,PH(0x22222a)];
    const body=box(1,.63,.09,L(0x202026),0,0,0,media);const lab=plane(.9,.5,L(tapeLabelTex()),0,.0,.047,media);
    const reels=[-.25,.25].map(x=>{const r=cyl(.1,.02,L(0xe8e4d8),x,.06,.05,media,10);r.rotation.x=Math.PI/2;return r});media.userData.reels=reels;media.userData.disc=null;
  }
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),mats);g.add(body);
  if(it.kind==='cd'){const o=plane(.3,H,L(mkTex(32,128,(c,w,h)=>{c.fillStyle='#f2c230';c.fillRect(0,0,w,h);c.fillStyle='#b8281c';c.fillRect(4,6,w-8,10);c.save();c.translate(w/2,h/2+8);c.rotate(-Math.PI/2);c.fillStyle='#1a1208';c.font='700 14px "Chakra Petch",Arial';c.textAlign='center';c.fillText('IMPORT EDITION',0,5);c.restore()})),-W/2+.15,0,D/2+.004,g);}
  if(it.kind==='cd'||it.kind==='dvd'||it.kind==='tape'||it.kind==='mixtape'){plane(W*1.0,H*1.0,new THREE.MeshBasicMaterial({map:T.shine,transparent:true,depthWrite:false}),0,0,D/2+.008,g)}
  if(it.kind==='dvd'){plane(.03,H*.98,L(0x000000),-W/2+.12,0,D/2+.003,g)} // hinge line
  if(it.kind==='mixtape'){const s=plane(W*.62,.14,L(mkTex(128,24,(c,w,h)=>{c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#111';c.font='700 15px "Chakra Petch",Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('MIXTAPE',w/2,h/2+1)})),W*.16,-H*.36,D/2+.012,g)}
  media.position.set(0,0,0);if(it.kind==='vinyl'||it.kind==='cd'||it.kind==='dvd')media.rotation.x=Math.PI/2;
  g.add(media);
  g.userData={item:it,W,H,D,media,front:body};
  return g}
function itemWorldSize(it){return DIM[it.kind]}
function mediaBox(it){return it.kind==='vinyl'?3:it.kind==='tape'||it.kind==='mixtape'?1.1:1.2}

/* ===== shelving ===== */
function shelfUnit(parent,cx,y0,cols,rows,cw,ch,depth,opts={}){
  const W=cols*cw+.5,H=rows*ch+.45,g=new THREE.Group();
  const wood=L(T.shelf),dk=L(T.shelfDark);
  T.shelf.repeat.set(2,1);
  box(W,H,.12,dk,0,y0+H/2,-depth/2,g);
  box(.26,H,depth,wood,-W/2+.13,y0+H/2,0,g);box(.26,H,depth,wood,W/2-.13,y0+H/2,0,g);
  box(W,.3,depth,wood,0,y0+H-.15,0,g);
  for(let r=0;r<=rows;r++){box(W-.5,.14,depth,wood,0,y0+.07+r*ch,0,g);if(opts.lip&&r<rows)box(W-.5,.3,.1,wood,0,y0+.3+r*ch,depth/2-.05,g)}
  box(W,.4,depth+.15,dk,0,y0-.2+.1,.05,g);
  g.position.set(cx,0,0);parent.add(g);
  const slots=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=cx+(c-(cols-1)/2)*cw,yb=y0+.14+(rows-1-r)*ch;slots.push({c,r,x,yb,zf:depth/2})}
  return{group:g,slots,W,H}}

/* ===== devices (shared between store and bedroom) ===== */
function buildTurntable(){
  const g=new THREE.Group(),wood=L(0x3a2412),metal=PH(0xb8b8bc,{shininess:80});
  box(4.4,.5,3.5,wood,0,.25,0,g);box(4.2,.12,3.3,PH(0x14141a),0,.56,0,g);
  const platter=new THREE.Group();platter.position.set(-.35,.7,.05);g.add(platter);cyl(1.62,.16,PH(0x888890,{shininess:70}),0,0,0,platter,26);
  const mat=cyl(1.5,.03,L(0x1a1a1e),0,.1,0,platter,26);
  const dropPoint=new THREE.Object3D();dropPoint.position.set(-.35,.9,.05);g.add(dropPoint);
  cyl(.12,.3,metal,1.6,.75,-1.0,g,10);
  const arm=new THREE.Group();arm.position.set(1.6,.95,-1.0);g.add(arm);
  const bar=box(.09,.09,2.4,metal,0,0,1.2,arm);const head=box(.28,.1,.38,PH(0x202024),0,-.05,2.45,arm);
  arm.rotation.y=.62;
  box(.35,.2,.35,L(0xd8d8d0),-1.7,.7,1.3,g);cyl(.14,.14,PH(0xd8b040),1.7,.64,1.25,g,10);
  [-1.8,1.8].forEach(x=>[-1.4,1.4].forEach(z=>cyl(.14,.2,L(0x111111),x,-.05,z,g,8)));
  g.userData={platter,arm,dropPoint,armRest:.62,armPlay:.12,spinning:false,kind:'turntable'};
  return g}
function buildCDDeck(){
  const g=new THREE.Group(),body=PH(0x15151a,{shininess:50});
  box(3.4,.95,2.8,body,0,.475,0,g);box(3.4,.1,2.8,PH(0x2a2a30),0,.95,0,g);
  const disp=box(1.0,.22,.04,L(mkTex(64,16,(c,w,h)=>{c.fillStyle='#021a10';c.fillRect(0,0,w,h);c.fillStyle='#5aff9a';c.font='10px "Share Tech Mono",monospace';c.fillText('CD  --:--',4,12)})),-.9,.55,1.42,g);
  const tray=new THREE.Group();tray.position.set(.55,.45,0);g.add(tray);box(1.9,.08,2.0,PH(0x2c2c32),0,0,.7,tray);cyl(.62,.03,L(0x181820),0,.06,.6,tray,22);
  [0,.3,.6].forEach(i=>cyl(.07,.04,L(i===1?0x5aff9a:0x444444),-1.4+i*.01-.2,.4,1.42,g,8).rotation.x=Math.PI/2);
  const dropPoint=new THREE.Object3D();dropPoint.position.set(0,.07,.6);tray.add(dropPoint);
  g.userData={tray,trayOut:1.3,trayIn:0,dropPoint,kind:'cd'};tray.position.z=0;
  [-1.4,1.4].forEach(x=>[-1.1,1.1].forEach(z=>cyl(.1,.1,L(0x111111),x,-.04,z,g,8)));
  return g}
function buildTapeDeck(){
  const g=new THREE.Group(),body=PH(0x26262c,{shininess:50});
  box(3.4,1.5,2.4,body,0,.75,0,g);
  const win=box(1.55,.8,.05,PH(0x0a0a10,{transparent:true,opacity:.9}),-.3,.85,1.22,g);
  const door=new THREE.Group();door.position.set(-.3,.45,1.22);g.add(door);const dpanel=box(1.6,.95,.08,PH(0x15151a,{transparent:true,opacity:.55}),0,.4,0,door);
  const dropPoint=new THREE.Object3D();dropPoint.position.set(-.3,.85,1.18);g.add(dropPoint);
  [0,1,2,3].forEach(i=>box(.28,.2,.12,L(i===0?0xb82a1c:0x888890),1.0+(i%2)*.3,.4+Math.floor(i/2)*.3,1.2,g));
  box(.5,.28,.05,L(0x111118),1.0,1.2,1.21,g);
  g.userData={door,dropPoint,kind:'tape'};
  [-1.4,1.4].forEach(x=>[-.9,.9].forEach(z=>cyl(.1,.1,L(0x111111),x,-.04,z,g,8)));
  return g}
function buildCRT(w=3.6,h=2.8,d=3){
  const g=new THREE.Group(),shell=PH(0x6a6a70,{shininess:30});
  box(w,h,d*.55,shell,0,h/2,d*.2,g);box(w*.72,h*.72,d*.5,shell,0,h/2,-d*.3,g);
  box(w*.88,h*.82,.05,L(0x0a0a0a),-w*.04,h/2+.05,d*.2+d*.275+.0,g);
  const sc=document.createElement('canvas');sc.width=128;sc.height=96;const tex=new THREE.CanvasTexture(sc);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const scr=plane(w*.8,h*.7,new THREE.MeshBasicMaterial({map:tex}),-w*.04,h/2+.05,d*.2+d*.275+.04,g);
  [0,1,2].forEach(i=>cyl(.1,.05,L(0x222222),w*.43,h*.7-i*.35,d*.2+d*.275+.03,g,8).rotation.x=Math.PI/2);
  g.userData={canvas:sc,ctx:sc.getContext('2d'),tex,scr,kind:'tv'};return g}
function buildDVDPlayer(){
  const g=new THREE.Group();box(3.2,.5,2.2,PH(0x1a1a20,{shininess:60}),0,.25,0,g);box(1.8,.06,.03,L(0x050508),-.3,.28,1.12,g);
  const tray=new THREE.Group();tray.position.set(-.3,.28,0);g.add(tray);box(1.5,.04,1.5,PH(0x2a2a30),0,0,.5,tray);
  const dropPoint=new THREE.Object3D();dropPoint.position.set(0,.05,.5);tray.add(dropPoint);
  box(.3,.08,.04,L(0x3ad87a),1.2,.3,1.12,g);
  g.userData={tray,trayOut:1.2,trayIn:0,dropPoint,kind:'dvd'};return g}
function crtDraw(tv,mode,it,t){ // mode: off|static|menu|play|viz
  const c=tv.userData.ctx,w=128,h=96;
  if(mode==='off'){c.fillStyle='#07090a';c.fillRect(0,0,w,h);const g=c.createRadialGradient(64,48,2,64,48,70);g.addColorStop(0,'rgba(60,70,70,.35)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h)}
  else if(mode==='static'){const im=c.createImageData(w,h);for(let i=0;i<im.data.length;i+=4){const v=Math.random()*150;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=255}c.putImageData(im,0,0)}
  else if(mode==='menu'||mode==='play'){c.fillStyle='#050a24';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#14308a');g.addColorStop(1,'#050a24');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.drawImage(getCover(it),6,10,44,Math.min(70,44*getCover(it).height/getCover(it).width));
    c.fillStyle='#fff';c.font='700 9px "Chakra Petch",Arial';wrapText(c,it.title,68).slice(0,3).forEach((l,i)=>c.fillText(l,56,22+i*10));c.font='7px "Share Tech Mono",monospace';c.fillStyle='#9fc3f2';c.fillText(it.year+' · '+it.genre,56,58);
    if(mode==='menu'){['PLAY MOVIE','SCENE SELECT','SETUP'].forEach((s,i)=>{const on=i===Math.floor(t*.8)%3;c.fillStyle=on?'#36d6ff':'#bcd6ff';c.font='700 8px "Chakra Petch",Arial';c.fillText((on?'▶ ':'  ')+s,56,70+i*9)})}
    else{c.fillStyle='#02060f';c.fillRect(0,78,w,18);c.fillStyle='#fff';c.font='7px "Share Tech Mono",monospace';c.fillText('▶ PLAYING  00:'+String(Math.floor(t)%60).padStart(2,'0'),6,89);c.fillStyle='#36d6ff';c.fillRect(6,92,((t*3)%116),2)}}
  else if(mode==='viz'){c.fillStyle='#04060c';c.fillRect(0,0,w,h);const d=new Uint8Array(A.an?A.an.frequencyBinCount:32);if(A.an)A.an.getByteFrequencyData(d);
    for(let i=0;i<24;i++){const v=(d[i]||0)/255;c.fillStyle=`hsl(${190+i*4},90%,${40+v*30}%)`;c.fillRect(6+i*5,70-v*54,4,v*54+2)}
    c.fillStyle='#fff';c.font='700 8px "Chakra Petch",Arial';c.fillText(it.title.slice(0,26),6,84);c.fillStyle='#9fc3f2';c.font='7px "Share Tech Mono",monospace';c.fillText(it.by.slice(0,30),6,92)}
  // CRT scanlines
  c.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<h;y+=2)c.fillRect(0,y,w,1);tv.userData.tex.needsUpdate=true}
