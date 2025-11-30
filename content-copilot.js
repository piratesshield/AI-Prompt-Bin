const COP_TOOL = 'copilot';
const COP_MIN = 5;
let cop_items = new Set();
let cop_input = '';

function cop_send(type, content, category = 'General') {
  if (!content || content.trim().length < COP_MIN) return;
  const key = `${type}|${content.substring(0, 100)}`;
  if (cop_items.has(key)) return;
  cop_items.add(key);
  try {
    chrome.runtime.sendMessage({
      action: 'capture',
      data: { type, content: content.trim(), aiTool: COP_TOOL, timestamp: new Date().toISOString(), category, sessionUrl: window.location.href, source: 'copilot.microsoft.com' }
    });
  } catch (e) {}
}

function cop_cat(t) {
  const l = (t || '').toLowerCase();
  if (/security|threat|attack/.test(l)) return 'Security';
  if (/code|python|javascript/.test(l)) return 'Code';
  if (/cloud|aws|azure/.test(l)) return 'Cloud';
  if (/ai|machine learning/.test(l)) return 'AI/ML';
  if (/data|database/.test(l)) return 'Data';
  return 'General';
}

document.addEventListener('input', (e) => {
  try {
    if (e.target && (['TEXTAREA','INPUT'].includes(e.target.tagName) || e.target.contentEditable === 'true')) {
      cop_input = (e.target.value || e.target.textContent || '').toString();
    }
  } catch (err) {}
}, true);

document.addEventListener('click', (e) => {
  try {
    const btn = e.target?.closest('button');
    if (btn && ((btn.getAttribute('aria-label') || '').includes('Send') || (btn.textContent || '').includes('Send'))) {
      if (cop_input && cop_input.length > COP_MIN) {
        cop_send('prompt', cop_input, cop_cat(cop_input));
        cop_input = '';
      }
    }
  } catch (err) {}
}, true);

try {
  let cop_proc = new Set();
  const cop_obs = new MutationObserver(() => {
    try {
      document.querySelectorAll('[role="article"], .message').forEach((m) => {
        try {
          const id = m.id || `o_${Math.random()}`;
          if (cop_proc.has(id)) return;
          cop_proc.add(id);
          const c = (m.textContent || '').trim();
          if (c.length > 10) cop_send(m.classList.contains('user') ? 'prompt' : 'response', c, cop_cat(c));
        } catch (e) {}
      });
    } catch (e) {}
  });
  let cop_att = 0;
  const cop_wt = setInterval(() => {
    if (document.body) {
      clearInterval(cop_wt);
      try { cop_obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }
    if (++cop_att > 200) clearInterval(cop_wt);
  }, 50);
} catch (e) {}
