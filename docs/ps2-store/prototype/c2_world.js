/* ===== worlds ===== */
function makeWorld(bg,fogNear,fogFar,fov=50){
  const scene=new THREE.Scene();scene.background=new THREE.Color(bg);scene.fog=new THREE.Fog(bg,fogNear,fogFar);
  const cam=new THREE.PerspectiveCamera(fov,innerWidth/innerHeight,.1,220);scene.add(cam);cams.push(cam);
  return{scene,cam,items:[],spots:[],stations:[],cur:null,upd:[],base:new THREE.Vector3(),look:new THREE.Vector3(),devices:{}}}
function spot(scene,x,y,z,tx,ty,tz,color=0xffb866,int=1.4,ang=.62){const s=new THREE.SpotLight(color,int,46,ang,.7,1.1);s.position.set(x,y,z);s.target.position.set(tx,ty,tz);scene.add(s,s.target);return s}
function beamCone(scene,x,y,z,h,r,color=0xffcc88){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,16,1,true),new THREE.MeshBasicMaterial({map:T.beam,color,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.position.set(x,y-h/2,z);scene.add(m);
  const can=cyl(.34,.6,L(0x1a1410),x,y+.1,z,scene,10);const lens=cyl(.28,.05,EM(0xffe2a8),x,y-.22,z,scene,10);return m}
function floorPool(scene,x,z,r,y=.03){const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),new THREE.MeshBasicMaterial({map:T.glow,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m)}
function blob(parent,x,y,z,w,d,op=.55){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:T.blob,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);parent.add(m)}

/* ---------- STORE ---------- */
const ST=makeWorld(0x0b0705,26,70);
const SECS=[
 {id:'cd',name:'Import CDs',tag:'Aisle 1',x:0,kind:'cd',cols:4,rows:3,cw:1.85,ch:2.05,y0:1.0,dep:1.5,lbl:'DISC',dist:11.6},
 {id:'vinyl',name:'Vinyl Wall',tag:'Aisle 2',x:15,kind:'vinyl',cols:4,rows:2,cw:3.6,ch:3.9,y0:1.0,dep:1.4,lbl:'LP',lip:true},
 {id:'listen',name:'Listening Post',tag:'Try before you buy',x:31,kind:'listen'},
 {id:'tape',name:'Tapes & Mixtapes',tag:'Aisle 3',x:47.5,kind:'tape',cols:5,rows:2,cw:1.6,ch:1.5,y0:3.0,dep:1.1,lbl:'TAPE'},
 {id:'dvd',name:'DVD Wall',tag:'Aisle 4',x:62,kind:'dvd',cols:5,rows:2,cw:1.8,ch:2.55,y0:1.8,dep:1.3,lbl:'DVD'},
 {id:'counter',name:'Checkout',tag:'Pay here',x:77,kind:'counter'}];
