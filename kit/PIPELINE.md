# Daily News app: how to publish a day

The student app (preview page) shows the three stories the teacher picked that morning. It reads
`days/index.json` (list of dates) and `days/<YYYY-MM-DD>.json` (one file per day) at runtime, plus
audio from `audio/<YYYY-MM-DD>/`. Publishing a day = adding those files to the artifact. The page
itself (index.html) never needs editing.

Artifact URL: https://claude.ai/artifact/Sr7MCdHHFPdmoHURH3qtZV
Example day file: `days/2026-11-05.json` (read it to see the exact shape).

## Steps

1. Read the artifact (Artifact tool, action "read", the URL above). Then read these published files
   with `path`/`paths`: `kit/PIPELINE.md`, `kit/gen_audio.py`, `kit/validate.js`, `days/index.json`,
   `days/2026-11-05.json`. Work in a folder `site/` that mirrors the artifact: `site/kit/…`, `site/days/…`.
2. Write `site/days/<date>.json` for today's three stories (format below). Use exactly the same
   three passages as today's PDF, paragraph for paragraph (no [1] markers, no headings inside paras).
   Reuse the PDF's 6 reading questions and answer key for each passage.
3. `cd site && node kit/validate.js days/<date>.json` — fix every ERROR and rerun until it says OK.
   Treat WARN lines seriously (fix letter balance, word counts) unless there is a good reason.
4. `cd site && pip install --break-system-packages -q kokoro-onnx soundfile && python3 kit/gen_audio.py days/<date>.json`
   (downloads ~350 MB of voice model from GitHub once, then makes ~90 mp3 files; with 600–800-word passages this takes 10–20 minutes, so run it in the background and wait).
5. Add the date to `site/days/index.json` → `{"days": [..., "<date>"], "updated": "<date>"}` (keep older dates).
6. Publish: Artifact tool, action "publish", `url` = the URL above, `file_path` = the saved page file the
   read step reported (index.html, republished unchanged), `root` = the `site` folder, and `files` =
   `days/<date>.json`, `days/index.json`, and every `audio/<date>/*.mp3` (files left out are kept;
   one publish takes at most 255 files). Do not pass `icon` or `capabilities`.
7. Mirror the day to the mini-program repo **Borami-hub/daily-news** (GitHub, private). Attach it with the
   add_repo tool (owner `Borami-hub`, repo `daily-news`, access `push`), clone it, then copy
   `site/days/<date>.json` → `content/days/<date>.json`, `site/days/index.json` → `content/days/index.json`,
   and `site/audio/<date>/` → `content/audio/<date>/`. Run `node kit/validate.js content/days/<date>.json`
   from the repo root, commit ("Add <date>") and push to `main`. A GitHub Action uploads the files to WeChat
   Cloud. If the repo cannot be attached or the push fails, skip this step and mention it in the reply.
8. Open nothing; tell the teacher in one Chinese sentence that the app now has today's stories.

## Day file format (all student-facing text in English, no Chinese)

```
{
  "date": "YYYY-MM-DD",
  "headline": "≤ 80 chars, a fresh title joining today's three topics (never 'Today's 3 stories')",
  "teaser": "one sentence of 2–3 hook questions",
  "articles": [ ARTICLE, ARTICLE, ARTICLE ]
}
```

ARTICLE:

| field | content |
|---|---|
| `id` | `n<YYYYMMDD>-<1..3>` |
| `topic` | one of Space, Environment, Health, Technology, Science, Society, Culture, Economy, Nature, Animals, Geography. |
| `title`, `dek` | the PDF title; a one-sentence standfirst that frames the critical-thinking angle |
| `sources` | `[{ "name": "Outlet, date", "url": "https://…" }]` |
| `paras` | array of paragraph strings = the PDF passage (600–800 words) |
| `words` | 8–10 items `{ w, level: "Academic"|"Topic term", pos, ipa, syl: [syllables], def, ex }`. About half academic (AWL / C1 words useful across topics), half topic terms. Choose the most useful words for the student. `w` is the dictionary (base) form; the passage may use any form of it (plural, -s, -ed, -ing, etc.), e.g. `plunge` for "plunged". `ex` is a NEW example sentence (not from the passage) that contains `w` exactly. English definitions only. |
| `keySentences` | 4–6 items `{ para, text, kind, note }`, one per main paragraph. `text` copied verbatim from that paragraph. `kind`: Main idea / Topic sentence / Cause → effect / Critical thinking / Author's view / Hedging / Key details / Interpretation. `note`: 1–2 sentences on why it matters for TOEFL reading. |
| `questions` | the 6 PDF questions: `{ type, para (0 = whole passage), q, opts[4], a (0–3), why, evidence, optWhy[4], highlight? }`. For sentence-simplification questions add `highlight` = the tested sentence, verbatim. `evidence` = verbatim phrase from that paragraph (empty only if para = 0). `optWhy[i]` explains each option: for the answer start with "Correct."; for distractors name the trap (not mentioned / detail swapped / cause reversed / too extreme / true but not the question / another meaning of the word). Keep the PDF's quality rules: no option can be ruled in or out without reading. Balance answer letters across the day's 18 questions. |
| `kps` | 4–6 key points `{ id: "<article id>-k<n>", tag, fact, q, opts, a }`. `fact` = one sentence to remember; `q`/`opts`/`a` = a short question that tests it (2–4 options). Used in the daily review. |
| `mindmap` | `{ center (≤ 4 words), question, branches: [4 × { title (≤ 3 words), paras: "1–2", blanks: [1–2 short phrases ≤ 7 words], kps: [linked kp ids] }], distractors: [2 phrases: one not in the article, one contradicting it] }` |
| `summary` | TOEFL prose summary: `{ intro, model, options: [6 × { t, ok, why, type: "main"|"detail"|"not"|"contra", para, evidence }] }` — 3 main ideas (ok: true), 1 minor detail, 1 not mentioned (para 0, evidence ""), 1 contradiction. `model` = 2-sentence model summary (≤ 50 words) using transitions (however, while, because, so). Evidence verbatim. |
| `speak` | `{ p, hint, sec: 45–60 }` — TOEFL-style opinion question tied to the story |
| `write` | `{ p, steps: [4 short planning steps], minWords: 120 }` — can mirror the PDF's academic discussion task |

The audio map (`"audio": { text: path }`) is added by `gen_audio.py`; do not write it by hand.

Voices (teacher's rule): words and their example sentences always use `af_heart`, the top-rated US voice. Article reading rotates through the higher-rated voices in `POOL` (gen_audio.py). Never use `af_nicole` or `am_puck`.
