/* ============================================================
   PART 15: STORY MISSIONS
   Five-chapter Grove Street storyline with staged objectives:
   go-to, kill counts, recruiting, boats and aircraft.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

const MEL = {x:-300, z:-520};   /* Sweet's corner at Grove Street */

const MISSIONS = [
  { name:'Home Coming', pay:500, stages:[
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Sweet: CJ! You made it back from Liberty City. Ballas are pushing into Idlewood — go send them a message.' },
    { t:'kills', gang:'bal', n:4, say:'Sweet: Waste 4 Ballas in their Idlewood turf. Show them who runs this city.' },
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Sweet: That sent the message. Get back to the house.' },
  ]},
  { name:'Rollin Deep', pay:800, stages:[
    { t:'recruit', n:2, say:'Sweet: You ride with family. Recruit 2 homies first — press G near Families members.' },
    { t:'gotoCar', x:-150, z:-260, r:26, say:'Sweet: Now roll through Idlewood in a ride.' },
    { t:'kills', gang:'bal', n:3, say:'Sweet: There they are — light them up!' },
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Sweet: That is how we do it. Come home.' },
  ]},
  { name:'The Bay Job', pay:1000, stages:[
    { t:'goto', x:-40, z:-1447, r:10, say:"Cesar: The cousins need a package moved across the bay. Take a boat from the jetty south of the airport." },
    { t:'boat', x:-1500, z:-1100, r:70, say:'Cesar: Keep the boat steady, ese.' },
    { t:'boat', x:-2420, z:-1660, r:45, say:'Cesar: Dock her at the San Fierro marina.' },
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Cesar: Package delivered. The families owe you one, CJ.' },
  ]},
  { name:'Learning to Fly', pay:1500, stages:[
    { t:'goto', x:260, z:-2660, r:13, say:"Cesar: Verdant Meadows. Take the plane on the apron and see the state from above, holmes." },
    { t:'air', x:60, z:-950, r:90, say:'Cesar: Fly east across the state — touch the Los Santos airport sky.' },
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Cesar: That was smooth flying. Back to the Grove.' },
  ]},
  { name:'Green Sabre', pay:3000, stages:[
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:"Sweet: This is it. We take this city for the Families. Drop 8 Ballas. No mercy." },
    { t:'kills', gang:'bal', n:8, say:'Sweet: Keep going! Every one of them counts!' },
    { t:'goto', x:MEL.x, z:MEL.z, r:12, say:'Sweet: That was for the Grove, brother. You run Los Santos now, CJ.' },
  ]},
];

SA.story = SA.story || { idx:0 };
SA.mission = null;
let missionSpot = null;
let hintT = 0;

function stage(){ return SA.mission ? SA.mission.def.stages[SA.mission.st] : null; }

function stageEnter(){
  const st = stage();
  if(!st) return;
  SA.mission.k = 0;
  hintT = 0;
  SA.toast(st.say);
  if(st.t==='goto' || st.t==='gotoCar' || st.t==='boat' || st.t==='air'){
    SA.gps = {x:st.x, z:st.z};
    if(SA.beaconShow) SA.beaconShow(st.x, st.z);
  } else {
    SA.gps = null;
    if(SA.beaconHide) SA.beaconHide();
  }
}

function missionDone(){
  const m = SA.mission;
  cash += m.def.pay;
  Audio.money();
  SA.respect = (SA.respect||0) + Math.round(m.def.pay/50);
  SA.story.idx++;
  const last = SA.story.idx >= MISSIONS.length;
  SA.toast(m.def.name + ' passed! +$' + m.def.pay);
  if(last){
    cash += 5000;
    SA.respect += 150;
    SA.toast('ALL MISSIONS COMPLETE — King of Los Santos! +$5000');
    Audio.tone(500, 1500, .12, .3, 'square');
  }
  SA.mission = null;
  SA.gps = null;
  if(SA.beaconHide) SA.beaconHide();
}

function missionFail(msg){
  SA.toast(msg || 'Mission failed.');
  SA.mission = null;
  SA.gps = null;
  if(SA.beaconHide) SA.beaconHide();
}

SA.storyStart = function(){
  if(SA.mission){ SA.toast('Finish your current mission first!'); return; }
  if(SA.trial){ SA.toast('Finish the current challenge first!'); return; }
  if(SA.story.idx >= MISSIONS.length){ SA.toast('You already own this city, CJ.'); return; }
  SA.mission = { def:MISSIONS[SA.story.idx], st:0, k:0 };
  stageEnter();
  Audio.tone(600, 900, .06, .2, 'square');
};

/* kill counting for 'kills' stages (chains on top of other wraps) */
function missionKill(gang){
  const st = stage();
  if(!st || st.t!=='kills') return;
  if(st.gang && gang !== st.gang) return;
  const m = SA.mission;
  m.k++;
  Audio.tone(350 + m.k*30, 250, .05, .12, 'sawtooth');
  if(m.k >= st.n) missionNext();
}
if(SA.gangDown){
  const prevDown = SA.gangDown;
  SA.gangDown = function(ped, byPlayer){
    prevDown(ped, byPlayer);
    if(SA.mission && byPlayer) missionKill(ped.gang);
  };
}

function missionNext(){
  SA.mission.st++;
  if(SA.mission.st >= SA.mission.def.stages.length){ missionDone(); return; }
  stageEnter();
}

SA.addUpd(dt=>{
  /* dynamic mission hub label */
  if(missionSpot){
    missionSpot.label = SA.story.idx >= MISSIONS.length ? 'Story: complete' :
      (SA.mission ? ('Mission: ' + SA.mission.def.name) : ('Mission: ' + MISSIONS[SA.story.idx].name));
  }
  const m = SA.mission;
  if(!m) return;
  if(player.deadT > 0){ missionFail('You went down — mission failed. Return to the house.'); return; }
  const st = stage();
  if(!st) return;
  hintT += dt;
  const pc = cur();
  const inCar = !!pc;
  const boatOk = pc && (pc.boat || pc.kind==='boat');
  const airOk = pc && pc.py !== undefined;
  if(st.t==='kills') return;   /* driven by kill events */
  if(st.t==='recruit'){
    if(SA.recruits && SA.recruits.length >= st.n){ missionNext(); return; }
    if(hintT > 6){ hintT = 0; SA.toast('Recruit ' + st.n + ' homies (press G near Families members)'); }
    return;
  }
  const px = pc ? pc.p.x : player.x, pz = pc ? pc.p.z : player.z;
  const d = Math.hypot(px - st.x, pz - st.z);
  if(st.t==='gotoCar' && !inCar && d < 120 && hintT > 5){ hintT = 0; SA.toast('Get a car and roll up on the marker.'); }
  if(st.t==='boat' && !boatOk && d < 260 && hintT > 5){ hintT = 0; SA.toast('Find a boat — there is one at the bay jetty.'); }
  if(st.t==='air' && !airOk && d < 400 && hintT > 5){ hintT = 0; SA.toast('Take off — get in the plane first!'); }
  if(d < st.r && (!st.t || st.t==='goto' || (st.t==='gotoCar' && inCar) || (st.t==='boat' && boatOk) || (st.t==='air' && airOk))){
    Audio.tone(800, 1200, .05, .15, 'square');
    missionNext();
  }
});

/* mission hub spot at the Grove */
SA.addBuild('story', ()=>{
  missionSpot = SA.addSpot({ x:-285, z:-548, r:9, label:'Story mission', fn:()=>SA.storyStart() });
  console.log('[SA] story missions ready (' + MISSIONS.length + ' chapters)');
});

console.log('[SA] story part loaded');
})();
