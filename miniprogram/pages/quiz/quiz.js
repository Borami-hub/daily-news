const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
const L = 'ABCD';

const blankOut = (ex, w) => ex.replace(new RegExp('\\b' + w + '\\b', 'i'), '______');
const kpQ = k => ({ id: k.id, type: 'mc', tag: k.tag, prompt: k.q, opts: k.opts, a: k.a, fact: k.fact });
function wordQ(aid, w, pool, spell) {
  const id = `${aid}-w-${w.w}`;
  if (spell && !/\s/.test(w.w)) return { id, type: 'spell', tag: 'Word', prompt: 'Spell the word:', def: `${w.def} (${w.pos})`, sub: blankOut(w.ex, w.w), answer: w.w };
  const opts = util.shuffle([w.w].concat(util.shuffle(pool.filter(x => x.w !== w.w)).slice(0, 3).map(x => x.w)));
  return { id, type: 'mc', tag: 'Word', prompt: 'Choose the word that fills the blank:', sub: blankOut(w.ex, w.w), opts, a: opts.indexOf(w.w), fact: `${w.w} ${w.ipa} — ${w.def}` };
}
function itemQ(it) {
  if (it.kind === 'kp') return kpQ(it.k);
  const a = data.art(it.art), s = store.load().srs[it.id];
  return wordQ(a.id, it.w, a.words, (s && s.box >= 3) || Math.random() < .4);
}

// Build the explanation view for one answered question.
function explainVM(q, picked, a, open) {
  const answered = picked != null && picked >= 0, ok = picked === q.a;
  const rich = !!((q.ctx || q.steps) && q.optWhy);
  if (!q.optWhy) return { simple: true, fact: q.fact };
  if (!rich) {
    let evi = null;
    if (a && q.para) evi = { para: q.para, segs: util.markOnce(a.paras[q.para - 1], q.evidence) };
    return { rich: false, fact: `Why ${L[q.a]}: ${q.fact}`, ow: q.opts.map((o, i) => ({ L: L[i], why: q.optWhy[i], cls: i === q.a ? 'r' : i === picked ? 'w' : '' })), evi };
  }
  const card = i => ({ L: L[i], text: q.opts[i], why: q.optWhy[i], cls: i === q.a ? 'r' : i === picked ? 'w' : '', tag: i === q.a ? 'Correct' : 'Ruled out', mine: i === picked });
  const order = ok || !answered ? [0, 1, 2, 3] : [picked, q.a].concat([0, 1, 2, 3].filter(i => i !== picked && i !== q.a));
  let ctx = (q.ctx || []).map(c => ({ para: c.para, segs: util.markOnce(c.text, c.hl) }));
  if (!ctx.length && a && q.para) ctx = [{ para: q.para, segs: util.markOnce(a.paras[q.para - 1], q.evidence) }];
  return {
    rich: true, ok, folded: ok && !open,
    res: ok ? '✓ Correct' : !answered ? `Skipped · Correct answer: ${L[q.a]}` : `✗ Your answer: ${L[picked]} · Correct answer: ${L[q.a]}`,
    ctx, cards: order.map(card), steps: q.steps || [], fact: q.steps && q.steps.length ? '' : `Why ${L[q.a]}: ${q.fact}`
  };
}

