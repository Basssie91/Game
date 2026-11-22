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
const LOWER = ['arcade_mijnen_bests', 'arcade_sudoku_bests', 'arcade_memory_bests'];
const HIGHER = ['arcade_overval_bests', 'arcade_td_bests'];
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
function mergeVal(k, cur, v, ghosts) {
  if (cur == null) return v;
  if (v == null) return cur;
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
  return cur;   // overige dingen (spel dat nog bezig is, voorkeuren): wat er al staat blijft
}
function mergeObjs(base, inc) {
  const o = Object.assign({}, base);
  for (const k in inc) if (KEEP.test(k) && !SKIP.test(k)) o[k] = mergeVal(k, o[k], inc[k]);
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
  for (const k in imp) {
    if (!KEEP.test(k) || SKIP.test(k)) continue;
    const cur = localStorage.getItem(k), ghosts = [];
    const out = mergeVal(k, cur, imp[k], ghosts);
    if (out !== cur) { try { localStorage.setItem(k, out); changed++; } catch (e) { /* vol */ } ghosts.forEach((g) => localStorage.removeItem(g)); }
  }
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
async function pull() {
  const snap = await fb.getDoc(ref());
  const d = snap.exists() ? snap.data() : {};
  remote = d.data || {};
  myName = d.name || '';
  // heeft de admin de records van dit account gewist? Dan ook hier wissen (één keer)
  const ra = d.resetAt && d.resetAt.toMillis ? d.resetAt.toMillis() : 0;
  if (ra && ra > (+localStorage.getItem('ga_reset_seen') || 0)) { wipeLocal(); localStorage.setItem('ga_reset_seen', ra); lastSent = ''; }
  return remote;
}
async function push(force) {
  if (!user || !ready) return;
  const data = mergeObjs(collect(), remote);
  const s = JSON.stringify(data);
  if (!force && s === lastSent) return;
  try {
    await fb.setDoc(ref(), { data, email: user.email, updated: fb.serverTimestamp() }, { merge: true });
    lastSent = s; remote = data; setStatus('saved');
    await pushBoard(data);
  } catch (e) { setStatus('error', e); }
}

// ---------- Openbare ranglijst (ook gelezen door de Discord-bot) ----------
const BOARD = ['overval', 'td', 'meteoren', 'runner', 'snake', '2048', 'blokken', 'stack', 'tycoon'];
function scoresOf(d) {
  const o = {};
  for (const g of BOARD) { const v = J(d['arcade_best_' + g]); if (typeof v === 'number' && v > 0) o[g] = Math.round(v); }
  const race = J(d.tt2_bests2); if (race && Object.keys(race).length) o.race = Object.keys(race).length;
  const vier = J(d.arcade_vier_stats); if (vier && vier.w > 0) o.vier = vier.w;
  return o;
}
async function pushBoard(data, force) {
  if (!user || !myName) return;
  const scores = scoresOf(data || mergeObjs(collect(), remote));
  const s = JSON.stringify([myName, scores]);
  if (!force && s === lastBoard) return;
  try {
    await fb.setDoc(fb.doc(fb.db, 'leaderboard', user.uid), { name: myName, scores, updated: fb.serverTimestamp() });
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

// ---------- Start ----------
(async () => {
  if (IS_HUB) hubUI();
  try { await loadFb(); } catch (e) { console.warn('Firebase niet geladen (offline?)', e); return; }
  fb.onAuthStateChanged(fb.auth, async (u) => {
    user = u; ready = false; acctUI();
    if (!u) { if (IS_HUB && localStorage.getItem(GUEST_KEY) !== '1') gate(true); return; }
    localStorage.removeItem(GUEST_KEY);
    if (IS_HUB) { gate(false); setStatus('busy'); }
    try {
      await pull();
      if (IS_HUB) {
        const n = applyIn(remote);      // beste van account + deze browser samenvoegen
        if (window.renderRecords) window.renderRecords();
      }
      ready = true;
      if (pendingName && !myName) { try { await setName(pendingName); } catch (e) { /* later in het menu */ } }
      pendingName = '';
      if (IS_HUB) acctUI();
      await push(true);
    } catch (e) {
      setStatus('error', e);
      if (IS_HUB) { const m = $('acctMenu'); if (m) $('acctErr').textContent = errText(e); }
    }
  });
  // regelmatig en bij weggaan opslaan
  setInterval(() => push(false), 15000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(false); });
  addEventListener('pagehide', () => push(false));
})();
