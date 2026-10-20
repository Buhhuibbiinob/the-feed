/* ===== core utilities ===== */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wait=s=>new Promise(r=>setTimeout(r,s*1000));
const ease={out:t=>1-Math.pow(1-t,3),io:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,back:t=>{const c=1.7,d=c+1;return 1+d*Math.pow(t-1,3)+c*Math.pow(t-1,2)},lin:t=>t,sq:t=>t*t};
const tweens=[];
function tween(dur,fn,ez=ease.io){return new Promise(res=>{tweens.push({t:0,dur:Math.max(dur,.001),fn,ez,res})})}
function tickTweens(dt){for(let i=tweens.length-1;i>=0;i--){const w=tweens[i];w.t+=dt;const k=Math.min(1,w.t/w.dur);w.fn(w.ez(k));if(k>=1){tweens.splice(i,1);w.res()}}}
function moveV(v,to,dur,ez){const f=v.clone();return tween(dur,k=>v.lerpVectors(f,to,k),ez)}
function rotE(e,to,dur,ez){const f=[e.x,e.y,e.z];return tween(dur,k=>{e.x=f[0]+(to[0]-f[0])*k;e.y=f[1]+(to[1]-f[1])*k;e.z=f[2]+(to[2]-f[2])*k},ez)}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function toast(msg,ms=2400){const t=$('#toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',ms)}
function stars(n){return '★'.repeat(n)+'☆'.repeat(5-n)}
const LIMIT=5;

