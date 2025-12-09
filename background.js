// Background Service Worker

// --- UTILITIES ---

const estimateTokens = (text) => {
  if (!text) return 0;
  
  // OpenAI Approximation for cl100k_base (GPT-4)
  // 1 token ~= 4 chars in English
  // 1 token ~= 0.75 words
  
  const chars = text.length;
  const words = text.trim().split(/\s+/).length;
  
  // Heuristics:
  // - Code: dense, many special chars. 1 token ~= 3 chars.
  // - CJK (Chinese/Japanese/Korean): 1 char often 2-3 tokens in older models, but ~1 token in newer.
  // - English Prose: 1 token ~= 4 chars.
  
  const hasCode = /```|def |function |class |import |const |var |\{|\}/.test(text);
  
  // Logic: 
  // - If it looks like code, assume more tokens per character.
  // - Use a max of word-count logic and char-count logic to avoid undercounting symbols.
  
  let tokenCount;
  
  if (hasCode) {
    // Code is token-heavy due to symbols and unique identifiers
    tokenCount = Math.ceil(chars / 3.5); 
  } else {
    // Standard English prose
    tokenCount = Math.ceil(chars / 4);
  }
  
  // Ensure we don't underestimate short sentences with many words (e.g. "I am a bot")
  const wordCountEstimate = Math.ceil(words * 1.33); 
  
  return Math.max(tokenCount, wordCountEstimate);
};

const determineCategory = (text) => {
  const l = text.toLowerCase();
  if (/security|threat|attack|vulnerability|xss|sql injection/.test(l)) return 'Security';
  if (/code|function|python|javascript|java|sql|react|node/.test(l)) return 'Code';
  if (/cloud|aws|azure|gcp|kubernetes|docker/.test(l)) return 'Cloud';
  if (/ai|machine learning|model|neural|nlm|llm|transformer/.test(l)) return 'AI/ML';
  if (/data|database|sql|nosql|mongodb|elasticsearch|excel|csv/.test(l)) return 'Data';
  return 'General';
};

// --- STORAGE LOGIC ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. CAPTURE & SAVE
  if (request.action === 'capture') {
    const { type, content, aiTool, sessionUrl } = request.data;
    
    // Safety check
    if (!content || content.length < 2) return true;

    chrome.storage.local.get(['prompt_bin_captures'], (result) => {
      let captures = result['prompt_bin_captures'] || [];
      
      // --- DEDUPLICATION LOGIC ---
      if (captures.length > 0) {
        const last = captures[0];
        const isDuplicate = 
            last.content === content && 
            last.aiTool === aiTool && 
            last.type === type;
            
        if (isDuplicate) {
          console.log('[Prompt Bin] Duplicate detected, skipping save.');
          return;
        }
      }

      const newItem = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        type,
        content,
        aiTool,
        timestamp: new Date().toISOString(),
        sessionUrl,
        tokens: estimateTokens(content),
        category: determineCategory(content)
      };

      // Add to top, limit to 5000 items
      const updated = [newItem, ...captures].slice(0, 5000);
      
      chrome.storage.local.set({ 'prompt_bin_captures': updated }, () => {
        console.log('[Prompt Bin] Saved:', newItem);
      });
    });
    
    return true; 
  }

  // 2. AUTOCOMPLETE QUERY
  if (request.action === 'search_history') {
    const query = (request.query || '').toLowerCase();
    
    if (query.length < 3) {
        sendResponse({ matches: [] });
        return true;
    }

    chrome.storage.local.get(['prompt_bin_captures'], (result) => {
      const data = result['prompt_bin_captures'] || [];
      
      const matches = [];
      const seen = new Set();

      for (const item of data) {
        if (item.type === 'prompt' && item.content.toLowerCase().includes(query)) {
            // Dedupe suggestions
            if (!seen.has(item.content)) {
                matches.push(item);
                seen.add(item.content);
            }
        }
        if (matches.length >= 5) break;
      }
      
      sendResponse({ matches });
    });
    
    return true; // Async response
  }
  
  // 3. CLEAR ALL
  if (request.action === 'clear_all') {
      chrome.storage.local.remove('prompt_bin_captures', () => {
          sendResponse({ success: true });
      });
      return true;
  }
  
  // 4. GET ALL (For Dashboard)
  if (request.action === 'get_all_captures') {
      chrome.storage.local.get(['prompt_bin_captures'], (result) => {
          sendResponse(result['prompt_bin_captures'] || []);
      });
      return true;
  }
  
  // 5. GET STATS (For Popup)
  if (request.action === 'get_stats') {
      chrome.storage.local.get(['prompt_bin_captures'], (result) => {
          const data = result['prompt_bin_captures'] || [];
          const stats = {
            total: data.length,
            tokens: data.reduce((acc, c) => acc + (c.tokens || 0), 0)
          };
          sendResponse(stats);
      });
      return true;
  }
});