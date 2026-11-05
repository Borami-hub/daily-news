#!/usr/bin/env node
/* Check a Daily News KET (A2) day file before publishing.  Usage: node kit/a2/validate.js content/a2/days/2026-11-06.json
   Exits with code 1 and lists every problem if anything is wrong. */
const fs = require('fs');
const day = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const errs = [], warn = [];
const need = (cond, msg) => { if (!cond) errs.push(msg); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TYPES = ['Detail', 'Main idea', 'Word in context', 'Who / what does it mean?', 'Right / Wrong / Doesn\'t say', 'Writer\'s purpose', 'Feelings', 'What does the message say?'];
const GENRES = ['Article', 'Story', 'Email', 'Interview', 'Three people', 'Notices & messages', 'Blog post'];
need(/^\d{4}-\d{2}-\d{2}$/.test(day.date || ''), 'date must be YYYY-MM-DD');
need(day.headline && day.headline.length <= 70, 'headline missing or too long');
need(day.teaser, 'teaser missing');
need(Array.isArray(day.articles) && day.articles.length === 3, 'need exactly 3 articles');
const letters = [0, 0, 0];
(day.articles || []).forEach((a, ai) => {
  const tag = `article ${ai + 1} (${a.title})`;
  ['id', 'topic', 'title', 'dek', 'paras', 'words', 'keySentences', 'questions', 'grammar', 'mindmap', 'summary', 'kps', 'speak', 'write'].forEach(k => need(a[k], `${tag}: missing ${k}`));
  need(Array.isArray(a.sources), `${tag}: sources must be an array ([] for invented texts)`);
  need(GENRES.includes(a.genre), `${tag}: genre must be one of ${GENRES.join(' | ')}`);
  if (!a.paras) return;
  const text = a.paras.join(' '), wc = text.split(/\s+/).length;
  if (wc < 230 || wc > 370) warn.push(`${tag}: ${wc} words (target 250–350)`);
  need(a.paras.length >= 4 && a.paras.length <= 8, `${tag}: need 4–8 paragraphs`);
  const sents = text.split(/(?<=[.!?])\s+/), lens = sents.map(s => s.split(/\s+/).length);
  const avg = lens.reduce((x, y) => x + y, 0) / lens.length;
  if (avg > 14) warn.push(`${tag}: average sentence ${avg.toFixed(1)} words (A2 target ≤ 14)`);
  sents.forEach((s, i) => { if (lens[i] > 25) warn.push(`${tag}: long sentence (${lens[i]} words): "${s.slice(0, 60)}…"`); });
  need(a.id.startsWith('k' + day.date.replace(/-/g, '')), `${tag}: id should start with k${day.date.replace(/-/g, '')}`);
  // words
  need(a.words.length >= 8 && a.words.length <= 10, `${tag}: need 8–10 words`);
  a.words.forEach(w => {
    ['w', 'level', 'pos', 'ipa', 'syl', 'def', 'ex'].forEach(k => need(w[k], `${tag}: word ${w.w} missing ${k}`));
    need(['A2 word', 'Topic word'].includes(w.level), `${tag}: word ${w.w} level must be "A2 word" or "Topic word"`);
    need(new RegExp('\\b' + esc(w.w) + '(s|es|d|ed|ing)?\\b', 'i').test(text), `${tag}: word "${w.w}" does not appear in the story`);
    need(new RegExp('\\b' + esc(w.w) + '\\b', 'i').test(w.ex), `${tag}: example for "${w.w}" must contain the exact word`);
    if (w.def && w.def.split(/\s+/).length > 14) warn.push(`${tag}: definition of "${w.w}" is long for A2`);
  });
  // key sentences
  need(a.keySentences.length >= 3 && a.keySentences.length <= 5, `${tag}: need 3–5 key sentences`);
  a.keySentences.forEach(k => need(a.paras[k.para - 1] && a.paras[k.para - 1].includes(k.text), `${tag}: key sentence not found verbatim in paragraph ${k.para}: "${(k.text || '').slice(0, 50)}"`));
  // questions
  need(a.questions.length === 6, `${tag}: need exactly 6 questions`);
  const types = new Set(); let rwd = 0;
  a.questions.forEach((q, qi) => {
    const qt = `${tag} Q${qi + 1}`;
    need(TYPES.includes(q.type), `${qt}: type must be one of ${TYPES.join(' | ')}`); types.add(q.type);
    need(q.opts && q.opts.length === 3, `${qt}: need 3 options`);
    need(q.a >= 0 && q.a <= 2, `${qt}: answer index must be 0–2`); letters[q.a]++;
    need(q.why && q.optWhy && q.optWhy.length === 3, `${qt}: need why + 3 optWhy`);
    if (q.optWhy) need(/^Correct\./.test(q.optWhy[q.a] || ''), `${qt}: optWhy for the answer must start with "Correct."`);
    if (q.type === 'Right / Wrong / Doesn\'t say') { rwd++; need(JSON.stringify(q.opts) === JSON.stringify(['Right', 'Wrong', 'Doesn\'t say']), `${qt}: Right/Wrong/Doesn't say options must be exactly those three`); }
    need(typeof q.para === 'number' && q.para >= 0 && q.para <= a.paras.length, `${qt}: para must be 0 (whole) or a paragraph number`);
    if (q.para) { need(q.evidence, `${qt}: evidence missing`); if (q.evidence) need(a.paras[q.para - 1].includes(q.evidence), `${qt}: evidence not found verbatim in paragraph ${q.para}`); }
  });
  if (types.size < 4) warn.push(`${tag}: only ${types.size} question types (use at least 4)`);
  if (rwd < 1 || rwd > 2) warn.push(`${tag}: use 1–2 Right / Wrong / Doesn't say questions (found ${rwd})`);
  // grammar
  const g = a.grammar || {};
  need(g.point && g.rule, `${tag}: grammar needs point and rule`);
  need(g.examples && g.examples.length >= 2 && g.examples.length <= 4, `${tag}: grammar needs 2–4 examples`);
  (g.examples || []).forEach(x => {
    need(a.paras[x.para - 1] && a.paras[x.para - 1].includes(x.text), `${tag}: grammar example not verbatim in paragraph ${x.para}: "${(x.text || '').slice(0, 50)}"`);
    need(x.mark && x.text && x.text.toLowerCase().includes(x.mark.toLowerCase()), `${tag}: grammar example mark "${x.mark}" not inside its sentence`);
  });
  need(g.items && g.items.length === 6, `${tag}: grammar needs exactly 6 items`);
  const gi = g.items || [];
  need(gi.filter(x => x.type === 'mc').length >= 2 && gi.filter(x => x.type === 'fill').length >= 2, `${tag}: grammar needs at least 2 mc and 2 fill items`);
  gi.forEach((x, i) => {
    const t = `${tag} grammar item ${i + 1}`;
    need(x.q && x.q.includes('___'), `${t}: q must contain ___`);
    need(x.why, `${t}: why missing`);
    if (x.type === 'mc') { need(x.opts && x.opts.length === 3 && x.a >= 0 && x.a <= 2, `${t}: mc needs 3 opts and a 0–2`); }
    else need(x.type === 'fill' && typeof x.a === 'string' && x.a && x.hint, `${t}: fill needs hint and a string answer`);
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
  need(a.kps.length >= 4 && a.kps.length <= 5, `${tag}: need 4–5 key points`);
  a.kps.forEach(k => need(k.id && k.fact && k.q && k.opts && k.a != null && k.a < k.opts.length, `${tag}: key point ${k.id} incomplete`));
  (mm.branches || []).forEach(b => (b.kps || []).forEach(id => need(a.kps.some(k => k.id === id), `${tag}: branch ${b.title} links unknown key point ${id}`)));
  // speak, write
  need(a.speak && a.speak.sec >= 30 && a.speak.sec <= 45, `${tag}: speak.sec must be 30–45`);
  need(a.write && a.write.steps && a.write.steps.length === 3 && a.write.minWords >= 25 && a.write.minWords <= 35, `${tag}: write needs 3 steps and minWords 25–35`);
});
if (Math.max(...letters) - Math.min(...letters) > 2) warn.push(`answer letters unbalanced: A${letters[0]} B${letters[1]} C${letters[2]}`);
if (/[一-鿿]/.test(JSON.stringify(day.articles))) warn.push('Chinese characters found in article content (app is English-only)');
warn.forEach(w => console.log('WARN', w));
if (errs.length) { errs.forEach(e => console.log('ERROR', e)); process.exit(1); }
console.log(`OK: ${day.date}, ${day.articles.length} articles`);
