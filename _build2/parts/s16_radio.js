/* ============================================================
   PART 16: RADIO
   Six procedural chiptune stations with a 16-step sequencer.
   Plays while driving. N cycles stations.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

const SCALE = [0,3,5,7,10,12,15,17];       /* minor-ish degrees 1..8 */
const STATIONS = [
  { name:'Radio Los Santos 92.3', bpm:92, root:45,
    kick:'x..x..x...x..x..', snr:'....x.......x...', hat:'.x.x.x.x.x.x.x.x',
    bass:'1..1..3...5.3...', lead:'....5...7...5...' },
  { name:'Playback FM 98.9', bpm:96, root:50,
    kick:'x...x..x.x..x...', snr:'....x.......x..x', hat:'x.x.x.x.x.x.x.x.',
    bass:'1.1..1..3.1..5..', lead:'..3..5........7.' },
  { name:'K-DST 101.1', bpm:120, root:52,
    kick:'x..x..x.x..x..x.', snr:'....x.......x...', hat:'..x...x...x...x.',
    bass:'1111111155553333', lead:'5.7.8.7.5...3...' },
  { name:'Bounce FM 108.5', bpm:108, root:53,
    kick:'x..x..x...x..x..', snr:'....x...x...x...', hat:'x.xxx.x.xx.xxx.x',
    bass:'1..3..5..1..7...', lead:'....1..3..5.....', },
  { name:'SF-UR 88.1', bpm:126, root:48,
    kick:'x...x...x...x...', snr:'....x.......x...', hat:'..x...x...x...x.',
    bass:'1.1.1.1.3.3.5.5.', lead:'5.8.7.5.3.5.8.5.' },
  { name:'K-Rose 97.3', bpm:100, root:55,
    kick:'x...x...x...x...', snr:'....x.......x...', hat:'....x.......x...',
    bass:'1..5..1..4..5..', lead:'3.5.7.8...5.3...' }
];

SA.radio = SA.radio || { on:true, idx:0 };

const midi = m => 440 * Math.pow(2, (m-69)/12);
function rBurst(dur, freq, q, vol, type, delay){
  if(!Audio.ok || Audio.muted) return;
  try{
    const ctx = Audio.ctx, t = ctx.currentTime + (delay||0);
    const src = ctx.createBufferSource(); src.buffer = Audio.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type||'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq*.22), t+dur); f.Q.value = q||1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    src.connect(f); f.connect(g); g.connect(Audio.master);
    src.start(t); src.stop(t+dur+.03);
  }catch(e){}
}

function scheduleStep(st, step, delay){
  const k = st.kick[step], s = st.snr[step], h = st.hat[step], b = st.bass[step], l = st.lead[step];
  if(k==='x') Audio.tone(140, 42, .13, .22, 'sine', delay);
  if(s==='x') rBurst(.09, 1900, .8, .13, 'bandpass', delay);
  if(h==='x') rBurst(.028, 6200, .9, .05, 'highpass', delay);
  if(b!=='.' && b!==undefined){
    const n = st.root + SCALE[(+b-1) % SCALE.length];
    Audio.tone(midi(n), midi(n), .17, .085, 'sawtooth', delay);
  }
  if(l!=='.' && l!==undefined){
    const n = st.root + 12 + SCALE[(+l-1) % SCALE.length];
    Audio.tone(midi(n), midi(n)*1.002, .2, .06, 'square', delay);
  }
}

let stepIdx = 0, nextT = 0, prevInCar = false;
SA.addUpd(dt=>{
  const st = STATIONS[SA.radio.idx % STATIONS.length];
  const inCar = !!cur();
  /* station change (ARROW keys while in a car) */
  const rHeld = !!keys.ArrowRight, lHeld = !!keys.ArrowLeft;
  if(inCar && !SA.uiOpen && ((rHeld && !SA._rHeld) || (lHeld && !SA._lHeld))){
    const dir = (rHeld && !SA._rHeld) ? 1 : -1;
    SA.radio.idx = (SA.radio.idx + dir + STATIONS.length) % STATIONS.length;
    const ns = STATIONS[SA.radio.idx];
    SA.toast('Radio: ' + ns.name);
    Audio.tone(700, 1100, .05, .12, 'square');
  }
  SA._rHeld = rHeld; SA._lHeld = lHeld;
  if(inCar && !prevInCar) SA.toast('Radio: ' + st.name + ' (press ← → to change)');
  prevInCar = inCar;
  if(!Audio.ok || !inCar || !SA.radio.on){
    if(Audio.ok) nextT = Audio.ctx.currentTime + .05;
    return;
  }
  const stepDur = 60 / st.bpm / 4;
  const now = Audio.ctx.currentTime;
  if(nextT < now - .5) nextT = now + .05;             /* tab was hidden/throttled */
  let guard = 48;
  while(nextT < now + .3 && guard-- > 0){
    scheduleStep(st, stepIdx, Math.max(0, nextT - now));
    stepIdx = (stepIdx + 1) % 16;
    nextT += stepDur;
  }
});

console.log('[SA] radio ready (' + STATIONS.length + ' stations, arrow keys to change)');
})();
