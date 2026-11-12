const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
Page({
  data: { wr: null, text: '', n: 0, at: '' },
  onLoad(q) {
    this.id = q.id;
    data.getArt(q.id).then(a => {
      this.a = a; const saved = store.load().writing[a.id] || { text: '' };
      // split "Professor: … (Name says: …) (Name says: …)" into readable parts
      const p = a.write.p, parts = p.split(/\s\((?=[A-Z][a-z]+ says:)/);
      const prof = parts[0], students = parts.slice(1).map(x => { const m = x.replace(/\)$/, '').match(/^([A-Z][a-z]+) says:\s*(.*)$/); return m ? { who: m[1], say: m[2] } : { who: '', say: x }; });
      this.text = saved.text;
      this.setData({ wr: { prof, students, steps: a.write.steps, min: a.write.minWords }, text: saved.text, n: util.wc(saved.text), at: saved.at || '' });
    });
  },
  onInput(e) {
    this.text = e.detail.value; const P = store.load();
    P.writing[this.id] = Object.assign(P.writing[this.id] || {}, { text: this.text }); store.save();
    this.setData({ n: util.wc(this.text) });
  },
  submit() {
    const n = util.wc(this.text), min = this.a.write.minWords;
    if (n < min) return wx.showToast({ title: `Write at least ${min} words`, icon: 'none' });
    const P = store.load(), at = store.nowLabel(); P.writing[this.id] = { text: this.text, at }; store.save();
    store.markDone(this.id, 'write', { writingWords: n }); this.setData({ at }); wx.showToast({ title: 'Saved', icon: 'none' });
  },
  copy() { const P = store.load(); util.copy([`[Daily News Writing] ${P.name || '(no name)'} · ${this.a.date} ${this.a.title}`, '', this.text || ''].join('\n')); }
});