/* ===== catalog (real titles, artists, directors, years) ===== */
const KIND_LABEL={cd:'CD',vinyl:'Vinyl LP',tape:'Cassette',mixtape:'Mixtape',dvd:'DVD'};
const CAT=[
// CDs
['cd','channel-orange','Channel Orange','Frank Ocean',2012,'R&B','electro-soul','Debut studio album blending soul, funk and electronic textures, with long, story-driven songs.','#e8571f','#7a1d0a',2],
['cd','damn','DAMN.','Kendrick Lamar',2017,'Hip-hop','hiphop','Fourth studio album, tightly sequenced and hard-hitting, built around themes of fate and faith.','#c3281c','#220806',5],
['cd','tpab','To Pimp a Butterfly','Kendrick Lamar',2015,'Hip-hop','hiphop','Dense, jazz- and funk-soaked record about fame, race and self-worth.','#e8dcc0','#4a3a1c',4],
['cd','doowops','Doo-Wops & Hooligans','Bruno Mars',2010,'Pop','rnb','Debut album of bright, retro-leaning pop and reggae-tinged hooks.','#f0b93a','#b3501a',0],
['cd','black-panther','Black Panther: The Album','Kendrick Lamar & Various Artists',2018,'Soundtrack','hiphop','Curated companion album to the film, mixing rap, R&B and African artists.','#1b1b22','#6b5a1e',3],
['cd','ram','Random Access Memories','Daft Punk',2013,'Electronic','electro','Live-instrument disco and funk record with a long list of guest collaborators.','#2b2b2b','#a68a3a',6],
['cd','discovery','Discovery','Daft Punk',2001,'Electronic','electro','French house landmark, loop-driven and full of pop and disco samples.','#2a50c8','#e8a02a',1],
['cd','illmatic','Illmatic','Nas',1994,'Hip-hop','hiphop','Concise debut, regarded as a landmark of East Coast rap storytelling.','#7a6a4a','#2a2216',7],
['cd','lauryn','The Miseducation of Lauryn Hill','Lauryn Hill',1998,'Neo-soul','rnb','Her only solo studio album, mixing hip-hop, soul and reggae.','#d8a43a','#5a3a12',2],
['cd','voodoo','Voodoo','D\'Angelo',2000,'Neo-soul','rnb','Slow-burning, loose-limbed neo-soul record built on live grooves.','#8a3a1c','#1a0c06',6],
['cd','gkmc','good kid, m.A.A.d city','Kendrick Lamar',2012,'Hip-hop','hiphop','Major-label debut told as a cinematic coming-of-age story set in Compton.','#6a8aa8','#1a2230',5],
['cd','blonde','Blonde','Frank Ocean',2016,'R&B','electro-soul','Spare, experimental follow-up to Channel Orange, heavy on guitars and voice.','#d9d9d4','#3a3a3a',3],
// Vinyl
['vinyl','kind-of-blue','Kind of Blue','Miles Davis',1959,'Jazz','jazz','Modal jazz classic recorded with a small group in just two sessions.','#1b3f8f','#0a1a40',4],
['vinyl','rumours','Rumours','Fleetwood Mac',1977,'Rock','rock','Soft-rock landmark written amid band break-ups and shared heartbreak.','#6b4a2a','#d8c8a0',1],
['vinyl','whats-going-on','What\'s Going On','Marvin Gaye',1971,'Soul','rnb','Suite-like soul album about war, poverty and the environment.','#c8b88a','#3a2a18',0],
['vinyl','key-of-life','Songs in the Key of Life','Stevie Wonder',1976,'Soul','rnb','Sprawling double album of soul, funk and jazz-inflected pop.','#2a8a4a','#0e3a1c',2],
['vinyl','purple-rain','Purple Rain','Prince and The Revolution',1984,'Pop/Rock','rock','Soundtrack album that fused funk, rock and synth-pop.','#6a2a9a','#1e0a30',7],
['vinyl','thriller','Thriller','Michael Jackson',1982,'Pop','rnb','Best-selling pop album of its era, polished by producer Quincy Jones.','#2a2a30','#c8a04a',3],
['vinyl','love-supreme','A Love Supreme','John Coltrane',1965,'Jazz','jazz','Four-part spiritual jazz suite recorded by the classic quartet.','#2a6a8a','#0a2230',6],
['vinyl','nevermind','Nevermind','Nirvana',1991,'Grunge','rock','Breakthrough album that pushed grunge into the mainstream.','#2a78c8','#0c2a50',4],
// Cassettes / mixtapes
['tape','low-end','The Low End Theory','A Tribe Called Quest',1991,'Hip-hop','jazz','Jazz-inflected sophomore album, a touchstone of alternative hip-hop.','#3a8a3a','#c83a1a',5],
['tape','36-chambers','Enter the Wu-Tang (36 Chambers)','Wu-Tang Clan',1993,'Hip-hop','hiphop','Raw, kung-fu-flavored debut from a nine-member Staten Island crew.','#e8c01a','#1a1a1a',3],
['tape','ready-to-die','Ready to Die','The Notorious B.I.G.',1994,'Hip-hop','hiphop','Debut album mixing street tales, humor and radio-ready hooks.','#c8c8c0','#2a2a2a',0],
['tape','the-chronic','The Chronic','Dr. Dre',1992,'Hip-hop','hiphop','Solo debut that defined the laid-back, synth-heavy G-funk sound.','#2a8a2a','#1a1a0a',1],
['tape','dummy','Dummy','Portishead',1994,'Trip-hop','rnb','Moody, sample-based debut with film-noir atmosphere.','#5a6a7a','#161a20',6],
['mixtape','acid-rap','Acid Rap','Chance the Rapper',2013,'Mixtape','hiphop','Free mixtape of bright, jazzy, personal Chicago rap.','#f08a2a','#6a2a8a',2],
['mixtape','coloring-book','Coloring Book','Chance the Rapper',2016,'Mixtape','hiphop','Gospel-driven mixtape that earned a Grammy as a streaming-only release.','#5ab0e8','#e8c83a',7],
['tape','late-registration','Late Registration','Kanye West',2005,'Hip-hop','rnb','Orchestral, soul-sampling second album produced with Jon Brion.','#8a4a2a','#2a1408',3],
['tape','one-in-a-million','One in a Million','Aaliyah',1996,'R&B','rnb','Second album with Timbaland and Missy Elliott, a landmark of futuristic R&B.','#9ab8d8','#2a3a58',4],
['tape','the-score','The Score','Fugees',1996,'Hip-hop','rnb','Second album mixing hip-hop, reggae and soul, with a hit cover at its center.','#c8782a','#3a1c08',1],
// DVDs
['dvd','matrix','The Matrix','Directed by the Wachowskis',1999,'Sci-fi','score','A hacker discovers his reality is a simulation, in a landmark action film.','#0c3a1c','#02100a',3],
['dvd','spirited-away','Spirited Away','Directed by Hayao Miyazaki',2001,'Animation','score','A girl wanders into a bathhouse for spirits in this Studio Ghibli classic.','#2a6aa8','#e8b84a',2],
['dvd','pulp-fiction','Pulp Fiction','Directed by Quentin Tarantino',1994,'Crime','score','Interlocking Los Angeles crime stories told out of order.','#c8281c','#f0d838',5],
['dvd','shrek','Shrek','Directed by Andrew Adamson & Vicky Jenson',2001,'Animation','score','An ogre and a talking donkey set out to rescue a princess, fairy-tale rules optional.','#5aa83a','#1e4a14',0],
['dvd','fellowship','The Lord of the Rings: The Fellowship of the Ring','Directed by Peter Jackson',2001,'Fantasy','score','A hobbit inherits a ring and sets out with eight companions to destroy it.','#8a6a2a','#1a1208',7],
['dvd','nemo','Finding Nemo','Directed by Andrew Stanton',2003,'Animation','score','An anxious clownfish crosses the ocean to find his son.','#18a8d8','#f08a1a',1],
['dvd','kill-bill','Kill Bill: Vol. 1','Directed by Quentin Tarantino',2003,'Action','score','A former assassin sets out for revenge on her old team.','#f0d018','#1a1a1a',4],
['dvd','amelie','Amélie','Directed by Jean-Pierre Jeunet',2001,'Romance','score','A shy Parisian waitress quietly improves the lives of those around her.','#c8281c','#2a6a3a',6],
['dvd','donnie-darko','Donnie Darko','Directed by Richard Kelly',2001,'Sci-fi','score','A troubled teenager is warned of the end of the world by a figure in a rabbit suit.','#1a1a30','#6a2a8a',3],
['dvd','lost-in-translation','Lost in Translation','Directed by Sofia Coppola',2003,'Drama','score','Two lonely strangers form a bond in a Tokyo hotel.','#e87aa8','#2a3a6a',2]
].map(r=>({kind:r[0],id:r[1],title:r[2],by:r[3],year:r[4],genre:r[5],style:r[6],blurb:r[7],c1:r[8],c2:r[9],pat:r[10]}));
const ITEM={};CAT.forEach(i=>ITEM[i.id]=i);
const isMusic=i=>i.kind!=='dvd';

