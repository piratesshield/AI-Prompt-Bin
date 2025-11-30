const TOOL = 'perplexity';
let items = new Set();
let input = '';

document.addEventListener('input', (e) => {
  try { const ta = e.target.closest('textarea'); if (ta) input = ta.value || ''; } catch (err) {}
}, true);

document.addEventListener('click', (e) => {
  try {
    const btn = e.target.closest('button');
    if (!btn) return;
    const txt = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
    if (txt.includes('send') || txt.includes('submit')) {
      if (input.trim().length > 5) {
        const key = 'p|' + input.substring(0, 50);
        if (!items.has(key)) {
          items.add(key);
          chrome.runtime.sendMessage({ action: 'capture', data: { type: 'prompt', content: input, aiTool: TOOL, timestamp: new Date().toISOString(), category: 'General', sessionUrl: window.location.href } });
        }
        input = '';
      }
    }
  } catch (err) {}
}, true);

const obs = new MutationObserver(() => {
  try {
    document.querySelectorAll('[role="article"], .prose, [class*="message"]').forEach(el => {
      try {
        if (!el.dataset.pb_cap) {
          const txt = el.textContent.trim();
          if (txt.length > 20) {
            const key = 'r|' + txt.substring(0, 50);
            if (!items.has(key)) {
              items.add(key);
              el.dataset.pb_cap = '1';
              const isUser = el.className.includes('user') || el.getAttribute('data-role') === 'user';
              chrome.runtime.sendMessage({ action: 'capture', data: { type: isUser ? 'prompt' : 'response', content: txt, aiTool: TOOL, timestamp: new Date().toISOString(), category: 'General', sessionUrl: window.location.href } });
            }
          }
        }
      } catch (e) {}
    });
  } catch (err) {}
});

if (document.body) obs.observe(document.body, { childList: true, subtree: true });
else document.addEventListener('DOMContentLoaded', () => { if (document.body) obs.observe(document.body, { childList: true, subtree: true }); });
