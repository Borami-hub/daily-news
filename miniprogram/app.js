const config = require('./config.js');
App({
  onLaunch() {
    if (config.READY) wx.cloud.init({ env: config.ENV_ID, traceUser: false });
  },
  globalData: { days: [], audio: {}, loading: null }
});
