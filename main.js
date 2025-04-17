// main.js

// 1. Background Music (HTMLAudio can stay for music)
const bgMusic = new Audio('assets/audio/lookchine.mp3');
bgMusic.loop   = true;
bgMusic.volume = 0.5;

// 2. Web Audio setup for SFX
const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
const sfxNames   = ['fsharp','gsharp','asharp','csharp','dsharp','gsharphigh','asharphigh'];
let   sfxBuffers = [];

// Load & decode all SFX once at startup
async function loadSfx() {
    const promises = sfxNames.map(async name => {
        const resp  = await fetch(`assets/audio/${name}.mp3`);
        const data  = await resp.arrayBuffer();
        return await audioCtx.decodeAudioData(data);
    });
    sfxBuffers = await Promise.all(promises);
}
loadSfx();  // start loading immediately

// Play one random explosion buffer
let activeVoices = 0, MAX_VOICES = 12;
function playExplosionSound() {
    if (!sfxBuffers.length || activeVoices >= MAX_VOICES) return;
    const idx = Math.floor(Math.random()*sfxBuffers.length);
    const buf = sfxBuffers[idx];
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    activeVoices++;
    src.onended = () => activeVoices--;
    src.start();
}

// 3. Configs
const desktopConfig = {
    dotRadius:       13, explosionRadius: 60,
    minSpeed:        40, maxSpeed:       150,
    levelRules: [
        {dotsCount:5, goal:1},{dotsCount:10,goal:2},
        {dotsCount:15,goal:3},{dotsCount:20,goal:5},
        {dotsCount:25,goal:7},{dotsCount:30,goal:10},
        {dotsCount:35,goal:15},{dotsCount:40,goal:21},
        {dotsCount:45,goal:27},{dotsCount:50,goal:33},
        {dotsCount:55,goal:44},{dotsCount:60,goal:55}
    ]
};
const mobileConfig = {
    dotRadius:       12, explosionRadius: 50,
    minSpeed:        30, maxSpeed:      110,
    levelRules: [
        {dotsCount:4, goal:1},{dotsCount:8, goal:2},
        {dotsCount:12,goal:2},{dotsCount:16,goal:4},
        {dotsCount:20,goal:6},{dotsCount:24,goal:8},
        {dotsCount:28,goal:12},{dotsCount:32,goal:17},
        {dotsCount:36,goal:22},{dotsCount:40,goal:26},
        {dotsCount:44,goal:35},{dotsCount:48,goal:44}
    ]
};

// 4. State
let cfg,
    currentLevel      = 0,
    totalScore        = 0,
    explodedThisLevel = 0,
    chainActive       = false,
    globalScale       = 1;

// 5. Canvas
const canvas = document.getElementById('gameCanvas'),
    ctx    = canvas.getContext('2d');

// 6. Storage
let dots       = [],
    explosions = [];

// 7. Dot
class Dot {
    constructor(x,y,dx,dy,color){
        this.x        = x;  this.y = y;
        this.dx       = dx; this.dy = dy;
        this.baseR    = cfg.dotRadius;
        this.radius   = this.baseR * globalScale;
        this.color    = color;
        this.exploded = false;
    }
    update(dt){
        this.x += this.dx*(dt/1000);
        this.y += this.dy*(dt/1000);
        // bounce + clamp
        if(this.x-this.radius<0){
            this.x=this.radius; this.dx=Math.abs(this.dx);
        } else if(this.x+this.radius>canvas.width){
            this.x=canvas.width-this.radius; this.dx=-Math.abs(this.dx);
        }
        if(this.y-this.radius<0){
            this.y=this.radius; this.dy=Math.abs(this.dy);
        } else if(this.y+this.radius>canvas.height){
            this.y=canvas.height-this.radius; this.dy=-Math.abs(this.dy);
        }
    }
    draw(){
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.fillStyle=this.color; ctx.fill(); ctx.closePath();
    }
}

// 8. Explosion
class Explosion {
    constructor(x,y,color){
        this.x      = x;   this.y    = y;
        this.baseR  = cfg.explosionRadius;
        this.maxR   = this.baseR * globalScale;
        this.radius = 0;   this.color = color;
        this.state  = 'expanding';
        this.expD   = 1100; this.hangD = 850; this.defD = 500;
        this.eT=0; this.hT=0; this.dT=0;
    }
    easeOut(t){ return t*(2-t) }
    easeIn(t){ return t*t }
    update(dt){
        if(this.state==='expanding'){
            this.eT+=dt; let p=this.eT/this.expD; if(p>1)p=1;
            this.radius = this.maxR*this.easeOut(p);
            if(p===1) this.state='hanging';
        }
        else if(this.state==='hanging'){
            this.hT+=dt; this.radius=this.maxR;
            if(this.hT>=this.hangD) this.state='shrinking';
        }
        else {
            this.dT+=dt; let p=this.dT/this.defD; if(p>1)p=1;
            this.radius=this.maxR*(1-this.easeIn(p));
            if(p===1){ this.radius=0; return false; }
        }
        return true;
    }
    draw(){
        if(this.radius<=0) return;
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.fillStyle=this.color; ctx.fill(); ctx.closePath();
    }
}

