let allCaptures = [];
let filteredCaptures = [];
let currentPage = 1;
const itemsPerPage = 25;

function loadCaptures() {
  chrome.runtime.sendMessage({ action: 'getAllCaptures' }, (r) => {
    if (r && r.success && r.data) {
      allCaptures = r.data || [];
      filteredCaptures = [...allCaptures];
      updateStats();
      displayCaptures();
    }
  });
}

function updateStats() {
  const total = filteredCaptures.length;
  const tokens = filteredCaptures.reduce((s, c) => s + (c.tokens || 0), 0);
  const prompts = filteredCaptures.filter(c => c.type === 'prompt').length;
  const responses = filteredCaptures.filter(c => c.type === 'response').length;
  document.getElementById('totalCount').textContent = total;
  document.getElementById('tokenCount').textContent = tokens.toLocaleString();
  document.getElementById('promptCount').textContent = prompts;
  document.getElementById('responseCount').textContent = responses;
}

function applyFilters() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase();
  const tool = document.getElementById('toolFilter').value;
  const type = document.getElementById('typeFilter').value;
  const category = document.getElementById('categoryFilter').value;
  filteredCaptures = allCaptures.filter(c => {
    const matchSearch = !search || c.content.toLowerCase().includes(search);
    const matchTool = !tool || c.aiTool === tool;
    const matchType = !type || c.type === type;
    const matchCategory = !category || c.category === category;
    return matchSearch && matchTool && matchType && matchCategory;
  });
  currentPage = 1;
  updateStats();
  displayCaptures();
}

function displayCaptures() {
  const container = document.getElementById('tableContainer');
  if (filteredCaptures.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div>No captures match your filters</div></div>';
    return;
  }
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredCaptures.slice(start, end);
  let html = '<table class="table"><thead><tr><th>Type</th><th>Tool</th><th>Category</th><th>Tokens</th><th>Content</th><th>Chat Link</th><th>Time</th></tr></thead><tbody>';
  
  pageItems.forEach((c, idx) => {
    const time = new Date(c.timestamp).toLocaleTimeString();
    const typeClass = c.type === 'prompt' ? 'badge-prompt' : 'badge-response';
    const toolClass = `badge-${c.aiTool}`;
    
    let chatLink = '-';
    if (c.sessionUrl) {
      const url = c.sessionUrl;
      if (url && url.length > 0) {
        chatLink = `<a href="${url}" target="_blank" class="session-link" title="${url}">🔗 Open</a>`;
      }
    }
    
    html += `<tr>
      <td><span class="badge ${typeClass}">${c.type}</span></td>
      <td><span class="badge ${toolClass}">${c.aiTool}</span></td>
      <td>${c.category || 'General'}</td>
      <td><span class="token-badge">${c.tokens || 0}🔤</span></td>
      <td><span class="prompt-text">${(c.content || '').substring(0, 80)}</span></td>
      <td>${chatLink}</td>
      <td>${time}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  const totalPages = Math.ceil(filteredCaptures.length / itemsPerPage);
  if (totalPages > 1) {
    html += '<div class="pagination">';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = i === currentPage ? 'active' : '';
      btn.addEventListener('click', () => goToPage(i));
      const div = document.createElement('div');
      div.appendChild(btn);
      if (i === 1) html += '<div class="pagination">';
      html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
  
  // Add event listeners to pagination buttons
  const paginationBtns = container.querySelectorAll('.pagination button');
  paginationBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = parseInt(e.target.getAttribute('data-page'));
      if (!isNaN(page)) goToPage(page);
    });
  });
}

function goToPage(page) {
  currentPage = page;
  displayCaptures();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exportData() {
  try {
    if (!allCaptures || allCaptures.length === 0) {
      alert('❌ No captures to export!');
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalCaptures: allCaptures.length,
      captures: allCaptures
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `ai-command-center-${dateStr}.json`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    alert('✅ Exported ' + allCaptures.length + ' captures!');
  } catch (error) {
    alert('❌ Export failed: ' + error.message);
  }
}

function clearData() {
  if (confirm('⚠️ Delete ALL captures? This cannot be undone!')) {
    chrome.runtime.sendMessage({ action: 'clearAll' }, (response) => {
      if (response && response.success) {
        allCaptures = [];
        filteredCaptures = [];
        currentPage = 1;
        updateStats();
        displayCaptures();
        alert('✅ All captures deleted!');
      } else {
        alert('❌ Failed to clear data');
      }
    });
  }
}

// Event listeners - NO INLINE HANDLERS
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('filterBtn').addEventListener('click', applyFilters);
document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('clearBtn').addEventListener('click', clearData);

['toolFilter', 'typeFilter', 'categoryFilter'].forEach(id => {
  const elem = document.getElementById(id);
  if (elem) elem.addEventListener('change', applyFilters);
});

loadCaptures();
setInterval(loadCaptures, 3000);
