const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
Page({
  data: { a: null, paras: [], hl: { w: true, s: true }, fs: 1, playing: -1, isPlaying: false, sheet: null, result: null, scrollTo: '' },
  onLoad(q) {
    this.id = q.id; this.t0 = Date.now();
    data.getArt(q.id).then(a => {
      this.a = a;
      const P = store.load();
      const w = util.words(a);
      this.setData({ hl: Object.assign({ w: true, s: true }, P.hl), fs: P.fs || 1,
        a: { title: a.title, dek: a.dek, topic: a.topic, color: util.topicColor(a.topic), kicker: `${a.topic} · ${store.longDay(a.date)}`, meta: `${w} words · about ${Math.max(2, Math.round(w / 150))} min · tap highlights to learn more`, sources: a.sources.map(s => s.name).join(', ') } });
      this.render();
    });
  },
  onUnload() { util.stop(); },
  render() {
    const a = this.a, hl = this.data.hl, words = a.words.map(w => w.w);
    const paras = a.paras.map((p, pi) => {
      let segs = [{ t: p }];
      if (hl.s) (a.keySentences || []).forEach((k, ki) => {
        if (k.para !== pi + 1) return;
        segs = segs.flatMap(sg => {
          if (sg.k != null || !sg.t.includes(k.text)) return [sg];
          const i = sg.t.indexOf(k.text);
          return [{ t: sg.t.slice(0, i) }, { t: k.text, k: ki }, { t: sg.t.slice(i + k.text.length) }].filter(x => x.t);
        });
      });
      segs.forEach(sg => { sg.parts = hl.w ? util.markWords(sg.t, words) : [{ t: sg.t }]; });
      return { i: pi, segs };
    });
    this.setData({ paras });
  },
  toggle(e) { const k = e.currentTarget.dataset.k, P = store.load(); const hl = Object.assign({}, this.data.hl); hl[k] = !hl[k]; P.hl = hl; store.save(); this.setData({ hl }); this.render(); },
  size() { const P = store.load(); P.fs = ((P.fs || 1) % 3) + 1; store.save(); this.setData({ fs: P.fs }); },
  playAll() {
    if (this.data.isPlaying) { util.stop(); return; }
    const ok = util.playAll(this.a.paras, i => this.setData({ playing: i, scrollTo: 'p' + i }), () => this.setData({ playing: -1, isPlaying: false }));
    if (ok) this.setData({ isPlaying: true });
  },
  tapWord(e) {
    if (!e.currentTarget.dataset.w) return;
    this.wordAt = Date.now();
    const w = this.a.words.find(x => x.w === e.currentTarget.dataset.w); if (!w) return;
    this.setData({ sheet: { kind: 'w', w } });
  },
  tapKs(e) { if (e.currentTarget.dataset.k == null || e.currentTarget.dataset.k === '' || Date.now() - (this.wordAt || 0) < 300) return; const k = this.a.keySentences[e.currentTarget.dataset.k]; this.setData({ sheet: { kind: 's', k } }); },
  close() { this.setData({ sheet: null }); },
  say(e) { util.speak(e.currentTarget.dataset.t); },
  done() {
    const secs = Math.max(1, Math.round((Date.now() - this.t0) / 1000)), w = util.words(this.a), wpm = Math.round(w / (secs / 60));
    store.markDone(this.id, 'read', { readSecs: secs, wpm });
    const tip = wpm < 120 ? 'Aim for about 150 words a minute for TOEFL reading.' : wpm > 260 ? 'Very fast. Make sure you can still answer the questions!' : 'Good TOEFL reading pace.';
    this.setData({ result: { time: `${Math.floor(secs / 60)}:${store.pad(secs % 60)}`, wpm, tip } });
  },
  toQuiz() { wx.redirectTo({ url: `/pages/quiz/quiz?mode=toefl&id=${this.id}` }); }
});
