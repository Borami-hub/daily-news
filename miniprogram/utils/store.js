// Progress, daily review (spaced repetition) and check-ins, kept on the phone. Mirrors the web version.
const KEY = 'news-mp-v1';
let P = null;
function load() {
  if (P) return P;
  P = { name: '', arts: {}, srs: {}, days: {}, rec: {}, writing: {}, hl: { w: true, s: true }, fs: 1 };
  try { const raw = wx.getStorageSync(KEY); if (raw) P = Object.assign(P, raw); } catch (e) {}
  return P;
}
function save() { try { wx.setStorageSync(KEY, P); } catch (e) {} }
function reset() { P = null; try { wx.removeStorageSync(KEY); } catch (e) {} return load(); }

const pad = n => (n < 10 ? '0' : '') + n;
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const longDay = s => { const [y, m, d] = s.split('-').map(Number); return `${WD[new Date(y, m - 1, d).getDay()]}, ${MON[m - 1]} ${d}`; };
const nowLabel = () => { const d = new Date(); return `${MON[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const arec = id => { load(); return P.arts[id] || (P.arts[id] = { done: {} }); };
const markDone = (id, mod, extra) => { const r = arec(id); r.done[mod] = true; if (extra) Object.assign(r, extra); save(); };

const INTERVAL = [0, 1, 2, 4, 7, 15], CAP = 15;
const itemsOf = a => a.kps.map(k => ({ id: k.id, kind: 'kp', art: a.id, k }))
  .concat(a.words.map(w => ({ id: `${a.id}-w-${w.w}`, kind: 'word', art: a.id, w })));
function itemById(id, arts) { for (const a of arts) { const it = itemsOf(a).find(x => x.id === id); if (it) return it; } return null; }
function enroll(a, wrongIds) {
  load(); const t = today();
  itemsOf(a).forEach(it => {
    const wrong = wrongIds.includes(it.id);
    if (!P.srs[it.id]) P.srs[it.id] = { box: wrong ? 1 : 2, due: addDays(t, wrong ? 1 : 2), n: 0 };
    else if (wrong) { P.srs[it.id].box = 1; P.srs[it.id].due = addDays(t, 1); }
  });
  save();
}
const dueIds = arts => { load(); return Object.keys(P.srs).filter(id => P.srs[id].due <= today() && itemById(id, arts)).sort((a, b) => P.srs[a].box - P.srs[b].box); };
function grade(id, ok, counted) {
  load(); const t = today(); const d = P.days[t] || (P.days[t] = { done: 0, correct: 0, checked: false });
  d.done++; if (ok) d.correct++;
  const s = P.srs[id];
  if (s && counted) { s.n++; if (ok) { s.box = Math.min(5, s.box + 1); s.due = addDays(t, INTERVAL[s.box]); } else { s.box = 1; s.due = addDays(t, 1); } }
  save();
}
const checkIn = () => { load(); const t = today(); (P.days[t] || (P.days[t] = { done: 0, correct: 0 })).checked = true; save(); };
function streak() { load(); let d = today(), n = 0; if (!(P.days[d] && P.days[d].checked)) d = addDays(d, -1); while (P.days[d] && P.days[d].checked) { n++; d = addDays(d, -1); } return n; }
function calendar() { load(); const t = today(), out = []; for (let i = 27; i >= 0; i--) { const d = addDays(t, -i), r = P.days[d]; out.push({ k: d, c: (r && r.checked ? 'on' : r && r.done ? 'part' : '') + (i === 0 ? ' today' : '') }); } return out; }
const starsOf = p => (p >= 90 ? 5 : p >= 75 ? 4 : p >= 60 ? 3 : p >= 40 ? 2 : 1);
const starStr = n => '★'.repeat(n) + '☆'.repeat(5 - n);
function finalize(a) {
  const r = arec(a.id);
  if (r.toefl && r.summary) {
    const overall = Math.round((r.toefl.c + r.summary.pts) / (r.toefl.t + 2) * 100);
    markDone(a.id, 'results', { overall, stars: starsOf(overall), at: nowLabel() });
    enroll(a, []);
  }
}

module.exports = {
  load, save, reset, get P() { return load(); },
  today, addDays, longDay, nowLabel, MON, WD, pad,
  arec, markDone, itemsOf, itemById, enroll, dueIds, grade, checkIn, streak, calendar, starsOf, starStr, finalize, CAP
};
