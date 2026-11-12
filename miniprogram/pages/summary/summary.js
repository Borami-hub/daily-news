const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
const TYPE = { main: ['Main idea', 'good'], detail: ['Minor detail', 'amber'], not: ['Not mentioned', 'bad'], contra: ['Contradicts the article', 'bad'] };
const CHECK = ['I stated the main idea, not small details.', 'I used my own words, not whole sentences from the article.', 'I connected ideas with transition words (however, while, because, so).', 'My summary is 40 words or fewer.'];
const TW = /\b(However|while|because|so|but|although|as a result|therefore)\b/gi;
Page({
  data: { ready: false },
  onLoad(q) { this.id = q.id; data.getArt(q.id).then(a => { this.a = a; this.init(); }); },
  init() {
    const P = store.load();
    this.s = { order: util.shuffle(this.a.summary.options.map((o, i) => i)), sel: [], checked: false, sheet: -1, own: (P.writing[this.id + '-sum'] || {}).text || '', compared: false, checks: {} };
    this.render();
  },
  render() {
    const s = this.s, sm = this.a.summary;
    const slots = [0, 1, 2].map(k => { const i = s.sel[k], o = i != null ? sm.options[i] : null; return { i, t: o ? o.t : '', st: s.checked && o ? (o.ok ? 'right' : 'wrong') : '' }; });
    const list = s.order.filter(i => s.checked || !s.sel.includes(i)).map(i => { const o = sm.options[i], t = TYPE[o.type] || ['', '']; return { i, t: o.t, why: o.why, ok: o.ok, on: s.sel.includes(i), type: t[0], tc: t[1], para: o.para }; });
    let sheet = null;
    if (s.sheet >= 0) { const o = sm.options[s.sheet]; sheet = { type: (TYPE[o.type] || [''])[0], para: o.para, segs: util.markOnce(this.a.paras[o.para - 1], o.evidence) }; }
    const model = []; let last = 0, m; TW.lastIndex = 0;
    while ((m = TW.exec(sm.model))) { if (m.index > last) model.push({ t: sm.model.slice(last, m.index) }); model.push({ t: m[0], b: true }); last = m.index + m[0].length; }
    if (last < sm.model.length) model.push({ t: sm.model.slice(last) });
    const words = util.wc(s.own);
    this.setData({ ready: true, intro: sm.intro, slots, list, checked: s.checked, pts: s.pts, n: s.sel.length, sheet, own: s.own, compared: s.compared, model,
      checks: CHECK.map((c, i) => ({ c, on: !!s.checks[i] })), words, wcColor: words > 40 ? 'var(--bad)' : words >= 15 ? 'var(--good)' : '' });
  },
  pick(e) { const s = this.s, i = +e.currentTarget.dataset.i; if (s.checked) return; if (s.sel.length >= 3) return wx.showToast({ title: 'Only three — tap one above to remove it', icon: 'none' }); s.sel.push(i); this.render(); },
  unpick(e) { const s = this.s; if (s.checked) return; const i = e.currentTarget.dataset.i; if (i == null || i === '') return; s.sel = s.sel.filter(x => x !== +i); this.render(); },
  check() {
    const s = this.s; if (s.sel.length < 3) return;
    const n = s.sel.filter(i => this.a.summary.options[i].ok).length; s.pts = n === 3 ? 2 : n === 2 ? 1 : 0; s.checked = true;
    store.markDone(this.id, 'summary', { summary: { pts: s.pts, n } }); store.finalize(this.a); this.render();
  },
  ev(e) { this.s.sheet = +e.currentTarget.dataset.i; this.render(); },
  close() { this.s.sheet = -1; this.render(); },
  onOwn(e) { this.s.own = e.detail.value; const words = util.wc(this.s.own); this.setData({ words, wcColor: words > 40 ? 'var(--bad)' : words >= 15 ? 'var(--good)' : '' }); },
  compare() {
    const s = this.s, P = store.load();
    if (util.wc(s.own) < 8 && !P.rec[`${this.id}-sumrec`]) return wx.showToast({ title: 'Write your summary first', icon: 'none' });
    s.compared = true; P.writing[this.id + '-sum'] = { text: s.own, at: store.nowLabel() }; store.save(); this.render();
  },
  chk(e) { const i = e.currentTarget.dataset.i; this.s.checks[i] = !this.s.checks[i]; this.render(); },
  edit() { this.s.compared = false; this.render(); },
  done() { wx.showToast({ title: 'Summary saved', icon: 'none' }); setTimeout(() => wx.navigateBack(), 400); },
  redo() { this.init(); }
});
