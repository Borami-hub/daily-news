// Real voice recording (TOEFL speaking practice). Files are kept on the phone; students can send them to the teacher in WeChat.
const store = require('./store.js');
const fs = wx.getFileSystemManager();
let rm = null, cb = null, startAt = 0, liveKey = null;
function mgr() {
  if (rm) return rm;
  rm = wx.getRecorderManager();
  rm.onStop(res => {
    const key = liveKey; liveKey = null;
    const sec = Math.max(1, Math.round((res.duration || (Date.now() - startAt)) / 1000));
    const dest = `${wx.env.USER_DATA_PATH}/rec-${key}.mp3`;
    try { fs.unlinkSync(dest); } catch (e) {}
    fs.saveFile({ tempFilePath: res.tempFilePath, filePath: dest,
      success: () => done(key, dest, sec),
      fail: () => done(key, res.tempFilePath, sec) });
  });
  rm.onError(() => { liveKey = null; wx.showToast({ title: 'Recording failed', icon: 'none' }); if (cb) cb(); });
  return rm;
}
function done(key, path, sec) {
  const P = store.load(); P.rec[key] = { sec, at: store.nowLabel(), path }; store.save();
  wx.showToast({ title: 'Saved', icon: 'none' }); if (cb) cb(key);
}
function start(key, onChange) {
  if (liveKey) return wx.showToast({ title: 'Stop the other recording first', icon: 'none' });
  cb = onChange; liveKey = key; startAt = Date.now();
  mgr().start({ duration: 120000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 });
}
function stop() { if (liveKey) mgr().stop(); }
const live = () => liveKey;
let player = null;
function play(key) {
  const r = store.load().rec[key]; if (!r) return;
  if (!player) player = wx.createInnerAudioContext();
  player.src = r.path; player.play();
}
function share(key, name) {
  const r = store.load().rec[key]; if (!r) return;
  wx.shareFileMessage({ filePath: r.path, fileName: name, fail: () => wx.showToast({ title: 'Could not share the file', icon: 'none' }) });
}
module.exports = { start, stop, live, play, share };
