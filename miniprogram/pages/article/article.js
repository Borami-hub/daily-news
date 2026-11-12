const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
const MODS = [
  ['words', 'Words', 'Academic words + topic terms'],
  ['read', 'Read', 'Highlighted words & key sentences · listen'],
  ['toefl', 'Questions', '6 TOEFL-style questions'],
  ['mindmap', 'Mind map', 'Build the article map · key points'],
  ['summary', 'Summary', 'TOEFL prose summary · pick 3 of 6'],
  ['speak', 'Speak', 'Give your opinion · record'],
  ['write', 'Write', 'Think critically · write'],
  ['results', 'Results', 'See where the gaps are']
];
Page({
  data: { a: null, mods: [], n: 0 },
  onLoad(q) { this.id = q.id; },
  onShow() {
    data.getArt(this.id).then(a => {
      if (!a) return;
      wx.setNavigationBarTitle({ title: a.topic });
      const r = store.arec(a.id);
      const mods = MODS.map((m, i) => ({ key: m[0], no: i + 1, title: m[1], sub: m[2], done: m[0] === 'results' ? r.overall != null : !!r.done[m[0]] }));
      const next = mods.find(m => !m.done);
      mods.forEach(m => { m.next = !!next && m.key === next.key; });
      const w = util.words(a);
      this.setData({ a: { title: a.title, topic: a.topic, color: util.topicColor(a.topic), meta: `${store.longDay(a.date)} · ${w} words · ~${Math.round(w / 180)} min read`, sources: a.sources }, mods, n: mods.filter(m => m.done).length });
    });
  },
  open(e) {
    const k = e.currentTarget.dataset.key, id = this.id;
    if (k === 'results' && store.arec(id).overall == null) return wx.showToast({ title: 'Finish Questions and Summary first', icon: 'none' });
    const url = k === 'toefl' ? `/pages/quiz/quiz?mode=toefl&id=${id}` : k === 'results' ? `/pages/result/result?id=${id}` : `/pages/${k}/${k}?id=${id}`;
    wx.navigateTo({ url });
  },
  copySrc(e) { util.copy(e.currentTarget.dataset.url); }
});
