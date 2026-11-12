const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
const COLORS = [['#0f8b8d', '#e3f4f4'], ['#e8590c', '#fff0e6'], ['#4263eb', '#e9edfd'], ['#c2255c', '#fbe7ef']];
Page({
  data: { mm: null },
  onLoad(q) { this.id = q.id; data.getArt(q.id).then(a => { this.a = a; this.init(); }); },
  onUnload() { util.stop(); },
  init() {
    const mm = this.a.mindmap; let k = 0; const ans = [];
    this.branches = mm.branches.map((b, bi) => ({ bi, title: b.title, paras: b.paras, kps: b.kps || [], c: COLORS[bi][0], t: COLORS[bi][1], slots: b.blanks.map(t => { ans.push(t); return { k: k++, answer: t, fill: '', state: '' }; }) }));
    this.pool = util.shuffle(ans.concat(mm.distractors)).map((t, i) => ({ i, t, used: false, decoy: mm.distractors.includes(t) }));
    this.sel = 0; this.checked = false; this.sheet = -1; this.score = '';
    this.render();
  },
  render() {
    const mm = this.a.mindmap;
    let sheet = null;
    if (this.sheet >= 0) {
      const b = this.branches[this.sheet], src = mm.branches[this.sheet];
      const facts = b.kps.length ? b.kps.map(id => (this.a.kps.find(k => k.id === id) || {}).fact).filter(Boolean) : src.blanks;
      sheet = { b, facts, pn: parseInt(b.paras, 10) };
    }
    this.setData({ mm: { center: mm.center, question: mm.question }, branches: this.branches, pool: this.pool, sel: this.sel, checked: this.checked, score: this.score,
      left: this.pool.filter(p => !p.used).length, traps: this.pool.filter(p => p.decoy).map(p => '“' + p.t + '”').join(' and '), sheet });
  },
  slot(e) {
    if (this.checked) return;
    const k = +e.currentTarget.dataset.k, slot = this.branches.flatMap(x => x.slots).find(x => x.k === k);
    if (slot.fill) { const p = this.pool.find(x => x.t === slot.fill && x.used); if (p) p.used = false; slot.fill = ''; }
    this.sel = k; this.render();
  },
  chip(e) {
    if (this.checked) return;
    const p = this.pool[+e.currentTarget.dataset.i]; if (p.used || this.sel < 0) return;
    const slots = this.branches.flatMap(x => x.slots), slot = slots.find(x => x.k === this.sel);
    if (slot.fill) { const old = this.pool.find(x => x.t === slot.fill && x.used); if (old) old.used = false; }
    slot.fill = p.t; p.used = true;
    const nx = slots.find(x => !x.fill); this.sel = nx ? nx.k : -1; this.render();
  },
  check() {
    const slots = this.branches.flatMap(x => x.slots);
    if (slots.some(x => !x.fill)) return wx.showToast({ title: 'Fill every box first', icon: 'none' });
    let r = 0; slots.forEach(y => { const ok = y.fill === y.answer; if (ok) r++; y.state = ok ? 'right' : 'wrong'; });
    this.checked = true; this.score = `${r}/${slots.length}`; this.sel = -1;
    store.markDone(this.id, 'mindmap', { mindmap: { c: r, t: slots.length } }); this.render();
  },
  show() { this.branches.forEach(x => x.slots.forEach(y => { if (y.state !== 'right') { y.fill = y.answer; y.state = 'fixed'; } })); this.render(); },
  retry() { this.init(); },
  open(e) { if (!this.checked) return; this.sheet = +e.currentTarget.dataset.b; this.render(); },
  close() { this.sheet = -1; this.render(); },
  sayPara() { const b = this.data.sheet; util.speak(this.a.paras[b.pn - 1]); },
  back() { wx.navigateBack(); }
});
