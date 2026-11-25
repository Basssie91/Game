// ================= Game Arcade-account (Firebase): records en saves in de cloud =================
// Wordt geladen op de startpagina én in elke game. Startpagina: inlogscherm + samenvoegen.
// In games: alleen stil opslaan naar je account.
const firebaseConfig = {
  apiKey: 'AIzaSyAANDdhYuISmIhyN_lbiO_-7R3wCt9bQGA',
  authDomain: 'game-arcade-7f5a8.firebaseapp.com',
  projectId: 'game-arcade-7f5a8',
  storageBucket: 'game-arcade-7f5a8.firebasestorage.app',
  messagingSenderId: '780565589564',
  appId: '1:780565589564:web:1046aab17911e304e5dd39',
};
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const IS_HUB = !!document.getElementById('authGate');
const GUEST_KEY = 'ga_guest';
const ADMIN_EMAIL = 'basjonker2009@gmail.com';

// ---------- Laatst gespeeld (alleen in games) ----------
if (!IS_HUB) {
  const id = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '').split('/').pop();
  if (id) {
    let r; try { r = JSON.parse(localStorage.getItem('arcade_recent')) || []; } catch (e) { r = []; }
    r = r.filter((x) => x.id !== id); r.unshift({ id, t: Date.now() });
    try { localStorage.setItem('arcade_recent', JSON.stringify(r.slice(0, 8))); } catch (e) { /* vol */ }
  }
}

// ---------- Opslag: verzamelen + slim samenvoegen (ook gebruikt door 'Records overzetten') ----------
const J = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const KEEP = /^(arcade_|tt2_)/;
const SKIP = /^tt2_ghost|^arcade_settings$/;          // spookritten zijn te groot; instellingen horen bij het apparaat
const LOWER = ['arcade_mijnen_bests', 'arcade_sudoku_bests', 'arcade_memory_bests', 'arcade_moto_bests', 'arcade_escape_bests', 'arcade_dief_bests'];
const HIGHER = ['arcade_overval_bests', 'arcade_td_bests', 'arcade_dief_stars'];
const pickObj = (a, b, better) => { const o = Object.assign({}, a); for (const k in b) if (o[k] == null || better(b[k], o[k])) o[k] = b[k]; return o; };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function collect() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (KEEP.test(k) && !SKIP.test(k)) o[k] = localStorage.getItem(k);
  }
  return o;
}
// cur = wat er al is, v = wat binnenkomt. Geeft de beste waarde terug.
// cur = wat op dit apparaat staat, v = wat in de cloud staat; lt/rt = hun wijzigtijden
function mergeVal(k, cur, v, ghosts, lt, rt) {
  if (cur == null) return v;
  if (v == null) return cur;
  if (k === 'arcade_mtimes') { const a = J(cur) || {}, b = J(v) || {}; const o = Object.assign({}, a); for (const x in b) if (!(o[x] >= b[x])) o[x] = b[x]; return JSON.stringify(o); }
  const a = J(cur), b = J(v);
  if (k.startsWith('tt2_bests') && a && b) {
    const o = Object.assign({}, a);
    for (const l in b) {
      const bt = b[l] && typeof b[l] === 'object' ? b[l].t : b[l], at = o[l] && typeof o[l] === 'object' ? o[l].t : o[l];
      if (o[l] == null || bt < at) { o[l] = b[l]; if (ghosts) ghosts.push('tt2_ghost2_' + l); }
    }
    return JSON.stringify(o);
  }
  if (LOWER.includes(k) && a && b) return JSON.stringify(pickObj(a, b, (x, y) => x < y));
  if (HIGHER.includes(k) && a && b) return JSON.stringify(pickObj(a, b, (x, y) => x > y));
  if (k === 'arcade_patience_stats' && a && b) return JSON.stringify({ wins: Math.max(a.wins || 0, b.wins || 0), best: a.best == null ? b.best : b.best == null ? a.best : Math.min(a.best, b.best) });
  if (k === 'arcade_vier_stats' && a && b) return JSON.stringify((b.w + b.l + b.d) > (a.w + a.l + a.d) ? b : a);
  if (k === 'arcade_recent' && Array.isArray(a) && Array.isArray(b)) {   // beide lijsten samen, nieuwste eerst
    const m = {}; a.concat(b).forEach((x) => { if (x && x.id && (!m[x.id] || x.t > m[x.id].t)) m[x.id] = x; });
    return JSON.stringify(Object.values(m).sort((x, y) => y.t - x.t).slice(0, 8));
  }
  if (k === 'arcade_tycoon2_save' && a && b) {   // de winkel waar je het verst mee bent
    const pa = (a.stats && a.stats.earned) || 0, pb = (b.stats && b.stats.earned) || 0;
    return pb > pa ? v : cur;
  }
  if (k.startsWith('arcade_best_') && typeof a === 'number' && typeof b === 'number') return JSON.stringify(Math.max(a, b));
  if (/best$/.test(k) && typeof a === 'number' && typeof b === 'number') return JSON.stringify(Math.max(a, b));
  // al het andere (voortgang, toernooien, opgeslagen spellen): de nieuwste stand wint
  if ((rt || 0) > (lt || 0)) return v;
  return cur;   // overige dingen (spel dat nog bezig is, voorkeuren): wat er al staat blijft
}
const mtOf = (o) => J(o && o.arcade_mtimes) || {};
function mergeObjs(base, inc) {
  const o = Object.assign({}, base), lt = mtOf(base), rt = mtOf(inc);
  for (const k in inc) if (KEEP.test(k) && !SKIP.test(k)) o[k] = mergeVal(k, o[k], inc[k], null, lt[k], rt[k]);
  return o;
}
function refreshTexts() {   // tekst-records op de startpagina opnieuw uitrekenen
  const g = (k) => J(localStorage.getItem('arcade_' + k));
  const lv = ['Makkelijk', 'Normaal', 'Moeilijk'];
  const top = (o) => (o ? [2, 1, 0].find((i) => o[i] != null) : undefined);
  let o = g('mijnen_bests'), t = top(o); if (t != null) localStorage.setItem('arcade_best_mijnen', JSON.stringify(`${lv[t]} ${fmt(o[t])}`));
  o = g('sudoku_bests'); t = top(o); if (t != null) localStorage.setItem('arcade_best_sudoku', JSON.stringify(`${lv[t]} ${fmt(o[t])}`));
  o = g('memory_bests'); t = top(o); if (t != null) localStorage.setItem('arcade_best_memory', JSON.stringify(`${['Klein', 'Middel', 'Groot'][t]}: ${o[t]} zetten`));
  o = g('patience_stats'); if (o && o.best != null) localStorage.setItem('arcade_best_patience', JSON.stringify(fmt(o.best)));
  o = g('vier_stats'); if (o) localStorage.setItem('arcade_best_vier', JSON.stringify(`${o.w} gewonnen`));
  o = g('overval_bests'); if (o && Object.keys(o).length) localStorage.setItem('arcade_best_overval', JSON.stringify(Object.values(o).reduce((s, x) => s + x, 0)));
  o = g('tycoon2_save'); if (o && o.best) { const cur = g('best_tycoon'); if (!cur || o.best > cur) localStorage.setItem('arcade_best_tycoon', JSON.stringify(o.best)); }
}
// Binnenkomende gegevens in deze browser zetten. Geeft het aantal wijzigingen terug.
function applyIn(imp) {
  let changed = 0;
  const T = window.ArcadeTimes, lt = T ? T.all() : mtOf(collect()), rt = mtOf(imp);
  for (const k in imp) {
    if (!KEEP.test(k) || SKIP.test(k) || k === 'arcade_mtimes') continue;
    const cur = localStorage.getItem(k), ghosts = [];
    const out = mergeVal(k, cur, imp[k], ghosts, lt[k], rt[k]);
    if (out !== cur) {
      try { localStorage.setItem(k, out); if (k !== 'arcade_recent') changed++; } catch (e) { /* vol */ }
      if (T && out === imp[k] && rt[k]) T.set(k, rt[k]); // overgenomen uit de cloud: tijd van de cloud houden
      ghosts.forEach((g) => localStorage.removeItem(g));
    }
  }
  if (T) T.merge(rt);
  refreshTexts();
  return changed;
}
window.ArcadeStore = { collect, merge: applyIn };

