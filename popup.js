// Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  
  // Safe Send Message
  const safeSendMessage = (msg, callback) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.error("BG Error:", chrome.runtime.lastError);
          // Don't alert user, just fail silently to avoid popup noise
          return;
        }
        callback(response);
      });
    } catch (e) {
      console.error("Runtime Error:", e);
    }
  };

  // Load Stats
  safeSendMessage({ action: 'get_stats' }, (stats) => {
    if (stats) {
      document.getElementById('count-total').textContent = stats.total;
      document.getElementById('count-tokens').textContent = stats.tokens.toLocaleString();
    }
  });

  // Load Recent
  safeSendMessage({ action: 'get_all_captures' }, (data) => {
    const list = document.getElementById('recent-list');
    list.innerHTML = '';
    
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="text-align:center; color:#555; font-size:12px; padding:20px;">No captures yet.</div>';
      return;
    }

    const recent = data.slice(0, 5);
    
    recent.forEach(item => {
      const el = document.createElement('div');
      el.className = 'item';
      
      const time = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      el.innerHTML = `
        <div class="item-meta">
          <span class="tag">${item.type.toUpperCase()}</span>
          <span>${item.aiTool} • ${time}</span>
        </div>
        <div class="item-content">${escapeHtml(item.content)}</div>
      `;
      list.appendChild(el);
    });
  });

  // Navigation
  document.getElementById('open-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });
  
  document.getElementById('view-all').addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });
});

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}