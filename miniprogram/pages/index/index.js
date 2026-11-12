const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
const config = require('../../config.js');

Page({
  data: { state: 'loading', strip: [], day: null, cards: [], review: {}, name: '' },
  onLoad() { this.load(); },
  onShow() { if (this.data.state === 'ok') this.build(); },
  onPullDownRefresh() { this.load(true).then(() => wx.stopPullDownRefresh()); },
  load(force) {
    if (!config.READY) { this.setData({ state: 'config' }); return Promise.resolve(); }
    if (!this.data.day) this.setData({ state: 'loading' });
    return data.loadDays(force).then(() => this.build()).catch(() => this.setData({ state: 'error' }));
  },
  build() {
    const days = getApp().globalData.days, P = store.load(), t = store.today();
    if (!days.length) { this.setData({ state: 'empty' }); return; }
    const sel = this.sel && days.find(d => d.date === this.sel) ? this.sel : days[0].date;
    const day = days.find(d => d.date === sel);
    const strip = days.map(d => {
      const [y, m, dd] = d.date.split('-').map(Number);
      const done = d.articles.filter(a => P.arts[a.id] && P.arts[a.id].overall != null).length;
      return { date: d.date, wd: d.date === t ? 'Today' : store.WD[new Date(y, m - 1, dd).getDay()].slice(0, 3), num: dd, mon: store.MON[m - 1], on: d.date === sel, dots: d.articles.map((a, i) => i < done) };
    });
    const cards = day.articles.map((a, i) => {
      const r = P.arts[a.id], done = r && r.overall != null, steps = r ? Object.keys(r.done).length : 0;
      return { id: a.id, n: i + 1, topic: a.topic, title: a.title, color: util.topicColor(a.topic),
        status: done ? `${store.starStr(r.stars)} ${r.overall}%` : steps ? `In progress · ${steps}/8` : `${util.words(a)} words · 6 questions · audio` };
    });
    const arts = data.allArts(), due = store.dueIds(arts).length, enrolled = Object.keys(P.srs).length, rec = P.days[t], checked = !!(rec && rec.checked);
    const review = { enrolled, due, checked, streak: store.streak(), cal: store.calendar(), dayLabel: `${store.MON[+t.slice(5, 7) - 1]} ${+t.slice(8)}`,
      line: `Due ${due} · Learned ${enrolled}${rec && rec.done ? ` · Today ${rec.correct}/${rec.done}` : ''}`, cap: Math.min(due, store.CAP) };
    this.setData({ state: 'ok', strip, day: { date: day.date, long: store.longDay(day.date) + (day.date === t ? ' · Today' : ''), headline: day.headline || 'Today in the news', teaser: day.teaser || '' }, cards, review, name: P.name });
  },
  pickDay(e) { this.sel = e.currentTarget.dataset.d; this.build(); },
  openArt(e) { wx.navigateTo({ url: '/pages/article/article?id=' + e.currentTarget.dataset.id }); },
  onName(e) { const P = store.load(); P.name = e.detail.value.trim(); store.save(); },
  review(e) { wx.navigateTo({ url: '/pages/quiz/quiz?mode=review' + (e.currentTarget.dataset.extra ? '&extra=1' : '') }); },
  checkin() { store.checkIn(); wx.showToast({ title: 'Checked in', icon: 'none' }); this.build(); },
  retry() { this.load(true); }
});