// ---------- Firebase ----------
let fb = null, user = null, remote = {}, lastSent = '', ready = false, myName = '', pendingName = '', lastBoard = '';
async function loadFb() {
  const [app, auth, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const a = app.initializeApp(firebaseConfig);
  fb = { ...auth, ...fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  fb.auth.languageCode = 'nl';
  return fb;
}
const ref = () => fb.doc(fb.db, 'users', user.uid);
function wipeLocal() {
  Object.keys(collect()).forEach((k) => localStorage.removeItem(k));
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('tt2_ghost')) localStorage.removeItem(k); }
}
let killed = false;
async function accountGone() {
  killed = true; ready = false;
  wipeLocal(); myName = ''; remote = {};
  try { await fb.signOut(fb.auth); } catch (e) { /* toch doorgaan */ }
  setTimeout(() => alert('Dit account is verwijderd door de beheerder. Je kunt er niet meer mee spelen.'), 50);
}
async function pull() {
  const snap = await fb.getDoc(ref());
  const d = snap.exists() ? snap.data() : {};
  if (d.deleted) { await accountGone(); throw Object.assign(new Error('Account verwijderd'), { code: 'account-deleted' }); }
  killed = false;
  remote = d.data || {};
  myName = d.name || '';
  // heeft de admin de records van dit account gewist? Dan ook hier wissen (één keer)
  const ra = d.resetAt && d.resetAt.toMillis ? d.resetAt.toMillis() : 0;
  if (ra && ra > (+localStorage.getItem('ga_reset_seen') || 0)) { wipeLocal(); localStorage.setItem('ga_reset_seen', ra); lastSent = ''; }
  // losse games die de admin heeft gereset
  let seen; try { seen = JSON.parse(localStorage.getItem('ga_resets_seen')) || {}; } catch (e) { seen = {}; }
  let changedSeen = false;
  for (const [id, ts] of Object.entries(d.resets || {})) {
    const t = ts && ts.toMillis ? ts.toMillis() : 0;
    if (t && t > (seen[id] || 0)) {
      const local = collect();
      Object.keys(local).filter((k) => id === 'race' ? (k.startsWith('tt2_bests') || k === 'tt2_unlockall') : new RegExp(`^arcade_(best_)?${id}(_|2_|$)`).test(k)).forEach((k) => localStorage.removeItem(k));
      if (id === 'race') for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('tt2_ghost')) localStorage.removeItem(k); }
      seen[id] = t; changedSeen = true; lastSent = ''; lastBoard = '';
    }
  }
  if (changedSeen) localStorage.setItem('ga_resets_seen', JSON.stringify(seen));
  return remote;
}
async function push(force) {
  if (!user || !ready || killed) return;
  let data = mergeObjs(collect(), remote);
  let s = JSON.stringify(data);
  if (!force && s === lastSent) return;
  try {
    // eerst de nieuwste versie ophalen: zo verwerken we resets van de admin voordat we iets terugzetten
    await pull();
    data = mergeObjs(collect(), remote); s = JSON.stringify(data);
    await fb.setDoc(ref(), { data, email: user.email, updated: fb.serverTimestamp() }, { merge: true });
    lastSent = s; remote = data; setStatus('saved');
    await pushBoard(data);
  } catch (e) { if (!killed) setStatus('error', e); }
}

