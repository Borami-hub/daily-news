# 每日精读 · daily content

Content for the 每日精读 WeChat mini program (daily English reading for students).

```
content/days/index.json         list of published dates
content/days/<YYYY-MM-DD>.json  one day: 3 articles, words, questions, mind map, summary, speaking, writing
content/audio/<YYYY-MM-DD>/     mp3 narration referenced by the day file
kit/                            PIPELINE.md (day file format), validate.js, gen_audio.py
scripts/upload-to-wechat.mjs    uploads content/ to WeChat Cloud Development storage
miniprogram/                    the WeChat mini program (students' app); see miniprogram/README.md
```

**Daily flow.** The morning scheduled task builds the day file from the teacher's three picked
stories, validates it (`node kit/validate.js content/days/<date>.json`), generates audio, adds the
date to `content/days/index.json`, and pushes to `main`. The GitHub Action then uploads the new
files to WeChat Cloud, keeping the same paths without the `content/` prefix.

**Secrets** (Settings → Secrets and variables → Actions): `WX_APPID`, `WX_APPSECRET`, `TCB_ENV_ID`.
Until they are set, the Action skips the upload. After adding them, run the Action once by hand
(Actions → Upload content to WeChat Cloud → Run workflow, tick "all") to upload the back catalogue.
