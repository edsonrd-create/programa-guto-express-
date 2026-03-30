const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('gutoElectron', {
  isElectron: true,
});
