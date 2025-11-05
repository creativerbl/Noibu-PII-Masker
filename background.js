chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ entries: [], active: false, mode: 'mask', urls: [] });
});
