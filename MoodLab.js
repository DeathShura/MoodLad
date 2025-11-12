// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const store = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
};
const nowStr = () => new Date().toLocaleString();

//Tab Navigation
$$('#tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('#tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['journal','coach','chat','progress','community','biometrics'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.classList.toggle('hidden', id!==tab);
    });
    if(tab==='progress'){ drawMoodChart(); renderSkills() }
  });
});

//MoodLab Lexicon (Expanded)
const POSITIVE = {
  emotions: ["joyful","happy","cheerful","delighted","elated","ecstatic","euphoric","thrilled","overjoyed","gleeful","content","satisfied","fulfilled","serene","peaceful","tranquil","calm","hopeful","optimistic","encouraged","reassured","confident","inspired","uplifted","grateful","thankful","appreciative","touched","moved","proud","empowered","validated"],
  qualities: ["excellent","outstanding","exceptional","superb","stellar","first-rate","top-notch","amazing","wonderful","marvelous","fantastic","fabulous","phenomenal","beautiful","lovely","elegant","exquisite","stunning","charming","kind","compassionate","caring","generous","considerate","thoughtful","empathetic","honest","sincere","authentic","trustworthy","reliable","dependable","creative","innovative","resourceful","brilliant","insightful","wise","resilient","courageous","brave","determined","persistent","tenacious"],
  states: ["enthusiastic","energized","motivated","driven","invigorated","peaceful","calm","centered","grounded","balanced","relaxed","relieved","comforted","soothed","at ease","inspired","engaged","in flow","focused","clear-headed","thriving","flourishing","growing","progressing","improving","safe","supported","connected","included","belonging"],
  actions: ["admire","appreciate","commend","praise","applaud","celebrate","cherish","encourage","support","uplift","empower","reassure","help","assist","nurture","guide","mentor","inspire","enlighten","motivate","validate","acknowledge","recognize","contribute","collaborate","cooperate"]
};
const NEGATIVE = {
  emotions: ["sad","down","blue","heartbroken","grief-stricken","devastated","angry","irritated","annoyed","enraged","furious","resentful","scared","afraid","terrified","petrified","panicked","frustrated","exasperated","aggravated","confused","bewildered","perplexed","ashamed","guilty","embarrassed","humiliated","jealous","envious","bitter"],
  qualities: ["terrible","horrible","awful","appalling","dreadful","abysmal","ugly","unpleasant","distasteful","vile","rude","mean","cruel","heartless","unkind","dishonest","deceitful","manipulative","two-faced","incompetent","inept","careless","thoughtless"],
  states: ["anxious","nervous","jittery","on edge","panicky","stressed","overwhelmed","burned out","exhausted","drained","hurt","wounded","pained","lonely","isolated","abandoned","excluded","disconnected","broken","shattered","defeated","demoralized","discouraged","hopeless","pessimistic","cynical","doubtful","restless","uneasy","unsettled","tense","numb","detached","empty"],
  actions: ["criticize","blame","judge","condemn","denounce","abuse","insult","belittle","mock","ridicule","shame","regret","lament","bemoan","resent","sabotage","undermine","obstruct","complain","gripe","grumble","whine","dismiss","ignore","neglect","avoid"]
};
const THEMES = {
  anxiety: ["anxious","worry","worried","worries","panic","panicky","fear","afraid","nervous","uneasy","restless","on edge","tense","overwhelmed"],
  selfCrit: ["stupid","worthless","failure","not good enough","hate myself","loser","idiot","my fault","should have","always my fault","useless","pathetic","disgusting","i'm a failure","i am a failure","i'm worthless","i am worthless"]
};
const DISTORTIONS = [
  {name:'All-or-Nothing', re:/\b(always|never|everything|nothing|completely|totally)\b/i},
  {name:'Catastrophizing', re:/\b(disaster|ruined|doomed|worst(-| )case|terrible|awful|hopeless)\b/i},
  {name:'Mind Reading', re:/\b(they|everyone|people)\s+(think|must think|probably think)\b/i},
  {name:'Should Statements', re:/\b(should|must|have to|supposed to|ought to)\b/i},
  {name:'Overgeneralization', re:/\b(never works|always happens|no one|everyone|every time)\b/i},
  {name:'Personalization', re:/\b(my fault|all on me|because of me|it's on me)\b/i},
  {name:'Labeling', re:/\b(i('| a)m|you('| a)re|he('| i)s|she('| i)s)\s+(failure|worthless|loser|idiot|stupid|pathetic)\b/i},
  {name:'Fortune-telling', re:/\b(it will fail|i('| )?('ll|will) mess up|guaranteed to go wrong|nothing will work)\b/i},
  {name:'Emotional Reasoning', re:/\b(i feel (like )?a (failure|loser|mess)|i feel so (bad|awful) so it must be true)\b/i}
];
const POS_LIST = Object.values(POSITIVE).flat();
const NEG_LIST = Object.values(NEGATIVE).flat();

//Sentiment & Emotion
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') }
function countMatches(raw, list){
  let count = 0;
  for(const term of list){
    if(term.includes(' ')){ if(raw.includes(term)) count++; }
    else {
      const re = new RegExp(`\\b${escapeReg(term)}\\b`,'i');
      if(re.test(raw)) count++;
    }
  }
  return count;
}
function analyzeSentiment(text){
  const raw = text.toLowerCase();
  const pos = countMatches(raw, POS_LIST);
  const neg = countMatches(raw, NEG_LIST);
  const total = pos + neg;
  const score = total ? (pos - neg) / total : 0;
  const label = score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral';
  let emotion = 'Calm';
  if (THEMES.selfCrit.some(p=> raw.includes(p))) {
    emotion = 'Self-critical';
  } else if (THEMES.anxiety.some(p=> raw.includes(p))) {
    emotion = 'Anxious';
  } else if (label === 'Positive') {
    const posEmos = POSITIVE.emotions.filter(e=> raw.includes(e));
    emotion = posEmos[0] ? capitalize(posEmos[0]) : 'Content';
  } else if (label === 'Negative') {
    const negEmos = NEGATIVE.emotions.filter(e=> raw.includes(e));
    emotion = negEmos[0] ? capitalize(negEmos[0]) : 'Sad';
  }
  return { score, label, emotion };
}
function detectDistortions(text){
  const raw = text.toLowerCase();
  const tags = [];
  for(const d of DISTORTIONS){ if(d.re.test(raw)) tags.push(d.name) }
  return [...new Set(tags)];
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1) }

//Journal
const journalInput = $('#journalInput');
const sentimentLabel = $('#sentimentLabel');
const sentimentScore = $('#sentimentScore');
const emotionLabel = $('#emotionLabel');
const distortionsEl = $('#distortions');
const suggestion = $('#interventionSuggestion');
const entriesEl = $('#entries');

function renderDistortions(tags){
  distortionsEl.innerHTML = tags.map(t=>`<span class="tag negative">⚠ ${t}</span>`).join('');
}
function suggestIntervention(text, sentiment, distortions){
  if(!text.trim()) { suggestion.textContent = 'Start typing to get tailored micro-activities.'; return; }
  let rec = '';
  if (sentiment.emotion === 'Self-critical') {
    rec = 'We noticed self-criticism. Try a 2–3 minute Self-Compassion Pause.';
  } else if (sentiment.emotion === 'Anxious' || sentiment.label === 'Negative') {
    rec = 'Tension detected. Consider 3 minutes of Box Breathing or Worry Deconstruction.';
  } else if (sentiment.label === 'Positive') {
    rec = 'Nice! Amplify with a 2-minute Savoring or Gratitude note.';
  } else {
    rec = 'Try a brief mindful check-in (breath + body scan) to ground.';
  }
  if(distortions.length){
    rec += ' Possible patterns: ' + distortions.join(', ') + '. A Thought Record can help.';
  }
  suggestion.textContent = rec;
}

journalInput.addEventListener('input', ()=>{
  const t = journalInput.value;
  const s = analyzeSentiment(t);
  sentimentLabel.textContent = s.label;
  sentimentScore.textContent = s.score.toFixed(2);
  emotionLabel.textContent = s.emotion;
  const d = detectDistortions(t);
  renderDistortions(d);
  suggestIntervention(t, s, d);
});

function renderEntries(){
  const data = store.get('entries', []);
  entriesEl.innerHTML = data.slice().reverse().map(e=>`
    <div class="item">
      <div class="meta">
        <span>${new Date(e.ts).toLocaleString()}</span>
        <span class="tag ${e.sentiment.label==='Positive'?'positive':e.sentiment.label==='Negative'?'negative':'neutral'}">${e.sentiment.label} ${e.sentiment.score.toFixed(2)}</span>
        <span class="tag">${e.sentiment.emotion}</span>
        ${e.distortions.map(x=>`<span class="tag negative">${x}</span>`).join('')}
      </div>
      <div style="margin-top:6px;white-space:pre-wrap">${e.text}</div>
    </div>
  `).join('');
}

$('#saveJournal').addEventListener('click', ()=>{
  const text = journalInput.value.trim();
  if(!text) return;
  const s = analyzeSentiment(text);
  const d = detectDistortions(text);
  const entries = store.get('entries', []);
  entries.push({ts:Date.now(), text, sentiment:s, distortions:d});
  store.set('entries', entries);
  journalInput.value = '';
  suggestion.textContent = 'Saved. Nice job checking in.';
  renderEntries();
  drawMoodChart();
});
$('#clearJournal').addEventListener('click', ()=>{ journalInput.value=''; journalInput.dispatchEvent(new Event('input')) });
renderEntries();

//Personalized Coach
function buildPlan(mode){
  const last = store.get('entries', []).slice(-1)[0];
  let context = mode;
  if(mode==='auto'){
    if(last){
      const e = last.sentiment;
      if(e.emotion==='Anxious' || e.label==='Negative') context='anxiety';
      else if(e.emotion==='Self-critical') context='self-criticism';
      else if(e.label==='Positive') context='positive';
      else context='rumination';
    } else context='rumination';
  }
  const blocks = {
    anxiety: [
      {title:'Box Breathing (4-4-4-4) • 3 min', steps:['Inhale 4','Hold 4','Exhale 4','Hold 4','Repeat 6–8 cycles']},
      {title:'Worry Deconstruction • 2 min', steps:['Write top worry','Is it solvable?','Next tiny step or schedule worry time']}
    ],
    'self-criticism': [
      {title:'Self-Compassion Pause • 3 min', steps:['Mindfulness: “This is tough.”','Common humanity: “Struggle is human.”','Kindness: “May I be kind to myself.”']},
      {title:'Values Reminder • 2 min', steps:['What matters right now?','One small value-aligned action']}
    ],
    positive: [
      {title:'Savoring • 2 min', steps:['Recall a recent good moment','Replay sensory details','Notice how it feels']},
      {title:'Gratitude • 2 min', steps:['List 3 things','Why they matter','Share or commit an act of kindness']}
    ],
    sleep: [
      {title:'Wind-down • 3 min', steps:['Dim lights','Slow breathing','Note worries to handle tomorrow']},
      {title:'Body Scan • 2 min', steps:['Scan head→toe','Release tension on exhale']}
    ],
    rumination: [
      {title:'Thought Labeling • 2 min', steps:['Name: planning vs. judging vs. worrying','Return to breath']},
      {title:'5-4-3-2-1 Grounding • 3 min', steps:['5 see','4 touch','3 hear','2 smell','1 taste']}
    ]
  };
  const plan = blocks[context] || blocks.rumination;
  return {context, plan};
}

$('#generatePlan').addEventListener('click', ()=>{
  const mode = $('#focusSelect').value;
  const {context, plan} = buildPlan(mode);
  const planEl = $('#plan');
  planEl.innerHTML = `
    <div class="item"><b>Recommended Focus: ${context}</b></div>
    ${plan.map(b=>`
      <div class="item">
        <b>${b.title}</b>
        <ul class="small">${b.steps.map(s=>`<li>${s}</li>`).join('')}</ul>
      </div>
    `).join('')}
  `;
  if(context==='positive') bumpSkill('savor',2);
});

// Breathing visual
const breathCanvas = $('#breathCanvas');
const bctx = breathCanvas.getContext('2d');
let breathTimer=null, t0=0;
function drawBreath(){
  const w = breathCanvas.width, h = breathCanvas.height;
  bctx.clearRect(0,0,w,h);
  const cx = w/2, cy = h/2, r = Math.min(w,h)*0.36;
  bctx.lineWidth = 10;
  bctx.strokeStyle = '#2a2f56';
  bctx.beginPath(); bctx.arc(cx,cy,r,0,Math.PI*2); bctx.stroke();
  const cycle = 16e3;
  const t = (performance.now()-t0) % cycle;
  const phases = [
    {name:'Inhale', color:'#6ee7b7', start:0, end:4000},
    {name:'Hold', color:'#7aa2ff', start:4000, end:8000},
    {name:'Exhale', color:'#94a3b8', start:8000, end:12000},
    {name:'Hold', color:'#a78bfa', start:12000, end:16000},
  ];
  const p = phases.find(ph=>t>=ph.start && t<ph.end) || phases[0];
  const frac = (t - p.start) / (p.end - p.start);

  bctx.strokeStyle = p.color;
  bctx.beginPath();
  bctx.arc(cx,cy,r,-Math.PI/2, -Math.PI/2 + frac*2*Math.PI);
  bctx.stroke();

  bctx.fillStyle = '#cbd5e1';
  bctx.font = '16px Inter, sans-serif';
  bctx.textAlign='center';
  bctx.fillText(p.name, cx, cy-6);
  bctx.font = '12px Inter, sans-serif';
  bctx.fillText(`${Math.ceil((p.end - t)/1000)}s`, cx, cy+14);

  breathTimer = requestAnimationFrame(drawBreath);
}
$('#startBreath').addEventListener('click', ()=>{
  if(breathTimer) cancelAnimationFrame(breathTimer);
  t0 = performance.now(); drawBreath(); bumpSkill('breath',2);
});
$('#stopBreath').addEventListener('click', ()=>{
  if(breathTimer) cancelAnimationFrame(breathTimer);
  breathTimer=null; bctx.clearRect(0,0,breathCanvas.width,breathCanvas.height);
});

// Self-Compassion Pause guide
$('#startSCP').addEventListener('click', ()=>{
  const el = $('#scpGuide');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div><b>Step 1 — Mindfulness</b><br><span class="small">Acknowledge: “This is hard.” Name the feeling.</span></div>
    <div class="divider"></div>
    <div><b>Step 2 — Common Humanity</b><br><span class="small">“Struggle is part of being human.” You’re not alone.</span></div>
    <div class="divider"></div>
    <div><b>Step 3 — Kindness</b><br><span class="small">Place a hand on your heart. Say: “May I be kind to myself right now.”</span></div>
  `;
  bumpSkill('compassion',2);
});

//Chat
const chatWindow = $('#chatWindow');
function addBubble(text, me=false){
  const div = document.createElement('div');
  div.className = 'bubble' + (me?' me':'');
  div.innerHTML = `<div>${text}</div><div class="time">${nowStr()}</div>`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
addBubble('Welcome to MoodLab. I’m here to listen. What would you like to share today?');

function reflect(input){
  const s = analyzeSentiment(input);
  const d = detectDistortions(input);
  let reply = 'I hear you. ';
  if(s.emotion==='Anxious') reply += 'There’s a lot of anxiety showing up. ';
  if(s.emotion==='Self-critical') reply += 'Your inner critic sounds loud. ';
  if(s.label==='Positive') reply += 'It’s nice to hear some positives too. ';
  if(d.length) reply += `I also notice patterns like ${d.join(', ')}. `;
  reply += 'Would you like a quick step to unpack this, or just to continue sharing?';
  return reply;
}
$('#sendChat').addEventListener('click', ()=>{
  const val = $('#chatInput').value.trim();
  if(!val) return;
  addBubble(val, true);
  $('#chatInput').value = '';
  setTimeout(()=> addBubble(reflect(val)), 400);
});

// Worry deconstruction
$('#worryGuide').addEventListener('click', ()=>{
  const panel = $('#worryPanel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div><b>Step 1</b>: Write the worry in one sentence.</div>
    <div class="row" style="margin-top:6px"><input id="w1" placeholder="The worry is..." /></div>
    <div class="divider"></div>
    <div><b>Step 2</b>: Is it solvable now or hypothetical?</div>
    <div class="row"><select id="w2"><option>Solvable</option><option>Hypothetical</option></select></div>
    <div class="divider"></div>
    <div id="w3"></div>
  `;
  panel.querySelector('#w2').addEventListener('change', e=>{
    const kind = e.target.value;
    if(kind==='Solvable'){
      panel.querySelector('#w3').innerHTML = `
        <div><b>Next tiny action</b> you can take in 5 minutes?</div>
        <div class="row" style="margin-top:6px"><input id="wstep" placeholder="e.g., draft the email"/></div>
      `;
    }else{
      panel.querySelector('#w3').innerHTML = `
        <div>Schedule “worry time” later (10 min) and gently refocus now.</div>
      `;
    }
  });
  bumpSkill('worry',2);
});

// Thought Record
$('#thoughtRecord').addEventListener('click', ()=>{
  const panel = $('#trPanel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="col">
      <div><b>Trigger</b><br><input id="tr1" placeholder="Situation/event"/></div>
      <div><b>Automatic Thoughts</b><br><input id="tr2" placeholder="What went through your mind?"/></div>
      <div><b>Feelings + Intensity (0–100)</b><br><input id="tr3" placeholder="e.g., anxiety 70"/></div>
      <div><b>Evidence For/Against</b><br><input id="tr4" placeholder="Against: ... / For: ..."/></div>
      <div><b>Balanced Thought</b><br><input id="tr5" placeholder="A kinder, more realistic alternative"/></div>
    </div>
  `;
});

//Progress: Mood Chart
function drawMoodChart(){
  const cvs = $('#moodChart');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  // Make canvas crisp on HiDPI
  const logicalW = 600, logicalH = 180;
  if (cvs.width !== logicalW * dpr) {
    cvs.width = logicalW * dpr;
    cvs.height = logicalH * dpr;
    cvs.style.width = logicalW + 'px';
    cvs.style.height = logicalH + 'px';
  }
  ctx.scale(dpr, dpr);

  const entries = store.get('entries', []);
  ctx.clearRect(0,0,logicalW,logicalH);

  // Axes
  ctx.strokeStyle = '#2a2f56';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30,10); ctx.lineTo(30,160); ctx.lineTo(590,160); ctx.stroke();

  // Map sentiment score [-1,1] to Y
  const points = entries.map((e,i)=>({
    x: 40 + i * ((550)/Math.max(1, entries.length-1)),
    y: 160 - ((e.sentiment.score+1)/2) * 140
  }));

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for(let i=0;i<=4;i++){
    const y = 20 + i*35;
    ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(590,y); ctx.stroke();
  }

  // Line
  ctx.strokeStyle = '#7aa2ff'; ctx.lineWidth=2;
  ctx.beginPath();
  points.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y) });
  ctx.stroke();

  // Points
  ctx.fillStyle = '#a78bfa';
  points.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill() });

  // Labels
  ctx.fillStyle = '#aeb6d6'; ctx.font='10px Inter';
  ctx.fillText('Positive', 2, 25);
  ctx.fillText('Neutral', 6, 95);
  ctx.fillText('Negative', 2, 160);
}

//Skills
const baseSkills = [
  {id:'breath', name:'Breath Regulation', progress:0},
  {id:'worry', name:'Worry Deconstruction', progress:0},
  {id:'compassion', name:'Self-Compassion', progress:0},
  {id:'savor', name:'Savoring & Gratitude', progress:0},
];
function getSkills(){ return store.get('skills', baseSkills) }
function setSkills(s){ store.set('skills', s) }
function bumpSkill(id, delta=10){
  const s = getSkills().map(x=> x.id===id ? {...x, progress: Math.min(100, x.progress+delta)} : x);
  setSkills(s); renderSkills();
}
function renderSkills(){
  const s = getSkills();
  const el = $('#skills');
  el.innerHTML = s.map(k=>`
    <div class="item skill">
      <div style="min-width:140px"><b>${k.name}</b></div>
      <div class="bar"><span style="width:${k.progress}%"></span></div>
      <div class="pill">${k.progress}%</div>
    </div>
  `).join('');
}
renderSkills();

// Export / Reset
$('#exportData').addEventListener('click', ()=>{
  const data = {
    brand: 'MoodLab',
    entries: store.get('entries', []),
    skills: getSkills(),
    lexicon: { POSITIVE, NEGATIVE, DISTORTIONS }
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='moodlab-data.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#clearData').addEventListener('click', ()=>{
  if(confirm('This will erase local data. Continue?')){
    localStorage.clear();
    renderEntries(); drawMoodChart(); renderSkills();
  }
});

//Community
$('#optIn').addEventListener('change', e=>{
  $('#circlePanel').classList.toggle('hidden', !e.target.checked);
});
let currentCircle=null;
function renderCircle(){
  const name = $('#anonName').value.trim() || 'Anon';
  $('#circleRoom').classList.remove('hidden');
  const history = store.get('circle_'+currentCircle, []);
  const el = $('#circleChat');
  el.innerHTML = '';
  history.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'bubble' + (m.me?' me':'');
    div.innerHTML = `<div><b>${m.name}:</b> ${m.text}</div><div class="time">${new Date(m.ts).toLocaleTimeString()}</div>`;
    el.appendChild(div);
  });
  el.scrollTop = el.scrollHeight;
}
$('#joinCircle').addEventListener('click', ()=>{
  currentCircle = $('#circleSelect').value;
  renderCircle();
});
$('#sendCircle').addEventListener('click', ()=>{
  const input = $('#circleInput');
  const text = input.value.trim(); if(!text || !currentCircle) return;
  const name = $('#anonName').value.trim() || 'Anon';
  const key = 'circle_'+currentCircle;
  const msgs = store.get(key, []);
  msgs.push({ts:Date.now(), name, text, me:true});
  store.set(key, msgs);
  input.value='';
  renderCircle();
});

//Biometrics
let bioTimer=null;
function lerp(a,b,t){ return a+(b-a)*t }
function bioTick(){
  const hr = lerp(60, 110, Math.random());
  const hrv = lerp(20, 90, Math.random());
  const temp = lerp(36.0, 37.8, Math.random());
  const sys = lerp(105, 135, Math.random());
  const dia = lerp(65, 90, Math.random());
  $('#hrVal').textContent = hr.toFixed(0);
  $('#hrvVal').textContent = hrv.toFixed(0);
  $('#tempVal').textContent = temp.toFixed(1);
  $('#bpVal').textContent = `${sys.toFixed(0)}/${dia.toFixed(0)}`;
  $('#hrBar').style.width = ((hr-50)/70*100)+'%';
  $('#hrvBar').style.width = ((hrv-10)/90*100)+'%';
  $('#tempBar').style.width = ((temp-35)/3*100)+'%';
  $('#bpBar').style.width = ((sys-90)/60*100)+'%';

  const bio = store.get('bio', []);
  const lastMood = (store.get('entries', []).slice(-1)[0]?.sentiment.score ?? 0);
  bio.push({ts:Date.now(), hr, hrv, temp, sys, dia, mood:lastMood});
  store.set('bio', bio);
  drawBioChart();
}
$('#simulateBio').addEventListener('click', ()=>{
  if(bioTimer) clearInterval(bioTimer);
  bioTimer = setInterval(bioTick, 1500);
});
$('#stopBio').addEventListener('click', ()=>{ if(bioTimer) clearInterval(bioTimer); bioTimer=null });

async function connectBLE(){
  if(!navigator.bluetooth){ alert('Web Bluetooth not supported in this browser.'); return; }
  try{
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[] });
    if(device.gatt){ await device.gatt.connect(); alert('Connected to: '+(device.name||'Device')); }
    else { alert('GATT not available for this device.'); }
  }catch(e){
    alert('BLE connection failed or canceled.');
  }
}
$('#connectBLE').addEventListener('click', connectBLE);

function drawBioChart(){
  const cvs = $('#bioChart'); const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const logicalW = 600, logicalH = 180;
  if (cvs.width !== logicalW * dpr) {
    cvs.width = logicalW * dpr;
    cvs.height = logicalH * dpr;
    cvs.style.width = logicalW + 'px';
    cvs.style.height = logicalH + 'px';
  }
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,logicalW,logicalH);

  const bio = store.get('bio', []).slice(-60);
  // Axes
  ctx.strokeStyle = '#2a2f56'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,10); ctx.lineTo(30,160); ctx.lineTo(590,160); ctx.stroke();

  function plot(data, color, mapY){
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((d,i)=>{
      const x = 40 + i * (550/Math.max(1,data.length-1));
      const y = mapY(d);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }
  // HRV 20-90
  plot(bio, '#6ee7b7', d=> 160 - ((d.hrv-20)/(90-20))*140);
  // Mood [-1..1]
  plot(bio, '#7aa2ff', d=> 160 - ((d.mood+1)/2)*140);

  ctx.fillStyle = '#aeb6d6'; ctx.font='10px Inter';
  ctx.fillText('HRV', 4, 24);
  ctx.fillText('Mood', 2, 160);
}

drawMoodChart();
drawBioChart();