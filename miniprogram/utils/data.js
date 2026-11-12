// Loads the published days from WeChat Cloud storage (same files the GitHub Action uploads).
const config = require('../config.js');
const fs = wx.getFileSystemManager();
const MAX_DAYS = 14;

function getJSON(path) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID: config.PREFIX + path,
      success: r => {
        try { resolve(JSON.parse(fs.readFileSync(r.tempFilePath, 'utf8'))); } catch (e) { reject(e); }
      },
      fail: reject
    });
  });
}

// Day files are cached by date + index "updated" stamp, so only changed days are downloaded again.
async function fetchDays() {
  const idx = await getJSON('days/index.json');
  const list = (idx.days || []).slice().sort().reverse().slice(0, MAX_DAYS);
  let cache = {};
  try { cache = wx.getStorageSync('day-cache') || {}; } catch (e) {}
  const stamp = idx.updated || '';
  const days = await Promise.all(list.map(async d => {
    const c = cache[d];
    // older days rarely change; re-download the newest two and anything cached before the last update
    if (c && c.stamp === stamp) return c.day;
    if (c && d < stamp && list.indexOf(d) > 1) return c.day;
    try { return await getJSON(`days/${d}.json`); } catch (e) { return c ? c.day : null; }
  }));
  const out = days.filter(d => d && d.articles && d.articles.length);
  const next = {};
  out.forEach(d => { next[d.date] = { stamp, day: d }; });
  try { wx.setStorageSync('day-cache', next); } catch (e) {}
  return out;
}

function loadDays(force) {
  const app = getApp();
  if (!config.READY) return Promise.reject(new Error('config'));
  if (app.globalData.days.length && !force) return Promise.resolve(app.globalData.days);
  if (app.globalData.loading && !force) return app.globalData.loading;
  app.globalData.loading = fetchDays().then(days => {
    days.forEach(d => d.articles.forEach(a => { a.date = d.date; }));
    const audio = {};
    days.forEach(d => Object.assign(audio, d.audio || {}));
    app.globalData.days = days;
    app.globalData.audio = audio;
    app.globalData.loading = null;
    return days;
  }).catch(e => {
    app.globalData.loading = null;
    // offline: fall back to whatever is cached
    let cache = {};
    try { cache = wx.getStorageSync('day-cache') || {}; } catch (er) {}
    const days = Object.values(cache).map(c => c.day).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!days.length) throw e;
    days.forEach(d => d.articles.forEach(a => { a.date = d.date; }));
    app.globalData.days = days;
    app.globalData.audio = Object.assign({}, ...days.map(d => d.audio || {}));
    return days;
  });
  return app.globalData.loading;
}

function allArts() {
  return getApp().globalData.days.flatMap(d => d.articles);
}
function art(id) {
  return allArts().find(a => a.id === id);
}
async function getArt(id) {
  await loadDays();
  return art(id);
}

module.exports = { loadDays, allArts, art, getArt };
