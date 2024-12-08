/* eslint-disable no-undef */
let capturing = false;
let floatingButton = null;

function createFloatingButton() {
  const button = document.createElement('div');
  button.innerHTML = `
    <div class="cryptorage-floating-btn" title="Capture Screenshot">
      <div class="cryptorage-floating-btn-inner">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .cryptorage-floating-btn {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 50px;
      background: #FF4444;
      cursor: pointer;
      box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
      z-index: 999999;
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .cryptorage-floating-btn:hover {
      width: 50px;
      height: 50px;
      right: 20px;
      border-radius: 50%;
      background: #4F46E5;
    }

    .cryptorage-floating-btn-inner {
      position: absolute;
      top: 0;
      right: 0;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .cryptorage-floating-btn:hover .cryptorage-floating-btn-inner {
      opacity: 1;
    }

    .cryptorage-floating-btn svg {
      color: white;
    }

    .cryptorage-floating-btn.capturing {
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { transform: translateY(-50%) scale(1); }
      50% { transform: translateY(-50%) scale(1.1); }
      100% { transform: translateY(-50%) scale(1); }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(button);

  // Add click handler
  button.addEventListener('click', async () => {
    const btn = document.querySelector('.cryptorage-floating-btn');
    if (!capturing) {
      btn.classList.add('capturing');
      try {
        // Use the same capture method as the main app
        chrome.runtime.sendMessage({ action: 'captureTab' }, response => {
          if (chrome.runtime.lastError) {
            console.error('Error capturing screenshot:', chrome.runtime.lastError);
          } else if (response.error) {
            console.error('Error capturing screenshot:', response.error);
          } else {
            // Send the captured screenshot to save
            chrome.runtime.sendMessage({ 
              action: 'saveScreenshot', 
              dataUrl: response.dataUrl,
              websiteName: window.location.hostname
            });
          }
          btn.classList.remove('capturing');
        });
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        btn.classList.remove('capturing');
      }
    }
  });

  // Check if floating button should be shown
  chrome.storage.local.get(['floatingButtonEnabled'], (result) => {
    const enabled = result.floatingButtonEnabled !== false; // Default to true if not set
    if (enabled) {
      floatingButton = button; // Store reference to the button
    }
  });
}

// Initialize floating button when the content script loads
createFloatingButton();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage' && !capturing) {
    capturing = true;
    const captureWidth = 10000;
    captureFullPage(captureWidth)
      .then(dataUrl => {
        console.log('Full page capture completed');
        sendResponse({ success: true, dataUrl });
      })
      .catch(error => {
        console.error('Error in captureFullPage:', error);
        sendResponse({ success: false, error: error.toString() });
      })
      .finally(() => {
        capturing = false;
      });
    return true;
  } else if (request.action === 'getWebpageContent') {
    const content = {
      images: Array.from(document.images)
        .map(img => img.src)
        .filter(src => src.startsWith('http')),
      audio: Array.from(document.getElementsByTagName('audio'))
        .map(audio => audio.src)
        .filter(src => src.startsWith('http')),
      video: Array.from(document.getElementsByTagName('video'))
        .map(video => video.src)
        .filter(src => src.startsWith('http')),
      links: Array.from(document.links)
        .map(link => link.href)
        .filter(href => href.startsWith('http'))
    };
    sendResponse({ content });
    return true;
  } else if (request.action === 'toggleFloatingButton') {
    if (request.enabled) {
      if (!floatingButton) {
        createFloatingButton();
      }
    } else {
      if (floatingButton) {
        floatingButton.remove();
        floatingButton = null;
      }
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageText') {
    // Get all text content from the page
    const pageText = document.body.innerText;
    sendResponse({ text: pageText });
  }

});

async function captureFullPage(captureWidth) {
  const totalHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const viewportHeight = window.innerHeight;
  const totalWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );
  
  console.log(`Total height: ${totalHeight}, Viewport height: ${viewportHeight}, Capture width: ${captureWidth}, Total width: ${totalWidth}`);

  const canvas = document.createElement('canvas');
  canvas.width = captureWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  let y = 0;
  while (y < totalHeight) {
    console.log(`Scrolling to y: ${y}`);
    window.scrollTo(0, y);
    await new Promise(resolve => setTimeout(resolve, 500)); // Increased wait time

    try {
      const dataUrl = await captureCurrentView();
      const img = await loadImage(dataUrl);
      
      // Calculate the height to draw (in case it's the last partial viewport)
      const drawHeight = Math.min(viewportHeight, totalHeight - y);
      
      // Draw the captured image onto the canvas
      ctx.drawImage(img, 0, 0, captureWidth, drawHeight, 0, y, captureWidth, drawHeight);
      console.log(`Captured and drew image at y: ${y}`);
    } catch (error) {
      console.error(`Error capturing view at y=${y}:`, error);
      throw error;
    }

    y += viewportHeight;
  }

  console.log('Finished capturing all views');
  return canvas.toDataURL();
}

function captureCurrentView() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureTab' }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.dataUrl);
      }
    });
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