// ---------- Openbare ranglijst (ook gelezen door de Discord-bot) ----------
const BOARD = ['overval', 'td', 'meteoren', 'runner', 'snake', '2048', 'stack', 'tycoon', 'moto'];
function scoresOf(d) {
  const o = {};
  for (const g of BOARD) { const v = J(d['arcade_best_' + g]); if (typeof v === 'number' && v > 0) o[g] = Math.round(v); }
  const race = J(d.tt2_bests2); if (race && Object.keys(race).length) o.race = Object.keys(race).length;
  const vier = J(d.arcade_vier_stats); if (vier && vier.w > 0) o.vier = vier.w;
  return o;
}
// racegames: beste tijd per level (seconden)
const TIMED = { race: 12, moto: 10, escape: 10, dief: 12 };
function timesOf(d) {
  const o = {};
  const r = J(d.tt2_bests2);
  if (r && typeof r === 'object') { o.race = {}; for (const k in r) { const t = r[k] && typeof r[k] === 'object' ? r[k].t : r[k]; if (typeof t === 'number' && t > 0) o.race[k] = Math.round(t * 100) / 100; } }
  for (const g of ['moto', 'escape', 'dief']) {
    const m = J(d['arcade_' + g + '_bests']);
    if (m && typeof m === 'object') { o[g] = {}; for (const k in m) if (typeof m[k] === 'number' && m[k] > 0) o[g][k] = Math.round(m[k] * 100) / 100; }
  }
  return o;
}
const fmtT = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return s >= 600 ? `${m}:${String(Math.floor(r)).padStart(2, '0')}` : `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`; };
// records die geen score zijn (tijden/zetten), alleen om te laten zien op je profiel
function extraOf(d) {
  const o = {};
  for (const g of ['sudoku', 'mijnen', 'memory', 'patience']) { const v = J(d['arcade_best_' + g]); if (typeof v === 'string' && v) o[g] = v; }
  return o;
}
async function pushBoard(data, force) {
  if (!user || !myName || killed) return;
  const d = data || mergeObjs(collect(), remote);
  const scores = scoresOf(d), extra = extraOf(d), times = timesOf(d);
  const since = (user.metadata && user.metadata.creationTime) || '';
  const s = JSON.stringify([myName, scores, extra, times]);
  if (!force && s === lastBoard) return;
  try {
    await fb.setDoc(fb.doc(fb.db, 'leaderboard', user.uid), { name: myName, scores, extra, times, since, updated: fb.serverTimestamp() });
    lastBoard = s;
  } catch (e) { console.warn('Ranglijst bijwerken mislukt:', e); }
}
const NAME_OK = /^[\p{L}\p{N} _.-]{2,16}$/u;
async function setName(n) {
  n = (n || '').trim().replace(/\s+/g, ' ');
  if (!NAME_OK.test(n)) throw new Error('Gebruik 2 tot 16 letters of cijfers.');
  await fb.setDoc(ref(), { name: n }, { merge: true });
  myName = n; acctUI();
  await pushBoard(null, true);
  if (IS_HUB) loadBoard();
}

// ---------- UI (alleen startpagina) ----------
const $ = (id) => document.getElementById(id);
function setStatus(st, e) {
  const el = $('acctState'); if (!el) return;
  el.textContent = st === 'saved' ? '☁️ Opgeslagen' : st === 'busy' ? '⏳ Laden…' : st === 'error' ? '⚠️ Niet opgeslagen' : '';
  if (e) console.warn('Game Arcade opslaan:', e);
}
const MSG = {
  'auth/invalid-credential': 'E-mail of wachtwoord klopt niet.',
  'auth/wrong-password': 'E-mail of wachtwoord klopt niet.',
  'auth/user-not-found': 'Er is geen account met dit e-mailadres.',
  'auth/invalid-email': 'Dit is geen geldig e-mailadres.',
  'auth/missing-password': 'Vul je wachtwoord in.',
  'auth/email-already-in-use': 'Er bestaat al een account met dit e-mailadres. Log in.',
  'auth/weak-password': 'Kies een wachtwoord van minstens 6 tekens.',
  'auth/too-many-requests': 'Te vaak geprobeerd. Wacht even en probeer het opnieuw.',
  'auth/network-request-failed': 'Geen verbinding. Controleer je internet.',
  'auth/operation-not-allowed': 'Inloggen met e-mail staat nog niet aan in Firebase.',
  'permission-denied': 'Opslaan geweigerd: de Firestore-regels staan nog niet goed.',
};
const errText = (e) => MSG[e && e.code] || 'Er ging iets mis' + (e && e.code ? ` (${e.code})` : '') + '.';
let mode = 'login';
function gate(show) { const g = $('authGate'); if (g) g.classList.toggle('open', !!show); if (show) setTimeout(() => $('aEmail').focus(), 50); }
function say(t, ok) { const m = $('aMsg'); m.textContent = t || ''; m.className = ok ? 'ok' : 'err'; }
function setMode(m) {
  mode = m;
  document.querySelectorAll('#authGate .tab').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  $('aPass2Row').style.display = m === 'signup' ? '' : 'none';
  $('aNameRow').style.display = m === 'signup' ? '' : 'none';
  $('aGo').textContent = m === 'signup' ? 'Account maken' : 'Inloggen';
  $('aPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  say('');
}
function acctUI() {
  const b = $('acctBtn'); if (!b) return;
  const p = $('acctMenu').querySelector('p');
  $('acctAdmin').style.display = user && (user.email || '').toLowerCase() === ADMIN_EMAIL ? '' : 'none';
  $('nameBox').style.display = user ? '' : 'none';
  $('acctProfile').style.display = user && myName ? '' : 'none';
  if (user && document.activeElement !== $('nameIn')) $('nameIn').value = myName;
  $('nameMsg').textContent = user && !myName ? 'Kies een naam om op de ranglijst te komen.' : ''; $('nameMsg').className = '';
  if (user) { b.textContent = '👤 ' + (myName || user.email || 'Account'); $('acctOut').textContent = 'Uitloggen'; p.textContent = 'Je records en je PC Tycoon-winkel worden automatisch in je account opgeslagen.'; }
  else { b.textContent = '🔑 Inloggen'; setStatus(''); $('acctOut').textContent = 'Inloggen'; p.textContent = 'Je speelt als gast: je records staan alleen in deze browser. Log in om ze overal te bewaren.'; }
}
function hubUI() {
  document.querySelectorAll('#authGate .tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
  $('authForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('aEmail').value.trim(), pw = $('aPass').value;
    if (!fb) return say('Kan geen verbinding maken met de server. Probeer het later opnieuw.');
    if (mode === 'signup' && pw !== $('aPass2').value) return say('De wachtwoorden zijn niet hetzelfde.');
    if (mode === 'signup') {
      const n = $('aName').value.trim();
      if (!NAME_OK.test(n)) return say('Kies een spelersnaam van 2 tot 16 letters of cijfers.');
      pendingName = n;
    }
    $('aGo').disabled = true; say('Even geduld…', true);
    try {
      if (mode === 'signup') await fb.createUserWithEmailAndPassword(fb.auth, email, pw);
      else await fb.signInWithEmailAndPassword(fb.auth, email, pw);
    } catch (e) { say(errText(e)); }
    $('aGo').disabled = false;
  });
  $('aForgot').addEventListener('click', async () => {
    const email = $('aEmail').value.trim();
    if (!email) return say('Vul eerst je e-mailadres in, dan sturen we een link.');
    if (!fb) return say('Kan geen verbinding maken met de server.');
    try { await fb.sendPasswordResetEmail(fb.auth, email); say('Check je mail (ook je spam) voor een link om een nieuw wachtwoord te kiezen.', true); }
    catch (e) { say(errText(e)); }
  });
  $('nameSave').addEventListener('click', async () => {
    const m = $('nameMsg');
    try { await setName($('nameIn').value); m.textContent = 'Opgeslagen! Je staat nu op de ranglijst.'; m.className = 'ok'; }
    catch (e) { m.textContent = e.message && !e.code ? e.message : errText(e); m.className = 'err'; }
  });
  $('nameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nameSave').click(); });
  $('aGuest').addEventListener('click', () => { localStorage.setItem(GUEST_KEY, '1'); gate(false); });
  $('acctBtn').addEventListener('click', () => {
    $('acctMenu').classList.toggle('open');
  });
  $('acctOut').addEventListener('click', async () => {
    $('acctMenu').classList.remove('open');
    if (!user) { setMode('login'); gate(true); return; }
    await push(true);
    // records staan veilig in je account; haal ze van deze browser zodat iemand anders hier opnieuw kan beginnen
    wipeLocal();
    localStorage.removeItem(GUEST_KEY);
    await fb.signOut(fb.auth);
    location.reload();
  });
  document.addEventListener('click', (e) => { const m = $('acctMenu'); if (m && (!m.contains(e.target) || e.target.id === 'syncOpen') && e.target !== $('acctBtn') && document.contains(e.target)) m.classList.remove('open'); });
  setMode('login');
}