/* ===== procedural cover typography (title/artist text is real; artwork is a placeholder slot) ===== */
const coverCanvas={};const coverURL={};
function wrapText(c,text,maxW){const words=text.split(' ');const lines=[];let cur='';for(const w of words){const t=cur?cur+' '+w:w;if(c.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t}if(cur)lines.push(cur);return lines}
function lum(hex){const n=parseInt(hex.slice(1),16);return(.299*(n>>16)+.587*(n>>8&255)+.114*(n&255))/255}
function drawPattern(c,w,h,it){
  const r=rng(hash(it.id)),p=it.pat;c.save();
  c.globalAlpha=.28;c.fillStyle=it.c2;c.strokeStyle=it.c2;
  if(p===0){for(let y=0;y<h;y+=h/9){c.fillRect(0,y,w,h/18)}}
  else if(p===1){for(let i=0;i<5;i++){c.beginPath();c.arc(w*.5,h*.62,w*(.15+i*.1),0,7);c.lineWidth=w*.03;c.stroke()}}
  else if(p===2){c.beginPath();c.arc(w*.5,h*.66,w*.28,0,7);c.fill();for(let i=0;i<9;i++){c.save();c.translate(w*.5,h*.66);c.rotate(i*Math.PI/9-Math.PI);c.fillRect(w*.3,-2,w*.5,4);c.restore()}}
  else if(p===3){c.lineWidth=2;for(let x=0;x<=w;x+=w/8){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}for(let y=0;y<=h;y+=h/8){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}}
  else if(p===4){for(let i=-4;i<8;i++){c.beginPath();c.moveTo(i*w/4,0);c.lineTo(i*w/4+w*.18,0);c.lineTo(i*w/4+w*.18+h*.5,h);c.lineTo(i*w/4+h*.5,h);c.fill()}}
  else if(p===5){for(let y=0;y<h;y+=h/14)for(let x=0;x<w;x+=w/14){c.beginPath();c.arc(x+3,y+3,(1-y/h)*w/34+1,0,7);c.fill()}}
  else if(p===6){c.lineWidth=w*.035;for(let j=0;j<7;j++){c.beginPath();for(let x=0;x<=w;x+=6)c.lineTo(x,h*.5+j*h*.07-h*.2+Math.sin(x/w*8+j)*h*.05);c.stroke()}}
  else{for(let i=0;i<14;i++){c.fillRect(r()*w,r()*h,w*(.1+r()*.25),h*(.05+r()*.2))}}
  c.restore()}
function drawCoverFace(it,w,h){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');
  const g=c.createLinearGradient(0,0,w*.4,h);g.addColorStop(0,it.c1);g.addColorStop(1,it.c2);c.fillStyle=g;c.fillRect(0,0,w,h);
  drawPattern(c,w,h,it);
  const dark=lum(it.c1)<.55,fg=dark?'#fff6e0':'#1a1208';
  c.fillStyle=fg;c.textBaseline='top';c.textAlign='left';
  const pad=w*.07,maxW=w-pad*2;
  let fs=it.kind==='dvd'?w*.15:w*.13,lines;
  do{c.font=`700 ${fs}px "Chakra Petch",Arial,sans-serif`;lines=wrapText(c,it.title,maxW);fs-=1.5}while((lines.length>4||Math.max(...lines.map(l=>c.measureText(l).width))>maxW)&&fs>10);
  const top=it.kind==='dvd'?h*.1:pad;
  lines.forEach((l,i)=>{c.shadowColor=dark?'rgba(0,0,0,.55)':'rgba(255,255,255,.35)';c.shadowBlur=0;c.shadowOffsetX=1.5;c.shadowOffsetY=1.5;c.fillText(l,pad,top+i*fs*1.05)});
  c.shadowColor='transparent';
  c.font=`600 ${Math.max(10,w*.06)}px "Chakra Petch",Arial,sans-serif`;c.textBaseline='bottom';
  const by=it.kind==='dvd'?it.by.replace('Directed by ','A film by '):it.by;
  const bl=wrapText(c,by,maxW);bl.slice(0,2).forEach((l,i,a)=>c.fillText(l,pad,h-pad-(a.length-1-i)*w*.07-(it.kind==='dvd'?h*.09:0)));
  if(it.kind==='dvd'){c.fillStyle='rgba(0,0,0,.65)';c.fillRect(0,h-h*.075,w,h*.075);c.fillStyle='#fff';c.font=`700 ${w*.05}px "Share Tech Mono",monospace`;c.textBaseline='middle';c.fillText('DVD-VIDEO · WIDESCREEN · '+it.year,pad,h-h*.0375)}
  return cv}
function coverSize(it){return it.kind==='dvd'?[160,226]:it.kind==='tape'||it.kind==='mixtape'?[176,176]:[192,192]}
function getCover(it){
  if(!coverCanvas[it.id]){const[w,h]=coverSize(it);coverCanvas[it.id]=drawCoverFace(it,w,h)}
  return coverCanvas[it.id]}
function coverThumb(it){if(!coverURL[it.id]){try{coverURL[it.id]=getCover(it).toDataURL('image/png')}catch(e){coverURL[it.id]=''}}return coverURL[it.id]}
const coverTexCbs=[];
function applyUploadedCover(it,url){
  const img=new Image();img.onload=()=>{const cv=getCover(it),c=cv.getContext('2d');
    const s=Math.max(cv.width/img.width,cv.height/img.height),dw=img.width*s,dh=img.height*s;
    c.drawImage(img,(cv.width-dw)/2,(cv.height-dh)/2,dw,dh);coverURL[it.id]=null;it.hasArt=true;coverTexCbs.forEach(f=>f(it))};
  img.src=url}

/* ===== audio ===== */
const A={ctx:null,
init(){if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const x=this.ctx=new C();this.master=x.createGain();this.master.gain.value=.85;
  this.an=x.createAnalyser();this.an.fftSize=64;this.an.smoothingTimeConstant=.7;this.master.connect(this.an);this.an.connect(x.destination);
  this.mb=x.createGain();this.mf=x.createBiquadFilter();this.mf.type='lowpass';this.mf.frequency.value=18000;this.mb.connect(this.mf);this.mf.connect(this.master);
  const len=x.sampleRate*2,nb=x.createBuffer(1,len,x.sampleRate),d=nb.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.nbuf=nb;
  this.lfo=x.createOscillator();this.lfo.frequency.value=.7;this.lfoG=x.createGain();this.lfoG.gain.value=0;this.lfo.connect(this.lfoG);this.lfo.start()},
tone(f,dur=.08,type='square',vol=.12,slide=0,when=0){if(!this.ctx)return;const x=this.ctx,t=x.currentTime+when,o=x.createOscillator(),g=x.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+dur+.02)},
noise(dur=.1,vol=.15,f=2000,when=0,q=1){if(!this.ctx)return;const x=this.ctx,t=x.currentTime+when,s=x.createBufferSource();s.buffer=this.nbuf;const b=x.createBiquadFilter();b.type='bandpass';b.frequency.value=f;b.Q.value=q;const g=x.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(b);b.connect(g);g.connect(this.master);s.start(t,Math.random());s.stop(t+dur+.02)},
sfx:{move(){A.tone(1040,.04,'square',.07)},select(){A.tone(660,.06,'square',.1);A.tone(990,.09,'square',.1,0,.06)},back(){A.tone(500,.08,'square',.09,-200)},
  grab(){A.noise(.09,.2,900);A.tone(150,.08,'triangle',.18,-60)},place(){A.noise(.07,.18,1400);A.tone(220,.07,'triangle',.18,-80)},
  pan(){A.noise(.5,.05,600,0,.6)},error(){A.tone(180,.18,'sawtooth',.12,-50);A.tone(150,.2,'sawtooth',.12,-40,.12)},
  register(){A.noise(.05,.2,3500);A.tone(1318,.12,'square',.08,0,.08);A.tone(1760,.35,'square',.08,0,.16);A.noise(.2,.1,5000,.2)},
  spin(){A.noise(.6,.04,300,0,.5)},click(){A.tone(1400,.02,'square',.06)},
  confirm(){[523,659,784,1046].forEach((f,i)=>A.tone(f,.12,'square',.09,0,i*.07))}}
};
const Prev={timer:null,item:null,playing:false,medium:null,voices:[],
start(it){if(!A.ctx)return;this.stop();A.init();const x=A.ctx,r=rng(hash(it.id));this.item=it;this.playing=true;
  const g=it.style,P={'hiphop':[88,'min'],'electro-soul':[78,'min'],'rnb':[82,'maj7'],'jazz':[118,'jazz'],'rock':[124,'maj'],'electro':[116,'min'],'score':[64,'min']}[g]||[90,'min'];
  this.bpm=P[0]+Math.floor(r()*14)-6;this.root=40+Math.floor(r()*10);this.mode=P[1];this.style=g;this.r=r;this.step=0;this.next=x.currentTime+.08;this.seed=hash(it.id);
  const med=it.kind==='vinyl'?'vinyl':(it.kind==='tape'||it.kind==='mixtape')?'tape':it.kind==='dvd'?'dvd':'cd';this.medium=med;
  A.mf.frequency.value=med==='vinyl'?7200:med==='tape'?5200:med==='dvd'?9000:18000;
  A.lfoG.gain.value=med==='tape'?18:0;
  const pats={'hiphop':['x..x..x.x.......','....x.......x...','x.x.x.x.x.x.x.xx'],'electro-soul':['x.....x...x.....','....x.......x...','..x...x...x...x.'],'rnb':['x.....x...x.....','....x.......x...','x.x.x.x.x.x.x.x.'],'jazz':['x.......x.......','..............x.','x..xx..xx..xx..x'],'rock':['x.....x.x.......','....x.......x...','x.x.x.x.x.x.x.x.'],'electro':['x...x...x...x...','....x.......x...','.x.x.x.x.x.x.x.x'],'score':['................','................','................']};
  this.pat=pats[g]||pats.hiphop;
  const degs=this.mode==='maj'?[[0,4,7],[5,9,12],[7,11,14],[3,7,10]]:[[0,3,7,10],[8,12,15],[5,8,12],[7,10,14]];
  this.prog=[0,5,3,4].map(()=>degs[Math.floor(r()*degs.length)]);this.rootsOff=[0,[0,3,5,7,8,10][Math.floor(r()*6)],[0,2,3,5,7][Math.floor(r()*5)],[0,5,7,10][Math.floor(r()*4)]];
  this.scale=this.mode==='maj'?[0,2,4,7,9]:[0,3,5,7,10];
  if(med==='vinyl'||med==='tape'){this.noiseSrc=x.createBufferSource();this.noiseSrc.buffer=A.nbuf;this.noiseSrc.loop=true;const f=x.createBiquadFilter();f.type=med==='tape'?'highpass':'bandpass';f.frequency.value=med==='tape'?5000:2500;this.ng=x.createGain();this.ng.gain.value=med==='tape'?.014:.02;this.noiseSrc.connect(f);f.connect(this.ng);this.ng.connect(A.master);this.noiseSrc.start();
    if(med==='vinyl'){this.crk=setInterval(()=>{if(Math.random()<.7)A.noise(.012,.12*Math.random()+.03,3000+Math.random()*4000)},170)}}
  this.timer=setInterval(()=>this.sched(),25);this.sched()},
stop(){this.playing=false;clearInterval(this.timer);clearInterval(this.crk);this.crk=null;if(this.noiseSrc){try{this.noiseSrc.stop()}catch(e){}this.noiseSrc=null}if(A.lfoG)A.lfoG.gain.value=0;if(A.mf)A.mf.frequency.value=18000;
  if(A.mb&&A.ctx){A.mb.disconnect();A.mb=A.ctx.createGain();A.mb.connect(A.mf)}},
v(f,t,d,type,vol,cut){const x=A.ctx,o=x.createOscillator(),g=x.createGain(),fl=x.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut||3000;A.lfoG.connect(o.detune);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(fl);fl.connect(g);g.connect(A.mb);o.start(t);o.stop(t+d+.05)},
mtof:m=>440*Math.pow(2,(m-69)/12),
sched(){if(!this.playing)return;const x=A.ctx;while(this.next<x.currentTime+.14){this.play(this.step,this.next);this.next+=60/this.bpm/4;this.step++}},
play(s,t0){const x=A.ctx,st=s%16,bar=Math.floor(s/16)%4,spb=60/this.bpm/4,t=t0+(((this.style==='jazz'||this.style==='hiphop')&&st%2)?spb*.22:0),ch=this.prog[bar],ro=this.root+this.rootsOff[bar],P=this.pat,sty=this.style;
  if(P[0][st]==='x'){A.tone(130,.14,'sine',.34,-90,t-x.currentTime);A.noise(.02,.15,200,t-x.currentTime)}
  if(P[1][st]==='x'){A.noise(.14,.17,1900,t-x.currentTime,.8);A.tone(190,.08,'triangle',.1,-60,t-x.currentTime)}
  if(P[2][st]==='x'){A.noise(.03,.05+(st%4===0?.03:0),7000,t-x.currentTime,2)}
  if(sty==='score'){if(st===0){ch.forEach((n,i)=>{this.v(this.mtof(ro+12+n),t,spb*15,'sawtooth',.06,900+bar*150);this.v(this.mtof(ro+12+n)*1.004,t,spb*15,'sawtooth',.05,800)});this.v(this.mtof(ro-12),t,spb*15,'sine',.22,300)}
    if(st%2===0&&this.r()<.8){const n=ro+24+this.scale[Math.floor(this.r()*5)];this.v(this.mtof(n),t,spb*3,'triangle',.07,2400)}return}
  const isKick=P[0][st]==='x';
  if(sty==='jazz'){if(st%4===0){const n=ro-12+ch[(st/4+bar)%ch.length%ch.length]%12;this.v(this.mtof(n),t,spb*3.6,'sine',.3,500)}if([0,6,10,14].includes(st)&&this.r()<.8){ch.forEach(n=>this.v(this.mtof(ro+12+n),t,spb*2.4,'triangle',.05,1800))}}
  else{if(isKick||st%8===6){this.v(this.mtof(ro-12+(bar%2&&st>7?7:0)),t,spb*2.6,sty==='rock'?'sawtooth':'sine',sty==='rock'?.12:.3,sty==='rock'?420:260)}
    if(st===0||(['hiphop','rnb','electro-soul'].includes(sty)&&(st===6||st===10))){ch.forEach(n=>this.v(this.mtof(ro+12+n),t,spb*(st===0?6:2.5),sty==='rock'?'sawtooth':'triangle',sty==='rock'?.06:.06,sty==='rock'?1500:1900))}}
  if(sty==='electro'){const n=ro+24+this.scale[Math.floor(this.r()*5)]+(st%8===0?-12:0);this.v(this.mtof(n),t,spb*1.4,'sawtooth',.05,1200+Math.sin(s/9)*900)}
  else if(st%4===2&&this.r()<.6){const n=ro+24+this.scale[Math.floor(this.r()*5)];this.v(this.mtof(n),t,spb*2.2,sty==='rock'?'square':'triangle',.07,2600)}}
};
function bits(buf,b){const l=Math.pow(2,b);return buf.map(v=>Math.round(v*l)/l)}
const Voice={talking:false,mouth:0,
speak(text){return new Promise(res=>{
  A.init();this.talking=true;
  // lo-fi layer under the voice: crushed hiss and crackle (the speech itself cannot be routed through WebAudio)
  let lo=null;if(A.ctx){const x=A.ctx,s=x.createBufferSource();s.buffer=A.nbuf;s.loop=true;const f=x.createBiquadFilter();f.type='bandpass';f.frequency.value=2600;f.Q.value=.7;const g=x.createGain();g.gain.value=.018;s.connect(f);f.connect(g);g.connect(A.master);s.start();lo={s,g}}
  const done=()=>{if(!this.talking)return;this.talking=false;this.mouth=0;if(lo){try{lo.s.stop()}catch(e){}}res()};
  const ss=window.speechSynthesis;let fired=false;
  if(ss&&window.SpeechSynthesisUtterance){try{ss.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;u.pitch=1.18;u.volume=1;const vs=ss.getVoices().filter(v=>/^en/i.test(v.lang));const pick=vs.find(v=>/female|samantha|zira|aria|jenny|google us/i.test(v.name))||vs[0];if(pick)u.voice=pick;
    u.onstart=()=>{fired=true};u.onend=done;u.onerror=()=>{fallback()};u.onboundary=()=>{fired=true};ss.speak(u);setTimeout(()=>{if(!fired)fallback()},900);setTimeout(done,text.length*95+2500);return}catch(e){}}
  fallback();
  function fallback(){if(Voice.fb)return;Voice.fb=true;const n=text.length;for(let i=0;i<n;i++){const ch=text[i];if(ch===' ')continue;A.tone(180+(ch.charCodeAt(0)*13)%260,.06,'square',.06,0,i*.06)}setTimeout(()=>{Voice.fb=false;done()},n*60+300)}
})},
cancel(){try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}this.talking=false;this.mouth=0}};

