// Shared helpers: audio playback, text highlighting segments, shuffling, word count.
const config = require('../config.js');

const TOPIC = { Economy: '#b35c00', Nature: '#2f9e44', Animals: '#5c940d', Geography: '#1971c2', Space: '#3b5bdb', Environment: '#2b8a3e', Health: '#c2410c', Technology: '#7048e8', Society: '#0b7285', Culture: '#a61e4d', Science: '#0b7a75' };
const topicColor = t => TOPIC[t] || '#0b7a75';

let player = null, queue = [], onStep = null, onStop = null;
function getPlayer() {
  if (player) return player;
  player = wx.createInnerAudioContext({ useWebAudioImplement: false });
  try { wx.setInnerAudioOption({ obeyMuteSwitch: false }); } catch (e) {}
  player.onEnded(() => {
    if (queue.length) { const n = queue.shift(); player.src = n.src; player.play(); if (onStep) onStep(n.i); }
    else { const f = onStop; onStep = onStop = null; if (f) f(); }
  });
  player.onError(() => { wx.showToast({ title: 'Audio unavailable', icon: 'none' }); stop(); });
  return player;
}
const srcOf = text => { const p = getApp().globalData.audio[text]; return p ? config.PREFIX + p : ''; };
function speak(text) {
  stop();
  const src = srcOf(text);
  if (!src) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return; }
  const p = getPlayer(); p.src = src; p.play();
}
// texts: array of strings; stepCb(i) fires as each one starts; doneCb when finished or stopped
function playAll(texts, stepCb, doneCb) {
  stop();
  const items = texts.map((t, i) => ({ i, src: srcOf(t) })).filter(x => x.src);
  if (!items.length) { wx.showToast({ title: 'No audio for this', icon: 'none' }); return false; }
  const p = getPlayer(); const first = items.shift(); queue = items; onStep = stepCb; onStop = doneCb;
  p.src = first.src; p.play(); if (stepCb) stepCb(first.i);
  return true;
}
function stop() {
  queue = [];
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