// ---------- Ranglijst op de startpagina ----------
const SHOW = { race: (v) => v + '/12', tycoon: (v) => 'Lvl ' + v, vier: (v) => v + ' wins', moto: (v) => v + '/30 ★' };
let boardPlayers = null;
const boardLvl = {};
async function loadBoard() {
  if (!fb) return;
  try {
    const snap = await fb.getDocs(fb.collection(fb.db, 'leaderboard'));
    boardPlayers = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => p.name);
  } catch (e) { console.warn('Ranglijst laden mislukt:', e); if (!boardPlayers) boardPlayers = []; }
  renderBoard();
}
function renderBoard() {
  const list = $('bList'); if (!list || !boardPlayers) return;
  const g = $('bGame').value;
  let rows;
  const lvBox = $('bLvl');
  if (TIMED[g]) {   // racegame: kies een level, snelste tijd bovenaan
    const cur = boardLvl[g] || 0;
    lvBox.innerHTML = Array.from({ length: TIMED[g] }, (_, i) => `<button data-l="${i}" class="${i === cur ? 'on' : ''}">${i + 1}</button>`).join('');
    lvBox.hidden = false;
    rows = levelRanking(g, cur).map((r) => ({ p: r.p, v: r.v, s: fmtT(r.v) }));
  } else lvBox.hidden = true;
  if (TIMED[g]) { /* al gedaan */ }
  else if (!g) {   // klassement: 🥇 3, 🥈 2, 🥉 1 punt per game
    rows = klassement().map(([uid, v]) => ({ p: boardPlayers.find((x) => x.uid === uid), v, s: v + ' pt' }));
  } else {
    rows = boardPlayers.filter((p) => p.scores && p.scores[g] > 0).map((p) => ({ p, v: p.scores[g], s: (SHOW[g] || ((v) => v.toLocaleString('nl-NL')))(p.scores[g]) })).sort((a, b) => b.v - a.v);
  }
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  list.innerHTML = rows.slice(0, 10).map(({ p, s }, i) => `<li data-uid="${esc(p.uid)}" title="Bekijk profiel" class="${user && p.uid === user.uid ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(p.name)}</span><span class="sc">${esc(s)}</span></li>`).join('')
    || '<li class="empty">Nog niemand op deze ranglijst. Wees de eerste!</li>';
  $('bCount').textContent = boardPlayers.length ? boardPlayers.length + (boardPlayers.length === 1 ? ' speler' : ' spelers') : '';
  if ($('nPlayers')) $('nPlayers').textContent = boardPlayers.length || '–';
  const note = $('bNote');
  if (!user) note.innerHTML = '<a id="bLogin">Log in</a> en kies een spelersnaam om mee te doen.';
  else if (!myName) note.textContent = 'Kies rechtsboven een spelersnaam om op de ranglijst te komen.';
  else { const pos = rows.findIndex((r) => r.p.uid === user.uid); note.textContent = pos >= 10 ? `Jij staat op plek ${pos + 1}.` : ''; }
  const l = $('bLogin'); if (l) l.onclick = () => { setMode('login'); gate(true); };
}