const hold=new THREE.Vector3();
ST.stations=SECS;
(function buildStore(){
  const sc=ST.scene;
  sc.add(new THREE.AmbientLight(0x6a4a34,.8));sc.add(new THREE.HemisphereLight(0xffe0b0,0x2a1a10,.35));
  // walls / floor / ceiling (subdivided so vertex lighting forms pools)
  const wall=plane(130,12,L(T.wall),32,6,-1.0,sc,86,10);
  const wain=plane(130,3,L(T.wainscot),32,1.5,-.98,sc,60,3);
  const floor=plane(130,22,L(T.floor),32,0,9,sc,86,16);floor.rotation.x=-Math.PI/2;
  const ceil=plane(130,22,L(T.ceil),32,11.5,9,sc,40,8);ceil.rotation.x=Math.PI/2;
  [-1.2,34,70].forEach(x=>0);
  for(let x=-10;x<=100;x+=12)box(.5,.7,22,L(0x1a100a),x,11.1,9,sc);
  box(130,.3,.5,L(0x1a1410),32,10.4,8.5,sc); // track rail
  const lw=plane(22,12,L(T.wall),-18,6,9,sc,10,6);lw.rotation.y=Math.PI/2;const rw=plane(22,12,L(T.wall),96,6,9,sc,10,6);rw.rotation.y=-Math.PI/2;
  // spots
  SECS.forEach(s=>{const L1=spot(sc,s.x,10.2,8.8,s.x,s.kind==='counter'?4:4.4,0,0xffb25a,s.kind==='listen'?1.25:1.55,.58);beamCone(sc,s.x,10.35,8.8,10.5,2.6);floorPool(sc,s.x,5.2,6)});
  const fill=new THREE.PointLight(0xff9040,.38,26,1.4);fill.position.set(7.5,5,6);sc.add(fill);const fill2=fill.clone();fill2.position.set(23,5,6);sc.add(fill2);const fill3=fill.clone();fill3.position.set(54.5,5,6);sc.add(fill3);const fill4=fill.clone();fill4.position.set(69,5,6);sc.add(fill4);
  // sections with shelving
  const byKind={cd:[],vinyl:[],tape:[],dvd:[]};CAT.forEach(i=>byKind[i.kind==='mixtape'?'tape':i.kind].push(i));
  SECS.forEach(s=>{
    if(!byKind[s.kind])return;
    const u=shelfUnit(sc,s.x,s.y0,s.cols,s.rows,s.cw,s.ch,s.dep,{lip:s.lip});
    s.W=u.W;s.H=u.H;s.yMid=s.y0+u.H/2;s.items=[];
    // sign
    plane(Math.min(u.W,5),1.1,L(signTex(s.name.toUpperCase(),256,56,'#2a1608','#f2b24a',s.tag.toUpperCase())),s.x,s.y0+u.H+1.1,.4,sc);
    box(.06,1.4,.06,L(0x111111),s.x-1.9,s.y0+u.H+.55+.55,.4,sc);box(.06,1.4,.06,L(0x111111),s.x+1.9,s.y0+u.H+.55+.55,.4,sc);
    byKind[s.kind].forEach((it,i)=>{
      const sl=u.slots[i],g=buildItem(it),[W,H,D]=DIM[it.kind];
      const z=s.dep/2-D/2-.18-(s.lip?.12:0);
      g.position.set(sl.x,sl.yb+H/2+(s.lip?.12:.01),z);
      g.rotation.x=-.06;sc.add(g);
      blob(sc,sl.x,sl.yb+(s.lip?.13:.02),z,W*.95,D+.7,.5);
      const lab=plane(Math.min(s.cw*.78,W),.26,L(labelTex(s.lbl+' '+(i+1),128,24)),sl.x,sl.yb+.2,s.dep/2-.02,sc);lab.rotation.x=-.2;
      const spotObj={type:'item',st:s.id,item:it,group:g,w:W,h:H,d:D,home:{pos:g.position.clone(),rot:g.rotation.clone(),parent:sc},label:s.lbl+' '+(i+1),slot:sl};
      g.userData.spot=spotObj;ST.spots.push(spotObj);ST.items.push(spotObj);s.items.push(spotObj)});
  });
  // plants / decor
  const plant=new THREE.Group();cyl(.7,.9,L(0x6a3a22),0,.45,0,plant,8);for(let i=0;i<9;i++){const l=box(.12,1.5,.5,L(0x2a6a2a),0,1.4,0,plant);l.rotation.z=(i-4)*.17;l.rotation.y=i*.7;l.position.set(Math.sin(i)*.2,1.6,Math.cos(i)*.2)}plant.position.set(-5.5,0,4.5);sc.add(plant);const p2=plant.clone();p2.position.set(24,0,4.2);sc.add(p2);const p3=plant.clone();p3.position.set(83.5,0,4);sc.add(p3);
  // wall decor: clock + framed placards between sections
  const clk=cyl(.9,.15,L(mkTex(64,64,(c,w,h)=>{c.fillStyle='#f0e8d0';c.beginPath();c.arc(32,32,31,0,7);c.fill();c.strokeStyle='#111';c.lineWidth=3;c.beginPath();c.moveTo(32,32);c.lineTo(32,12);c.moveTo(32,32);c.lineTo(44,38);c.stroke();for(let i=0;i<12;i++){c.fillRect(32+Math.sin(i/12*6.283)*27-1,32-Math.cos(i/12*6.283)*27-1,2,2)}})),7.7,8.2,-.7,sc,18);clk.rotation.x=Math.PI/2;clk.rotation.y=0;
  [[7.6,'NEW ARRIVALS'],[22.8,'STAFF PICKS'],[39.3,'3 FOR $20'],[54.8,'NOW ON DVD'],[69.4,'COMING SOON']].forEach(([x,t])=>plane(2.8,.9,L(signTex(t,160,52,'#1a3a6a','#e8f0ff')),x,6.6,-.9,sc));
  // posters (generic colour studies)
  [[7.6,4.2,'#e8571f','#2a0a04'],[22.8,5.4,'#1f4fa8','#06142e'],[39.3,5.4,'#7a2a9a','#1a0830'],[69.4,3.2,'#2a8a4a','#06200e']].forEach(([x,y,a,b],i)=>{const t=mkTex(64,96,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.arc(w/2,h*.42,w*.28,0,7);c.fill();c.fillRect(0,h*.78,w,3)});plane(1.9,2.8,L(t),x,y+1.5,-.9,sc)});
  // listening bench + devices
  const ls=SECS[2],bx=ls.x;
  box(12.4,3.0,3.6,L(T.shelfDark),bx,1.5,.9,sc);box(12.8,.22,4,L(T.shelf),bx,3.1,.9,sc);
  const tt=buildTurntable();tt.position.set(bx-4.2,3.2,1.0);sc.add(tt);ST.devices.vinyl=tt;
  const cd=buildCDDeck();cd.position.set(bx-.1,3.2,1.0);sc.add(cd);ST.devices.cd=cd;
  const tp=buildTapeDeck();tp.position.set(bx+3.5,3.2,1.0);tp.scale.setScalar(.95);sc.add(tp);ST.devices.tape=tp;ST.devices.mixtape=tp;
  box(13,.22,3,L(T.shelf),bx+.6,5.8,.35,sc);box(.3,2.6,2.6,L(T.shelfDark),bx-5.4,4.5,.35,sc);box(.3,2.6,2.6,L(T.shelfDark),bx+6.7,4.5,.35,sc);
  const tv=buildCRT();tv.position.set(bx+3.2,5.9,.2);sc.add(tv);ST.devices.tv=tv;
  const dv=buildDVDPlayer();dv.position.set(bx-1.7,5.9,.6);sc.add(dv);ST.devices.dvd=dv;
  plane(5,1,L(signTex('LISTENING POST',256,52,'#0e2a52','#cfe2ff','PLACE IT ON · PRESS PLAY')),bx-1.2,8.6,-.9,sc);
  // headphones on the wall
  const hp=new THREE.Group();const arc=new THREE.Mesh(new THREE.TorusGeometry(.7,.09,6,14,Math.PI),L(0x111111));arc.position.y=.3;hp.add(arc);cyl(.34,.2,L(0xb8281c),-.7,.2,0,hp,10).rotation.z=Math.PI/2;cyl(.34,.2,L(0xb8281c),.7,.2,0,hp,10).rotation.z=Math.PI/2;hp.position.set(bx+6.2,7.4,-.8);sc.add(hp);
  ST.devices.tv.userData.mode='off';
  // counter
  const cs=SECS[5],cx=cs.x;
  box(9,3.3,2.4,L(T.shelfDark),cx,1.65,2.7,sc);box(9.4,.28,2.9,L(T.shelf),cx,3.4,2.7,sc);box(9,.2,.2,L(0xf2b24a),cx,3.0,3.95,sc);
  const reg=new THREE.Group();box(1.9,.8,1.5,PH(0x3a3a40),0,.4,0,reg);const rs=box(1.1,.7,.1,L(mkTex(64,40,(c,w,h)=>{c.fillStyle='#021a10';c.fillRect(0,0,w,h);c.fillStyle='#5aff9a';c.font='12px "Share Tech Mono",monospace';c.fillText('TOTAL',4,16);c.fillText('$ --.--',4,32)})),0,1.05,-.1,reg);rs.rotation.x=-.35;reg.position.set(cx+2.6,3.54,2.4);sc.add(reg);
  cyl(.5,.8,PH(0x88c8e8,{transparent:true,opacity:.5}),cx-3.6,3.9,2.4,sc,10);box(1.6,.9,.9,L(0x8a5a2a),cx-2.4,3.97,2.2,sc);
  plane(4.4,1,L(signTex('CHECKOUT',256,58,'#3a0e0a','#ffd27a','THANK YOU · COME AGAIN')),cx,8.4,-.9,sc);
  // cashier billboard
  ST.cashier=makeCashier();ST.cashier.position.set(cx,5.1,.6);sc.add(ST.cashier.mesh||ST.cashier);
})();
function makeCashier(){
  const c=document.createElement('canvas');c.width=128;c.height=192;const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(4.8,7.2),new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.3}));
  const photo={img:null,mx:.5,my:.43};
  try{const sv=Store.ls('cashierPhoto',null);if(sv){const im=new Image();im.onload=()=>{photo.img=im;photo.mx=sv.mx;photo.my=sv.my};im.src=sv.url}}catch(e){}
  function draw(mouth,blink,t){const x=c.getContext('2d');x.clearRect(0,0,128,192);
    if(photo.img){const s=Math.min(128/photo.img.width,192/photo.img.height);const w=photo.img.width*s,h=photo.img.height*s;x.save();x.shadowColor='#fff';x.shadowBlur=0;for(const[dx,dy]of[[2,0],[-2,0],[0,2],[0,-2]]){x.shadowOffsetX=dx;x.shadowOffsetY=dy}x.drawImage(photo.img,(128-w)/2,192-h,w,h);x.restore();
      const mx=(128-w)/2+photo.mx*w,my=192-h+photo.my*h;if(mouth>0){x.fillStyle='#2a0a0c';x.beginPath();x.ellipse(mx,my,w*.06,w*(.012+.035*mouth),0,0,7);x.fill();x.fillStyle='#d88a8a';x.fillRect(mx-w*.04,my+w*.02*mouth,w*.08,1.5)}tex.needsUpdate=true;return}
    // painted "stock photo" cutout: white sticker outline, soft shading, photographic grain
    const skin='#e0a982',skinD='#b9825c',hair='#2a1a14',shirt='#2f6bd0';
    const body=()=>{x.beginPath();x.moveTo(8,192);x.quadraticCurveTo(10,138,42,126);x.lineTo(86,126);x.quadraticCurveTo(118,138,120,192);x.closePath()};
    const head=()=>{x.beginPath();x.ellipse(64,66,29,36,0,0,7)};
    x.lineJoin='round';x.strokeStyle='#fff';x.lineWidth=8;body();x.stroke();head();x.stroke();x.beginPath();x.ellipse(64,50,38,40,0,0,7);x.stroke();
    let g=x.createLinearGradient(0,126,0,192);g.addColorStop(0,'#3d7be0');g.addColorStop(1,'#1d3f8a');x.fillStyle=g;body();x.fill();
    x.fillStyle='#f2f2f2';x.beginPath();x.moveTo(50,126);x.lineTo(64,150);x.lineTo(78,126);x.closePath();x.fill();
    x.fillStyle='#fff';x.fillRect(84,146,26,14);x.fillStyle='#d8281c';x.fillRect(84,146,26,3);x.fillStyle='#222';x.font='700 8px Arial';x.fillText('SAM',89,157);
    x.fillStyle=skinD;x.fillRect(54,100,20,28);
    x.fillStyle=hair;x.beginPath();x.ellipse(64,46,36,36,0,Math.PI,0);x.lineTo(98,86);x.quadraticCurveTo(92,60,64,52);x.quadraticCurveTo(36,60,30,86);x.closePath();x.fill();
    g=x.createRadialGradient(56,60,4,64,70,40);g.addColorStop(0,'#f0c29c');g.addColorStop(1,skin);x.fillStyle=g;head();x.fill();
    x.fillStyle=hair;x.beginPath();x.moveTo(33,60);x.quadraticCurveTo(64,26,95,60);x.quadraticCurveTo(80,42,64,44);x.quadraticCurveTo(46,42,33,60);x.fill();
    const ey=blink?2:6;x.fillStyle='#fff';[48,80].forEach(ex=>{x.beginPath();x.ellipse(ex,66,7,ey,0,0,7);x.fill()});x.fillStyle='#3a2414';if(!blink)[48,80].forEach(ex=>{x.beginPath();x.arc(ex+1,66,3.2,0,7);x.fill()});
    x.strokeStyle=hair;x.lineWidth=2.5;[[41,56,55,54],[73,54,87,56]].forEach(a=>{x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[2],a[3]);x.stroke()});
    x.strokeStyle=skinD;x.lineWidth=2;x.beginPath();x.moveTo(64,70);x.lineTo(61,82);x.lineTo(66,83);x.stroke();
    x.fillStyle='rgba(220,110,100,.35)';[44,84].forEach(cx=>{x.beginPath();x.ellipse(cx,84,6,4,0,0,7);x.fill()});
    const my=94;if(mouth<=0){x.strokeStyle='#8a2a2a';x.lineWidth=2.5;x.beginPath();x.moveTo(52,my);x.quadraticCurveTo(64,my+7,76,my);x.stroke()}
    else{x.fillStyle='#3a0a10';x.beginPath();x.ellipse(64,my+1,10+mouth*2,2+mouth*6,0,0,7);x.fill();x.fillStyle='#fff';x.fillRect(57,my-2-mouth*0,14,3);x.fillStyle='#c85a5a';x.beginPath();x.ellipse(64,my+2+mouth*4,6,2.5,0,0,7);x.fill()}
    // photographic grain + slight bitcrush
    const im=x.getImageData(0,0,128,192),d=im.data;for(let i=0;i<d.length;i+=4){if(d[i+3]>20){const n=(Math.random()-.5)*16;d[i]=(d[i]+n)&0xf8;d[i+1]=(d[i+1]+n)&0xf8;d[i+2]=(d[i+2]+n)&0xf8}}x.putImageData(im,0,0);tex.needsUpdate=true}
  const o={mesh:m,photo,draw,state:{mouth:-1,blink:false},position:m.position};
  draw(0,false,0);return o}

