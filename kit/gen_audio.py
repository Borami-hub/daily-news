#!/usr/bin/env python3
"""Generate natural-voice audio for one Daily News day file and write the audio map into it.

Usage:  python3 gen_audio.py days/2026-11-06.json
Needs:  pip install --break-system-packages kokoro-onnx soundfile ; ffmpeg on PATH.
Model files are downloaded once into ./tts-model/ from the kokoro-onnx GitHub release.
Output: audio/<date>/a{n}-p{i}.mp3 (paragraphs), a{n}-w-*.mp3 / a{n}-ex-*.mp3 (words, examples),
        a{n}-ks{i}.mp3 (key sentences); the day file gets an "audio" map {text: path}.
        Each article's paragraphs and key sentences are read by a rotating narrator (see POOL); words
        and example sentences always use WORD_VOICE; delete audio/<date>/ to regenerate.
"""
import json, os, re, subprocess, sys, urllib.request

MODEL_DIR = "tts-model"
# Narrators rotate so the app never sounds the same: each of the day's three articles gets a different
# voice, and the starting voice moves on every day. The pool alternates female/male and US/UK accents
# (TOEFL listening uses several accents too). Best-sounding Kokoro voices only.
POOL = ["af_heart", "am_michael", "bf_emma", "am_fenrir", "af_bella", "bm_george",
        "af_nicole", "am_puck", "bf_isabella", "bm_fable", "af_sarah", "am_echo"]

# Words and their example sentences always use one very clear US voice, so pronunciation is consistent.
WORD_VOICE = "af_heart"

def voice_for(date, article_no):
    import datetime
    day_no = datetime.date.fromisoformat(date).toordinal()
    return POOL[(day_no * 3 + article_no - 1) % len(POOL)]
REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"

def fetch(name):
    os.makedirs(MODEL_DIR, exist_ok=True)
    path = os.path.join(MODEL_DIR, name)
    if not os.path.exists(path) or os.path.getsize(path) < 1_000_000:
        print("downloading", name); urllib.request.urlretrieve(REL + name, path)
    return path

def main(day_path):
    import soundfile as sf
    from kokoro_onnx import Kokoro
    k = Kokoro(fetch("kokoro-v1.0.onnx"), fetch("voices-v1.0.bin"))
    day = json.load(open(day_path))
    date = day["date"]; out = f"audio/{date}"; os.makedirs(out, exist_ok=True)
    amap = {}

    voice = POOL[0]
    def gen(text, name, speed=0.95, v=None):
        v = v or voice
        path = f"{out}/{name}.mp3"
        if not os.path.exists(path):
            lang = "en-gb" if v.startswith("b") else "en-us"
            samples, sr = k.create(text, voice=v, speed=speed, lang=lang)
            sf.write("_tmp.wav", samples, sr)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "_tmp.wav", "-ac", "1", "-b:a", "48k", path], check=True)
        amap[text] = path

    for ai, a in enumerate(day["articles"], 1):
        voice = voice_for(date, ai); a["voice"] = voice
        print(f"article {ai}: {voice}")
        for pi, p in enumerate(a["paras"], 1): gen(p, f"a{ai}-p{pi}")
        for w in a["words"]:
            slug = re.sub(r"[^a-z]+", "-", w["w"].lower()).strip("-")
            gen(w["w"], f"a{ai}-w-{slug}", 0.85, WORD_VOICE); gen(w["ex"], f"a{ai}-ex-{slug}", 0.9, WORD_VOICE)
        for si, ks in enumerate(a.get("keySentences", []), 1): gen(ks["text"], f"a{ai}-ks{si}")
    day["audio"] = amap
    json.dump(day, open(day_path, "w"), ensure_ascii=False, indent=1)
    if os.path.exists("_tmp.wav"): os.remove("_tmp.wav")
    print(f"{len(amap)} audio files in {out}")

if __name__ == "__main__":
    main(sys.argv[1])
