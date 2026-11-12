// Shared helpers: audio playback, text highlighting segments, shuffling, word count.
const config = require('../config.js');

const TOPIC = { Economy: '#b35c00', Nature: '#2f9e44', Animals: '#5c940d', Geography: '#1971c2', Space: '#3b5bdb', Environment: '#2b8a3e', Health: '#c2410c', Technology: '#7048e8', Society: '#0b7285', Culture: '#a61e4d', Science: '#0b7a75' };
const topicColor = t => TOPIC[t] || '#0b7a75';

// Audio: each mp3 is downloaded from cloud storage with wx.cloud.downloadFile (the same way the lessons load,
// so no domain whitelist is needed) and played from the local temp file. Files are cached for the session.
let player = null, queue = [], onStep = null, onStop = null, token = 0;
const fileCache = {};
function getPlayer() {
  if (player) return player;
  player = wx.createInnerAudioContext({ useWebAudioImplement: false });
  try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
  player.onEnded(() => next());
  player.onError(err => { wx.showToast({ title: 'Audio error ' + (err && err.errCode != null ? err.errCode : ''), icon: 'none' }); console.error('audio error', err, player.src); stop(); });
  return player;
}
const idOf = text => { const p = getApp().globalData.audio[text]; return p ? config.PREFIX + p : ''; };
function local(id) {
  if (!fileCache[id]) {
    fileCache[id] = new Promise((resolve, reject) => wx.cloud.downloadFile({
      fileID: id, success: r => resolve(r.tempFilePath),
      fail: e => { delete fileCache[id]; console.error('audio download failed', id, e); reject(e); }
    }));
  }
  return fileCache[id];
}
function playFile(my, item) {
  return local(item.id).then(path => {
    if (my !== token) return;
    const p = getPlayer(); p.src = path; p.play();
    if (onStep && item.i != null) onStep(item.i);
  });
}
function fail(e) { wx.showToast({ title: 'Audio download failed', icon: 'none' }); console.error(e); stop(); }
function next() {
  if (!queue.length) { const f = onStop; onStep = onStop = null; if (f) f(); return; }
  const my = token, item = queue.shift();
  if (queue[0]) local(queue[0].id).catch(() => {}); // fetch the one after next in the background
  playFile(my, item).catch(fail);
}
function speak(text) {
  stop();
  const id = idOf(text);
  if (!id) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return; }
  playFile(++token, { id }).catch(fail);
}
// texts: array of strings; stepCb(i) fires as each one starts; doneCb when finished or stopped
function playAll(texts, stepCb, doneCb) {
  stop();
  const items = texts.map((t, i) => ({ i, id: idOf(t) })).filter(x => x.id);
  if (!items.length) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return false; }
  ++token; onStep = stepCb; onStop = doneCb; queue = items;
  next();
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