/* ---------- crate (rides on the camera) ---------- */
const crate=new THREE.Group();
(function(){const w=L(T.shelf),dk=L(T.shelfDark);box(4.6,.22,3.4,dk,0,.11,0,crate);
  [[0,-1.7,4.6,.1],[0,1.7,4.6,.1]].forEach(([x,z,W])=>{[.35,.8,1.25].forEach(y=>box(W,.3,.12,w,x,y,z,crate))});
  [-2.3,2.3].forEach(x=>{[.35,.8,1.25].forEach(y=>box(.12,.3,3.4,w,x,y,0,crate))});
  [[-2.3,-1.7],[2.3,-1.7],[-2.3,1.7],[2.3,1.7]].forEach(([x,z])=>box(.2,1.55,.2,dk,x,.78,z,crate));
  box(1.2,.14,.1,L(0x1a100a),0,1.0,1.77,crate);})();
crate.userData.slots=[];crate.userData.contents=[];
function crateLayout(){ // lean items against the back of the crate, fanned along x
  const n=crate.userData.contents.length;crate.userData.contents.forEach((sp,i)=>{const t=n<=1?0:i/(n-1)-.5;sp.cratePos=new THREE.Vector3(t*(Math.min(n,5)-1)*.7*1.15,sp.h*.5*.96+.12,-.4+(i%2)*.15);sp.crateRot=new THREE.Euler(-.16,0,t*.1)})}