// 9. initDots + scoreboard
function initDots(){
    const rule = cfg.levelRules[currentLevel];
    dots = []; explosions = [];
    const m = cfg.dotRadius * globalScale;
    for(let i=0;i<rule.dotsCount;i++){
        const x = Math.random()*(canvas.width-2*m)+m;
        const y = Math.random()*(canvas.height-2*m)+m;
        const a = Math.random()*Math.PI*2;
        const s = Math.random()*(cfg.maxSpeed-cfg.minSpeed)+cfg.minSpeed;
        dots.push(new Dot(
            x,y,Math.cos(a)*s,Math.sin(a)*s,
            `hsl(${Math.random()*360},100%,50%)`
        ));
    }
    updateScoreboard();
}

function updateScoreboard(){
    const rule = cfg.levelRules[currentLevel];
    document.getElementById('score').innerText  = `Score: ${totalScore}`;
    document.getElementById('level').innerText  = `Level: ${currentLevel+1}`;
    document.getElementById('points').innerText =
        `Points: ${explodedThisLevel}/${rule.goal} from ${rule.dotsCount}`;
}

// 10. Flow
function nextLevel(){
    currentLevel++;
    if(currentLevel>=cfg.levelRules.length){
        showFinalPopup();
    } else {
        explodedThisLevel=0;
        chainActive=false;
        initDots();
    }
}
function restartLevel(){
    explodedThisLevel=0;
    chainActive=false;
    initDots();
}
function resetGame(){
    currentLevel=0; totalScore=0;
    explodedThisLevel=0; chainActive=false;
    initDots();
}

// 11. Collision + SFX
function checkCollisions(){
    for(const d of dots){
        if(d.exploded) continue;
        for(const ex of explosions){
            const dist = Math.hypot(d.x-ex.x, d.y-ex.y);
            if(dist <= ex.radius+d.radius){
                d.exploded = true;
                explodedThisLevel++;
                explosions.push(new Explosion(d.x,d.y,d.color));
                playExplosionSound();
                break;
            }
        }
    }
    dots = dots.filter(d=>!d.exploded);
}

// 12. Main Loop
let lastTS = null;
function update(ts){
    if(!lastTS) lastTS=ts;
    const dt=ts-lastTS; lastTS=ts;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    dots.forEach(d=>{ d.update(dt); d.draw(); });
    explosions = explosions.filter(ex=>{ const ok=ex.update(dt); ex.draw(); return ok; });
    checkCollisions();

    if(chainActive && explosions.length===0){
        chainActive=false;
        const rule=cfg.levelRules[currentLevel];
        if(explodedThisLevel>=rule.goal){
            totalScore+=explodedThisLevel;
            setTimeout(showLevelPopup, 500);
        } else {
            setTimeout(()=>{ alert(`Try again: ${explodedThisLevel}/${rule.goal}`); restartLevel(); },500);
        }
    }

    updateScoreboard();
    requestAnimationFrame(update);
}

// 13. Popup & input
function showLevelPopup(){
    document.getElementById('nextLevelButton').innerText='Next Level';
    document.getElementById('popupMessage').innerText =
        `Level ${currentLevel+1} complete!\n`+
        `You got ${explodedThisLevel} (min ${cfg.levelRules[currentLevel].goal}).\n`+
        `Total Score: ${totalScore}`;
    document.getElementById('popupOverlay').style.display='flex';
}
function showFinalPopup(){
    document.getElementById('nextLevelButton').innerText='Play Again';
    document.getElementById('popupMessage').innerText =
        `CONGRATULATIONS!\nYou finished all levels!\nFinal Score: ${totalScore}`;
    document.getElementById('popupOverlay').style.display='flex';
}
function hidePopup(){
    document.getElementById('popupOverlay').style.display='none';
}

document.getElementById('nextLevelButton')
    .addEventListener('click', ()=>{
        hidePopup();
        if(currentLevel >= cfg.levelRules.length) resetGame();
        else nextLevel();
    });

canvas.addEventListener('click', e=>{
    if(chainActive) return;
    chainActive=true;
    const r=canvas.getBoundingClientRect(),
        x=e.clientX-r.left, y=e.clientY-r.top;
    explosions.push(new Explosion(x,y,'white'));
    // start audioCtx on first user gesture
    if(audioCtx.state==='suspended') audioCtx.resume();
    playExplosionSound();
});

// 14. Responsive Canvas
function resizeCanvas(){
    const MAX=800;
    let w=window.innerWidth; if(w>MAX) w=MAX;
    let h=w*(600/800);
    canvas.width=w; canvas.height=h;
    globalScale=w/MAX;
}
window.addEventListener('load',resizeCanvas);
window.addEventListener('resize',resizeCanvas);

// 15. Start Game
function startGame(){
    cfg = window.innerWidth<600 ? mobileConfig : desktopConfig;
    document.getElementById('startScreen').style.display='none';
    if(audioCtx.state==='suspended') audioCtx.resume();
    bgMusic.play().catch(_=>{});
    explodedThisLevel=0; chainActive=false;
    initDots();
    lastTS=null;
    requestAnimationFrame(update);
}
document.getElementById('startBtn')
    .addEventListener('click', startGame);