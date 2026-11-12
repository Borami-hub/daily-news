// Shared helpers: audio playback, text highlighting segments, shuffling, word count.
const config = require('../config.js');

const TOPIC = { Economy: '#b35c00', Nature: '#2f9e44', Animals: '#5c940d', Geography: '#1971c2', Space: '#3b5bdb', Environment: '#2b8a3e', Health: '#c2410c', Technology: '#7048e8', Society: '#0b7285', Culture: '#a61e4d', Science: '#0b7a75' };
const topicColor = t => TOPIC[t] || '#0b7a75';

// Audio: cloud file IDs are turned into https temp URLs (more reliable than giving the player a cloud:// ID),
// cached for the session. Errors show the reason so problems can be diagnosed on the phone.
let player = null, queue = [], onStep = null, onStop = null, token = 0;
const urlCache = {};
function getPlayer() {
  if (player) return player;
  player = wx.createInnerAudioContext({ useWebAudioImplement: false });
  try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
  player.onEnded(() => {
    if (queue.length) { const n = queue.shift(); player.src = n.url; player.play(); if (onStep) onStep(n.i); }
    else { const f = onStop; onStep = onStop = null; if (f) f(); }
  });
  player.onError(err => { wx.showToast({ title: 'Audio error ' + (err && err.errCode != null ? err.errCode : ''), icon: 'none' }); console.error('audio error', err, player.src); stop(); });
  return player;
}
const idOf = text => { const p = getApp().globalData.audio[text]; return p ? config.PREFIX + p : ''; };
function toUrls(ids) {
  const need = ids.filter(id => !urlCache[id]);
  if (!need.length) return Promise.resolve(ids.map(id => urlCache[id]));
  const batches = [];
  for (let i = 0; i < need.length; i += 50) batches.push(need.slice(i, i + 50));
  return Promise.all(batches.map(b => wx.cloud.getTempFileURL({ fileList: b }).then(r => {
    (r.fileList || []).forEach(f => { if (f.tempFileURL) urlCache[f.fileID] = f.tempFileURL; else console.error('temp url failed', f); });
  }))).then(() => ids.map(id => urlCache[id] || ''));
}
function speak(text) {
  stop();
  const id = idOf(text);
  if (!id) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return; }
  const my = ++token;
  toUrls([id]).then(([url]) => {
    if (my !== token) return;
    if (!url) return wx.showToast({ title: 'Audio file not found', icon: 'none' });
    const p = getPlayer(); p.src = url; p.play();
  }).catch(e => { console.error('getTempFileURL', e); wx.showToast({ title: 'Audio load failed', icon: 'none' }); });
}
// texts: array of strings; stepCb(i) fires as each one starts; doneCb when finished or stopped
function playAll(texts, stepCb, doneCb) {
  stop();
  const items = texts.map((t, i) => ({ i, id: idOf(t) })).filter(x => x.id);
  if (!items.length) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return false; }
  const my = ++token; onStep = stepCb; onStop = doneCb;
  toUrls(items.map(x => x.id)).then(urls => {
    if (my !== token) return;
    items.forEach((x, k) => { x.url = urls[k]; });
    const ok = items.filter(x => x.url);
    if (!ok.length) { wx.showToast({ title: 'Audio file not found', icon: 'none' }); return stop(); }
    const p = getPlayer(); const first = ok.shift(); queue = ok;
    p.src = first.url; p.play(); if (onStep) onStep(first.i);
  }).catch(e => { console.error('getTempFileURL', e); wx.showToast({ title: 'Audio load failed', icon: 'none' }); stop(); });
  return true;
}
function stop() {
  token++; queue = [];
  const f = onStop; onStep = onStop = null;
  if (player) { try { player.stop(); } catch (e) {} }
  if (f) f();
}

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Split text into [{t, hl}] with the first occurrence of `phrase` marked.
function markOnce(text, phrase) {
  if (!phrase) return [{ t: text }];
  const i = text.indexOf(phrase);
  if (i < 0) return [{ t: text }];
  return [{ t: text.slice(0, i) }, { t: phrase, hl: true }, { t: text.slice(i + phrase.length) }].filter(x => x.t);
}
// Split text into [{t, w}] where w = base word for any of `words` (allowing simple endings).
function markWords(text, words) {
  if (!words || !words.length) return [{ t: text }];
  const re = new RegExp('\\b(' + words.map(w => escRe(w)).sort((x, y) => y.length - x.length).join('|') + ')(s|es|d|ed|ing)?\\b', 'gi');
  const out = []; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    const base = words.find(w => m[1].toLowerCase() === w.toLowerCase()) || m[1];
    out.push({ t: m[0], w: base });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const wc = t => ((t || '').trim().match(/[A-Za-z’'-]+/g) || []).length;
const words = a => a.paras.join(' ').split(/\s+/).length;
function copy(text) { wx.setClipboardData({ data: text, success: () => wx.showToast({ title: 'Copied', icon: 'none' }) }); }
function inArticle(a, w) {
  const re = new RegExp('\\b' + escRe(w) + '(s|es|d|ed|ing)?\\b', 'i');
  for (let i = 0; i < a.paras.length; i++) {
    const sents = a.paras[i].match(/[^.!?]+[.!?]+["”]?/g) || [a.paras[i]];
    const hit = sents.find(x => re.test(x));
    if (hit) { const s = hit.trim(), m = s.match(re); return { para: i + 1, segs: markOnce(s, m[0]) }; }
  }
  return null;
}

module.exports = { topicColor, speak, playAll, stop, markOnce, markWords, shuffle, wc, words, copy, inArticle };