function placeCrate(world){const cam=world.cam,tn=Math.tan(cam.fov*Math.PI/360),d=10,asp=cam.aspect;
  const nx=asp<1?-.5:-.74,ny=asp<1?-.82:-.8;crate.scale.setScalar(asp<1?.38:.5);
  crate.position.set(nx*d*tn*asp,ny*d*tn-.2,-d);crate.rotation.set(.62,.28,0)}
function camLocal(world,nx,ny,dist){const tn=Math.tan(world.cam.fov*Math.PI/360);return new THREE.Vector3(nx*dist*tn*world.cam.aspect,ny*dist*tn,-dist)}

/* ---------- selection indicator (cyan frame + blue arrow, from the reference) ---------- */
const sel={ring:null,arrow:null,target:null,w:1,h:1,t:0};
(function(){
  const rt1=mkTex(128,128,(c,w,h)=>{c.shadowColor='#36d6ff';c.shadowBlur=14;c.strokeStyle='#36d6ff';c.lineWidth=9;c.strokeRect(14,14,w-28,h-28);c.shadowBlur=0;c.strokeStyle='#d8f8ff';c.lineWidth=3;c.strokeRect(14,14,w-28,h-28);c.fillStyle='rgba(54,214,255,.12)';c.fillRect(14,14,w-28,h-28)});rt1.minFilter=rt1.magFilter=THREE.NearestFilter;
  const at=mkTex(64,64,(c,w,h)=>{c.fillStyle='#2c8cff';c.strokeStyle='#d8f0ff';c.lineWidth=3;c.beginPath();c.moveTo(6,6);c.lineTo(32,18);c.lineTo(58,6);c.lineTo(32,58);c.closePath();c.fill();c.stroke()});at.minFilter=at.magFilter=THREE.NearestFilter;
  const mm=t=>new THREE.MeshBasicMaterial({map:t,transparent:true,depthTest:false,depthWrite:false,fog:false});
  sel.ring=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mm(rt1));sel.arrow=new THREE.Mesh(new THREE.PlaneGeometry(.7,.7),mm(at));
  sel.ring.renderOrder=999;sel.arrow.renderOrder=1000;sel.ring.visible=sel.arrow.visible=false;
})();
function selUpdate(world,dt){
  sel.t+=dt;const tg=sel.target;if(!tg||!tg.group||tg.hidden){sel.ring.visible=sel.arrow.visible=false;return}
  if(sel.ring.parent!==world.scene){world.scene.add(sel.ring,sel.arrow)}
  sel.ring.visible=sel.arrow.visible=true;
  const p=new THREE.Vector3();tg.group.getWorldPosition(p);const toCam=world.cam.position.clone().sub(p).normalize();
  const pulse=1+Math.sin(sel.t*6)*.045,sw=(tg.w||1)*1.34+.2,sh=(tg.h||1)*1.3+.2;
  sel.ring.position.copy(p).addScaledVector(toCam,.45);sel.ring.quaternion.copy(world.cam.quaternion);sel.ring.scale.set(sw*pulse,sh*pulse,1);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(world.cam.quaternion);
  sel.arrow.position.copy(sel.ring.position).addScaledVector(up,sh/2+.32+Math.abs(Math.sin(sel.t*4))*.22);sel.arrow.quaternion.copy(world.cam.quaternion);const as=Math.max(.5,Math.min(1.6,sw*.38));sel.arrow.scale.set(as,as,1)}

