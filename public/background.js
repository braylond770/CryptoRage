/* eslint-disable no-undef */
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
      if (chrome.runtime.lastError) {
        console.error('Error in captureVisibleTab:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // Indicates we wish to send a response asynchronously
  }
  if (request.action === 'saveScreenshot') {
    chrome.storage.local.get(['connectedAddress'], async (result) => {
      if (result.connectedAddress) {
        // Store the screenshot temporarily
        chrome.storage.local.set({
          pendingScreenshot: {
            dataUrl: request.dataUrl,
            websiteName: request.websiteName
          }
        }, () => {
          // Open the extension popup
          chrome.action.openPopup();
        });
      } else {
        // Show a notification if user is not connected
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Cryptorage',
          message: 'Please connect your wallet to save screenshots'
        });
      }
    });
    return true;
  }
});

async function captureFullPage(tabId, sendResponse) {
  try {
    const dimensions = await getPageDimensions(tabId);
    if (!dimensions) {
      throw new Error('Failed to get page dimensions');
    }
    const { width, height } = dimensions;
    const screenshots = [];
    const viewportHeight = await getViewportHeight(tabId);
    let y = 0;

    while (y < height) {
      await scrollTo(tabId, 0, y);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for repaint
      const screenshot = await captureVisibleTab(tabId);
      if (!screenshot) {
        throw new Error('Failed to capture screenshot');
      }
      screenshots.push(screenshot);
      y += viewportHeight;
    }

    const stitchedScreenshot = await stitchScreenshots(screenshots, width, height);
    sendResponse({ screenshot: stitchedScreenshot });
  } catch (error) {
    console.error('Error in captureFullPage:', error);
    sendResponse({ error: error.message });
  }
}

function getPageDimensions(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'getPageDimensions' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error in getPageDimensions:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

function getViewportHeight(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'getViewportHeight' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error in getViewportHeight:', chrome.runtime.lastError);
        resolve(600); // Default fallback height
      } else {
        resolve(response.height);
      }
    });
  });
}

function scrollTo(tabId, x, y) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'scrollTo', x, y }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error in scrollTo:', chrome.runtime.lastError);
      }
      setTimeout(resolve, 100); // Wait for the scroll to complete
    });
  });
}

function captureVisibleTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error in captureVisibleTab:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(dataUrl);
      }
    });
  }); 
}

function stitchScreenshots(screenshots, width, height) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    let y = 0;
    screenshots.forEach((screenshot) => {
      const img = new Image();
      img.src = screenshot;
      img.onload = () => {
        context.drawImage(img, 0, y);
        y += img.height;
        if (y >= height) {
          resolve(canvas.toDataURL('image/png'));
        }
      };
    });
  });
}
chrome.management.getAll((extensions) => {
  console.log(extensions);
});