const STORAGE_KEY = 'aiCC_captures_v3';
const MAX_CAPTURES = 10000;

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const hasCode = /```|def |function |class |import /.test(text);
  const tokensByWords = Math.ceil(words * (hasCode ? 1.1 : 1.3));
  const tokensByChars = Math.ceil(chars * (hasCode ? 0.4 : 0.25));
  return Math.max(tokensByWords, tokensByChars);
}

function validateCapture(data) {
  return data && data.type && data.content && data.aiTool && data.timestamp;
}

async function addCapture(captureData) {
  if (!validateCapture(captureData)) {
    return { success: false, error: 'Invalid capture data' };
  }

  const capture = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...captureData,
    tokens: estimateTokens(captureData.content),
    addedAt: new Date().toISOString()
  };

  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    let captures = result[STORAGE_KEY] || [];
    captures.unshift(capture);
    if (captures.length > MAX_CAPTURES) captures = captures.slice(0, MAX_CAPTURES);
    
    await chrome.storage.local.set({ [STORAGE_KEY]: captures });
    return { success: true, data: capture };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAllCaptures() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return { success: true, data: result[STORAGE_KEY] || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getStats() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const captures = result[STORAGE_KEY] || [];
    
    const stats = {
      total: captures.length,
      prompts: captures.filter(c => c.type === 'prompt').length,
      responses: captures.filter(c => c.type === 'response').length,
      totalTokens: captures.reduce((sum, c) => sum + (c.tokens || 0), 0)
    };
    
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearAll() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    chrome.action.setBadgeText({ text: '' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateBadge() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const count = (result[STORAGE_KEY] || []).length;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(Math.min(count, 999)) });
      chrome.action.setBadgeBackgroundColor({ color: '#c41e3a' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    addCapture(request.data).then(result => {
      sendResponse(result);
      updateBadge();
    });
    return true;
  } else if (request.action === 'getAllCaptures') {
    getAllCaptures().then(sendResponse);
    return true;
  } else if (request.action === 'getStats') {
    getStats().then(sendResponse);
    return true;
  } else if (request.action === 'clearAll') {
    clearAll().then(result => {
      sendResponse(result);
      updateBadge();
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ [STORAGE_KEY]: [] });
  updateBadge();
});

updateBadge();
