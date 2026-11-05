#!/usr/bin/env python3
"""Generate natural-voice audio for one Daily News day file and write the audio map into it.

Usage:  python3 gen_audio.py days/2026-11-06.json
Needs:  pip install --break-system-packages kokoro-onnx soundfile ; ffmpeg on PATH.
Model files are downloaded once into ./tts-model/ from the kokoro-onnx GitHub release.
Output: audio/<date>/a{n}-p{i}.mp3 (paragraphs), a{n}-w-*.mp3 / a{n}-ex-*.mp3 (words, examples),
        a{n}-ks{i}.mp3 (key sentences); the day file gets an "audio" map {text: path}.
"""
import json, os, re, subprocess, sys, urllib.request

VOICE, MODEL_DIR = "af_heart", "tts-model"
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

    def gen(text, name, speed=0.95):
        path = f"{out}/{name}.mp3"
        if not os.path.exists(path):
            samples, sr = k.create(text, voice=VOICE, speed=speed, lang="en-us")
            sf.write("_tmp.wav", samples, sr)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "_tmp.wav", "-ac", "1", "-b:a", "48k", path], check=True)
        amap[text] = path

    for ai, a in enumerate(day["articles"], 1):
        for pi, p in enumerate(a["paras"], 1): gen(p, f"a{ai}-p{pi}")
        for w in a["words"]:
            slug = re.sub(r"[^a-z]+", "-", w["w"].lower()).strip("-")
            gen(w["w"], f"a{ai}-w-{slug}", 0.85); gen(w["ex"], f"a{ai}-ex-{slug}")
        for si, ks in enumerate(a.get("keySentences", []), 1): gen(ks["text"], f"a{ai}-ks{si}")
    day["audio"] = amap
    json.dump(day, open(day_path, "w"), ensure_ascii=False, indent=1)
    if os.path.exists("_tmp.wav"): os.remove("_tmp.wav")
    print(f"{len(amap)} audio files in {out}")

if __name__ == "__main__":
    main(sys.argv[1])