// ---------- Profiel ----------
const PGAMES = [['race', '🏎️', 'Turbo Tijdrit'], ['moto', '🏍️', 'Moto Stunt'], ['escape', '🔐', 'Escape Room'], ['dief', '🕵️', 'Nachtdief'], ['overval', '🤖', 'Robo Overval'], ['tycoon', '💻', 'PC Tycoon'], ['td', '🛡️', 'Robo Defense'], ['meteoren', '☄️', 'Meteorenregen'], ['runner', '🏃', 'Neon Runner'], ['snake', '🐍', 'Snake 2.0'], ['2048', '🔢', '2048'], ['stack', '🏗️', 'Stack Tower']];
// snelste tijden op één level
function levelRanking(id, l) {
  return boardPlayers.filter((p) => p.times && p.times[id] && p.times[id][l] != null).map((p) => ({ p, v: p.times[id][l] })).sort((a, b) => a.v - b.v);
}
// ranglijst van een game; bij racegames: wie de meeste level-podiumplekken heeft (🥇 3, 🥈 2, 🥉 1 per level)
function gameRanking(id) {
  if (TIMED[id]) {
    const pts = new Map();
    for (let l = 0; l < TIMED[id]; l++) levelRanking(id, l).slice(0, 3).forEach((r, i) => pts.set(r.p.uid, (pts.get(r.p.uid) || 0) + 3 - i));
    return boardPlayers.filter((p) => pts.has(p.uid)).map((p) => ({ p, v: pts.get(p.uid) })).sort((a, b) => b.v - a.v);
  }
  return boardPlayers.filter((p) => p.scores && p.scores[id] > 0).map((p) => ({ p, v: p.scores[id] })).sort((a, b) => b.v - a.v);
}
const KL_GAMES = ['race', 'moto', 'escape', 'dief', 'overval', 'tycoon', 'td', 'meteoren', 'runner', 'snake', '2048', 'stack'];
function klassement() {
  const pts = new Map();
  for (const id of KL_GAMES) gameRanking(id).slice(0, 3).forEach((r, i) => pts.set(r.p.uid, (pts.get(r.p.uid) || 0) + 3 - i));
  return [...pts.entries()].sort((a, b) => b[1] - a[1]);
}
async function openProfile(uid) {
  if (!boardPlayers) await loadBoard();
  const p = (boardPlayers || []).find((x) => x.uid === uid); if (!p) return;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kl = klassement(), kpos = kl.findIndex(([u]) => u === uid);
  const sc = p.scores || {}, ex = p.extra || {};
  let n = 0;
  const tm = p.times || {};
  const rows = PGAMES.map(([id, ic, naam]) => {
    let val = null, rank = '', sub = '';
    if (TIMED[id]) {
      const mine = tm[id] || {}, ls = Object.keys(mine).map(Number).sort((a, b) => a - b);
      if (ls.length) {
        n++;
        let wins = 0;
        sub = '<div class="psub">' + ls.map((l) => { const r = levelRanking(id, l).findIndex((x) => x.p.uid === uid) + 1; if (r === 1) wins++; return `<span class="${r === 1 ? 'gold' : ''}">L${l + 1} ${fmtT(mine[l])}${r ? ' <i>#' + r + '</i>' : ''}</span>`; }).join('') + '</div>';
        return `<div class="pg"><span class="pic">${ic}</span><span class="pn">${naam}</span><b>${ls.length}/${TIMED[id]} levels</b><span class="prk ${wins ? 'm1' : ''}">${wins ? '🥇 ' + wins : ''}</span></div>${sub}`;
      }
      return `<div class="pg none"><span class="pic">${ic}</span><span class="pn">${naam}</span><b>–</b></div>`;
    }
    if (sc[id] > 0) {
      val = (SHOW[id] || ((v) => v.toLocaleString('nl-NL')))(sc[id]);
      const all = boardPlayers.filter((x) => x.scores && x.scores[id] > 0).sort((a, b) => b.scores[id] - a.scores[id]);
      const r = all.findIndex((x) => x.uid === uid) + 1;
      rank = `<span class="prk ${r <= 3 ? 'm' + r : ''}">#${r}<small> van ${all.length}</small></span>`;
    } else if (ex[id]) val = ex[id];
    if (val != null) n++;
    void sub;
    return `<div class="pg ${val == null ? 'none' : ''}"><span class="pic">${ic}</span><span class="pn">${naam}</span><b>${val == null ? '–' : esc(val)}</b>${rank}</div>`;
  }).join('');
  const since = p.since ? new Date(p.since) : null;
  $('profBody').innerHTML = `
    <div class="phead"><div class="pav">${esc(p.name.slice(0, 1).toUpperCase())}</div>
      <div><h2>${esc(p.name)}${user && uid === user.uid ? ' <span class="pme">JIJ</span>' : ''}</h2>
      <p>${since && !isNaN(since) ? 'Speler sinds ' + since.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) : 'Game Arcade-speler'}</p></div></div>
    <div class="pstats">
      <div><b>${kpos >= 0 ? '#' + (kpos + 1) : '–'}</b><small>Klassement</small></div>
      <div><b>${kpos >= 0 ? kl[kpos][1] : 0}</b><small>Punten</small></div>
      <div><b>${n}/${PGAMES.length}</b><small>Records</small></div>
    </div>
    <div class="pgrid">${rows}</div>`;
  $('profModal').classList.add('open');
}

// ---------- Mededeling bovenaan de startpagina (instellen via de admin-pagina) ----------
async function loadAnnouncement() {
  const bar = $('annBar'); if (!bar || !fb) return;
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, 'site', 'announcement'));
    const a = snap.exists() ? snap.data() : null;
    const key = a ? (a.updated && a.updated.toMillis ? a.updated.toMillis() : 0) + '|' + a.text : '';
    if (!a || !a.on || !a.text || localStorage.getItem('ga_ann_closed') === key) { bar.hidden = true; return; }
    bar.className = 'ann ' + (a.color || 'red');
    $('annText').textContent = a.text;
    const l = $('annLink');
    if (a.link) { l.href = a.link; l.target = /^https?:/i.test(a.link) ? '_blank' : '_self'; l.hidden = false; } else l.hidden = true;
    $('annClose').onclick = () => { bar.hidden = true; localStorage.setItem('ga_ann_closed', key); };
    bar.hidden = false;
  } catch (e) { console.warn('Mededeling laden mislukt:', e); }
}

