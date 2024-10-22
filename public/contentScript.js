/* eslint-disable no-undef */
let capturing = false;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage' && !capturing) {
    capturing = true;
    const captureWidth = 10000; // Fixed width of 10000 pixels
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
    return true; // Indicates we wish to send a response asynchronously
  } else if (request.action === 'getWebpageContent') {
    const content = {
      images: Array.from(document.images)
        .map(img => img.src)
        .filter(src => src.startsWith('http')), // Only include valid URLs
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
  }
});

// ... (rest of the code remains the same)

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
