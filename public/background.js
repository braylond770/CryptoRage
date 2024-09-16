/// <reference types="chrome"/>

chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.type === 'WALLET_CONNECTED' && request.address) {
      chrome.storage.local.set({ connectedAddress: request.address }, () => {
        console.log('Address saved:', request.address);
        sendResponse({ success: true });
      });
      return true; // Indicates we wish to send a response asynchronously
    }
  }
);

// Check localStorage periodically
setInterval(() => {
  if (typeof localStorage !== 'undefined') {
    const address = localStorage.getItem('connectedAddress');
    if (address) {
      chrome.storage.local.set({ connectedAddress: address }, () => {
        console.log('Address saved from localStorage:', address);
        localStorage.removeItem('connectedAddress');
      });
    }
  }
}, 1000); // Check every second

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
    chrome.storage.local.set({latestScreenshot: dataUrl}, () => {
      console.log('Screenshot saved locally');
    });
  });
});