/* ===== persistence: shared db when available, device storage otherwise ===== */
const Store={db:null,uid:null,mode:'local',canWrite:true,isEditor:false,assets:null,handle:'',
async init(){
  try{if(window.claude&&claude.use){const db=await claude.use('db'),user=await claude.use('user');
    if(db&&user){const id=await user.id();if(id){this.db=db;this.uid=id;this.mode='shared';
      try{const w=await user.can('data.write');if(w===false)this.canWrite=false}catch(e){}
      try{this.isEditor=!!(user.canEdit&&user.canEdit())}catch(e){}}}
    try{this.assets=await claude.use('assets')}catch(e){}}}catch(e){}
  if(!this.db){this.uid='local'}
  try{this.handle=(await this.getProfile()).handle||''}catch(e){}},
ls(k,d){try{return JSON.parse(localStorage.getItem('rds:'+k))??d}catch(e){return d}},
lset(k,v){try{localStorage.setItem('rds:'+k,JSON.stringify(v))}catch(e){}},
ucol(){return this.db.collection('data/users/'+this.uid)},
async getProfile(){if(this.db){const s=await this.ucol().doc('profile').get();return s.exists?s.data():{}}return this.ls('profile',{})},
async saveProfile(handle){this.handle=handle;if(this.db){await this.ucol().doc('profile').set({handle})}else this.lset('profile',{handle})},
async getDaily(){const k=todayKey();if(this.db){const s=await this.ucol().doc('daily-'+k).get();return s.exists?{count:s.data().count||0,items:s.data().items||[]}:{count:0,items:[]}}const d=this.ls('daily-'+k,null);return d||{count:0,items:[]}},
async checkout(ids){ // limit enforced here, against the stored per-day record
  const d=await this.getDaily();if(d.count+ids.length>LIMIT)return{ok:false,left:Math.max(0,LIMIT-d.count)};
  const nd={count:d.count+ids.length,items:d.items.concat(ids.map(id=>({id,ts:Date.now()})))};const k=todayKey();
  if(this.db){await this.ucol().doc('daily-'+k).set(nd);for(const id of ids)await this.ucol().doc('own-'+id).set({id,ts:Date.now()})}
  else{this.lset('daily-'+k,nd);const o=this.ls('own',{});ids.forEach(id=>o[id]=Date.now());this.lset('own',o)}
  return{ok:true,left:LIMIT-nd.count}},
async owned(){if(this.db){const s=await this.ucol().get();return s.docs.filter(d=>d.id.startsWith('own-')).map(d=>d.data().id)}return Object.keys(this.ls('own',{}))},
reviews:[],revCbs:[],
watchReviews(){if(this.db){this.db.collection('reviews').onSnapshot(s=>{this.reviews=s.docs.map(d=>({_id:d.id,...d.data()}));this.revCbs.forEach(f=>f())},()=>{})}else{this.reviews=this.ls('reviews',[]);}},
async postReview(r){const id=this.uid+'_'+r.itemId;if(this.db){await this.db.collection('reviews').doc(id).set(r)}else{const l=this.ls('reviews',[]).filter(x=>x._id!==id);l.push({_id:id,...r});this.lset('reviews',l);this.reviews=l;this.revCbs.forEach(f=>f())}},
watchCovers(cb){if(this.db){this.db.collection('covers').onSnapshot(s=>s.docs.forEach(d=>cb(d.id,d.data().url)),()=>{})}else{const c=this.ls('covers',{});Object.keys(c).forEach(k=>cb(k,c[k]))}},
async setCover(id,url){if(this.db)await this.db.collection('covers').doc(id).set({url});else{const c=this.ls('covers',{});c[id]=url;this.lset('covers',c)}}};
