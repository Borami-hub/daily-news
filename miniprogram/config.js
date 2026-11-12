// 只需要填这一行：云开发控制台 → 存储 → 打开 days 文件夹 → 点 index.json → 复制 "File ID"，粘到引号里。
// 形如 cloud://cloud1-8gxxxxxx.636c-cloud1-8gxxxxxx-1300000000/days/index.json
const INDEX_FILE_ID = '';

const m = INDEX_FILE_ID.match(/^cloud:\/\/([^.]+)\.([^/]+)\//);
module.exports = {
  ENV_ID: m ? m[1] : '',
  PREFIX: m ? `cloud://${m[1]}.${m[2]}/` : '',
  READY: !!m
};
