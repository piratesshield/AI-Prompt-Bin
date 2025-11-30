// ===== GEMINI =====
const GEM_TOOL = 'gemini';
const GEM_MIN = 5;
let gem_items = new Set();
let gem_input = '';

function gem_send(type, content, category = 'General') {
  if (!content || content.trim().length < GEM_MIN) return;
  const key = `${type}|${content.substring(0, 100)}`;
  if (gem_items.has(key)) return;
  gem_items.add(key);
  try {
    chrome.runtime.sendMessage({
      action: 'capture',
      data: { type, content: content.trim(), aiTool: GEM_TOOL, timestamp: new Date().toISOString(), category, sessionUrl: window.location.href, source: 'gemini.google.com' }
    });
  } catch (e) {}
}

function gem_cat(t) {
  const l = (t || '').toLowerCase();
  if (/security|threat|attack/.test(l)) return 'Security';
  if (/code|python|javascript/.test(l)) return 'Code';
  if (/cloud|aws/.test(l)) return 'Cloud';
  if (/ai|machine learning/.test(l)) return 'AI/ML';
  if (/data|database/.test(l)) return 'Data';
  return 'General';
}

document.addEventListener('input', (e) => {
  try {
    if (e.target && (['TEXTAREA','INPUT'].includes(e.target.tagName) || e.target.contentEditable === 'true')) {
      gem_input = (e.target.value || e.target.textContent || '').toString();
    }
  } catch (err) {}
}, true);

document.addEventListener('click', (e) => {
  try {
    const btn = e.target?.closest('button');
    if (btn && ((btn.getAttribute('aria-label') || '').includes('Send') || (btn.textContent || '').includes('↑'))) {
      if (gem_input && gem_input.length > GEM_MIN) {
        gem_send('prompt', gem_input, gem_cat(gem_input));
        gem_input = '';
      }
    }
  } catch (err) {}
}, true);

try {
  let gem_proc = new Set();
  const gem_obs = new MutationObserver(() => {
    try {
      document.querySelectorAll('[role="article"]').forEach((m) => {
        try {
          const id = m.id || `g_${Math.random()}`;
          if (gem_proc.has(id)) return;
          gem_proc.add(id);
          const c = (m.textContent || '').trim();
          if (c.length > 10) gem_send(m.classList.contains('user') ? 'prompt' : 'response', c, gem_cat(c));
        } catch (e) {}
      });
    } catch (e) {}
  });
  let gem_att = 0;
  const gem_wt = setInterval(() => {
    if (document.body) {
      clearInterval(gem_wt);
      try { gem_obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }
    if (++gem_att > 200) clearInterval(gem_wt);
  }, 50);
} catch (e) {}
