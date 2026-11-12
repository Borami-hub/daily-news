const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const rec = require('../../utils/recorder.js');
Page({
  data: { sp: null, r: null, live: false },
  onLoad(q) { this.id = q.id; this.key = `${q.id}-speak`; data.getArt(q.id).then(a => { this.a = a; this.render(); }); },
  onUnload() { rec.stop(); },
  render() { this.setData({ sp: this.a.speak, r: store.load().rec[this.key] || null, live: rec.live() === this.key }); },
  record() {
    if (rec.live() === this.key) return rec.stop();
    rec.start(this.key, k => { if (k) store.markDone(this.id, 'speak'); this.render(); });
    this.render();
  },
  play() { rec.play(this.key); },
  share() { const P = store.load(); rec.share(this.key, `${P.name || 'student'}-${this.a.date}-speaking.mp3`); },
  done() { store.markDone(this.id, 'speak'); wx.showToast({ title: 'Done', icon: 'none' }); setTimeout(() => wx.navigateBack(), 400); }
});
