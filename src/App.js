import { useState, useEffect, useRef } from "react";

const DIRECTIONS = ["N","NE","E","SE","S","SW","W","NW"];
const OPPOSITE   = {N:"S",S:"N",E:"W",W:"E",NE:"SW",SW:"NE",NW:"SE",SE:"NW"};
const ARROWS     = {N:"↑",NE:"↗",E:"→",SE:"↘",S:"↓",SW:"↙",W:"←",NW:"↖"};
const BEARINGS   = {N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};

const WITTY_WATER = {
  N:  ["Godspeed to the North Pole, Shackleton. Pack mittens.","The Arctic called. It said no."],
  NE: ["Turns out the Atlantic doesn't have a Yelp page. Re-rolling…","Northeastern ocean entry: 0/10."],
  E:  ["East? INTO THE ATLANTIC? Sir this is a road trip.","Unless you drive on water (you don't), we're re-rolling."],
  SE: ["The Bermuda Triangle sends its regards. Hard pass.","Southeastern splash zone activated. Re-rolling…"],
  S:  ["The Gulf of Mexico is beautiful. Also not driveable.","You rolled into the ocean like a true adventurer. Nope."],
  SW: ["The Pacific Ocean has entered the chat. It says no.","Southwest = Hawaii technically, but your car disagrees."],
  W:  ["West? Into the Pacific? What are you, a salmon?","Rolling west is just a very expensive swimming lesson."],
  NW: ["The Pacific Northwest is gorgeous. The actual Pacific, less so.","Great news: fish live there. Bad news: you don't."],
};

const TRIP_MODES = [
  {id:"weekend",  label:"Weekend",   days:2,  firstHours:3, legHours:2, desc:"Fri night → Sun"},
  {id:"threeday", label:"3-Day",     days:3,  firstHours:5, legHours:3, desc:"Long weekend"},
  {id:"week",     label:"Full Week", days:7,  firstHours:7, legHours:4, desc:"Real adventure"},
  {id:"open",     label:"Open-Ended",days:null,firstHours:7,legHours:4, desc:"No plan, no end"},
  {id:"custom",   label:"Custom",    days:null,firstHours:7,legHours:4, desc:"You decide"},
];

const MUSIC_APPS = [
  {id:"spotify", label:"Spotify",       url:"https://open.spotify.com"},
  {id:"apple",   label:"Apple Music",   url:"https://music.apple.com"},
  {id:"youtube", label:"YouTube Music", url:"https://music.youtube.com"},
  {id:"amazon",  label:"Amazon Music",  url:"https://music.amazon.com"},
  {id:"none",    label:"None / Manual", url:null},
];

const SOCIAL_PLATFORMS = [
  {id:"facebook", label:"Facebook",  icon:"f", color:"#1877f2", shareUrl:(t)=>`https://www.facebook.com/sharer/sharer.php?u=https://destinationunknown.app&quote=${encodeURIComponent(t)}`},
  {id:"x",        label:"X",         icon:"𝕏", color:"#1a1a1a", shareUrl:(t)=>`https://x.com/intent/tweet?text=${encodeURIComponent(t)}`},
  {id:"threads",  label:"Threads",   icon:"@", color:"#1a1a1a", shareUrl:(t)=>`https://www.threads.net/intent/post?text=${encodeURIComponent(t)}`},
  {id:"instagram",label:"Instagram", icon:"◎", color:"#c13584", shareUrl:null},
  {id:"tiktok",   label:"TikTok",    icon:"♪", color:"#010101", shareUrl:null},
];

const DEFAULT_HASHTAG = "#DestinationUnknown";
const MAP_PRICE = 4.99;
const AVG_MPH = 65;
const US_BOUNDS = {minLat:24.5,maxLat:49.5,minLon:-125,maxLon:-66.5};

const hoursToMiles = h => h * AVG_MPH;
function getDestCoords(lat,lon,dir,miles){
  const rad=(BEARINGS[dir]*Math.PI)/180;
  return {lat:parseFloat((lat+Math.cos(rad)*miles/69).toFixed(4)),lon:parseFloat((lon+Math.sin(rad)*miles/54.6).toFixed(4))};
}
function isInUS(lat,lon){return lat>=US_BOUNDS.minLat&&lat<=US_BOUNDS.maxLat&&lon>=US_BOUNDS.minLon&&lon<=US_BOUNDS.maxLon;}
function getMapsUrl(a,b,c,d){return`https://www.google.com/maps/dir/${a},${b}/${c},${d}`;}
function createPlayers(names,app){return names.map((name,i)=>({id:i,name,vetosLeft:1,musicApp:app}));}
function getPlayer(players,idx){return players[idx%players.length];}
function wittyWater(dir){const lines=WITTY_WATER[dir]||["That's water. We don't do water."];return lines[Math.floor(Math.random()*lines.length)];}