Page({
  data: { v: 'loading' },
  onLoad(p) {
    this.p = p;
    data.loadDays().then(() => this.init()).catch(() => this.setData({ v: 'empty' }));
  },
  onUnload() { this.stopTimer(); },
  init() {
    const { mode, id, extra } = this.p, arts = data.allArts();
    let qs = [];
    if (mode === 'review') {
      let ids = store.dueIds(arts).slice(0, store.CAP);
      const P = store.load();
      if (extra || !ids.length) ids = util.shuffle(Object.keys(P.srs).filter(x => store.itemById(x, arts))).sort((x, y) => P.srs[x].box - P.srs[y].box).slice(0, 10);
      qs = util.shuffle(ids).map(x => itemQ(store.itemById(x, arts)));
      wx.setNavigationBarTitle({ title: extra ? 'Extra practice' : 'Daily review' });
    } else {
      this.a = data.art(id);
      qs = this.a.questions.map((q, i) => ({ id: `${this.a.id}-q${i}`, type: 'mc', tag: q.type, prompt: q.q, opts: q.opts, a: q.a, fact: q.why, para: q.para, evidence: q.evidence, optWhy: q.optWhy, highlight: q.highlight, ctx: q.ctx, steps: q.steps }));
    }
    this.s = { qs, i: 0, answered: false, picked: -1, typed: '', ok: false, correct: 0, wrong: [], requeued: {}, finished: false, showP: false, style: mode === 'toefl' ? null : 'practice', answers: [], reviewing: false, ri: 0, t0: 0, open: false };
    this.render();
  },
  render() {
    const s = this.s, { mode, extra } = this.p, a = this.a;
    if (!s.qs.length) return this.setData({ v: 'empty' });
    if (mode === 'toefl' && !s.style) return this.setData({ v: 'style', title: a.title });
    if (s.reviewing) {
      const q = s.qs[s.ri], mine = s.answers[s.ri];
      return this.setData({ v: 'review', n: s.qs.length, ri: s.ri, q: this.qView(q),
        chip: mine === q.a ? ['good', 'Correct'] : mine == null ? ['bad', 'Skipped'] : ['bad', 'Wrong'],
        dots: s.qs.map((x, i) => ({ i, c: (i === s.ri ? 'cur ' : '') + (s.answers[i] === x.a ? 'ok' : 'no') })),
        plain: q.opts.map((o, i) => ({ L: L[i], o, cls: i === q.a ? 'right' : i === mine ? 'wrong' : '', mine: i === mine })),
        ex: explainVM(q, mine, a, s.open) });
    }
    if (s.finished) return this.setData({ v: 'done', sum: s.summary, wrongList: s.wrongList, mode, dots: mode === 'toefl' ? s.qs.map((x, i) => ({ i, c: s.answers[i] === x.a ? 'ok' : 'no' })) : [], cal: mode === 'review' ? store.calendar() : [] });
    const q = s.qs[s.i], n = s.qs.length;
    const peek = a && q.para ? { para: q.para, text: a.paras[q.para - 1] } : null;
    if (s.style === 'test') {
      return this.setData({ v: 'test', n, i: s.i, q: this.qView(q), peek, showP: s.showP,
        dots: s.qs.map((x, i) => ({ i, c: (i === s.i ? 'cur ' : '') + (s.answers[i] != null ? 'done' : '') })),
        opts: q.opts.map((o, i) => ({ L: L[i], o, chosen: s.answers[s.i] === i })), last: s.i === n - 1 });
    }
    const ex = s.answered && q.type === 'mc' ? explainVM(q, s.picked, a, s.open) : null;
    this.setData({ v: 'practice', n, i: s.i, correct: s.correct, eyebrow: extra ? 'Extra practice · does not affect check-in' : mode === 'review' ? 'Daily review' : 'Questions',
      q: this.qView(q), answered: s.answered, ok: s.ok, typed: s.typed, peek, showP: s.showP, last: s.i === n - 1,
      hidePlain: !!(ex && ex.rich),
      opts: q.type === 'mc' ? q.opts.map((o, i) => ({ L: L[i], o, cls: s.answered && i === q.a ? 'right' : s.answered && i === s.picked ? 'wrong' : '' })) : [],
      ex });
  },
  qView(q) { return { tag: q.tag, prompt: q.prompt, highlight: q.highlight || '', type: q.type, def: q.def || '', sub: q.sub || '', answer: q.answer || '' }; },

  style(e) { this.s.style = e.currentTarget.dataset.v; this.s.t0 = Date.now(); if (this.s.style === 'test') this.startTimer(); this.render(); },
  togglep() { this.s.showP = !this.s.showP; this.render(); },
  toggleOpen() { this.s.open = !this.s.open; this.render(); },
  answer(ok, picked) {
    const s = this.s, q = s.qs[s.i];
    s.answers[s.i] = picked;
    if (!ok) s.wrong.push(q.id);
    if (this.p.mode === 'review') {
      const counted = !s.requeued[q.id];
      store.grade(q.id, ok, counted);
      if (!ok && counted) { s.requeued[q.id] = true; const it = store.itemById(q.id, data.allArts()); if (it) s.qs.push(itemQ(it)); }
    }
    Object.assign(s, { answered: true, ok, picked, correct: s.correct + (ok ? 1 : 0), open: false });
    this.render();
  },
  pick(e) { if (this.s.answered) return; const i = +e.currentTarget.dataset.i; this.answer(i === this.s.qs[this.s.i].a, i); },
  onSpell(e) { this.s.typed = e.detail.value; },
  spell() {
    const s = this.s; if (s.answered) return;
    const v = (s.typed || '').trim().toLowerCase(); if (!v) return;
    this.answer(v === s.qs[s.i].answer.toLowerCase(), -1);
  },
  sayAnswer() { util.speak(this.s.qs[this.s.i].answer); },
  next() {
    const s = this.s;
    if (s.i < s.qs.length - 1) { Object.assign(s, { i: s.i + 1, answered: false, picked: -1, typed: '', ok: false, showP: false, open: false }); this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); }
    else this.finish();
  },
  // test mode
  tpick(e) { this.s.answers[this.s.i] = +e.currentTarget.dataset.i; this.render(); },
  goto(e) { this.s.i = +e.currentTarget.dataset.i; this.s.showP = false; this.render(); },
  tprev() { if (this.s.i > 0) { this.s.i--; this.s.showP = false; this.render(); } },
  tnext() { this.s.i++; this.s.showP = false; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); },
  tsubmit() {
    const s = this.s, blank = s.qs.filter((x, i) => s.answers[i] == null).length;
    if (blank && !s.confirmBlank) { s.confirmBlank = true; return wx.showToast({ title: `${blank} unanswered — tap Submit again`, icon: 'none' }); }
    s.qs.forEach((x, i) => { if (s.answers[i] === x.a) s.correct++; else s.wrong.push(x.id); });
    this.stopTimer(); s.elapsed = Math.floor((Date.now() - s.t0) / 1000); this.finish();
  },
  startTimer() { this.stopTimer(); this.tmr = setInterval(() => { if (this.data.v !== 'test') return; const e = Math.floor((Date.now() - this.s.t0) / 1000); this.setData({ timer: `${Math.floor(e / 60)}:${store.pad(e % 60)}` }); }, 1000); },
  stopTimer() { if (this.tmr) clearInterval(this.tmr); this.tmr = null; },
  finish() {
    const s = this.s, { mode, id, extra } = this.p, c = s.correct, t = s.qs.length, wrongIds = [...new Set(s.wrong)], arts = data.allArts();
    if (mode === 'review') {
      if (!extra) store.checkIn();
      const rec = store.load().days[store.today()] || { done: 0, correct: 0 };
      s.summary = { title: extra ? 'Practice done' : 'Checked in', big: store.streak(), bigLabel: 'day streak', line: `This set ${c}/${t} correct · Today ${rec.correct}/${rec.done}` };
    } else {
      store.markDone(id, 'toefl', { toefl: { c, t, wrong: wrongIds.map(x => +x.split('-q')[1]) } });
      store.finalize(this.a);
      s.summary = { title: 'Questions done', big: `${c}/${t}`, bigLabel: 'correct', line: s.elapsed ? `Test mode · ${Math.floor(s.elapsed / 60)}:${store.pad(s.elapsed % 60)}` : '', canResult: store.arec(id).overall != null };
    }
    s.wrongList = mode === 'toefl' ? [] : wrongIds.map(x => { const it = store.itemById(x, arts); return it ? (it.kind === 'kp' ? { tag: it.k.tag, text: it.k.fact } : { tag: 'Word', text: `${it.w.w} — ${it.w.def}` }) : null; }).filter(Boolean);
    s.finished = true; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  rgoto(e) { this.s.reviewing = true; this.s.ri = +e.currentTarget.dataset.i; this.s.open = false; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); },
  rprev() { if (this.s.ri > 0) { this.s.ri--; this.s.open = false; this.render(); } },
  rnext() { this.s.ri++; this.s.open = false; this.render(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); },
  rexit() { this.s.reviewing = false; this.render(); },
  toResult() { wx.redirectTo({ url: `/pages/result/result?id=${this.p.id}` }); },
  toRead() { wx.navigateTo({ url: `/pages/read/read?id=${this.p.id}` }); },
  back() { wx.navigateBack(); },
  copyDay() {
    const P = store.load(), rec = P.days[store.today()] || { done: 0, correct: 0 };
    util.copy([`[Daily News Review] ${P.name || '(no name)'}`, `Date: ${store.today()}`, `Streak: ${store.streak()} days`, `Today: ${rec.correct}/${rec.done} correct`].join('\n'));
  }
});
