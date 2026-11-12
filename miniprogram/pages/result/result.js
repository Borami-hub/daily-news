const data = require('../../utils/data.js');
const store = require('../../utils/store.js');
const util = require('../../utils/util.js');
Page({
  data: { r: null },
  onLoad(q) { this.id = q.id; },
  onShow() {
    data.getArt(this.id).then(a => {
      this.a = a; const r = store.arec(a.id), P = store.load();
      if (r.overall == null) return this.setData({ none: true });
      const tq = r.toefl, sm = r.summary, wrongTypes = [...new Set(tq.wrong.map(i => a.questions[i].type))];
      this.tips = [
        `Overall ${r.overall}% · ${r.stars}★ — ${r.overall >= 80 ? 'Strong reading of this story' : r.overall >= 60 ? 'Good, with a few gaps' : 'Reread the article slowly, then retry the questions'}`,
        `Questions ${tq.c}/${tq.t} — ${wrongTypes.length ? 'Practice these question types: ' + wrongTypes.join(', ') : 'No mistakes'}`,
        `Summary ${sm.pts}/2 points — ${sm.pts === 2 ? 'You can tell main ideas from details' : 'Practice separating main ideas from minor details'}`,
        `Speaking ${P.rec[`${a.id}-speak`] ? 'recorded' : 'not recorded'} · Writing ${r.writingWords ? r.writingWords + ' words' : 'not submitted'}`
      ];
      this.setData({ r: { at: r.at, title: a.title, overall: r.overall, stars: store.starStr(r.stars), q: `${tq.c}/${tq.t}`, s: `${sm.pts}/2`, m: r.mindmap ? `${r.mindmap.c}/${r.mindmap.t}` : '—' }, tips: this.tips });
    });
  },
  retake() { wx.navigateTo({ url: `/pages/quiz/quiz?mode=toefl&id=${this.id}` }); },
  copy() { const P = store.load(), r = store.arec(this.id); util.copy([`[Daily News] ${P.name || '(no name)'}`, `Story: ${this.a.date} ${this.a.title}`, `Time: ${r.at}`, ...this.tips].join('\n')); }
});