// ---------- Admin-voordelen in games (alleen voor het admin-account) ----------
function adminTools() {
  if (IS_HUB || document.getElementById('cheatBtn')) return;
  window.__arcadeAdmin = true;
  const list = (typeof ArcadeCore !== 'undefined' && ArcadeCore.cheats) || [];
  if (!list.length) return;
  const css = document.createElement('style');
  css.textContent = `#cheatBtn{position:fixed;right:66px;top:12px;z-index:9998;border:1px solid rgba(255,255,255,.22);background:rgba(20,22,27,.85);color:#fff;font:800 13px system-ui,sans-serif;padding:8px 12px;border-radius:10px;cursor:pointer;backdrop-filter:blur(6px)}
#cheatBtn:hover{background:#e8282f;border-color:#e8282f}@media (max-width:600px){#cheatBtn .lbl{display:none}#cheatBtn{padding:8px 10px}}
#cheatBox{position:fixed;right:12px;top:58px;z-index:9999;width:min(290px,calc(100vw - 24px));max-height:70vh;overflow-y:auto;background:#15171d;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px;box-shadow:0 20px 50px rgba(0,0,0,.55);display:none;font-family:system-ui,sans-serif;color:#fff}
#cheatBox.open{display:block}#cheatBox h3{margin:2px 4px 10px;font-size:14px;font-style:italic;font-weight:900}#cheatBox h3 span{color:#e8282f}
#cheatBox button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font:700 13px system-ui,sans-serif;padding:9px 10px;border-radius:9px;margin-bottom:6px;cursor:pointer}
#cheatBox button:hover{background:rgba(255,255,255,.12)}#cheatBox .sw{flex:none;font-size:11px;font-weight:900;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.12);color:#aab}
#cheatBox .sw.on{background:#e8282f;color:#fff}#cheatBox .ok{background:#2f8f55!important;border-color:#2f8f55!important}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'cheatBtn'; btn.innerHTML = '🛠️<span class="lbl"> Admin</span>'; btn.title = 'Admin-voordelen';
  const box = document.createElement('div'); box.id = 'cheatBox';
  const render = () => {
    box.innerHTML = '<h3>ADMIN <span>VOORDELEN</span></h3>';
    list.forEach((ch, i) => {
      const b = document.createElement('button');
      const on = ch.get ? !!ch.get() : null;
      b.innerHTML = `<span>${ch.label}</span>${on === null ? '' : `<span class="sw ${on ? 'on' : ''}">${on ? 'AAN' : 'UIT'}</span>`}`;
      b.onclick = (e) => {
        e.stopPropagation();
        try {
          if (ch.get) { ch.set(!ch.get()); render(); }
          else { ch.fn(); b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 600); }
        } catch (err) { console.warn('Admin-voordeel mislukt:', err); }
        b.blur();
      };
      box.appendChild(b);
    });
  };
  render();
  btn.onclick = (e) => { e.stopPropagation(); render(); box.classList.toggle('open'); btn.blur(); };
  for (const el of [btn, box]) ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation()));
  document.body.append(btn, box);
}

// ---------- Start ----------
(async () => {
  if (IS_HUB) {
    hubUI(); $('bGame').addEventListener('change', renderBoard);
    $('bList').addEventListener('click', (e) => { const li = e.target.closest('[data-uid]'); if (li) openProfile(li.dataset.uid); });
    $('bLvl').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (b) { boardLvl[$('bGame').value] = +b.dataset.l; renderBoard(); } });
    $('profModal').addEventListener('click', (e) => { if (e.target.id === 'profModal' || e.target.closest('#profClose')) $('profModal').classList.remove('open'); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') $('profModal').classList.remove('open'); });
    $('acctProfile').addEventListener('click', () => { $('acctMenu').classList.remove('open'); if (user) openProfile(user.uid); });
  }
  try { await loadFb(); } catch (e) { console.warn('Firebase niet geladen (offline?)', e); return; }
  fb.onAuthStateChanged(fb.auth, async (u) => {
    user = u; ready = false; acctUI();
    if (IS_HUB) renderSug();
    if (!u) { if (IS_HUB) renderBoard(); if (IS_HUB && localStorage.getItem(GUEST_KEY) !== '1') gate(true); return; }
    localStorage.removeItem(GUEST_KEY);
    if ((u.email || '').toLowerCase() === ADMIN_EMAIL) adminTools();
    if (IS_HUB) { gate(false); setStatus('busy'); }
    try {
      await pull();
      const n = applyIn(remote);        // nieuwste/beste van account + deze browser samenvoegen
      if (IS_HUB) { if (window.renderRecords) window.renderRecords(); }
      else if (n > 0) {
        // in een game: de game had de oude stand al geladen -> één keer opnieuw laden met de nieuwe stand
        let lastR = 0; try { lastR = +sessionStorage.getItem('ga_sync_reload') || 0; } catch (e) { /* ok */ }
        if (Date.now() - lastR > 60000) { try { sessionStorage.setItem('ga_sync_reload', Date.now()); } catch (e) { /* ok */ } location.reload(); return; }
      }
      ready = true;
      if (pendingName && !myName) { try { await setName(pendingName); } catch (e) { /* later in het menu */ } }
      pendingName = '';
      if (IS_HUB) acctUI();
      await push(true);
      if (IS_HUB) { loadBoard(); loadSug(); }
    } catch (e) {
      if (killed) return;
      setStatus('error', e);
      if (IS_HUB) { const m = $('acctMenu'); if (m) $('acctErr').textContent = errText(e); }
    }
  });
  if (IS_HUB) { loadBoard(); setInterval(loadBoard, 60000); loadAnnouncement(); initSug(); loadSug(); }
  // regelmatig en bij weggaan opslaan
  setInterval(() => push(false), 15000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(false); });
  addEventListener('pagehide', () => push(false));
})();


// ---------- Suggesties (startpagina): iedereen leest, ingelogden sturen in, alleen de admin beheert ----------
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'zojuist'; if (s < 3600) return Math.floor(s / 60) + ' min geleden'; if (s < 86400) return Math.floor(s / 3600) + ' uur geleden'; const d = Math.floor(s / 86400); return d === 1 ? 'gisteren' : d + ' dagen geleden'; };
const SUG_ST = { open: '💡 Nieuw', gepland: '🛠️ Gepland', toegevoegd: '✅ Toegevoegd', gesloten: 'Gesloten' };
let sugAll = [], sugTab = 'open', sugMail = {};
const escS = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const isAdmin = () => !!user && (user.email || '').toLowerCase() === ADMIN_EMAIL;
async function loadSug() {
  if (!fb || !document.getElementById('sugList')) return;
  try {
    const snap = await fb.getDocs(fb.collection(fb.db, 'suggestions'));
    sugAll = snap.docs.map((d) => ({ id: d.id, ...d.data() })).map((x) => ({ ...x, t: x.created && x.created.toMillis ? x.created.toMillis() : (+x.created || 0) }));
    sugAll.sort((p, q) => q.t - p.t);
  } catch (e) { sugAll = null; }
  // alleen voor de admin: e-mailadressen opzoeken in de accountlijst (die mag alleen de admin lezen)
  if (isAdmin() && sugAll && !Object.keys(sugMail).length) { try { const us = await fb.getDocs(fb.collection(fb.db, 'users')); us.docs.forEach((d) => { sugMail[d.id] = d.data().email || ''; }); } catch (e) { /* geen toegang */ } }
  renderSug();
}
function renderSug() {
  const ul = document.getElementById('sugList'); if (!ul) return;
  if (sugAll === null) { ul.innerHTML = '<li class="sempty">Suggesties konden niet geladen worden.</li>'; return; }
  const want = (x) => sugTab === 'open' ? (x.status === 'open' || x.status === 'gepland') : x.status === sugTab;
  const list = sugAll.filter(want);
  document.getElementById('sugCount').textContent = sugAll.filter((x) => x.status === 'open' || x.status === 'gepland').length + ' open';
  if (!list.length) { ul.innerHTML = `<li class="sempty">${sugTab === 'open' ? 'Nog geen open suggesties. Wees de eerste!' : 'Nog niets hier.'}</li>`; return; }
  const adm = isAdmin();
  ul.innerHTML = list.slice(0, 60).map((x, i) => `<li style="animation-delay:${Math.min(i, 12) * 0.03}s">
    <div class="sugtop"><b>${escS(x.name || 'Speler')}</b><span>${x.t ? ago(x.t) : ''}</span><span class="sbadge ${x.status}">${SUG_ST[x.status] || x.status}</span></div>
    <div class="sugtxt">${escS(x.text || '')}</div>
    ${adm ? `<div class="sugadm" data-id="${x.id}">${x.status !== 'gepland' ? '<button data-st="gepland">🛠️ Gepland</button>' : ''}${x.status !== 'toegevoegd' ? '<button data-st="toegevoegd">✅ Toegevoegd</button>' : ''}${x.status !== 'gesloten' ? '<button data-st="gesloten">✕ Sluiten</button>' : ''}${x.status !== 'open' ? '<button data-st="open">↺ Weer open</button>' : ''}<button class="del" data-del="1">🗑️ Verwijderen</button><small style="color:#8c8c8c;align-self:center">${escS(sugMail[x.uid] || '')}</small></div>` : ''}
  </li>`).join('');
}
function sugMsg(t, cls) { const m = document.getElementById('sugMsg'); if (m) { m.textContent = t; m.className = cls || ''; } }
function initSug() {
  const form = document.getElementById('sugForm'); if (!form) return;
  const ta = document.getElementById('sugText');
  ta.addEventListener('input', () => { document.getElementById('sugLeft').textContent = `${ta.value.length}/300`; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!user) { sugMsg('Log eerst in om een suggestie in te sturen.', 'err'); return; }
    if (text.length < 5) { sugMsg('Schrijf iets meer (minimaal 5 tekens).', 'err'); return; }
    const last = +localStorage.getItem('ga_sug_last') || 0;
    if (Date.now() - last < 60000) { sugMsg('Even wachten: één suggestie per minuut.', 'err'); return; }
    const btn = document.getElementById('sugBtn'); btn.disabled = true;
    try {
      const id = user.uid + '_' + Date.now();
      await fb.setDoc(fb.doc(fb.db, 'suggestions', id), { text, name: myName || 'Speler', uid: user.uid, status: 'open', created: fb.serverTimestamp() });
      localStorage.setItem('ga_sug_last', Date.now());
      ta.value = ''; document.getElementById('sugLeft').textContent = '0/300';
      sugMsg('Bedankt! Je suggestie staat erbij.', 'ok'); sugTab = 'open';
      document.querySelectorAll('.sugtabs button').forEach((b) => b.classList.toggle('on', b.dataset.s === 'open'));
      await loadSug();
    } catch (err) { sugMsg('Insturen lukte niet: ' + (err.code || err.message), 'err'); }
    btn.disabled = false;
  });
  document.querySelectorAll('.sugtabs button').forEach((b) => b.addEventListener('click', () => {
    sugTab = b.dataset.s; document.querySelectorAll('.sugtabs button').forEach((x) => x.classList.toggle('on', x === b)); renderSug();
  }));
  document.getElementById('sugList').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || !isAdmin()) return;
    const id = b.closest('.sugadm').dataset.id;
    try {
      if (b.dataset.del) { if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Zeker?'; return; } await fb.deleteDoc(fb.doc(fb.db, 'suggestions', id)); }
      else await fb.setDoc(fb.doc(fb.db, 'suggestions', id), { status: b.dataset.st }, { merge: true });
      await loadSug();
    } catch (err) { b.textContent = 'Lukt niet: ' + (err.code || err.message); }
  });
}

// ---------- Automatisch bijwerken na een nieuwe versie van de site ----------
(() => {
  const mine = (document.querySelector('meta[name="site-build"]') || {}).content;
  if (!mine) return;
  const vurl = new URL('version.json', import.meta.url);
  let pending = null, bar = null, deadline = 0, note = '';
  const esc2 = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const GRACE = 5 * 60 * 1000; // in een game: uiterlijk na 5 minuten
  async function go(build) {
    // eerst nog even opslaan, dan de nieuwe versie laden (met ?u= zodat de cache wordt overgeslagen)
    try { await Promise.race([push(true), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* toch door */ }
    try { sessionStorage.setItem('ga_upd_try', build + '|' + Date.now()); } catch (e) { /* privé-modus */ }
    const u = new URL(location.href); u.searchParams.set('u', build);
    location.replace(u.toString());
  }
  function showBar(build) {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'updBar';
    bar.innerHTML = '<span>🔄 Er is een nieuwe versie van de site!</span><small id="updLeft"></small><button id="updGo">Nu bijwerken</button>' + (note ? `<small style="flex-basis:100%;text-align:center;color:#bdbdbd;font-weight:600;font-size:12px">Nieuw: ${esc2(note)}</small>` : '');
    bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 24px);padding:10px 12px 10px 16px;border-radius:14px;background:#15181f;color:#fff;border:1px solid rgba(255,210,63,.5);box-shadow:0 10px 30px rgba(0,0,0,.5);font:700 14px system-ui,sans-serif';
    document.body.appendChild(bar);
    const b = bar.querySelector('#updGo');
    b.style.cssText = 'background:#ffd23f;color:#111;border:0;border-radius:10px;padding:8px 14px;font:800 14px system-ui,sans-serif;cursor:pointer';
    b.onclick = () => go(build);
    bar.querySelector('#updLeft').style.cssText = 'color:#9aa1ab;font-weight:600';
  }
  // startscherm: groot verplicht scherm dat je niet kunt wegklikken
  function bigModal(build) {
    const m = document.createElement('div');
    m.id = 'updModal';
    m.innerHTML = `<div class="ub"><div class="ui"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg></div><h2>Nieuwe update!</h2><p>Er staat een nieuwe versie van Game Arcade klaar. Werk de site bij om verder te spelen.</p><button id="updNow">Nu bijwerken</button><small id="updAuto"></small>${note ? `<div class="un"><b>Nieuw</b>${esc2(note)}</div>` : ''}</div>`;
    m.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,5,5,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;animation:updIn .35s ease both';
    const st = document.createElement('style');
    st.textContent = '@keyframes updIn{from{opacity:0}to{opacity:1}}@keyframes updSpin{to{transform:rotate(360deg)}}#updModal .ub{width:min(560px,100%);text-align:center;background:#121212;border:1px solid rgba(255,255,255,.18);border-radius:26px;padding:44px 32px 34px;box-shadow:0 40px 120px rgba(0,0,0,.7)}#updModal .ui{width:96px;height:96px;margin:0 auto 18px;border-radius:50%;background:#fff;color:#0a0a0a;display:grid;place-items:center;font-size:48px;animation:updSpin 3s linear infinite}#updModal h2{margin:0 0 12px;font-size:clamp(34px,7vw,54px);font-weight:900;letter-spacing:-1.5px;text-transform:uppercase;line-height:1}#updModal p{margin:0 auto 26px;max-width:420px;color:#bdbdbd;font-size:18px;line-height:1.5}#updModal button{width:100%;height:64px;border:0;border-radius:16px;background:#fff;color:#0a0a0a;font:900 22px system-ui,sans-serif;cursor:pointer}#updModal button:hover{background:#d9d9d9}#updModal small{display:block;margin-top:14px;color:#8c8c8c;font-size:14px}#updModal .un{margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);color:#bdbdbd;font-size:13px;line-height:1.5}#updModal .un b{display:block;margin-bottom:4px;color:#fff;font-size:11px;letter-spacing:2px;text-transform:uppercase}';
    document.head.appendChild(st); document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
    const btn = m.querySelector('#updNow');
    btn.onclick = () => { btn.textContent = 'Bijwerken…'; btn.disabled = true; go(build); };
    let left = 15;
    const t = () => { m.querySelector('#updAuto').textContent = `Automatisch over ${left} seconden`; if (left-- <= 0) btn.click(); };
    t(); setInterval(t, 1000);
  }
  function tick() {
    if (!pending) return;
    const left = Math.max(0, deadline - Date.now());
    const el = document.getElementById('updLeft');
    if (el) el.textContent = `Automatisch over ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (!left) go(pending);
  }
  async function check() {
    let build;
    try { const r = await fetch(vurl + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); build = j.build; note = j.note || ''; } catch (e) { return; }
    if (!build || build === mine) return;
    // net geprobeerd en nog steeds oud (GitHub is nog bezig)? Even wachten
    try { const [b, t] = (sessionStorage.getItem('ga_upd_try') || '').split('|'); if (b === build && Date.now() - +t < 120000) return; } catch (e) { /* ok */ }
    if (pending) return;
    pending = build;
    // op de startpagina of als niemand kijkt: meteen. In een game: melding, zodat je je potje kunt afmaken
    if (document.hidden) return go(build);
    if (IS_HUB) return bigModal(build);
    deadline = Date.now() + GRACE;
    showBar(build); tick(); setInterval(tick, 1000);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && pending) go(pending); else if (!document.hidden) check(); });
  setTimeout(check, 4000);
  setInterval(check, 60000);
})();