async function geocodeCity(city){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,{headers:{"Accept-Language":"en"}});
    const d=await r.json();
    if(!d.length)return null;
    return{lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)};
  }catch{return null;}
}
async function reverseGeocode(lat,lon){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{"Accept-Language":"en"}});
    const d=await r.json();
    const a=d.address||{};
    return`${a.city||a.town||a.village||a.county||"Unknown"}, ${a.state||a.country||""}`.replace(/, $/,"");
  }catch{return"Unknown location";}
}
async function checkIfWater(lat,lon){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{"Accept-Language":"en"}});
    const d=await r.json();
    if(!d.address)return true;
    const a=d.address;
    if(d.type==="water"||d.type==="ocean"||d.type==="sea")return true;
    if(!a.city&&!a.town&&!a.village&&!a.county&&!a.state)return true;
    return false;
  }catch{return false;}
}
async function fetchWeather(lat,lon){
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3&timezone=auto`);
    return await r.json();
  }catch{return null;}
}
const WMO_CODES={0:"Clear skies",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",80:"Rain showers",95:"Thunderstorm"};
const WMO_EMOJI={0:"☀️",1:"🌤",2:"⛅",3:"☁️",45:"🌫",51:"🌦",61:"🌦",63:"🌧",65:"🌧",71:"🌨",73:"❄️",80:"🌦",95:"⛈"};

async function claudeAI(prompt,max=1000){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:max,messages:[{role:"user",content:prompt}]}),
  });
  const d=await r.json();
  return(d.content||[]).map(c=>c.text||"").join("");
}
async function fetchDestInfo(fromCity,dir,hours,mode){
  const prompt=`Road trip expert. Heading ${dir} ~${hours}h from ${fromCity}. Trip mode: ${mode||"open"}.
Rules: destination 20k+ pop, on land, genuinely interesting.
Return ONLY valid JSON (no markdown):
{"destinationCity":"City, State","population":"~50k","tagline":"one exciting sentence","waypoints":[{"name":"","type":"attraction","description":"","hoursFromStart":2}],"thingsToDo":[{"name":"","description":""}],"placesToEat":[{"name":"","description":"","type":"local"}],"events":"seasonal happenings","funFact":"surprising fact","staySearch":"search term"}
3-5 waypoints, 3-4 things, 3 eats.`;
  try{const t=await claudeAI(prompt,1200);return JSON.parse(t.replace(/```json|```/g,"").trim());}
  catch{return null;}
}
async function fetchPackingGuide(weatherData,destCity){
  if(!weatherData?.current)return["Pack layers","Comfortable shoes","Phone charger","Sunglasses"];
  const cur=weatherData.current;
  const prompt=`Traveler heading to ${destCity}. Weather: ${Math.round(cur.temperature_2m||60)}°F, ${WMO_CODES[cur.weathercode]||"mixed"}. Wind: ${Math.round(cur.windspeed_10m||0)}mph.
Witty packing guide, 4-5 bullets. Be funny and specific. Return ONLY JSON array: ["item 1","item 2"]`;
  try{const t=await claudeAI(prompt,300);return JSON.parse(t.replace(/```json|```/g,"").trim());}
  catch{return["Pack layers — weather is unpredictable","Comfortable walking shoes","Phone charger (always)","Sunglasses and good vibes"];}
}
async function generateSocialPost(dest,fromCity,dir,players,leg,hashtag){
  const names=players.map(p=>p.name).join(", ");
  const prompt=`Fun social post for "Destination Unknown" road trip. Travelers: ${names}. Heading ${dir} from ${fromCity} to ${dest}. Leg #${leg}. 3 options asking locals for tips, under 280 chars each, include ${hashtag}.
Return ONLY JSON: {"posts":[{"style":"Excited & Fun","text":""},{"style":"Adventure Seeker","text":""},{"style":"Asking for Help","text":""}]}`;
  try{const t=await claudeAI(prompt,500);return JSON.parse(t.replace(/```json|```/g,"").trim());}
  catch{return{posts:[{style:"Quick Post",text:`🎲 Dice rolled! Heading ${dir} to ${dest}! Locals — drop your best tips! ${hashtag}`}]};}
}

const FAKE_ADS=[
  {text:"Kayak — Find flights to anywhere. Even places the dice didn't pick.",url:"https://www.kayak.com"},
  {text:"AllTrails — Every destination has a trail. Find yours.",url:"https://www.alltrails.com"},
  {text:"REI — Gear up. The dice demands it.",url:"https://www.rei.com"},
  {text:"Roadtrippers — Plan the stops between the rolls.",url:"https://roadtrippers.com"},
];

const MOCK_COMMUNITY=[
  {route:"NE → SE → N",cities:"Nashville → Charlotte → Richmond",travelers:"Jake & Mia",days:"3 days",icon:"🎸"},
  {route:"W → SW → S",cities:"Denver → Albuquerque → El Paso",travelers:"The Kowalski Clan",days:"Full Week",icon:"🌵"},
  {route:"S → SE → E",cities:"Chicago → Memphis → Atlanta",travelers:"Road Warriors x4",days:"Long Weekend",icon:"🎷"},
  {route:"NW → W → SW",cities:"Minneapolis → Rapid City → Cheyenne",travelers:"Solo Tyler",days:"5 days",icon:"🏔"},
];

const css=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Rajdhani:wght@400;600;700&display=swap');
:root{--navy:#0d1b2e;--navy-mid:#162338;--navy-light:#1e3054;--navy-rim:#243a63;--cream:#f5ede0;--cream-dark:#e8d9c4;--cream-dim:#d4c4aa;--burgundy:#7c1d2e;--burgundy-l:#9c2840;--brass:#b8922a;--brass-l:#d4aa42;--brass-dim:#a07e22;--white:#fdfaf5;--shadow:rgba(8,14,24,0.55);--td:rgba(245,237,224,0.38);--tm:rgba(245,237,224,0.65);--tb:rgba(245,237,224,0.88);}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Cormorant Garamond',Georgia,serif;background:var(--navy);color:var(--navy);min-height:100vh;overflow-x:hidden;}
h1,h2,h3{font-family:'Playfair Display',Georgia,serif;}
button{cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;border:none;outline:none;transition:all .18s ease;letter-spacing:.1em;text-transform:uppercase;}
input,select,textarea{font-family:'Cormorant Garamond',Georgia,serif;font-size:1rem;}
::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:var(--navy);} ::-webkit-scrollbar-thumb{background:var(--brass);border-radius:2px;}

.ad-banner{background:linear-gradient(90deg,rgba(184,146,42,.08),rgba(124,29,46,.06));border-top:1px solid rgba(184,146,42,.15);border-bottom:1px solid rgba(184,146,42,.15);padding:8px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.ad-label{font-family:'Rajdhani',sans-serif;font-size:.58rem;letter-spacing:.2em;color:var(--td);text-transform:uppercase;}
.ad-content{flex:1;text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--tm);font-size:.85rem;}
.ad-upgrade{padding:5px 12px;background:var(--brass-dim);color:var(--navy);font-size:.6rem;letter-spacing:.12em;}
.ad-upgrade:hover{background:var(--brass);}

.modal-overlay{position:fixed;inset:0;background:rgba(8,14,24,.9);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-box{width:100%;max-width:420px;background:var(--cream);padding:32px 28px;position:relative;box-shadow:0 0 0 1px rgba(184,146,42,.2),0 32px 80px var(--shadow);}
.modal-box::before,.modal-box::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--brass-dim);border-style:solid;opacity:.5;}
.modal-box::before{top:9px;left:9px;border-width:1px 0 0 1px;} .modal-box::after{bottom:9px;right:9px;border-width:0 1px 1px 0;}
.modal-title{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:900;color:var(--navy);margin-bottom:5px;}
.modal-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:rgba(13,27,46,.55);font-size:.92rem;margin-bottom:18px;}
.modal-perks{list-style:none;display:flex;flex-direction:column;gap:7px;margin-bottom:22px;}
.modal-perks li{font-family:'Cormorant Garamond',serif;font-size:.92rem;color:rgba(13,27,46,.8);display:flex;align-items:center;gap:8px;}
.modal-perks li::before{content:'✦';color:var(--brass);font-size:.65rem;flex-shrink:0;}
.modal-cta{width:100%;padding:15px;background:var(--navy);color:var(--brass-l);font-size:.78rem;letter-spacing:.2em;border:1px solid var(--brass-dim);}
.modal-cta:hover{background:var(--navy-light);}
.modal-close{position:absolute;top:12px;right:14px;background:none;color:rgba(13,27,46,.3);font-size:.85rem;text-transform:none;letter-spacing:0;font-family:'Rajdhani',sans-serif;}
.modal-close:hover{color:var(--burgundy);}
.modal-note{text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.78rem;color:rgba(13,27,46,.38);margin-top:10px;}

.interstitial{position:fixed;inset:0;background:rgba(8,14,24,.96);z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px;}
.interstitial-label{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.28em;color:var(--td);}
.interstitial-ad{width:100%;max-width:380px;background:rgba(245,237,224,.05);border:1px solid rgba(245,237,224,.1);padding:26px;text-align:center;}
.interstitial-ad h3{font-family:'Playfair Display',serif;font-size:1.25rem;color:var(--cream);margin-bottom:8px;}
.interstitial-ad p{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--tm);font-size:.9rem;}
.interstitial-skip{padding:9px 22px;background:var(--burgundy);color:var(--cream);font-size:.7rem;letter-spacing:.14em;}
.interstitial-counter{font-family:'Rajdhani',sans-serif;font-size:.68rem;color:var(--td);letter-spacing:.1em;}
.interstitial-upgrade{background:none;color:var(--brass-l);font-size:.68rem;letter-spacing:.08em;text-decoration:underline;text-transform:none;}

.setup{min-height:100vh;background:radial-gradient(ellipse at 50% 0%,rgba(180,140,40,.07) 0%,transparent 60%),radial-gradient(ellipse at 0% 100%,rgba(124,29,46,.06) 0%,transparent 55%),linear-gradient(170deg,#0d1b2e 0%,#0a1520 100%);display:flex;flex-direction:column;align-items:center;padding:40px 16px 72px;gap:28px;}
.setup-hero{text-align:center;}
.setup-eyebrow{font-family:'Rajdhani',sans-serif;font-size:.7rem;letter-spacing:.35em;color:var(--brass);text-transform:uppercase;margin-bottom:10px;opacity:.9;}
.setup-logo{font-family:'Playfair Display',serif;font-size:clamp(2.6rem,8vw,4.5rem);font-weight:900;color:var(--cream);line-height:1.05;}
.setup-logo em{font-style:italic;color:var(--brass-l);}
.setup-rule-line{display:flex;align-items:center;gap:12px;margin:12px auto 0;max-width:280px;}
.setup-rule-line::before,.setup-rule-line::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--brass),transparent);}
.setup-rule-diamond{width:5px;height:5px;background:var(--brass);transform:rotate(45deg);flex-shrink:0;}
.setup-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--td);font-size:1.1rem;margin-top:8px;}
.setup-card{width:100%;max-width:500px;background:var(--cream);border:1px solid var(--cream-dark);padding:30px 26px;display:flex;flex-direction:column;gap:24px;position:relative;box-shadow:0 0 0 1px rgba(184,146,42,.18),0 20px 70px var(--shadow);}
.setup-card::before,.setup-card::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--brass-dim);border-style:solid;opacity:.5;}
.setup-card::before{top:9px;left:9px;border-width:1px 0 0 1px;} .setup-card::after{bottom:9px;right:9px;border-width:0 1px 1px 0;}
.section-title{font-family:'Rajdhani',sans-serif;font-size:.68rem;letter-spacing:.28em;color:var(--brass-dim);text-transform:uppercase;border-bottom:1px solid var(--cream-dim);padding-bottom:6px;margin-bottom:2px;}
.section-hint{font-family:'Cormorant Garamond',serif;font-size:.86rem;color:rgba(13,27,46,.43);font-style:italic;}
.toggle-row{display:flex;gap:7px;}
.toggle-btn{flex:1;padding:9px 10px;background:var(--cream-dark);color:rgba(13,27,46,.52);font-size:.7rem;border:1px solid var(--cream-dim);}
.toggle-btn.active{background:var(--navy);color:var(--brass-l);border-color:var(--brass-dim);box-shadow:inset 0 1px 3px rgba(0,0,0,.3);}
.field-input{width:100%;padding:10px 12px;background:var(--white);border:1px solid var(--cream-dim);color:var(--navy);font-size:.98rem;transition:border-color .15s;}
.field-input:focus{outline:none;border-color:var(--navy-rim);box-shadow:0 0 0 2px rgba(36,58,99,.1);}
.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.mode-btn{padding:12px 10px;background:var(--white);border:1px solid var(--cream-dim);text-align:left;text-transform:none;letter-spacing:0;}
.mode-btn:hover{border-color:var(--navy-rim);} .mode-btn.active{background:var(--navy);border-color:var(--brass-dim);}
.mode-btn-label{font-family:'Playfair Display',serif;font-size:.9rem;font-weight:700;color:var(--navy);display:block;margin-bottom:2px;}
.mode-btn.active .mode-btn-label{color:var(--brass-l);}
.mode-btn-desc{font-family:'Cormorant Garamond',serif;font-size:.8rem;color:rgba(13,27,46,.43);font-style:italic;}
.mode-btn.active .mode-btn-desc{color:var(--td);}
.music-select{width:100%;padding:10px 12px;background:var(--white);border:1px solid var(--cream-dim);color:var(--navy);appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230d1b2e' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;cursor:pointer;}
.player-list{display:flex;flex-direction:column;gap:8px;}
.player-row{display:flex;align-items:center;gap:8px;}
.player-num{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.75rem;letter-spacing:.1em;color:var(--brass-dim);width:20px;text-align:center;flex-shrink:0;}
.remove-btn{background:none;color:rgba(13,27,46,.22);font-size:.7rem;padding:3px 6px;text-transform:none;letter-spacing:0;}
.remove-btn:hover{color:var(--burgundy);}
.add-player-btn{background:none;color:var(--navy-rim);font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--navy-rim);width:fit-content;text-transform:none;letter-spacing:.04em;font-family:'Rajdhani',sans-serif;}
.error-msg{font-style:italic;color:var(--burgundy);font-size:.88rem;}
.start-btn{width:100%;padding:17px;background:var(--navy);color:var(--brass-l);font-size:.8rem;letter-spacing:.22em;border:1px solid var(--brass-dim);box-shadow:inset 0 1px 0 rgba(212,170,66,.15),0 4px 20px rgba(8,14,24,.4);position:relative;overflow:hidden;}
.start-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(212,170,66,.05) 0%,transparent 100%);}
.start-btn:hover:not(:disabled){background:var(--navy-light);}
.start-btn:disabled{opacity:.42;cursor:not-allowed;}
.rules-footer{width:100%;max-width:500px;color:var(--td);text-align:center;}
.rules-footer h3{font-family:'Rajdhani',sans-serif;font-size:.63rem;letter-spacing:.28em;color:var(--brass);opacity:.7;margin-bottom:9px;text-transform:uppercase;}
.rules-footer ul{list-style:none;display:flex;flex-direction:column;gap:4px;}
.rules-footer li{font-family:'Cormorant Garamond',serif;font-size:.86rem;line-height:1.5;color:rgba(245,237,224,.32);}

.dice-scene{width:100px;height:100px;perspective:450px;margin:6px auto;}
.dice-cube{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .1s linear;}
.dice-face{position:absolute;width:100px;height:100px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;backface-visibility:hidden;border:2px solid rgba(13,27,46,.15);}
.dice-face-front {transform:translateZ(50px);background:var(--cream);}
.dice-face-back  {transform:rotateY(180deg) translateZ(50px);background:var(--cream-dark);}
.dice-face-right {transform:rotateY(90deg) translateZ(50px);background:var(--cream);}
.dice-face-left  {transform:rotateY(-90deg) translateZ(50px);background:var(--cream-dark);}
.dice-face-top   {transform:rotateX(90deg) translateZ(50px);background:var(--cream);}
.dice-face-bottom{transform:rotateX(-90deg) translateZ(50px);background:var(--cream-dark);}
.dice-face-arrow{font-size:2.2rem;line-height:1;color:var(--burgundy);}
.dice-face-label{font-size:.78rem;font-weight:700;letter-spacing:.15em;color:var(--navy);font-family:'Rajdhani',sans-serif;}
.dice-cube.rolling{animation:diceRoll 1.5s ease-in-out forwards;}
.dice-cube.landed{animation:diceLand .5s cubic-bezier(.175,.885,.32,1.275) forwards;}
@keyframes diceRoll{0%{transform:rotateX(0) rotateY(0) rotateZ(0);}20%{transform:rotateX(200deg) rotateY(100deg) rotateZ(60deg);}40%{transform:rotateX(400deg) rotateY(200deg) rotateZ(120deg);}60%{transform:rotateX(500deg) rotateY(450deg) rotateZ(200deg);}80%{transform:rotateX(650deg) rotateY(600deg) rotateZ(310deg);}100%{transform:rotateX(720deg) rotateY(720deg) rotateZ(360deg);}}
@keyframes diceLand{0%{transform:scale(1.25) rotateZ(12deg);}60%{transform:scale(.93) rotateZ(-2deg);}100%{transform:scale(1) rotateZ(0);}}

.compass-svg{width:170px;height:170px;}
.compass-dir{font-family:'Rajdhani',sans-serif;font-size:7px;font-weight:700;fill:rgba(245,237,224,.28);letter-spacing:.8px;}
.compass-dir.blocked{fill:rgba(124,29,46,.7);} .compass-dir.result{fill:var(--brass-l);font-size:9px;filter:drop-shadow(0 0 6px rgba(212,170,66,.8));} .compass-dir.water-bl{fill:rgba(22,35,56,.85);}

.trip-screen{min-height:100vh;background:linear-gradient(160deg,#0d1b2e 0%,#0a1520 100%);display:flex;flex-direction:column;}
.trip-header{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:rgba(10,18,30,.98);border-bottom:1px solid rgba(184,146,42,.22);position:sticky;top:0;z-index:20;}
.trip-logo{font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:900;color:var(--cream);}
.trip-logo em{font-style:italic;color:var(--brass-l);}
.trip-city{font-family:'Cormorant Garamond',serif;font-size:.7rem;color:var(--td);font-style:italic;margin-top:1px;}
.header-btns{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;}
.hdr-btn{padding:5px 10px;font-size:.62rem;background:rgba(245,237,224,.04);color:var(--tm);border:1px solid rgba(245,237,224,.09);letter-spacing:.08em;}
.hdr-btn:hover{background:rgba(245,237,224,.08);color:var(--tb);}
.hdr-btn.danger{color:rgba(156,40,64,.9);border-color:rgba(124,29,46,.25);}
.hdr-btn.danger:hover{background:rgba(124,29,46,.1);}
.hdr-btn.gold{color:var(--brass-l);border-color:rgba(184,146,42,.28);}
.hdr-btn.gold:hover{background:rgba(184,146,42,.1);}

.player-bar{display:flex;gap:5px;padding:8px 16px;overflow-x:auto;background:rgba(10,18,30,.55);border-bottom:1px solid rgba(245,237,224,.04);}
.player-chip{display:flex;align-items:center;gap:6px;padding:5px 12px;background:rgba(245,237,224,.04);border:1px solid rgba(245,237,224,.07);white-space:nowrap;flex-shrink:0;transition:all .2s;}
.player-chip.active{background:rgba(184,146,42,.09);border-color:rgba(184,146,42,.32);}
.chip-name{font-family:'Rajdhani',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.1em;color:var(--tm);}
.player-chip.active .chip-name{color:var(--brass-l);}
.chip-veto{display:flex;gap:2px;align-items:center;}
.veto-pip{font-size:.4rem;color:#5a9c6b;} .veto-used{font-size:.52rem;color:rgba(124,29,46,.55);}

.trip-main{flex:1;display:flex;flex-direction:column;align-items:center;padding:22px 14px 60px;gap:24px;}
.roll-zone{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:460px;}
.loc-badge{font-family:'Cormorant Garamond',serif;background:rgba(245,237,224,.05);border:1px solid rgba(245,237,224,.09);color:var(--tm);padding:7px 18px;font-size:.92rem;}
.loc-badge strong{font-weight:600;color:var(--brass-l);font-style:italic;}
.notice{width:100%;padding:9px 14px;font-family:'Rajdhani',sans-serif;font-size:.75rem;font-weight:600;letter-spacing:.1em;text-align:center;}
.notice.blocked{background:rgba(124,29,46,.09);border:1px solid rgba(124,29,46,.22);color:rgba(200,80,100,.88);}
.notice.water{background:rgba(22,35,56,.28);border:1px solid rgba(36,58,99,.48);color:rgba(100,160,220,.82);}
.notice.must{background:linear-gradient(90deg,rgba(184,146,42,.1),rgba(184,146,42,.05));border:1px solid rgba(184,146,42,.28);color:var(--brass-l);animation:pulse 2.2s ease infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.58;}}

.water-alert{width:100%;background:rgba(22,35,56,.45);border:1px solid rgba(36,58,99,.55);padding:13px 15px;text-align:center;}
.water-alert-wit{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--tm);font-size:.96rem;margin-bottom:10px;line-height:1.5;}
.transport-links{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;}
.transport-link{padding:7px 13px;font-size:.66rem;letter-spacing:.1em;text-decoration:none;font-family:'Rajdhani',sans-serif;font-weight:700;text-transform:uppercase;transition:all .15s;}
.transport-link.flights{background:rgba(26,63,92,.45);color:rgba(100,180,240,.88);border:1px solid rgba(36,58,99,.65);}
.transport-link.flights:hover{background:rgba(26,63,92,.75);}
.transport-link.train{background:rgba(42,92,34,.38);color:rgba(120,200,130,.88);border:1px solid rgba(42,92,34,.55);}
.transport-link.train:hover{background:rgba(42,92,34,.65);}

.roll-actions{display:flex;flex-direction:column;align-items:center;gap:9px;width:100%;}
.roll-btn{width:100%;max-width:290px;padding:17px 22px;background:var(--burgundy);color:var(--cream);font-size:.8rem;letter-spacing:.2em;border:1px solid rgba(156,40,64,.55);box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 5px 22px rgba(124,29,46,.32);position:relative;overflow:hidden;}
.roll-btn::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(245,237,224,.18),transparent);}
.roll-btn:hover:not(:disabled){background:var(--burgundy-l);} .roll-btn:disabled{opacity:.32;cursor:not-allowed;}
.veto-btn{padding:9px 20px;background:rgba(124,29,46,.09);color:rgba(200,80,100,.82);border:1px solid rgba(124,29,46,.28);font-size:.72rem;letter-spacing:.1em;}
.veto-btn:hover{background:rgba(124,29,46,.18);}
.no-veto-note{font-family:'Cormorant Garamond',serif;font-size:.8rem;color:var(--td);font-style:italic;}
.music-banner{display:flex;align-items:center;gap:10px;background:rgba(30,48,84,.38);border:1px solid rgba(36,58,99,.48);color:rgba(180,220,190,.78);padding:9px 16px;font-family:'Cormorant Garamond',serif;font-size:.9rem;width:100%;max-width:290px;}
.music-link{margin-left:auto;color:var(--brass-l);font-family:'Rajdhani',sans-serif;font-size:.68rem;font-weight:700;text-decoration:none;letter-spacing:.1em;text-transform:uppercase;}
.music-link:hover{text-decoration:underline;}

.result-card{width:100%;max-width:540px;background:var(--cream);border:1px solid var(--cream-dark);overflow:hidden;animation:slideUp .5s cubic-bezier(.22,1,.36,1);box-shadow:0 0 0 1px rgba(184,146,42,.13),0 28px 70px var(--shadow);position:relative;}
.result-card::before,.result-card::after{content:'';position:absolute;width:14px;height:14px;border-color:var(--brass-dim);border-style:solid;opacity:.4;z-index:1;pointer-events:none;}
.result-card::before{top:7px;left:7px;border-width:1px 0 0 1px;} .result-card::after{bottom:7px;right:7px;border-width:0 1px 1px 0;}
@keyframes slideUp{from{opacity:0;transform:translateY(26px);}to{opacity:1;transform:translateY(0);}}
.result-hero{background:var(--navy);padding:20px 22px;display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid rgba(184,146,42,.18);position:relative;overflow:hidden;}
.result-hero::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 80% 0%,rgba(184,146,42,.06),transparent 60%);pointer-events:none;}
.result-dir-badge{background:var(--burgundy);color:var(--cream);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:1.1rem;letter-spacing:.1em;width:50px;height:50px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(156,40,64,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 3px 10px rgba(124,29,46,.38);}
.result-dest{flex:1;}
.result-city{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:900;color:var(--cream);line-height:1.1;}
.result-meta{font-family:'Rajdhani',sans-serif;font-size:.66rem;letter-spacing:.16em;color:var(--td);margin-top:3px;text-transform:uppercase;}
.result-tagline{font-family:'Cormorant Garamond',serif;font-size:.92rem;color:var(--tm);font-style:italic;margin-top:7px;line-height:1.5;}
.result-fun-fact{font-family:'Cormorant Garamond',serif;font-size:.82rem;color:var(--brass);margin-top:5px;font-style:italic;}
.maps-btn{display:flex;align-items:center;justify-content:center;gap:7px;margin:14px 22px 0;padding:11px 16px;background:var(--navy);color:var(--cream-dark);font-family:'Rajdhani',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;border:1px solid rgba(245,237,224,.1);transition:all .15s;}
.maps-btn:hover{background:var(--navy-light);border-color:rgba(184,146,42,.28);color:var(--brass-l);}
.result-body{padding:18px 22px 24px;display:flex;flex-direction:column;gap:18px;}
.res-section-title{font-family:'Rajdhani',sans-serif;font-size:.63rem;letter-spacing:.28em;color:var(--brass-dim);text-transform:uppercase;border-bottom:1px solid var(--cream-dim);padding-bottom:5px;margin-bottom:9px;}
.waypoints{display:flex;flex-direction:column;gap:8px;}
.waypoint{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--white);border-left:2px solid var(--brass-dim);}
.wp-icon{font-size:1rem;flex-shrink:0;margin-top:2px;}
.wp-name{font-family:'Playfair Display',serif;font-weight:700;font-size:.88rem;color:var(--navy);}
.wp-time{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.1em;color:rgba(13,27,46,.38);font-weight:600;text-transform:uppercase;margin-left:5px;}
.wp-desc{font-family:'Cormorant Garamond',serif;font-size:.88rem;color:rgba(13,27,46,.58);margin-top:2px;line-height:1.4;}
.items-list{display:flex;flex-direction:column;gap:7px;}
.list-item{padding:9px 12px;background:var(--white);border:1px solid var(--cream-dark);}
.list-item-name{font-family:'Playfair Display',serif;font-weight:700;font-size:.88rem;color:var(--navy);}
.list-item-desc{font-family:'Cormorant Garamond',serif;font-size:.88rem;color:rgba(13,27,46,.55);margin-top:2px;line-height:1.42;}
.food-type{display:inline-block;font-family:'Rajdhani',sans-serif;font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;margin-left:7px;background:rgba(13,27,46,.06);color:rgba(13,27,46,.42);}
.stay-links{display:flex;gap:7px;flex-wrap:wrap;}
.stay-link{padding:9px 14px;background:var(--navy);color:var(--cream-dark);font-family:'Rajdhani',sans-serif;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;border:1px solid rgba(245,237,224,.09);transition:all .13s;}
.stay-link:hover{background:var(--navy-light);color:var(--brass-l);border-color:rgba(184,146,42,.28);}
.events-box{padding:11px 14px;background:rgba(184,146,42,.04);border:1px solid rgba(184,146,42,.13);font-family:'Cormorant Garamond',serif;font-size:.9rem;color:rgba(13,27,46,.62);line-height:1.52;font-style:italic;}

.weather-box{background:var(--navy);border:1px solid rgba(184,146,42,.13);overflow:hidden;}
.weather-current{display:flex;align-items:center;gap:13px;padding:13px 16px;border-bottom:1px solid rgba(245,237,224,.05);}
.weather-emoji{font-size:1.9rem;line-height:1;}
.weather-temp{font-family:'Playfair Display',serif;font-size:1.7rem;color:var(--cream);font-weight:900;}
.weather-cond{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--tm);font-size:.87rem;margin-top:2px;}
.weather-city{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.18em;color:var(--td);text-transform:uppercase;}
.weather-forecast{display:flex;gap:0;margin-left:auto;}
.forecast-day{flex:1;padding:8px 7px;text-align:center;border-right:1px solid rgba(245,237,224,.04);}
.forecast-day:last-child{border-right:none;}
.forecast-dow{font-family:'Rajdhani',sans-serif;font-size:.58rem;letter-spacing:.12em;color:var(--td);text-transform:uppercase;margin-bottom:3px;}
.forecast-icon{font-size:1.1rem;margin-bottom:3px;}
.forecast-hi{font-family:'Rajdhani',sans-serif;font-size:.75rem;font-weight:700;color:var(--tm);}
.forecast-lo{font-family:'Rajdhani',sans-serif;font-size:.65rem;color:var(--td);}
.packing-list{padding:13px 16px;border-top:1px solid rgba(245,237,224,.05);}
.packing-title{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.22em;color:var(--brass-dim);text-transform:uppercase;margin-bottom:9px;}
.packing-items{list-style:none;display:flex;flex-direction:column;gap:5px;}
.packing-items li{font-family:'Cormorant Garamond',serif;font-size:.88rem;display:flex;align-items:flex-start;gap:7px;color:var(--tm);}
.packing-items li::before{content:'✦';color:var(--brass);font-size:.52rem;margin-top:5px;flex-shrink:0;}

.journal-panel{background:var(--cream);border:1px solid var(--cream-dark);overflow:hidden;}
.journal-tabs{display:flex;border-bottom:1px solid var(--cream-dim);}
.journal-tab{flex:1;padding:9px 7px;background:none;color:rgba(13,27,46,.42);font-size:.62rem;letter-spacing:.15em;border-right:1px solid var(--cream-dim);text-transform:uppercase;}
.journal-tab:last-child{border-right:none;} .journal-tab.active{background:var(--white);color:var(--burgundy);}
.journal-tab:hover{background:var(--white);}
.journal-body{padding:14px;}
.journal-textarea{width:100%;background:var(--white);border:1px solid var(--cream-dim);padding:11px;font-family:'Cormorant Garamond',serif;font-size:.92rem;color:var(--navy);line-height:1.58;resize:vertical;min-height:90px;outline:none;}
.journal-textarea:focus{border-color:var(--navy-rim);}
.journal-save{margin-top:7px;padding:8px 16px;background:var(--navy);color:var(--brass-l);font-size:.65rem;letter-spacing:.13em;border:1px solid rgba(184,146,42,.18);}
.journal-save:hover{background:var(--navy-light);}
.journal-saved{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.78rem;color:rgba(13,27,46,.38);margin-left:9px;}
.proscons-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.procon-col h4{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.18em;margin-bottom:7px;text-transform:uppercase;}
.procon-col.pros h4{color:#2a7a3a;} .procon-col.cons h4{color:var(--burgundy);}
.procon-input-row{display:flex;gap:5px;margin-bottom:5px;}
.procon-input{flex:1;padding:6px 9px;background:var(--white);border:1px solid var(--cream-dim);font-size:.85rem;color:var(--navy);outline:none;}
.procon-input:focus{border-color:var(--navy-rim);}
.procon-add{padding:6px 9px;font-size:.62rem;letter-spacing:.08em;}
.procon-add.pro{background:rgba(42,122,58,.13);color:#2a7a3a;border:1px solid rgba(42,122,58,.28);}
.procon-add.con{background:rgba(124,29,46,.09);color:var(--burgundy-l);border:1px solid rgba(124,29,46,.18);}
.procon-list{list-style:none;display:flex;flex-direction:column;gap:3px;}
.procon-list li{font-family:'Cormorant Garamond',serif;font-size:.85rem;color:rgba(13,27,46,.68);padding:4px 7px;background:var(--white);display:flex;justify-content:space-between;align-items:center;}
.procon-del{background:none;color:rgba(13,27,46,.22);font-size:.68rem;text-transform:none;letter-spacing:0;padding:0 3px;}

.ask-locals-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:calc(100% - 44px);margin:0 22px 22px;padding:13px;background:rgba(13,27,46,.04);border:1px solid rgba(13,27,46,.12);color:var(--navy);font-family:'Rajdhani',sans-serif;font-size:.72rem;letter-spacing:.16em;transition:all .15s;}
.ask-locals-btn:hover{background:var(--navy);color:var(--brass-l);border-color:rgba(184,146,42,.28);}

.share-overlay{position:fixed;inset:0;background:rgba(8,14,24,.86);z-index:50;display:flex;align-items:flex-end;justify-content:center;}
.share-panel{width:100%;max-width:540px;max-height:90vh;background:var(--cream);overflow-y:auto;padding:25px 22px 36px;box-shadow:0 -10px 55px var(--shadow);animation:slideUpPanel .3s cubic-bezier(.22,1,.36,1);position:relative;}
.share-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--brass),transparent);opacity:.45;}
@keyframes slideUpPanel{from{transform:translateY(100%);}to{transform:translateY(0);}}
.share-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
.share-title{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:900;color:var(--navy);}
.share-subtitle{font-family:'Cormorant Garamond',serif;font-size:.88rem;color:rgba(13,27,46,.48);font-style:italic;margin-top:2px;}
.share-hashtag-row{display:flex;align-items:center;gap:9px;margin:14px 0;padding:10px 13px;background:var(--white);border:1px solid var(--cream-dim);}
.share-hashtag-label{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.22em;color:rgba(13,27,46,.38);white-space:nowrap;text-transform:uppercase;}
.share-hashtag-input{flex:1;background:none;border:none;font-family:'Playfair Display',serif;font-size:.92rem;font-weight:700;color:var(--burgundy);outline:none;padding:0;}
.post-options{display:flex;flex-direction:column;gap:9px;margin-bottom:16px;}
.post-option{border:1px solid var(--cream-dim);background:var(--white);cursor:pointer;transition:all .15s;overflow:hidden;}
.post-option.selected{border-color:var(--burgundy);}
.post-option-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--cream-dark);}
.post-option.selected .post-option-header{background:rgba(124,29,46,.07);}
.post-style-label{font-family:'Rajdhani',sans-serif;font-size:.64rem;font-weight:700;letter-spacing:.18em;color:rgba(13,27,46,.48);text-transform:uppercase;}
.post-option.selected .post-style-label{color:var(--burgundy);}
.post-select-dot{width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(13,27,46,.18);background:none;flex-shrink:0;}
.post-option.selected .post-select-dot{background:var(--burgundy);border-color:var(--burgundy);}
.post-text-area{width:100%;padding:12px;background:none;border:none;font-family:'Cormorant Garamond',serif;font-size:.92rem;line-height:1.58;color:var(--navy);resize:vertical;min-height:90px;outline:none;}
.post-char-count{padding:3px 12px 8px;font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.08em;color:rgba(13,27,46,.28);text-align:right;text-transform:uppercase;}
.post-char-count.over{color:var(--burgundy);}
.share-platforms{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:11px;}
.platform-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:11px 5px;color:var(--cream);font-size:.56rem;letter-spacing:.07em;text-transform:uppercase;}
.platform-btn:hover{opacity:.82;transform:translateY(-1px);}
.platform-icon{font-size:.95rem;line-height:1;}
.copy-all-btn{width:100%;padding:13px;background:var(--navy);color:var(--brass-l);font-size:.72rem;letter-spacing:.18em;border:1px solid rgba(184,146,42,.22);}
.copy-all-btn:hover{background:var(--navy-light);}
.copy-all-btn.copied{background:#2a5c38;color:#7dda99;border-color:rgba(100,200,130,.28);}
.share-loading{display:flex;align-items:center;gap:11px;padding:22px 0;font-family:'Cormorant Garamond',serif;font-style:italic;color:rgba(13,27,46,.48);font-size:.92rem;}
.share-spinner{width:16px;height:16px;border:2px solid rgba(13,27,46,.1);border-top-color:var(--burgundy);border-radius:50%;animation:spin .72s linear infinite;}

.log-overlay{position:fixed;inset:0;background:rgba(8,14,24,.83);z-index:30;display:flex;align-items:flex-end;justify-content:center;}
.log-panel{width:100%;max-width:520px;max-height:78vh;background:var(--cream);overflow-y:auto;padding:24px 20px 30px;box-shadow:0 -9px 45px var(--shadow);position:relative;}
.log-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--brass),transparent);opacity:.42;}
.log-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.log-title{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:900;color:var(--navy);}
.log-close{background:none;color:rgba(13,27,46,.32);font-size:.95rem;text-transform:none;letter-spacing:0;padding:3px 7px;font-family:'Rajdhani',sans-serif;}
.log-close:hover{color:var(--burgundy);}
.log-entry{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--cream-dim);}
.log-dir{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:1rem;color:var(--burgundy);width:28px;letter-spacing:.05em;}
.log-info{flex:1;}
.log-city{font-family:'Playfair Display',serif;font-weight:700;font-size:.9rem;color:var(--navy);}
.log-player{font-family:'Cormorant Garamond',serif;font-size:.78rem;color:rgba(13,27,46,.42);font-style:italic;margin-top:1px;}
.log-badge{font-family:'Rajdhani',sans-serif;font-size:.58rem;font-weight:700;letter-spacing:.1em;padding:2px 7px;text-transform:uppercase;}
.log-badge.must{background:rgba(184,146,42,.1);color:var(--brass-dim);}
.log-badge.vetoed{background:rgba(124,29,46,.09);color:var(--burgundy-l);}

.community-overlay{position:fixed;inset:0;background:rgba(8,14,24,.9);z-index:35;display:flex;align-items:flex-end;justify-content:center;}
.community-panel{width:100%;max-width:540px;max-height:82vh;background:var(--cream);overflow-y:auto;padding:24px 20px 34px;box-shadow:0 -11px 55px var(--shadow);position:relative;}
.community-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--brass),transparent);opacity:.48;}
.community-title{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:900;color:var(--navy);margin-bottom:3px;}
.community-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.88rem;color:rgba(13,27,46,.48);margin-bottom:16px;}
.community-feed{display:flex;flex-direction:column;gap:9px;}
.community-card{padding:13px;background:var(--white);border:1px solid var(--cream-dark);display:flex;gap:11px;align-items:flex-start;}
.comm-route{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.13em;color:var(--brass-dim);text-transform:uppercase;margin-bottom:2px;}
.comm-cities{font-family:'Playfair Display',serif;font-size:.92rem;font-weight:700;color:var(--navy);margin-bottom:2px;}
.comm-meta{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.8rem;color:rgba(13,27,46,.42);}
.comm-icon{font-size:1.3rem;flex-shrink:0;margin-top:2px;}

.end-screen{min-height:100vh;background:linear-gradient(160deg,#0d1b2e,#0a1520);display:flex;flex-direction:column;align-items:center;padding:44px 16px 76px;gap:24px;}
.end-title{font-family:'Playfair Display',serif;font-size:clamp(1.9rem,6vw,3rem);font-weight:900;color:var(--cream);text-align:center;line-height:1.1;}
.end-title em{font-style:italic;color:var(--brass-l);}
.end-rule{display:flex;align-items:center;gap:12px;max-width:300px;width:100%;}
.end-rule::before,.end-rule::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--brass),transparent);}
.end-diamond{width:5px;height:5px;background:var(--brass);transform:rotate(45deg);}
.journey-map-wrap{width:100%;max-width:540px;background:var(--cream);border:1px solid var(--cream-dark);padding:22px;box-shadow:0 0 0 1px rgba(184,146,42,.13),0 22px 55px var(--shadow);position:relative;}
.journey-map-wrap::before,.journey-map-wrap::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--brass-dim);border-style:solid;opacity:.48;}
.journey-map-wrap::before{top:7px;left:7px;border-width:1px 0 0 1px;} .journey-map-wrap::after{bottom:7px;right:7px;border-width:0 1px 1px 0;}
.map-eyebrow{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.28em;color:var(--brass-dim);text-transform:uppercase;text-align:center;margin-bottom:14px;}
.map-svg{width:100%;height:200px;background:rgba(13,27,46,.04);border:1px solid var(--cream-dim);}
.map-legend{display:flex;gap:14px;justify-content:center;margin-top:10px;flex-wrap:wrap;}
.map-legend-item{display:flex;align-items:center;gap:5px;font-family:'Cormorant Garamond',serif;font-size:.8rem;color:rgba(13,27,46,.55);}
.map-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.map-download-btn{width:100%;margin-top:16px;padding:14px;background:var(--burgundy);color:var(--cream);font-size:.76rem;letter-spacing:.18em;border:1px solid rgba(156,40,64,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.07);}
.map-download-btn:hover{background:var(--burgundy-l);}
.map-note{text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.78rem;color:rgba(13,27,46,.38);margin-top:7px;}
.end-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;width:100%;max-width:540px;}
.stat-box{background:rgba(245,237,224,.05);border:1px solid rgba(245,237,224,.09);padding:14px;text-align:center;}
.stat-val{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:900;color:var(--brass-l);}
.stat-label{font-family:'Rajdhani',sans-serif;font-size:.58rem;letter-spacing:.18em;color:var(--td);text-transform:uppercase;margin-top:2px;}
.new-trip-btn{padding:15px 38px;background:var(--navy);color:var(--brass-l);font-size:.78rem;letter-spacing:.2em;border:1px solid var(--brass-dim);}
.new-trip-btn:hover{background:var(--navy-light);}

.loading-overlay{position:fixed;inset:0;background:rgba(8,14,24,.93);z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
.loading-spinner{width:42px;height:42px;border:2px solid rgba(184,146,42,.13);border-top-color:var(--brass);border-radius:50%;animation:spin .88s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.loading-text{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--td);font-size:.97rem;letter-spacing:.04em;}
`;

// ── Components ──

function Dice3D({ rolling, result }) {
  const faces = [
    {cls:"dice-face-front", dir:result||"?"},
    {cls:"dice-face-back",  dir:"S"},
    {cls:"dice-face-right", dir:"E"},
    {cls:"dice-face-left",  dir:"W"},
    {cls:"dice-face-top",   dir:"N"},
    {cls:"dice-face-bottom",dir:"SW"},
  ];
  return (
    <div className="dice-scene">
      <div className={`dice-cube${rolling?" rolling":result?" landed":""}`}>
        {faces.map((f,i)=>(
          <div key={i} className={`dice-face ${f.cls}`}>
            <span className="dice-face-arrow">{f.dir!=="?"?ARROWS[f.dir]||"":"?"}</span>
            {f.dir!=="?"&&<span className="dice-face-label">{f.dir}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const CP=[{d:"N",x:50,y:9},{d:"NE",x:82,y:18},{d:"E",x:91,y:50},{d:"SE",x:82,y:82},{d:"S",x:50,y:91},{d:"SW",x:18,y:82},{d:"W",x:9,y:50},{d:"NW",x:18,y:18}];
function Compass({blocked,result,waterDirs=[]}) {
  return (
    <svg viewBox="0 0 100 100" className="compass-svg">
      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(245,237,224,.07)" strokeWidth="1"/>
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(245,237,224,.04)" strokeWidth=".5"/>
      {CP.map(({d,x,y})=><line key={d} x1="50" y1="50" x2={x} y2={y} stroke="rgba(245,237,224,.05)" strokeWidth=".5"/>)}
      <circle cx="50" cy="50" r="2.5" fill="rgba(184,146,42,.45)"/>
      {CP.map(({d,x,y})=>{
        let cls="compass-dir";
        if(d===result)cls+=" result";
        else if(d===blocked)cls+=" blocked";
        else if(waterDirs.includes(d))cls+=" water-bl";
        return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={cls}>{d}</text>;
      })}
    </svg>
  );
}

function PlayerBar({players,currentPlayer}) {
  return (
    <div className="player-bar">
      {players.map(p=>(
        <div key={p.id} className={`player-chip${p.id===currentPlayer.id?" active":""}`}>
          <span className="chip-name">{p.name}</span>
          <span className="chip-veto">
            {Array.from({length:p.vetosLeft}).map((_,i)=><span key={i} className="veto-pip">●</span>)}
            {p.vetosLeft===0&&<span className="veto-used">✕</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const WMO_E={0:"☀️",1:"🌤",2:"⛅",3:"☁️",45:"🌫",51:"🌦",61:"🌦",63:"🌧",65:"🌧",71:"🌨",73:"❄️",80:"🌦",95:"⛈"};
const WMO_C={0:"Clear skies",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",51:"Drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",80:"Showers",95:"Thunderstorm"};

function WeatherCard({weather,packingGuide,destCity}) {
  if(!weather?.current)return null;
  const cur=weather.current, daily=weather.daily;
  return (
    <div>
      <h3 className="res-section-title">🌤 Weather & What to Pack</h3>
      <div className="weather-box">
        <div className="weather-current">
          <span className="weather-emoji">{WMO_E[cur.weathercode]||"🌡"}</span>
          <div>
            <div className="weather-city">{destCity}</div>
            <div className="weather-temp">{Math.round(cur.temperature_2m)}°F</div>
            <div className="weather-cond">{WMO_C[cur.weathercode]||"Variable"} · {Math.round(cur.windspeed_10m)}mph wind</div>
          </div>
          {daily&&(
            <div className="weather-forecast">
              {["Today","Tmw","Day 3"].map((day,i)=>(
                <div key={i} className="forecast-day">
                  <div className="forecast-dow">{day}</div>
                  <div className="forecast-icon">{WMO_E[daily.weathercode?.[i]]||"🌡"}</div>
                  <div className="forecast-hi">{Math.round(daily.temperature_2m_max?.[i]||0)}°</div>
                  <div className="forecast-lo">{Math.round(daily.temperature_2m_min?.[i]||0)}°</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {packingGuide?.length>0&&(
          <div className="packing-list">
            <div className="packing-title">What to Pack</div>
            <ul className="packing-items">{packingGuide.map((item,i)=><li key={i}>{item}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Journal({legIndex,journal,onSave}) {
  const entry=journal[legIndex]||{notes:"",food:"",activities:"",pros:[],cons:[]};
  const [tab,setTab]=useState("notes");
  const [notes,setNotes]=useState(entry.notes);
  const [food,setFood]=useState(entry.food);
  const [activities,setActivities]=useState(entry.activities);
  const [pros,setPros]=useState(entry.pros||[]);
  const [cons,setCons]=useState(entry.cons||[]);
  const [proInput,setProInput]=useState("");
  const [conInput,setConInput]=useState("");
  const [saved,setSaved]=useState(false);
  const save=()=>{onSave(legIndex,{notes,food,activities,pros,cons});setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const addPro=()=>{if(proInput.trim()){setPros([...pros,proInput.trim()]);setProInput("");}};
  const addCon=()=>{if(conInput.trim()){setCons([...cons,conInput.trim()]);setConInput("");}};
  return (
    <div>
      <h3 className="res-section-title">📓 Trip Journal</h3>
      <div className="journal-panel">
        <div className="journal-tabs">
          {[{id:"notes",label:"Notes"},{id:"food",label:"Food Log"},{id:"activities",label:"Activities"},{id:"proscons",label:"Pros/Cons"}].map(t=>(
            <button key={t.id} className={`journal-tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="journal-body">
          {tab==="notes"&&<><textarea className="journal-textarea" placeholder="How was this leg? What stood out?" value={notes} onChange={e=>setNotes(e.target.value)}/><div style={{display:"flex",alignItems:"center"}}><button className="journal-save" onClick={save}>Save</button>{saved&&<span className="journal-saved">Saved ✓</span>}</div></>}
          {tab==="food"&&<><textarea className="journal-textarea" placeholder="Where did you eat? What was amazing?" value={food} onChange={e=>setFood(e.target.value)}/><div style={{display:"flex",alignItems:"center"}}><button className="journal-save" onClick={save}>Save</button>{saved&&<span className="journal-saved">Saved ✓</span>}</div></>}
          {tab==="activities"&&<><textarea className="journal-textarea" placeholder="What did you do? Best moments?" value={activities} onChange={e=>setActivities(e.target.value)}/><div style={{display:"flex",alignItems:"center"}}><button className="journal-save" onClick={save}>Save</button>{saved&&<span className="journal-saved">Saved ✓</span>}</div></>}
          {tab==="proscons"&&(
            <div className="proscons-grid">
              <div className="procon-col pros">
                <h4>👍 Pros</h4>
                <div className="procon-input-row"><input className="procon-input" value={proInput} onChange={e=>setProInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPro()} placeholder="Add a pro…"/><button className="procon-add pro" onClick={addPro}>+</button></div>
                <ul className="procon-list">{pros.map((p,i)=><li key={i}>{p}<button className="procon-del" onClick={()=>setPros(pros.filter((_,j)=>j!==i))}>✕</button></li>)}</ul>
              </div>
              <div className="procon-col cons">
                <h4>👎 Cons</h4>
                <div className="procon-input-row"><input className="procon-input" value={conInput} onChange={e=>setConInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCon()} placeholder="Add a con…"/><button className="procon-add con" onClick={addCon}>+</button></div>
                <ul className="procon-list">{cons.map((c,i)=><li key={i}>{c}<button className="procon-del" onClick={()=>setCons(cons.filter((_,j)=>j!==i))}>✕</button></li>)}</ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const WP_ICONS={attraction:"🏛",food:"🍽",scenic:"🌄",quirky:"🎪"};
function ResultCard({result,onAskLocals,journal,onSaveJournal,legIndex}) {
  const {direction,info,mapsUrl,fromCity,hours,destCoords,weather,packingGuide}=result;
  const dest=info?.destinationCity||result.destCity;
  const stayQ=encodeURIComponent(info?.staySearch||dest);
  return (
    <div className="result-card">
      <div className="result-hero">
        <div className="result-dir-badge">{ARROWS[direction]}</div>
        <div className="result-dest">
          <h2 className="result-city">{dest}</h2>
          <p className="result-meta">~{hours}h {direction} from {fromCity}{info?.population?` · pop. ${info.population}`:""}</p>
          {info?.tagline&&<p className="result-tagline">"{info.tagline}"</p>}
          {info?.funFact&&<p className="result-fun-fact">✦ {info.funFact}</p>}
        </div>
      </div>
      <a href={mapsUrl} target="_blank" rel="noreferrer" className="maps-btn">🗺 Open Route in Google Maps</a>
      <div className="result-body">
        <WeatherCard weather={weather} packingGuide={packingGuide} destCity={dest}/>
        {info?.waypoints?.length>0&&<div><h3 className="res-section-title">🛣 Along the Way</h3><div className="waypoints">{info.waypoints.map((wp,i)=><div key={i} className="waypoint"><span className="wp-icon">{WP_ICONS[wp.type]||"📍"}</span><div><span className="wp-name">{wp.name}</span>{wp.hoursFromStart&&<span className="wp-time">· {wp.hoursFromStart}h in</span>}<p className="wp-desc">{wp.description}</p></div></div>)}</div></div>}
        {info?.thingsToDo?.length>0&&<div><h3 className="res-section-title">✨ Things To Do</h3><div className="items-list">{info.thingsToDo.map((t,i)=><div key={i} className="list-item"><div className="list-item-name">{t.name}</div><div className="list-item-desc">{t.description}</div></div>)}</div></div>}
        {info?.placesToEat?.length>0&&<div><h3 className="res-section-title">🍽 Where To Eat</h3><div className="items-list">{info.placesToEat.map((f,i)=><div key={i} className="list-item"><div className="list-item-name">{f.name}{f.type&&<span className="food-type">{f.type}</span>}</div><div className="list-item-desc">{f.description}</div></div>)}</div></div>}
        <div><h3 className="res-section-title">🏠 Where To Stay</h3><div className="stay-links"><a href={`https://www.airbnb.com/s/${stayQ}/homes`} target="_blank" rel="noreferrer" className="stay-link">Airbnb</a><a href={`https://www.vrbo.com/search?destination=${stayQ}`} target="_blank" rel="noreferrer" className="stay-link">VRBO</a><a href={`https://www.hotels.com/search.do?q-destination=${stayQ}`} target="_blank" rel="noreferrer" className="stay-link">Hotels.com</a><a href={`https://www.booking.com/search.html?ss=${stayQ}`} target="_blank" rel="noreferrer" className="stay-link">Booking</a></div></div>
        {info?.events&&<div><h3 className="res-section-title">🎭 Events & Concerts</h3><div className="events-box">{info.events}</div></div>}
        <Journal legIndex={legIndex} journal={journal} onSave={onSaveJournal}/>
      </div>
      <button className="ask-locals-btn" onClick={onAskLocals}>📣 Ask the Locals for Tips</button>
    </div>
  );
}

function AdBanner({onUpgrade}) {
  const ad=FAKE_ADS[Math.floor(Math.random()*FAKE_ADS.length)];
  return (
    <div className="ad-banner">
      <span className="ad-label">Ad</span>
      <a href={ad.url} target="_blank" rel="noreferrer" className="ad-content" style={{textDecoration:"none"}}>{ad.text}</a>
      <button className="ad-upgrade" onClick={onUpgrade}>Remove Ads $9.99/yr</button>
    </div>
  );
}

function PremiumModal({onClose,onActivate}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Go Premium</h2>
        <p className="modal-sub">One year. One price. All the adventure.</p>
        <ul className="modal-perks">
          <li>No ads — ever</li>
          <li>1 free printable journey map per year</li>
          <li>Priority community feed placement</li>
          <li>Early access to new features</li>
        </ul>
        <button className="modal-cta" onClick={onActivate}>Unlock Premium — $9.99/year</button>
        <p className="modal-note">Cancel anytime. No tricks. Just better trips.</p>
      </div>
    </div>
  );
}

function Interstitial({onSkip,onUpgrade}) {
  const [sec,setSec]=useState(3);
  useEffect(()=>{if(sec<=0)return;const t=setTimeout(()=>setSec(s=>s-1),1000);return()=>clearTimeout(t);},[sec]);
  const ad=FAKE_ADS[Math.floor(Math.random()*FAKE_ADS.length)];
  return (
    <div className="interstitial">
      <span className="interstitial-label">Sponsored · Supports free access</span>
      <div className="interstitial-ad">
        <h3>Adventure Awaits</h3>
        <p style={{marginBottom:10}}>{ad.text}</p>
        <a href={ad.url} target="_blank" rel="noreferrer" style={{color:"var(--brass-l)",fontFamily:"'Rajdhani',sans-serif",fontSize:".72rem",letterSpacing:".13em",textTransform:"uppercase"}}>Learn More →</a>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
        {sec>0?<span className="interstitial-counter">Skip in {sec}…</span>:<button className="interstitial-skip" onClick={onSkip}>Skip → See Destination</button>}
        <button className="interstitial-upgrade" onClick={onUpgrade}>Remove ads forever — $9.99/yr</button>
      </div>
    </div>
  );
}

function SocialShare({result,players,legNum,onClose}) {
  const [hashtag,setHashtag]=useState(DEFAULT_HASHTAG);
  const [posts,setPosts]=useState(null);
  const [selIdx,setSelIdx]=useState(0);
  const [editedTexts,setEditedTexts]=useState({});
  const [loading,setLoading]=useState(true);
  const [copied,setCopied]=useState(false);
  const dest=result.info?.destinationCity||result.destCity;
  useEffect(()=>{
    generateSocialPost(dest,result.fromCity,result.direction,players,legNum,hashtag).then(d=>{
      setPosts(d.posts);
      const init={};d.posts.forEach((p,i)=>{init[i]=p.text;});
      setEditedTexts(init);setLoading(false);
    });
  },[]);
  const curText=editedTexts[selIdx]||"";
  const copy=async()=>{try{await navigator.clipboard.writeText(curText);}catch{const el=document.createElement("textarea");el.value=curText;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}setCopied(true);setTimeout(()=>setCopied(false),2500);};
  const share=(p)=>{if(p.shareUrl)window.open(p.shareUrl(curText),"_blank");else{copy();if(p.id==="instagram")window.open("https://www.instagram.com/","_blank");if(p.id==="tiktok")window.open("https://www.tiktok.com/","_blank");}};
  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-panel" onClick={e=>e.stopPropagation()}>
        <div className="share-header"><div><h2 className="share-title">📣 Ask the Locals</h2><p className="share-subtitle">Headed to {dest} — let locals guide you</p></div><button className="log-close" onClick={onClose}>✕</button></div>
        <div className="share-hashtag-row"><span className="share-hashtag-label">Hashtag</span><input className="share-hashtag-input" value={hashtag} onChange={e=>setHashtag(e.target.value.startsWith("#")?e.target.value:"#"+e.target.value)}/></div>
        {loading?<div className="share-loading"><div className="share-spinner"/>Crafting posts…</div>:(
          <>
            <div className="post-options">{posts?.map((p,i)=>(
              <div key={i} className={`post-option${selIdx===i?" selected":""}`} onClick={()=>setSelIdx(i)}>
                <div className="post-option-header"><span className="post-style-label">{p.style}</span><span className="post-select-dot"/></div>
                {selIdx===i?(<><textarea className="post-text-area" value={editedTexts[i]||""} onChange={e=>setEditedTexts(prev=>({...prev,[i]:e.target.value}))} onClick={e=>e.stopPropagation()}/><div className={`post-char-count${curText.length>280?" over":""}`}>{curText.length}/280</div></>):(<div style={{padding:"9px 11px",fontSize:".8rem",color:"rgba(13,27,46,.52)",lineHeight:1.48,fontFamily:"'Cormorant Garamond',serif"}}>{p.text.slice(0,95)}{p.text.length>95?"…":""}</div>)}
              </div>
            ))}</div>
            <div className="share-platforms">{SOCIAL_PLATFORMS.map(p=><button key={p.id} className="platform-btn" style={{background:p.color==="000000"?"#1a1a1a":p.color}} onClick={()=>share(p)}><span className="platform-icon">{p.icon}</span>{p.label}</button>)}</div>
            <button className={`copy-all-btn${copied?" copied":""}`} onClick={copy}>{copied?"✓ Copied!":"📋 Copy Post Text"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function TripLog({log,startCity,onClose}) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel" onClick={e=>e.stopPropagation()}>
        <div className="log-header"><h2 className="log-title">📜 Trip Log</h2><button className="log-close" onClick={onClose}>✕ Close</button></div>
        <div className="log-entry"><span className="log-dir">🏠</span><div className="log-info"><div className="log-city">{startCity}</div><div className="log-player">Starting point</div></div></div>
        {log.map((e,i)=><div key={i} className="log-entry"><span className="log-dir">{ARROWS[e.direction]}</span><div className="log-info"><div className="log-city">{e.location}</div><div className="log-player">{e.player?.name} · {e.direction}</div></div>{e.isMust&&<span className="log-badge must">Must</span>}{e.wasVetoed&&<span className="log-badge vetoed">Vetoed</span>}</div>)}
      </div>
    </div>
  );
}

function Community({onClose}) {
  return (
    <div className="community-overlay" onClick={onClose}>
      <div className="community-panel" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><h2 className="community-title">Where Others Rolled</h2><p className="community-sub">Real trips. Real dice. Real adventures.</p></div>
          <button className="log-close" onClick={onClose}>✕</button>
        </div>
        <div className="community-feed">{MOCK_COMMUNITY.map((t,i)=><div key={i} className="community-card"><span className="comm-icon">{t.icon}</span><div><div className="comm-route">{t.route} · {t.days}</div><div className="comm-cities">{t.cities}</div><div className="comm-meta">{t.travelers}</div></div></div>)}</div>
      </div>
    </div>
  );
}

function JourneyMap({log,startCity,startCoords,isPremium,onUpgrade}) {
  const svgRef=useRef(null);
  const allCoords=[startCoords,...log.map(e=>e.coords).filter(Boolean)];
  const cities=[startCity,...log.map(e=>e.location)];
  if(allCoords.length<2)return <div style={{textAlign:"center",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",color:"rgba(13,27,46,.45)",padding:"20px"}}>Roll at least once to see your journey map!</div>;
  const lats=allCoords.map(c=>c.lat),lons=allCoords.map(c=>c.lon);
  const minLat=Math.min(...lats)-1,maxLat=Math.max(...lats)+1,minLon=Math.min(...lons)-1,maxLon=Math.max(...lons)+1;
  const W=500,H=200;
  const toX=lon=>((lon-minLon)/(maxLon-minLon))*W*0.85+W*0.075;
  const toY=lat=>H-(((lat-minLat)/(maxLat-minLat))*H*0.8+H*0.1);
  const points=allCoords.map(c=>({x:toX(c.lon),y:toY(c.lat)}));
  const handleDl=()=>{if(!isPremium){onUpgrade();return;}const el=svgRef.current;if(!el)return;const data=new XMLSerializer().serializeToString(el);const blob=new Blob([data],{type:"image/svg+xml"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="destination-unknown-journey.svg";a.click();URL.revokeObjectURL(url);};
  return (
    <div className="journey-map-wrap">
      <div className="map-eyebrow">Your Journey · {log.length} Legs · {cities.length} Destinations</div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="map-svg">
        <defs><marker id="arr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#b8922a" opacity=".75"/></marker></defs>
        {points.slice(0,-1).map((p,i)=><line key={i} x1={p.x} y1={p.y} x2={points[i+1].x} y2={points[i+1].y} stroke="#b8922a" strokeWidth="1.5" strokeDasharray="4 3" opacity=".55" markerEnd="url(#arr)"/>)}
        {points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={i===0||i===points.length-1?5.5:3.5} fill={i===0?"#7c1d2e":i===points.length-1?"#2a7a3a":"#b8922a"} opacity=".88"/><text x={p.x} y={p.y-8} textAnchor="middle" fontSize="6.5" fill="#0d1b2e" fontFamily="Rajdhani,sans-serif" fontWeight="700">{cities[i]?.split(",")[0]}</text></g>)}
      </svg>
      <div className="map-legend">
        <div className="map-legend-item"><div className="map-legend-dot" style={{background:"#7c1d2e"}}/>Start</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{background:"#b8922a"}}/>Stops</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{background:"#2a7a3a"}}/>End</div>
      </div>
      <button className="map-download-btn" onClick={handleDl}>{isPremium?"⬇ Download Journey Map (Free with Premium)":"🗺 Download Journey Map — $4.99"}</button>
      {!isPremium&&<p className="map-note">Premium members get 1 free map/year.</p>}
    </div>
  );
}

function EndScreen({trip,log,journal,onNewTrip,isPremium,onUpgrade}) {
  const total=log.reduce((s,_,i)=>s+(i===0?trip.tripMode.firstHours:trip.tripMode.legHours),0);
  return (
    <div className="end-screen">
      <div style={{textAlign:"center"}}><div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:".68rem",letterSpacing:".32em",color:"var(--brass)",textTransform:"uppercase",marginBottom:10}}>Trip Complete</div><h1 className="end-title">Destination<br/><em>Unknown</em></h1></div>
      <div className="end-rule"><span className="end-diamond"/></div>
      <div className="end-stats">
        <div className="stat-box"><div className="stat-val">{log.length}</div><div className="stat-label">Legs</div></div>
        <div className="stat-box"><div className="stat-val">~{total}h</div><div className="stat-label">On Road</div></div>
        <div className="stat-box"><div className="stat-val">{log.length+1}</div><div className="stat-label">Destinations</div></div>
      </div>
      <JourneyMap log={log} startCity={trip.startCity} startCoords={trip.startCoords} isPremium={isPremium} onUpgrade={onUpgrade}/>
      <button className="new-trip-btn" onClick={onNewTrip}>🎲 Roll Again</button>
    </div>
  );
}

function SetupScreen({onStart,isPremium,onShowPremium}) {
  const [useGPS,setUseGPS]=useState(false);
  const [startCity,setStartCity]=useState("");
  const [flyToStart,setFlyToStart]=useState(false);
  const [mode,setMode]=useState(TRIP_MODES[0]);
  const [customDays,setCustomDays]=useState("");
  const [musicApp,setMusicApp]=useState("spotify");
  const [names,setNames]=useState(["",""]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const addPlayer=()=>{if(names.length<8)setNames([...names,""]); };
  const removeName=i=>setNames(names.filter((_,idx)=>idx!==i));
  const updateName=(i,v)=>{const n=[...names];n[i]=v;setNames(n);};
  const handleStart=async()=>{
    const playerNames=names.map(n=>n.trim()).filter(Boolean);
    if(!playerNames.length){setError("Add at least one adventurer!");return;}
    setLoading(true);setError("");
    try{
      let coords,cityLabel;
      if(useGPS){const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej));coords={lat:pos.coords.latitude,lon:pos.coords.longitude};cityLabel=`${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}`;}
      else{if(!startCity.trim()){setError("Enter a starting city!");setLoading(false);return;}const geo=await geocodeCity(startCity.trim());if(!geo){setError("Couldn't find that city — try again.");setLoading(false);return;}coords=geo;cityLabel=startCity.trim();}
      const selMode=mode.id==="custom"?{...mode,days:parseInt(customDays)||null,firstHours:customDays<=2?3:customDays<=4?5:7,legHours:customDays<=2?2:customDays<=4?3:4}:mode;
      onStart({players:createPlayers(playerNames,musicApp),startCoords:coords,startCity:cityLabel,tripMode:selMode,flyToStart});
    }catch{setError("Location error — try typing a city.");setLoading(false);}
  };
  return (
    <div className="setup">
      <div className="setup-hero">
        <p className="setup-eyebrow">An Adventure in Every Roll</p>
        <h1 className="setup-logo">Destination<br/><em>Unknown</em></h1>
        <div className="setup-rule-line"><span className="setup-rule-diamond"/></div>
        <p className="setup-sub">Roll the dice. Let fate drive.</p>
      </div>
      {!isPremium&&<AdBanner onUpgrade={onShowPremium}/>}
      <div className="setup-card">
        <div>
          <h2 className="section-title">Starting Point</h2>
          <div style={{display:"flex",flexDirection:"column",gap:9,marginTop:9}}>
            <div className="toggle-row">
              <button className={`toggle-btn${!useGPS?" active":""}`} onClick={()=>setUseGPS(false)}>📍 Enter City</button>
              <button className={`toggle-btn${useGPS?" active":""}`} onClick={()=>setUseGPS(true)}>🛰 Use GPS</button>
            </div>
            {!useGPS&&<input className="field-input" placeholder="e.g. Warrensburg, MO" value={startCity} onChange={e=>setStartCity(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleStart()}/>}
            {useGPS&&<p className="section-hint">We'll use your device's current location.</p>}
          </div>
        </div>
        <div>
          <h2 className="section-title">Trip Style</h2>
          <div className="toggle-row" style={{marginTop:9,marginBottom:10}}>
            <button className={`toggle-btn${!flyToStart?" active":""}`} onClick={()=>setFlyToStart(false)}>🚗 Drive from Here</button>
            <button className={`toggle-btn${flyToStart?" active":""}`} onClick={()=>setFlyToStart(true)}>✈️ Fly to Start</button>
          </div>
          {flyToStart&&<p className="section-hint">Roll from home, then fly or take Amtrak to that first destination to begin the drive.</p>}
        </div>
        <div>
          <h2 className="section-title">Trip Mode</h2>
          <p className="section-hint" style={{marginBottom:9}}>Sets distance and leg lengths automatically.</p>
          <div className="mode-grid">
            {TRIP_MODES.map(m=><button key={m.id} className={`mode-btn${mode.id===m.id?" active":""}`} onClick={()=>setMode(m)}><span className="mode-btn-label">{m.label}</span><span className="mode-btn-desc">{m.desc}{m.id!=="custom"&&m.days?` · ${m.firstHours}h / ${m.legHours}h legs`:""}</span></button>)}
          </div>
          {mode.id==="custom"&&<input className="field-input" style={{marginTop:9}} placeholder="How many days?" type="number" min="1" max="30" value={customDays} onChange={e=>setCustomDays(e.target.value)}/>}
        </div>
        <div>
          <h2 className="section-title">Music App</h2>
          <p className="section-hint" style={{marginBottom:9}}>You roll, you drive, you pick the playlist.</p>
          <select className="music-select" value={musicApp} onChange={e=>setMusicApp(e.target.value)}>
            {MUSIC_APPS.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <h2 className="section-title">Adventurers</h2>
          <p className="section-hint" style={{marginBottom:9}}>Each player gets 1 veto for the entire trip.</p>
          <div className="player-list">
            {names.map((name,i)=><div key={i} className="player-row"><span className="player-num">{i+1}</span><input className="field-input" placeholder={`Adventurer ${i+1}`} value={name} onChange={e=>updateName(i,e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleStart()}/>{names.length>1&&<button className="remove-btn" onClick={()=>removeName(i)}>✕</button>}</div>)}
          </div>
          {names.length<8&&<button className="add-player-btn" onClick={addPlayer} style={{marginTop:7}}>+ Add Adventurer</button>}
        </div>
        {error&&<p className="error-msg">{error}</p>}
        <button className="start-btn" onClick={handleStart} disabled={loading}>{loading?"Plotting your adventure…":"🎲 Begin the Adventure"}</button>
      </div>
      <div className="rules-footer">
        <h3>The Rules</h3>
        <ul>
          <li>🧭 First roll = {mode.firstHours}h drive in that direction</li>
          <li>🔄 Each leg = {mode.legHours}h in a new direction</li>
          <li>🚫 No backtracking the exact way you came</li>
          <li>🌊 Water or out-of-US rolls auto re-roll (with commentary)</li>
          <li>❌ Each player has 1 veto (re-roll) for the whole trip</li>
          <li>⚡ After a veto, next roll is a MUST — no vetoes allowed</li>
          <li>🎵 You roll = you drive = you pick music</li>
        </ul>
      </div>
    </div>
  );
}

function TripScreen({trip,isPremium,onEnd,onShowPremium}) {
  const [players,setPlayers]=useState(trip.players);
  const [coords,setCoords]=useState(trip.startCoords);
  const [cityName,setCityName]=useState(trip.startCity);
  const [lastDir,setLastDir]=useState(null);
  const [log,setLog]=useState([]);
  const [journal,setJournal]=useState({});
  const [rolling,setRolling]=useState(false);
  const [diceResult,setDiceResult]=useState(null);
  const [activeResult,setActiveResult]=useState(null);
  const [isMust,setIsMust]=useState(false);
  const [rollIdx,setRollIdx]=useState(0);
  const [showLog,setShowLog]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [showCommunity,setShowCommunity]=useState(false);
  const [showMapModal,setShowMapModal]=useState(false);
  const [showInterstitial,setShowInterstitial]=useState(false);
  const [showPremiumModal,setShowPremiumModal]=useState(false);
  const [pendingResult,setPendingResult]=useState(null);
  const [loadingInfo,setLoadingInfo]=useState(false);
  const [waterMessage,setWaterMessage]=useState(null);
  const [waterDirs,setWaterDirs]=useState([]);
  const resultRef=useRef(null);

  const isFirst=log.length===0;
  const hours=isFirst?trip.tripMode.firstHours:trip.tripMode.legHours;
  const currentPlayer=getPlayer(players,rollIdx);
  const blocked=lastDir?OPPOSITE[lastDir]:null;
  const musicApp=MUSIC_APPS.find(a=>a.id===currentPlayer.musicApp);
  const saveJournal=(idx,data)=>setJournal(prev=>({...prev,[idx]:data}));
  const revealResult=r=>{setActiveResult(r);setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);};

  const doRoll=async()=>{
    setRolling(true);setActiveResult(null);setWaterMessage(null);setDiceResult(null);setWaterDirs([]);
    await new Promise(r=>setTimeout(r,1600));
    let direction,destCoords,isWater=true,attempts=0,wDirs=[];
    while(isWater&&attempts<8){
      const available=DIRECTIONS.filter(d=>d!==blocked&&!wDirs.includes(d));
      if(!available.length)break;
      direction=available[Math.floor(Math.random()*available.length)];
      destCoords=getDestCoords(coords.lat,coords.lon,direction,hoursToMiles(hours));
      isWater=!isInUS(destCoords.lat,destCoords.lon)||await checkIfWater(destCoords.lat,destCoords.lon);
      if(isWater){wDirs.push(direction);setWaterDirs([...wDirs]);setWaterMessage(wittyWater(direction));await new Promise(r=>setTimeout(r,1200));}
      attempts++;
    }
    setWaterMessage(null);setRolling(false);setDiceResult(direction);
    setLoadingInfo(true);
    const destCity=await reverseGeocode(destCoords.lat,destCoords.lon);
    const mapsUrl=getMapsUrl(coords.lat,coords.lon,destCoords.lat,destCoords.lon);
    const [info,weather]=await Promise.all([fetchDestInfo(cityName,direction,hours,trip.tripMode.label),fetchWeather(destCoords.lat,destCoords.lon)]);
    const packingGuide=await fetchPackingGuide(weather,info?.destinationCity||destCity);
    setLoadingInfo(false);
    const result={direction,destCity,destCoords,info,mapsUrl,fromCity:cityName,hours,player:currentPlayer,weather,packingGuide};
    setLog(prev=>[...prev,{direction,location:info?.destinationCity||destCity,player:currentPlayer,isMust,wasVetoed:false,coords:destCoords}]);
    setCoords(destCoords);setCityName(info?.destinationCity||destCity);setLastDir(direction);setIsMust(false);setRollIdx(i=>i+1);
    if(!isPremium){setPendingResult(result);setShowInterstitial(true);}else{revealResult(result);}
  };

  const handleVeto=()=>{
    if(isMust||currentPlayer.vetosLeft<=0)return;
    setPlayers(prev=>prev.map(p=>p.id===currentPlayer.id?{...p,vetosLeft:p.vetosLeft-1}:p));
    setLog(prev=>{const u=[...prev];if(u.length)u[u.length-1].wasVetoed=true;return u;});
    setIsMust(true);setActiveResult(null);setDiceResult(null);setRollIdx(i=>i+1);
  };

  return (
    <div className="trip-screen">
      <header className="trip-header">
        <div><h1 className="trip-logo">Destination <em>Unknown</em></h1><div className="trip-city">from {trip.startCity} · {trip.tripMode.label}</div></div>
        <div className="header-btns">
          {!isPremium&&<button className="hdr-btn gold" onClick={onShowPremium}>★ Premium</button>}
          <button className="hdr-btn" onClick={()=>setShowCommunity(true)}>🌍 Community</button>
          <button className="hdr-btn" onClick={()=>setShowLog(true)}>📜 Log ({log.length})</button>
          <button className="hdr-btn" onClick={()=>setShowMapModal(true)}>🗺 Map</button>
          <button className="hdr-btn danger" onClick={onEnd}>End</button>
        </div>
      </header>
      {!isPremium&&<AdBanner onUpgrade={onShowPremium}/>}
      <PlayerBar players={players} currentPlayer={currentPlayer}/>
      <main className="trip-main">
        <div className="roll-zone">
          <div className="loc-badge">📍 Currently in <strong>{cityName}</strong></div>
          {blocked&&<div className="notice blocked">🚫 {blocked} is blocked — no backtracking!</div>}
          {isMust&&<div className="notice must">⚡ MUST ROLL — {currentPlayer.name} must accept this. No vetoes.</div>}
          {waterMessage&&(
            <div className="water-alert">
              <p className="water-alert-wit">"{waterMessage}"</p>
              {(trip.flyToStart&&isFirst)&&<div className="transport-links"><a href={`https://www.google.com/flights`} target="_blank" rel="noreferrer" className="transport-link flights">✈ Google Flights</a><a href="https://www.amtrak.com/plan-your-trip" target="_blank" rel="noreferrer" className="transport-link train">🚆 Amtrak</a></div>}
            </div>
          )}
          <Compass blocked={blocked} result={diceResult} waterDirs={waterDirs}/>
          <Dice3D rolling={rolling} result={diceResult}/>
          <div className="roll-actions">
            <button className="roll-btn" onClick={doRoll} disabled={rolling||loadingInfo||(activeResult&&!isMust)}>{rolling?"Rolling the dice…":loadingInfo?"Scouting the route…":`🎲 ${currentPlayer.name}, Roll!`}</button>
            {activeResult&&!isMust&&currentPlayer.vetosLeft>0&&<button className="veto-btn" onClick={handleVeto}>❌ Veto & Re-roll ({currentPlayer.vetosLeft} left)</button>}
            {activeResult&&!isMust&&currentPlayer.vetosLeft===0&&<p className="no-veto-note">No vetoes left for {currentPlayer.name}</p>}
          </div>
          {activeResult&&musicApp&&musicApp.id!=="none"&&<div className="music-banner">🎵 {currentPlayer.name}'s turn to pick music{musicApp.url&&<a href={musicApp.url} target="_blank" rel="noreferrer" className="music-link">Open {musicApp.label} →</a>}</div>}
          {activeResult&&trip.flyToStart&&isFirst&&(
            <div className="water-alert" style={{marginTop:4}}>
              <p className="water-alert-wit" style={{fontStyle:"normal",color:"var(--brass-l)",fontSize:".88rem"}}>✈ Fly-to-Start — Find your way to {activeResult.info?.destinationCity||activeResult.destCity}</p>
              <div className="transport-links">
                <a href={`https://www.google.com/flights`} target="_blank" rel="noreferrer" className="transport-link flights">✈ Google Flights</a>
                <a href="https://www.amtrak.com/plan-your-trip" target="_blank" rel="noreferrer" className="transport-link train">🚆 Amtrak</a>
              </div>
            </div>
          )}
        </div>
        <div ref={resultRef}>
          {activeResult&&<ResultCard result={activeResult} onAskLocals={()=>setShowShare(true)} journal={journal} onSaveJournal={saveJournal} legIndex={log.length-1}/>}
        </div>
      </main>
      {showLog&&<TripLog log={log} startCity={trip.startCity} onClose={()=>setShowLog(false)}/>}
      {showShare&&activeResult&&<SocialShare result={activeResult} players={players} legNum={log.length} onClose={()=>setShowShare(false)}/>}
      {showCommunity&&<Community onClose={()=>setShowCommunity(false)}/>}
      {showMapModal&&(
        <div className="modal-overlay" onClick={()=>setShowMapModal(false)}>
          <div style={{width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <JourneyMap log={log} startCity={trip.startCity} startCoords={trip.startCoords} isPremium={isPremium} onUpgrade={()=>{setShowMapModal(false);setShowPremiumModal(true);}}/>
          </div>
        </div>
      )}
      {showInterstitial&&<Interstitial onSkip={()=>{setShowInterstitial(false);if(pendingResult){revealResult(pendingResult);setPendingResult(null);}}} onUpgrade={()=>{setShowInterstitial(false);setShowPremiumModal(true);}}/>}
      {showPremiumModal&&<PremiumModal onClose={()=>setShowPremiumModal(false)} onActivate={()=>{setShowPremiumModal(false);onShowPremium();}}/>}
      {loadingInfo&&<div className="loading-overlay"><div className="loading-spinner"/><p className="loading-text">Scouting {diceResult?ARROWS[diceResult]:""} {diceResult}… finding the good stuff</p></div>}
    </div>
  );
}

export default function DestinationUnknown() {
  const [trip,setTrip]=useState(null);
  const [isPremium,setIsPremium]=useState(false);
  const [showPremium,setShowPremium]=useState(false);
  const [endData,setEndData]=useState(null);
  return (
    <>
      <style>{css}</style>
      {showPremium&&<PremiumModal onClose={()=>setShowPremium(false)} onActivate={()=>{setIsPremium(true);setShowPremium(false);}}/>}
      {endData?(
        <EndScreen trip={endData.trip} log={endData.log} journal={endData.journal} onNewTrip={()=>setEndData(null)} isPremium={isPremium} onUpgrade={()=>setShowPremium(true)}/>
      ):!trip?(
        <SetupScreen onStart={setTrip} isPremium={isPremium} onShowPremium={()=>setShowPremium(true)}/>
      ):(
        <TripScreen trip={trip} isPremium={isPremium} onEnd={()=>{setEndData({trip,log:[],journal:{}});setTrip(null);}} onShowPremium={()=>setShowPremium(true)}/>
      )}
    </>
  );
}

