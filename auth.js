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
let fb = null, user = null, remote = {}, lastSent = '', ready = false;
async function loadFb() {
  const [app, auth, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const a = app.initializeApp(firebaseConfig);
  fb = { ...auth, ...fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  fb.auth.languageCode = 'nl';
  return fb;
}
const ref = () => fb.doc(fb.db, 'users', user.uid);
async function pull() {
  const snap = await fb.getDoc(ref());
  remote = (snap.exists() && snap.data().data) || {};
  return remote;
}
async function push(force) {
  if (!user || !ready) return;
  const data = mergeObjs(collect(), remote);
  const s = JSON.stringify(data);
  if (!force && s === lastSent) return;
  try {
    await fb.setDoc(ref(), { data, email: user.email, updated: fb.serverTimestamp() });
    lastSent = s; remote = data; setStatus('saved');
  } catch (e) { setStatus('error', e); }
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
  $('aGo').textContent = m === 'signup' ? 'Account maken' : 'Inloggen';
  $('aPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  say('');
}
function acctUI() {
  const b = $('acctBtn'); if (!b) return;
  if (user) { b.textContent = '👤 ' + (user.email || 'Account'); b.title = 'Account'; }
  else { b.textContent = '🔑 Inloggen'; setStatus(''); }
}
function hubUI() {
  document.querySelectorAll('#authGate .tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
  $('authForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('aEmail').value.trim(), pw = $('aPass').value;
    if (!fb) return say('Kan geen verbinding maken met de server. Probeer het later opnieuw.');
    if (mode === 'signup' && pw !== $('aPass2').value) return say('De wachtwoorden zijn niet hetzelfde.');
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
  $('aGuest').addEventListener('click', () => { localStorage.setItem(GUEST_KEY, '1'); gate(false); });
  $('acctBtn').addEventListener('click', () => {
    if (!user) { setMode('login'); gate(true); return; }
    $('acctMenu').classList.toggle('open');
  });
  $('acctOut').addEventListener('click', async () => {
    $('acctMenu').classList.remove('open');
    await push(true);
    // records staan veilig in je account; haal ze van deze browser zodat iemand anders hier opnieuw kan beginnen
    Object.keys(collect()).forEach((k) => localStorage.removeItem(k));
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('tt2_ghost')) localStorage.removeItem(k); }
    localStorage.removeItem(GUEST_KEY);
    await fb.signOut(fb.auth);
    location.reload();
  });
  document.addEventListener('click', (e) => { const m = $('acctMenu'); if (m && !m.contains(e.target) && e.target !== $('acctBtn')) m.classList.remove('open'); });
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
        if (n && window.renderRecords) window.renderRecords();
      }
      ready = true;
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
