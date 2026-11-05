// Uploads files under content/ to WeChat Cloud Development storage, keeping the same paths
// (content/days/2026-11-05.json -> days/2026-11-05.json). Node 20+, no dependencies.
// Usage: node scripts/upload-to-wechat.mjs [file ...]   (no args = upload everything in content/)
import fs from 'node:fs';
import path from 'node:path';

const { WX_APPID, WX_APPSECRET, TCB_ENV_ID } = process.env;
if (!WX_APPID || !WX_APPSECRET || !TCB_ENV_ID) {
  console.log('Secrets WX_APPID / WX_APPSECRET / TCB_ENV_ID are not set yet; skipping upload.');
  process.exit(0);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
let files = process.argv.slice(2).filter(f => f.startsWith('content/') && fs.existsSync(f));
if (!process.argv.slice(2).length) files = walk('content');
// index.json last, so the app never lists a day whose files are not up yet
files.sort((a, b) => (a.endsWith('days/index.json') ? 1 : 0) - (b.endsWith('days/index.json') ? 1 : 0));
if (!files.length) { console.log('Nothing to upload.'); process.exit(0); }

async function token() {
  const r = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid: WX_APPID, secret: WX_APPSECRET }),
  }).then(r => r.json());
  if (!r.access_token) throw new Error('Could not get access_token: ' + JSON.stringify(r));
  return r.access_token;
}

const TYPES = { '.json': 'application/json', '.mp3': 'audio/mpeg' };
async function upload(at, file) {
  const cloudPath = path.relative('content', file).split(path.sep).join('/');
  const meta = await fetch(`https://api.weixin.qq.com/tcb/uploadfile?access_token=${at}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ env: TCB_ENV_ID, path: cloudPath }),
  }).then(r => r.json());
  if (meta.errcode) throw new Error(`${cloudPath}: ${JSON.stringify(meta)}`);
  const form = new FormData();
  form.append('key', cloudPath);
  form.append('Signature', meta.authorization);
  form.append('x-cos-security-token', meta.token);
  form.append('x-cos-meta-fileid', meta.cos_file_id);
  form.append('file', new Blob([fs.readFileSync(file)], { type: TYPES[path.extname(file)] || 'application/octet-stream' }));
  const res = await fetch(meta.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`${cloudPath}: HTTP ${res.status} ${await res.text()}`);
  return cloudPath;
}

const at = await token();
let ok = 0;
for (let i = 0; i < files.length; i += 6) {
  const batch = files.slice(i, i + 6);
  const done = await Promise.all(batch.map(f => upload(at, f)));
  ok += done.length;
  done.forEach(p => console.log('uploaded', p));
}
console.log(`Done: ${ok} file(s) uploaded to ${TCB_ENV_ID}.`);
