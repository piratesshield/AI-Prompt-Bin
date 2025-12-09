// Background Service Worker

declare var chrome: any;

// Function to estimate tokens (duplicated from shared logic for simplicity in background)
const estimateTokens = (text: string): number => {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const hasCode = /```|def |function |class |import /.test(text);
  const tokensByWords = Math.ceil(words * (hasCode ? 1.1 : 1.3));
  const tokensByChars = Math.ceil(chars * (hasCode ? 0.4 : 0.25));
  return Math.max(tokensByWords, tokensByChars);
};

const determineCategory = (text: string): string => {
  const l = text.toLowerCase();
  if (/security|threat|attack|vulnerability/.test(l)) return 'Security';
  if (/code|function|python|javascript|java|sql/.test(l)) return 'Code';
  if (/cloud|aws|azure|gcp|kubernetes/.test(l)) return 'Cloud';
  if (/ai|machine learning|model|neural|nlm|llm|transformer/.test(l)) return 'AI/ML';
  if (/data|database|sql|nosql|mongodb|elasticsearch/.test(l)) return 'Data';
  return 'General';
};

chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'capture') {
    const { type, content, aiTool, sessionUrl } = request.data;
    
    const captureItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      aiTool,
      timestamp: new Date().toISOString(),
      sessionUrl,
      tokens: estimateTokens(content),
      category: determineCategory(content)
    };

    chrome.storage.local.get(['prompt_bin_captures'], (result: any) => {
      const captures = result['prompt_bin_captures'] || [];
      const updatedCaptures = [captureItem, ...captures].slice(0, 5000); // Limit storage
      
      chrome.storage.local.set({ 'prompt_bin_captures': updatedCaptures }, () => {
        console.log('Capture saved:', captureItem);
      });
    });
  }
});

export {};
