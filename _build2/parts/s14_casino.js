/* ============================================================
   PART 14: CASINO GAMBLING
   Blackjack + Wheel of Fortune at the four LV casinos.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

const BETS = { 'The Pyramid':100, 'Camelot Castle':100, 'Four Dragons':500, 'The Big Dome':250 };

function drawCard(){
  const v = 1 + Math.floor(Math.random()*13);
  const val = v===1 ? 11 : (v>10 ? 10 : v);
  const name = v===1 ? 'A' : (v===11 ? 'J' : (v===12 ? 'Q' : (v===13 ? 'K' : String(v))));
  return {v, val, name};
}
function handTotal(h){
  let t = 0, aces = 0;
  for(const c of h){ t += c.val; if(c.v===1) aces++; }
  while(t > 21 && aces > 0){ t -= 10; aces--; }
  return t;
}
function handStr(h){ return h.map(c=>c.name).join(' '); }

SA.casinoBiggestWin = 0;

/* ---------- table markup ---------- */
function tableHtml(title, handLine, dealerLine, resultLine, buttons, note){
  return '<h2>'+title+'</h2>'+
    (handLine ? '<div class="msub">'+handLine+'</div>' : '')+
    (dealerLine ? '<div class="msub">'+dealerLine+'</div>' : '')+
    (resultLine ? '<div class="note" style="color:#ffd76a;font-weight:700">'+resultLine+'</div>' : '')+
    '<div class="btns">'+buttons+'</div>'+
    (note ? '<div class="note">'+note+'</div>' : '');
}

function winTone(big){ Audio.tone(big?600:480, big?1400:900, .07, .25, 'square'); }

/* ---------- blackjack ---------- */
function bjMenu(msg){
  const b = SA._bj;
  if(!b || b.done){
    const bet = BETS[SA._cas.name] || 100;
    SA.openPanel(tableHtml('Blackjack — '+SA._cas.name,
      null, null, msg||'',
      '<button data-a="bjDeal">DEAL ($'+bet+' ante)</button>'+
      '<button data-a="casWheel">WHEEL OF FORTUNE ($50)</button>'+
      '<button data-a="casClose" class="alt">LEAVE THE TABLE</button>',
      'Blackjack pays double. Dealer stands on 17.'));
    SA.actions.bjDeal = () => {
      const bet2 = BETS[SA._cas.name] || 100;
      if(cash < bet2){ SA.toast('Not enough cash for the ante.'); return; }
      cash -= bet2; Audio.money();
      SA._bj = { bet:bet2, ph:[drawCard(), drawCard()], dh:[drawCard(), drawCard()], done:false };
      bjPlay();
    };
    SA.actions.casWheel = () => wheelMenu();
    SA.actions.casClose = () => SA.closeModal();
    return;
  }
  bjPlay();
}

function bjPlay(msg){
  const b = SA._bj;
  const pt = handTotal(b.ph), dt = handTotal(b.dh);
  const ptxt = 'YOUR HAND: '+handStr(b.ph)+'  ('+pt+' )';
  const dtext = 'DEALER: '+b.dh[0].name+'  ?';
  SA.openPanel(tableHtml('Blackjack — '+SA._cas.name,
    ptxt, dtext, msg||b.last||'',
    '<button data-a="bjHit">HIT</button>'+
    '<button data-a="bjStand">STAND</button>'+
    '<button data-a="casClose" class="alt">LEAVE</button>',
    'Ante $'+b.bet+' · pays double · dealer stands on 17'));
  SA.actions.bjHit = () => {
    if(b.done) return;
    b.ph.push(drawCard());
    if(handTotal(b.ph) > 21){
      b.done = true;
      b.last = 'BUST! The dealer takes your $'+b.bet+'.';
      Audio.fail();
      bjPlay();
    } else if(handTotal(b.ph) === 21) bjStand();
    else bjPlay();
  };
  SA.actions.bjStand = () => bjStand();
}

function bjStand(){
  const b = SA._bj;
  if(!b || b.done) return;
  while(handTotal(b.dh) < 17) b.dh.push(drawCard());
  const pt = handTotal(b.ph), dt = handTotal(b.dh);
  let msg;
  if(dt > 21){ cash += b.bet*2; msg = 'Dealer busts with '+dt+' — you win $'+b.bet+'!'; winTone(true); }
  else if(pt > dt){ cash += b.bet*2; msg = 'You win! '+pt+' beats '+dt+' — +$'+b.bet; winTone(false); }
  else if(pt === dt){ cash += b.bet; msg = 'Push. '+pt+' ties '+dt+' — ante returned.'; }
  else { msg = 'Dealer wins '+dt+' to '+pt+'. -$'+b.bet; Audio.fail(); }
  const net = (pt>dt||dt>21) ? b.bet : (pt===dt ? 0 : -b.bet);
  if(net > SA.casinoBiggestWin) SA.casinoBiggestWin = net;
  b.done = true;
  SAFE_NET(net);
  bjMenu(msg + '  •  CASH $'+cash.toLocaleString('en-US'));
}
function SAFE_NET(n){ if(n > 5000) SA.toast('High roller! You are up $'+n+'.'); }

/* ---------- wheel of fortune ---------- */
function wheelMenu(msg){
  SA.openPanel(tableHtml('Wheel of Fortune — '+SA._cas.name,
    null, null, msg||'',
    '<button data-a="wSpin">SPIN ($50)</button>'+
    '<button data-a="bjMenu">BLACKJACK TABLE</button>'+
    '<button data-a="casClose" class="alt">LEAVE</button>',
    'Land on: lose · x1 · x2 · x4 · x8. Good luck.'));
  SA.actions.wSpin = () => {
    if(cash < 50){ SA.toast('Need $50 to spin.'); return; }
    cash -= 50; Audio.money();
    const r = Math.random();
    let mult, txt;
    if(r < .42){ mult = 0; txt = 'Nothing this time.'; Audio.fail(); }
    else if(r < .68){ mult = 1; txt = 'You win your $50 back.'; }
    else if(r < .86){ mult = 2; txt = 'x2 — you win $100!'; winTone(false); }
    else if(r < .95){ mult = 4; txt = 'x4 — you win $200!'; winTone(true); }
    else { mult = 8; txt = 'x8 — JACKPOT! You win $400!'; winTone(true); }
    cash += 50*mult;
    if(mult*50 > SA.casinoBiggestWin) SA.casinoBiggestWin = mult*50;
    wheelMenu('The wheel lands on... '+txt+'  •  CASH $'+cash.toLocaleString('en-US'));
  };
  SA.actions.bjMenu = () => bjMenu();
}

/* ---------- entry point (called from the casino door spots) ---------- */
SA.openCasino = function(c){
  SA._cas = c || {name:'The Pyramid', x:0, z:0};
  SA._bj = null;
  SA.toast('Welcome to '+SA._cas.name+'. Try your luck!');
  Audio.tone(440,880,.07,.2,'triangle');
  bjMenu();
};

console.log('[SA] casino games ready');
})();