/* ---------- BEDROOM ---------- */
const RM=makeWorld(0x07080f,34,80,56);
RM.stations=[
 {id:'bed',name:'On the Bed',tag:'Home',kind:'view'},{id:'shelf',name:'Collection Shelf',tag:'Your stuff',kind:'shelf'},{id:'hifi',name:'Hi-Fi Dresser',tag:'Records · Tapes',kind:'view'},
 {id:'tv',name:'TV & DVD',tag:'Movie night',kind:'view'},{id:'desk',name:'Desk',tag:'Notebook · CD player',kind:'desk'},{id:'board',name:'Community Board',tag:'Reviews',kind:'board'}];
(function buildRoom(){
  const sc=RM.scene;
  sc.add(new THREE.AmbientLight(0x3a3a5a,.7));sc.add(new THREE.HemisphereLight(0x8aa0d8,0x2a1a10,.3));
  const wp=mkTex(64,64,(c,w,h)=>{c.fillStyle='#2c3a6a';c.fillRect(0,0,w,h);c.fillStyle='#34447a';for(let x=0;x<w;x+=16)c.fillRect(x,0,8,h);speckle(c,w,h,160,['#222c52','#3c4e8c']);c.fillStyle='rgba(255,255,255,.07)';for(let y=8;y<h;y+=16)for(let x=8;x<w;x+=16)c.fillRect(x,y,2,2)},[12,3]);
  const carpet=mkTex(64,64,(c,w,h)=>{c.fillStyle='#4a3a52';c.fillRect(0,0,w,h);speckle(c,w,h,500,['#5a4a64','#3a2c42','#6a5a74'])},[16,12]);
  plane(24,10,L(wp),0,5,-9,sc,24,8);const lw=plane(20,10,L(wp),-12,5,0,sc,10,8);lw.rotation.y=Math.PI/2;const rw=plane(20,10,L(wp),12,5,0,sc,10,8);rw.rotation.y=-Math.PI/2;
  const fl=plane(24,22,L(carpet),0,0,1,sc,24,16);fl.rotation.x=-Math.PI/2;const cl=plane(24,22,L(0x1a1620),0,10,1,sc,8,8);cl.rotation.x=Math.PI/2;
  box(24,.5,.3,L(0x1a1420),0,.25,-8.85,sc);
  // rug
  const rug=plane(8,6,L(mkTex(64,48,(c,w,h)=>{c.fillStyle='#8a2a3a';c.fillRect(0,0,w,h);c.strokeStyle='#e8c070';c.lineWidth=3;c.strokeRect(4,4,w-8,h-8);c.strokeRect(10,10,w-20,h-20);c.fillStyle='#e8c070';c.beginPath();c.arc(w/2,h/2,8,0,7);c.fill()})),0,.03,0,sc);rug.rotation.x=-Math.PI/2;
  // window with night city
  const night=mkTex(96,64,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#05061a');g.addColorStop(1,'#3a2a5a');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<30;i++){c.fillStyle='#fff';c.fillRect(Math.random()*w,Math.random()*h*.5,1,1)}c.fillStyle='#0a0a14';for(let x=0;x<w;x+=9){const bh=10+Math.random()*26;c.fillRect(x,h-bh,8,bh);for(let k=0;k<5;k++){if(Math.random()<.5){c.fillStyle='#ffd27a';c.fillRect(x+2+(k%2)*3,h-bh+3+Math.floor(k/2)*5,2,2);c.fillStyle='#0a0a14'}}}c.fillStyle='#e8e8f0';c.beginPath();c.arc(78,12,4,0,7);c.fill()});
  plane(5,3.4,new THREE.MeshBasicMaterial({map:night}),7.5,6.2,-8.95,sc);[[0,1.8],[0,-1.8]].forEach(([x,y])=>box(5.4,.25,.3,L(0xd8d0c0),7.5,6.2+y,-8.85,sc));[-2.6,2.6].forEach(x=>box(.25,3.8,.3,L(0xd8d0c0),7.5+x,6.2,-8.85,sc));box(.15,3.6,.2,L(0xd8d0c0),7.5,6.2,-8.85,sc);
  const moon=new THREE.PointLight(0x8aa8ff,.5,20,1.5);moon.position.set(7.5,6.2,-6);sc.add(moon);
  // lamps
  const lamp=new THREE.Group();cyl(.5,.15,L(0x222222),0,.08,0,lamp,10);cyl(.06,1.6,L(0x333333),0,.9,0,lamp,6);const sh=cyl(.8,.9,new THREE.MeshBasicMaterial({color:0xffd28a}),0,2.0,0,lamp,12,.45);lamp.position.set(11.2,3.2,-7.8);sc.add(lamp);
  const lp=new THREE.PointLight(0xffa850,1.15,30,1.2);lp.position.set(10.6,5.6,-6.4);sc.add(lp);
  const ceilLamp=new THREE.PointLight(0xffb56a,.55,34,1.2);ceilLamp.position.set(-1,8.6,-1);sc.add(ceilLamp);
  const tvGlow=new THREE.PointLight(0x6a9cff,.45,12,1.5);tvGlow.position.set(-1.2,5,-6);sc.add(tvGlow);RM.tvGlow=tvGlow;
  const spL=spot(sc,-8,9,4,-8,3.4,-8,0xffc27a,1.1,.55);const spL2=spot(sc,0,9,4,0,3,-8,0xffc27a,.9,.6);const spR=spot(sc,8.2,9,4,8.2,3.4,-8,0xffb060,1.0,.55);
  // bed (camera sits here)
  box(9,.7,9,L(0x3a2412),0,.9,8.2,sc);box(8.6,1.2,8.6,L(mkTex(32,32,(c,w,h)=>{c.fillStyle='#b8402a';c.fillRect(0,0,w,h);c.fillStyle='#d8583a';for(let x=0;x<w;x+=8)c.fillRect(x,0,4,h);speckle(c,w,h,60,['#8a2a1a'])},[4,4])),0,1.6,8.2,sc);box(3,.5,1.6,L(0xe8e0d0),-2.4,2.4,5.2,sc);box(9,3.4,.5,L(0x3a2412),0,2.5,12.4,sc);
  // dresser + hi-fi
  box(8,3.0,2.6,L(T.shelfDark),-8,1.5,-7.5,sc);box(8.4,.22,3,L(T.shelf),-8,3.1,-7.5,sc);[-9.8,-6.2].forEach(x=>[0,1].forEach(r=>box(3,1.2,.1,L(T.shelf),x,.9+r*1.1,-6.15,sc)));
  const tt=buildTurntable();tt.position.set(-9.5,3.2,-7.4);sc.add(tt);RM.devices.vinyl=tt;
  const tp=buildTapeDeck();tp.position.set(-5.4,3.2,-7.4);sc.add(tp);RM.devices.tape=tp;RM.devices.mixtape=tp;
  // TV stand + TV + DVD
  box(7.6,2.2,2.6,L(T.shelfDark),0,1.1,-7.5,sc);box(8,.2,3,L(T.shelf),0,2.3,-7.5,sc);
  const tv=buildCRT(4.2,3.2,3.2);tv.position.set(-1.4,2.4,-7.6);sc.add(tv);RM.devices.tv=tv;const dv=buildDVDPlayer();dv.position.set(2.4,2.4,-7.2);sc.add(dv);RM.devices.dvd=dv;
  // desk
  box(8,.3,3.2,L(T.shelf),8.4,3.3,-7.4,sc);[-3.7,3.7].forEach(x=>box(.4,3.2,3,L(T.shelfDark),8.4+x,1.6,-7.4,sc));box(7.4,2.2,.3,L(T.shelfDark),8.4,2.2,-8.6,sc);
  const cd=buildCDDeck();cd.position.set(10.6,3.45,-7.4);sc.add(cd);RM.devices.cd=cd;
  // notebook on the desk
  const nb=new THREE.Group();box(2.5,.12,3.1,L(0x2a5a9a),0,.06,0,nb);const pg=box(2.3,.06,2.9,L(mkTex(64,64,(c,w,h)=>{c.fillStyle='#efe6cf';c.fillRect(0,0,w,h);c.strokeStyle='#8fb3d9';for(let y=8;y<h;y+=6){c.beginPath();c.moveTo(4,y);c.lineTo(w-4,y);c.stroke()}c.strokeStyle='#d36060';c.beginPath();c.moveTo(12,0);c.lineTo(12,h);c.stroke()})),.05,.15,0,nb);const pen=cyl(.05,1.7,L(0xd8281c),.6,.24,.3,nb,6);pen.rotation.z=Math.PI/2;pen.rotation.y=.5;
  nb.position.set(6.6,3.5,-6.6);nb.rotation.y=-.18;sc.add(nb);RM.notebook=nb;
  // corkboard on right wall
  const cb=new THREE.Group();box(.3,6.2,9,L(0x5b3414),0,0,0,cb);const cork=plane(8.4,5.6,L(mkTex(64,48,(c,w,h)=>{c.fillStyle='#a8743a';c.fillRect(0,0,w,h);speckle(c,w,h,500,['#8a5a2a','#c8904a','#6a4220'])})),-.18,0,0,cb);cork.rotation.y=-Math.PI/2;
  const cards=[[-2.6,1.2,'#fff8dc'],[-.6,1.5,'#d8f0ff'],[1.5,1.1,'#fff8dc'],[3.0,1.6,'#ffe0e0'],[-1.8,-1.3,'#e8ffd8'],[.8,-1.4,'#fff8dc'],[2.8,-1.2,'#d8f0ff']];
  cards.forEach(([z,y,c],i)=>{const n=plane(1.6,1.8,L(c),-.2,y,z,cb);n.rotation.y=-Math.PI/2;n.rotation.x=(i%3-1)*.06});
  plane(5,.9,L(signTex('COMMUNITY BOARD',256,48,'#2a1608','#f2b24a')),-.2,3.5,0,cb).rotation.y=-Math.PI/2;
  cb.position.set(11.7,5,-1);sc.add(cb);RM.board=cb;
  // collection shelf on left wall
  const holder=new THREE.Group();holder.rotation.y=Math.PI/2;holder.position.set(-11.5,0,-1);sc.add(holder);RM.shelfHolder=holder;
  RM.shelfUnit=shelfUnit(holder,0,2.0,6,2,2.05,3.7,1.4,{lip:true});
  // posters
  [[-5.2,6.8,'#e8571f','#2a0a04'],[-2.4,6.8,'#1f4fa8','#06142e'],[3.4,6.9,'#7a2a9a','#1a0830']].forEach(([x,y,a,b])=>{const t=mkTex(48,64,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,255,.25)';c.beginPath();c.arc(w/2,h*.4,w*.26,0,7);c.fill()});box(1.9,2.5,.1,L(0x111111),x,y,-8.85,sc);plane(1.7,2.3,L(t),x,y,-8.78,sc)});
  // console on the rug
  const ps=new THREE.Group();box(2.4,.35,1.5,PH(0x15151a),0,.18,0,ps);box(.5,.3,.05,L(0x36d6ff),.7,.2,.78,ps);ps.position.set(-3.4,.04,-5.2);ps.rotation.y=.4;sc.add(ps);
})();

/* helpers for room items */
function placeRoomItems(ownedIds){
  RM.items.forEach(s=>{if(s.group.parent)s.group.parent.remove(s.group)});RM.items.length=0;RM.spots=RM.spots.filter(s=>s.type!=='item');
  const u=RM.shelfUnit,holder=RM.shelfHolder;
  const order=CAT.filter(i=>ownedIds.includes(i.id));
  order.forEach((it,i)=>{
    const sl=u.slots[i];if(!sl)return;const g=buildItem(it),[W,H,D]=DIM[it.kind],sc=it.kind==='vinyl'?.62:it.kind==='dvd'?1.0:1.0,k=it.kind==='vinyl'?.62:1;
    g.scale.setScalar(k);g.position.set(sl.x,sl.yb+H*k/2+.12,1.4/2-D*k/2-.3);g.rotation.x=-.06;holder.add(g);
    blob(holder,sl.x,sl.yb+.14,g.position.z,W*k*.95,D*k+.7,.5);
    const sp={type:'item',st:'shelf',item:it,group:g,w:W*k,h:H*k,d:D*k,k,home:{pos:g.position.clone(),rot:g.rotation.clone(),parent:holder},label:'',slot:sl};
    g.userData.spot=sp;RM.items.push(sp);RM.spots.push(sp)})}
RM.spots.push({type:'notebook',st:'desk',group:RM.notebook,w:3,h:1.4,label:'NOTEBOOK'});
RM.spots.push({type:'board',st:'board',group:RM.board,w:8.4,h:5.6,label:'COMMUNITY BOARD'});
