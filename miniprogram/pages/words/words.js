const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
Page({
  data: { i: 0, n: 0, w: null, show: false, hit: null, ex: [] },
  onLoad(q) { this.id = q.id; data.getArt(q.id).then(a => { this.a = a; this.show(0); }); },
  onUnload() { util.stop(); },
  show(i) {
    const a = this.a, w = a.words[i];
    this.setData({ i, n: a.words.length, show: false, w: Object.assign({}, w, { long: w.w.length > 12 }), hit: util.inArticle(a, w.w), ex: util.markOnce(w.ex, (w.ex.match(new RegExp('\\b' + w.w + '\\b', 'i')) || [])[0]) });
  },
  reveal() { this.setData({ show: true }); },
  sayWord() { util.speak(this.data.w.w); },
  sayEx() { util.speak(this.data.w.ex); },
  prev() { if (this.data.i > 0) this.show(this.data.i - 1); },
  next() {
    if (this.data.i < this.data.n - 1) return this.show(this.data.i + 1);
    store.markDone(this.id, 'words'); wx.showToast({ title: 'Words done', icon: 'none' }); setTimeout(() => wx.navigateBack(), 500);
  }
});
