// Use of English · Cambridge C1 Advanced (CAE) style: 4 parts built on the day's stories.
const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const L = 'ABCD';
const norm = x => String(x == null ? '' : x).toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:]+$/, '').replace(/\s+/g, ' ').trim();
const okOf = (p, it, v) => p.type === 'mc' ? v === it.a : it.ans.some(a => norm(a) === norm(v));
const right = (p, it) => p.type === 'mc' ? `${L[it.a]} ${it.opts[it.a]}` : it.ans.join(' / ');
function rec(date) { const P = store.load(); P.uoe = P.uoe || {}; return P.uoe[date] || (P.uoe[date] = {}); }

Page({
  data: { ready: false },
  onLoad(q) {
    this.date = q.date;
    data.loadDays().then(days => {
      const d = days.find(x => x.date === q.date) || days[0];
      if (!d || !d.uoe) { wx.showToast({ title: 'No Use of English for this day', icon: 'none' }); return; }
      this.u = d.uoe; this.date = d.date; this.s = { p: 0, ans: {}, chk: {}, confirm: false }; this.render();
    });
  },
  render() {
    const u = this.u, s = this.s, p = u.parts[s.p], chk = !!s.chk[s.p], r = rec(this.date);
    const tabs = u.parts.map((x, i) => ({ i, on: i === s.p, label: 'Part ' + x.part, sub: r[x.part] ? `${r[x.part].c}/${r[x.part].t}` : x.items.length + ' items' }));
    // text split into plain segments and gap tokens
    let segs = [];
    if (p.text) {
      const re = /\{(\d+)\}/g; let last = 0, m;
      while ((m = re.exec(p.text))) {
        if (m.index > last) segs.push({ t: p.text.slice(last, m.index) });
        const it = p.items.find(x => x.n === +m[1]), v = s.ans[it.n];
        const fill = p.type === 'mc' ? (v != null ? it.opts[v] : '______') : (v ? v : '______');
        segs.push({ gap: true, n: it.n, t: ` (${it.n}) ${fill} `, st: chk ? (okOf(p, it, v) ? 'ok' : 'no') : '' });
        last = m.index + m[0].length;
      }
      if (last < p.text.length) segs.push({ t: p.text.slice(last) });
    }
    const items = p.items.map(it => {
      const v = s.ans[it.n], ok = okOf(p, it, v);
      const yours = p.type === 'mc' ? (v != null ? it.opts[v] : '') : (v || '');
      return { n: it.n, stem: it.stem || '', s1: it.s1 || '', key: it.key || '', pre: it.pre || '', post: it.post || '', val: v || '',
        opts: (it.opts || []).map((o, i) => ({ i, t: `${L[i]}  ${o}`, c: chk ? (i === it.a ? 'right' : v === i ? 'wrong' : '') : (v === i ? 'on' : '') })),
        st: chk ? (ok ? 'ok' : 'no') : '', ok, yours: yours || '(blank)', right: right(p, it), why: it.why, focus: it.focus || '' };
    });
    const c = chk ? items.filter(x => x.ok).length : 0;
    this.setData({ ready: true, tabs, part: { part: p.part, title: p.title, topic: p.topic || '', task: p.task, type: p.type }, segs, items, chk,
      score: chk ? `${c}/${items.length} correct` : '', good: c >= items.length * 0.6, last: s.p === u.parts.length - 1 });
  },
  tab(e) { this.s.p = +e.currentTarget.dataset.i; this.s.confirm = false; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); },
  pick(e) { const s = this.s; if (s.chk[s.p]) return; s.ans[+e.currentTarget.dataset.n] = +e.currentTarget.dataset.i; this.render(); },
  onInput(e) { this.s.ans[+e.currentTarget.dataset.n] = e.detail.value; },
  onBlur() { this.render(); },
  check() {
    const s = this.s, p = this.u.parts[s.p];
    const blank = p.items.filter(it => s.ans[it.n] == null || s.ans[it.n] === '').length;
    if (blank && !s.confirm) { s.confirm = true; return wx.showToast({ title: `${blank} blank — tap Check again`, icon: 'none' }); }
    s.confirm = false; s.chk[s.p] = true;
    rec(this.date)[p.part] = { c: p.items.filter(it => okOf(p, it, s.ans[it.n])).length, t: p.items.length }; store.save();
    this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  retry() { const s = this.s, p = this.u.parts[s.p]; p.items.forEach(it => { delete s.ans[it.n]; }); s.chk[s.p] = false; this.render(); },
  next() { this.s.p++; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); },
  done() { wx.navigateBack(); }
});
