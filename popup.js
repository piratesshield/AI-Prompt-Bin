function updateStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (r) => {
    if (r && r.success && r.data) {
      document.getElementById('totalStat').textContent = r.data.total;
      document.getElementById('tokensStat').textContent = r.data.totalTokens.toLocaleString();
      document.getElementById('promptsStat').textContent = r.data.prompts;
    }
  });
}

function updateCaptures() {
  chrome.runtime.sendMessage({ action: 'getAllCaptures' }, (r) => {
    if (r && r.success && r.data) {
      const recent = (r.data || []).slice(0, 5);
      const container = document.getElementById('capturesList');
      if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state">No captures yet</div>';
        return;
      }
      container.innerHTML = recent.map(c => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        return `<div class="capture-item"><div><span class="badge">${c.type}</span><span class="badge">${c.tokens || 0}🔤</span></div><div class="capture-content">${(c.content || '').substring(0, 50)}</div><div class="capture-time">${time}</div></div>`;
      }).join('');
    }
  });
}

document.getElementById('openDashboard').addEventListener('click', () => {
  const dashboardPath = chrome.runtime.getURL('dashboard.html');
  chrome.tabs.create({ url: dashboardPath });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Delete all?')) {
    chrome.runtime.sendMessage({ action: 'clearAll' }, () => {
      updateStats();
      updateCaptures();
    });
  }
});

updateStats();
updateCaptures();
setInterval(() => {
  updateStats();
  updateCaptures();
}, 2000);
