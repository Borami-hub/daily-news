#!/usr/bin/env node
/* Check a Daily News day file before publishing.  Usage: node validate.js days/2026-11-06.json
   Exits with code 1 and lists every problem if anything is wrong. */
const fs = require('fs');
const day = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const errs = [], warn = [];
const need = (cond, msg) => { if (!cond) errs.push(msg); };
need(/^\d{4}-\d{2}-\d{2}$/.test(day.date || ''), 'date must be YYYY-MM-DD');
need(day.headline && day.headline.length < 90, 'headline missing or too long');
need(day.teaser, 'teaser missing');
need(Array.isArray(day.articles) && day.articles.length === 3, 'need exactly 3 articles');
const letters = { 0: 0, 1: 0, 2: 0, 3: 0 };
(day.articles || []).forEach((a, ai) => {
  const tag = `article ${ai + 1} (${a.title})`;
  ['id', 'topic', 'title', 'dek', 'paras', 'words', 'keySentences', 'questions', 'mindmap', 'summary', 'kps', 'speak', 'write', 'sources'].forEach(k => need(a[k], `${tag}: missing ${k}`));
  if (!a.paras) return;
  const text = a.paras.join(' '), wc = text.split(/\s+/).length;
  if (wc < 550 || wc > 850) warn.push(`${tag}: ${wc} words (target 600–800)`);
  need(a.id.startsWith('n' + day.date.replace(/-/g, '')), `${tag}: id should start with n${day.date.replace(/-/g, '')}`);
  // words
  need(a.words.length >= 8 && a.words.length <= 10, `${tag}: need 8–10 words`);
  a.words.forEach(w => {
    ['w', 'level', 'pos', 'ipa', 'syl', 'def', 'ex'].forEach(k => need(w[k], `${tag}: word ${w.w} missing ${k}`));
    need(['Academic', 'Topic term'].includes(w.level), `${tag}: word ${w.w} level must be Academic or Topic term`);
    // w may be the base form of a word in the passage: plural, -s, -ed, -ing, -er, -est, -ly forms all count
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const base = w.w.toLowerCase(), stems = [base];
    if (/e$/.test(base)) stems.push(base.slice(0, -1));                        // plunge → plung(ed/ing)
    if (/[^aeiou]y$/.test(base)) stems.push(base.slice(0, -1) + 'i');          // amplify → amplifi(ed/es)
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) stems.push(base + base.slice(-1)); // stop → stopp(ed/ing)
    const re = new RegExp('\\b(' + stems.map(esc).join('|') + ')(s|es|d|ed|ing|er|ers|est|ly|ies)?\\b', 'i');
    need(re.test(text), `${tag}: word "${w.w}" (or a form of it) does not appear in the article`);
    need(new RegExp('\\b' + w.w + '\\b', 'i').test(w.ex), `${tag}: example for "${w.w}" must contain the exact word`);
    need(!/[一-鿿]/.test(JSON.stringify(w)), `${tag}: word ${w.w} contains Chinese (app is English-only)`);
  });
  // key sentences
  need(a.keySentences.length >= 4 && a.keySentences.length <= 6, `${tag}: need 4–6 key sentences`);
  a.keySentences.forEach(k => need(a.paras[k.para - 1] && a.paras[k.para - 1].includes(k.text), `${tag}: key sentence not found verbatim in paragraph ${k.para}: "${(k.text || '').slice(0, 50)}"`));
  // questions
  need(a.questions.length === 6, `${tag}: need exactly 6 questions`);
  a.questions.forEach((q, qi) => {
    const qt = `${tag} Q${qi + 1}`;
    need(q.opts && q.opts.length === 4, `${qt}: need 4 options`);
    need(q.a >= 0 && q.a <= 3, `${qt}: answer index must be 0–3`); letters[q.a]++;
    need(q.why && q.optWhy && q.optWhy.length === 4, `${qt}: need why + 4 optWhy`);
    need(typeof q.para === 'number' && q.para >= 0 && q.para <= a.paras.length, `${qt}: para must be 0 (whole) or a paragraph number`);
    if (q.para && q.evidence) need(a.paras[q.para - 1].includes(q.evidence), `${qt}: evidence not found verbatim in paragraph ${q.para}`);
    if (q.para) need(q.evidence, `${qt}: evidence missing`);
    (q.ctx || []).forEach(c => need(a.paras[c.para - 1] && a.paras[c.para - 1].includes(c.text) && (!c.hl || c.text.includes(c.hl)), `${qt}: ctx sentence not verbatim in paragraph ${c.para} (or hl not inside it): "${(c.text || '').slice(0, 50)}"`));
    if (q.steps) need(q.steps.length === 3 && q.steps.every(x => x.t && x.x), `${qt}: steps must be 3 items {t, x}`);
    if (!q.ctx || !q.steps) warn.push(`${qt}: missing ctx/steps (detailed explanation)`);
  });
  // mind map
  const mm = a.mindmap || {};
  need(mm.branches && mm.branches.length === 4, `${tag}: mind map needs 4 branches`);
  need(mm.distractors && mm.distractors.length === 2, `${tag}: mind map needs 2 distractors`);
  (mm.branches || []).forEach(b => need(b.blanks && b.blanks.length >= 1 && b.blanks.length <= 2, `${tag}: branch ${b.title} needs 1–2 blanks`));
  const allBlanks = (mm.branches || []).flatMap(b => b.blanks || []);
  need(new Set(allBlanks.concat(mm.distractors || [])).size === allBlanks.length + (mm.distractors || []).length, `${tag}: mind map phrases must be unique`);
  // summary
  const sm = a.summary || {};
  need(sm.intro && sm.model, `${tag}: summary needs intro and model`);
  need(sm.options && sm.options.length === 6 && sm.options.filter(o => o.ok).length === 3, `${tag}: summary needs 6 options, 3 correct`);
  (sm.options || []).forEach(o => {
    need(['main', 'detail', 'not', 'contra'].includes(o.type), `${tag}: summary option type invalid`);
    need((o.type === 'main') === !!o.ok, `${tag}: summary option ok/type mismatch`);
    if (o.evidence) need(a.paras[o.para - 1] && a.paras[o.para - 1].includes(o.evidence), `${tag}: summary evidence not found in paragraph ${o.para}`);
  });
  // key points
  need(a.kps.length >= 4 && a.kps.length <= 6, `${tag}: need 4–6 key points`);
  a.kps.forEach(k => need(k.id && k.fact && k.q && k.opts && k.a != null && k.a < k.opts.length, `${tag}: key point ${k.id} incomplete`));
  (mm.branches || []).forEach(b => (b.kps || []).forEach(id => need(a.kps.some(k => k.id === id), `${tag}: branch ${b.title} links unknown key point ${id}`)));
});
// use of english (C1 Advanced)
if (!day.uoe) warn.push('uoe (Use of English) missing');
else {
  const parts = day.uoe.parts || [];
  need(parts.length === 4, 'uoe: need 4 parts');
  const want = { mc: [8, 1], open: [8, 9], wf: [8, 17], kwt: [6, 25] }, ul = [0, 0, 0, 0];
  parts.forEach(p => {
    const w = want[p.type]; need(w, `uoe part ${p.part}: bad type ${p.type}`); if (!w) return;
    need(p.title && p.task && p.items && p.items.length === w[0], `uoe part ${p.part}: need title, task and ${w[0]} items`);
    (p.items || []).forEach((it, i) => {
      need(it.n === w[1] + i, `uoe part ${p.part}: item numbers should run ${w[1]}…`);
      need(it.why && it.focus, `uoe item ${it.n}: missing why/focus`);
      if (p.type === 'mc') { need(it.opts && it.opts.length === 4 && it.a >= 0 && it.a <= 3, `uoe item ${it.n}: need 4 opts and a`); ul[it.a]++; }
      else need(Array.isArray(it.ans) && it.ans.length, `uoe item ${it.n}: ans must be a non-empty array`);
      if (p.type === 'wf') need(it.stem, `uoe item ${it.n}: stem missing`);
      if (p.type === 'kwt') { need(it.s1 && it.key && it.pre != null && it.post != null, `uoe item ${it.n}: need s1, key, pre, post`);
        (it.ans || []).forEach(a => { const n = a.trim().split(/\s+/).length; need(n >= 3 && n <= 6 && new RegExp('\\b' + it.key + '\\b', 'i').test(a), `uoe item ${it.n}: answer "${a}" must be 3–6 words incl. ${it.key}`); }); }
      if (p.type !== 'kwt') need((p.text || '').includes(`{${it.n}}`), `uoe item ${it.n}: gap {${it.n}} not in text`);
    });
  });
  if (Math.max(...ul) - Math.min(...ul) > 2) warn.push(`uoe part 1 answer letters unbalanced: A${ul[0]} B${ul[1]} C${ul[2]} D${ul[3]}`);
  if (/[一-鿿]/.test(JSON.stringify(day.uoe))) warn.push('Chinese characters found in uoe (app is English-only)');
}
const lv = Object.values(letters);
if (Math.max(...lv) - Math.min(...lv) > 3) warn.push(`answer letters unbalanced: A${lv[0]} B${lv[1]} C${lv[2]} D${lv[3]}`);
if (/[一-鿿]/.test(JSON.stringify(day.articles))) warn.push('Chinese characters found in article content (app is English-only)');
warn.forEach(w => console.log('WARN', w));
if (errs.length) { errs.forEach(e => console.log('ERROR', e)); process.exit(1); }
console.log(`OK: ${day.date}, ${day.articles.length} articles`);
