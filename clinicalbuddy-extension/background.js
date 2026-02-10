// Open the side panel when the user clicks the extension icon.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Notify side panel when active tab or URL changes so it can load fresh content.
function isWebUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (tab && isWebUrl(tab.url)) {
      chrome.runtime.sendMessage({ type: 'tabChanged', url: tab.url, tabId: tab.id }).catch(function () {});
    }
  });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete' || !tab || !isWebUrl(tab.url)) return;
  chrome.tabs.query({ active: true, windowId: tab.windowId }, function (tabs) {
    if (tabs[0] && tabs[0].id === tabId) {
      chrome.runtime.sendMessage({ type: 'tabChanged', url: tab.url, tabId: tabId }).catch(function () {});
    }
  });
});

// Relay: side panel asks for page content → ask content script in active tab → return result.
// Also relay applyPageEnhancements to active tab for heading summaries + highlights.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'applyPageEnhancements') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) { sendResponse({ ok: false }); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'applyPageEnhancements', payload: msg.payload || {} }, function (res) {
        sendResponse(res || { ok: false });
      });
    });
    return true;
  }
  if (msg.type === 'scrollToHighlight') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) { sendResponse({ ok: false }); return; }
      function tryScroll() {
        chrome.tabs.sendMessage(tab.id, { type: 'scrollToHighlight', id: msg.id }, function (res) {
          if (chrome.runtime.lastError && chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] }, function () {});
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, function () {
              if (chrome.runtime.lastError) { sendResponse({ ok: false }); return; }
              tryScroll();
            });
            return;
          }
          sendResponse(res || { ok: false, found: false });
        });
      }
      tryScroll();
    });
    return true;
  }
  if (msg.type !== 'getPageContent') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ ok: false, error: 'No active tab' });
      return;
    }
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://'))) {
      sendResponse({ ok: false, error: 'Cannot read this page (browser internal page)' });
      return;
    }

    function trySendMessage() {
      chrome.tabs.sendMessage(tab.id, { type: 'getPageContent' }, (response) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message;
          if (err && err.includes('Receiving end does not exist')) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                return;
              }
              trySendMessage();
            });
          } else {
            sendResponse({ ok: false, error: err });
          }
        } else {
          sendResponse(response || { ok: false, error: 'No response' });
        }
      });
    }

    trySendMessage();
  });
  return true;
});
