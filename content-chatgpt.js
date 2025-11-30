const TOOL_NAME = 'chatgpt';
const MIN_LENGTH = 5;
let capturedItems = new Set();
let lastInput = '';

function send(type, content, category = 'General') {
  if (!content || content.trim().length < MIN_LENGTH) return;
  if (typeof content !== 'string') return;
  
  const key = `${type}|${content.substring(0, 100)}`;
  if (capturedItems.has(key)) return;
  capturedItems.add(key);
  
  try {
    const msg = {
      action: 'capture',
      data: {
        type,
        content: content.trim(),
        aiTool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        category,
        sessionUrl: window.location.href || '',
        source: 'chatgpt.com',
        metadata: { characterCount: content.length, hasCode: /```/.test(content) }
      }
    };
    
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(msg);
    }
  } catch (e) {
    // Silently fail
  }
}

function detectCategory(text) {
  if (!text) return 'General';
  const l = text.toLowerCase();
  if (/security|threat|attack|vulnerability/.test(l)) return 'Security';
  if (/code|function|python|javascript|java|sql/.test(l)) return 'Code';
  if (/cloud|aws|azure|gcp|kubernetes/.test(l)) return 'Cloud';
  if (/ai|machine learning|model|neural|nlm|llm|transformer/.test(l)) return 'AI/ML';
  if (/data|database|sql|nosql|mongodb|elasticsearch/.test(l)) return 'Data';
  if (/docker|devops|ci\/cd|terraform|jenkins/.test(l)) return 'DevOps';
  return 'General';
}

// INPUT MONITOR
document.addEventListener('input', (e) => {
  try {
    const target = e.target;
    if (!target) return;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.contentEditable === 'true') {
      lastInput = (target.value || target.textContent || '').toString();
    }
  } catch (err) {}
}, true);

// CLICK MONITOR
document.addEventListener('click', (e) => {
  try {
    const target = e.target;
    if (!target) return;
    const btn = target.closest('button');
    if (!btn) return;
    
    const label = (btn.getAttribute('aria-label') || '').toString();
    const text = (btn.textContent || '').toString();
    
    if (label.includes('Send') || text.includes('↑')) {
      if (lastInput && lastInput.length > MIN_LENGTH) {
        send('prompt', lastInput, detectCategory(lastInput));
        lastInput = '';
      }
    }
  } catch (err) {}
}, true);

// MESSAGE MONITOR
try {
  let processed = new Set();
  const obs = new MutationObserver(() => {
    try {
      const msgs = document.querySelectorAll('[data-message-id], [role="article"], [class*="message"]');
      if (!msgs) return;
      
      msgs.forEach((m) => {
        try {
          if (!m) return;
          const id = m.getAttribute('data-message-id') || m.id || `m_${Math.random()}`;
          if (processed.has(id)) return;
          processed.add(id);
          
          const content = (m.textContent || '').trim();
          if (content.length < 10) return;
          
          const isUser = m.classList.contains('user') || m.getAttribute('data-role') === 'user';
          if (isUser) {
            send('prompt', content, detectCategory(content));
          } else {
            send('response', content, detectCategory(content));
          }
        } catch (e) {}
      });
    } catch (e) {}
  });
  
  // Wait for body safely
  let attempts = 0;
  const wait = setInterval(() => {
    if (document && document.body && typeof document.body === 'object') {
      clearInterval(wait);
      try {
        obs.observe(document.body, { childList: true, subtree: true });
      } catch (e) {}
    }
    if (++attempts > 200) clearInterval(wait);
  }, 50);
} catch (e) {}

// KEYBOARD MONITOR
document.addEventListener('keydown', (e) => {
  try {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const ta = document.querySelector('textarea');
      if (ta && ta.value && ta.value.length > MIN_LENGTH) {
        send('prompt', ta.value, detectCategory(ta.value));
      }
    }
  } catch (e) {}
}, true);
