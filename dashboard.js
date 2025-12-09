



// Dashboard Logic

let allCaptures = [];
let currentTimeFrame = 'Week';
let activeFilterNode = null; // Stores the node currently hovered

// Tool Colors Config
const TOOL_COLORS = {
    'chatgpt': '#10a37f',
    'gemini': '#1d4ed8',
    'claude': '#d97706',
    'perplexity': '#14b8a6',
    'copilot': '#7c3aed',
    'default': '#666666'
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderLegend();

    // Event Listeners
    document.getElementById('refresh-btn').addEventListener('click', loadData);
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('clear-btn').addEventListener('click', clearHistory);
    document.getElementById('search-input').addEventListener('input', () => { activeFilterNode = null; renderTable(); });
    document.getElementById('tool-filter').addEventListener('change', () => { activeFilterNode = null; renderTable(); });
    document.getElementById('type-filter').addEventListener('change', () => { activeFilterNode = null; renderTable(); });

    const buttons = document.querySelectorAll('.time-controls button');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeFrame = e.target.dataset.period;
            renderChart();
        });
    });
});

function loadData() {
    try {
        chrome.runtime.sendMessage({ action: 'get_all_captures' }, (data) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            allCaptures = data || [];
            updateStats();
            renderTable();
            renderChart();
            renderMemoryGraph();
        });
    } catch(e) {
        console.error("Connection failed", e);
    }
}

function exportData() {
    if (allCaptures.length === 0) {
        alert("No data to export.");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allCaptures, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "prompt_bin_export_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function clearHistory() {
    if (confirm('Are you sure you want to delete all history?')) {
        chrome.runtime.sendMessage({ action: 'clear_all' }, () => {
            loadData();
        });
    }
}

function updateStats() {
    const total = allCaptures.length;
    const tokens = allCaptures.reduce((acc, c) => acc + (c.tokens || 0), 0);
    const prompts = allCaptures.filter(c => c.type === 'prompt').length;
    const responses = allCaptures.filter(c => c.type === 'response').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-tokens').textContent = tokens.toLocaleString();
    document.getElementById('stat-prompts').textContent = prompts;
    document.getElementById('stat-responses').textContent = responses;
}

function getToolClass(toolName) {
    const t = (toolName || '').toLowerCase();
    if (t.includes('chatgpt')) return 'chatgpt';
    if (t.includes('gemini')) return 'gemini';
    if (t.includes('claude')) return 'claude';
    if (t.includes('perplexity')) return 'perplexity';
    if (t.includes('copilot')) return 'copilot';
    return 'default';
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const search = document.getElementById('search-input').value.toLowerCase();
    const toolFilter = document.getElementById('tool-filter').value;
    const typeFilter = document.getElementById('type-filter').value;

    let filtered = allCaptures.filter(item => {
        const matchSearch = item.content.toLowerCase().includes(search);
        const matchTool = toolFilter === 'ALL' || item.aiTool === toolFilter;
        const matchType = typeFilter === 'ALL' || item.type === typeFilter;
        return matchSearch && matchTool && matchType;
    });

    // Apply Graph Filter if hovering
    if (activeFilterNode) {
        if (activeFilterNode.type === 'tool') {
            filtered = filtered.filter(item => item.aiTool === activeFilterNode.id);
        } else if (activeFilterNode.type === 'item') {
            // Filter by content if it's a prompt node, as prompts are deduplicated by content in the graph
            filtered = filtered.filter(item => item.content === activeFilterNode.label);
        }
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#666; padding:30px;">No captures found.</td></tr>';
        return;
    }

    filtered.slice(0, 100).forEach(item => {
        const tr = document.createElement('tr');
        const date = new Date(item.timestamp).toLocaleString();
        const toolClass = getToolClass(item.aiTool);
        const category = item.category || 'General';
        
        tr.innerHTML = `
            <td><span class="tag ${item.type}">${item.type}</span></td>
            <td><span class="tag ${toolClass}">${item.aiTool}</span></td>
            <td><span class="tag category">${category}</span></td>
            <td class="content-cell">${escapeHtml(item.content)}</td>
            <td style="font-family:monospace; color:#aaa;">${item.tokens.toLocaleString()}</td>
            <td style="color:#888; font-size:12px;">${date}</td>
            <td><button class="copy-btn" data-content="${escapeHtmlAttr(item.content)}">Copy</button></td>
            <td>
                ${item.sessionUrl ? `<a href="${item.sessionUrl}" target="_blank" class="link-btn">Open</a>` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach copy listeners
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.getAttribute('data-content');
            navigator.clipboard.writeText(text).then(() => {
                e.target.textContent = 'Copied!';
                e.target.style.color = '#4ade80';
                setTimeout(() => {
                    e.target.textContent = 'Copy';
                    e.target.style.color = '#aaa';
                }, 1500);
            });
        });
    });
}

function renderLegend() {
    const el = document.getElementById('chart-legend');
    el.innerHTML = '';
    
    Object.keys(TOOL_COLORS).forEach(tool => {
        if (tool === 'default') return;
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="legend-dot" style="background:${TOOL_COLORS[tool]}"></div> ${tool.toUpperCase()}`;
        el.appendChild(item);
    });
}

function renderChart() {
    const container = document.getElementById('chart-container');
    container.innerHTML = '';
    
    if (allCaptures.length === 0) {
        container.innerHTML = '<div style="position:absolute; width:100%; text-align:center; color:#444; top:45%;">No data available</div>';
        return;
    }

    const groups = {};
    const now = new Date();
    
    let limitTime = 0;
    let getKey = () => {};
    let getSortTime = () => {};

    if (currentTimeFrame === 'Day') {
         limitTime = 24 * 60 * 60 * 1000;
         getKey = (d) => d.getHours() + ':00';
         getSortTime = (d) => d.setMinutes(0,0,0);
    } else if (currentTimeFrame === 'Week') {
         limitTime = 7 * 24 * 60 * 60 * 1000;
         getKey = (d) => (d.getMonth() + 1) + '/' + d.getDate();
         getSortTime = (d) => d.setHours(0,0,0,0);
    } else if (currentTimeFrame === 'Month') {
         limitTime = 30 * 24 * 60 * 60 * 1000;
         getKey = (d) => (d.getMonth() + 1) + '/' + d.getDate();
         getSortTime = (d) => d.setHours(0,0,0,0);
    } else if (currentTimeFrame === 'Year') {
         limitTime = 365 * 24 * 60 * 60 * 1000;
         getKey = (d) => (d.getMonth() + 1) + '/' + d.getFullYear();
         getSortTime = (d) => d.setDate(1);
    } else {
         limitTime = 5 * 365 * 24 * 60 * 60 * 1000;
         getKey = (d) => d.getFullYear();
         getSortTime = (d) => d.setMonth(0, 1);
    }

    allCaptures.forEach(item => {
        const d = new Date(item.timestamp);
        if (now - d > limitTime) return;

        const key = getKey(d);
        const sortTime = getSortTime(d);
        
        if (!groups[sortTime]) {
            groups[sortTime] = { label: key, total: 0, tools: {} };
        }
        
        const toolKey = (item.aiTool || 'default').toLowerCase();
        const baseTool = toolKey.includes('chatgpt') ? 'chatgpt' :
                         toolKey.includes('gemini') ? 'gemini' :
                         toolKey.includes('claude') ? 'claude' :
                         toolKey.includes('perplexity') ? 'perplexity' :
                         toolKey.includes('copilot') ? 'copilot' : 'default';
                         
        if (!groups[sortTime].tools[baseTool]) groups[sortTime].tools[baseTool] = 0;
        groups[sortTime].tools[baseTool]++;
        groups[sortTime].total++;
    });

    const sortedKeys = Object.keys(groups).sort((a,b) => a - b);
    const data = sortedKeys.map(k => groups[k]);
    
    if (data.length === 0) {
         container.innerHTML = '<div style="position:absolute; width:100%; text-align:center; color:#444; top:45%;">No activity in this period</div>';
         return;
    }

    const maxVal = Math.max(...data.map(d => d.total));

    data.forEach(d => {
        const groupEl = document.createElement('div');
        groupEl.className = 'bar-group';
        
        const stackEl = document.createElement('div');
        stackEl.className = 'bar-stack';
        const totalHeightPct = Math.max((d.total / maxVal) * 100, 1);
        stackEl.style.height = `${totalHeightPct}%`;

        let tooltipText = `${d.label}\nTotal: ${d.total}`;
        
        Object.keys(d.tools).forEach(tool => {
            const count = d.tools[tool];
            if (count > 0) {
                const segmentHeight = (count / d.total) * 100;
                const seg = document.createElement('div');
                seg.className = 'bar-segment';
                seg.style.height = `${segmentHeight}%`;
                seg.style.backgroundColor = TOOL_COLORS[tool] || TOOL_COLORS['default'];
                stackEl.appendChild(seg);
                
                tooltipText += `\n${tool.toUpperCase()}: ${count}`;
            }
        });

        const tooltip = document.createElement('div');
        tooltip.className = 'bar-tooltip';
        tooltip.innerText = tooltipText;

        const label = document.createElement('div');
        label.className = 'bar-label';
        label.innerText = d.label;

        groupEl.appendChild(tooltip);
        groupEl.appendChild(stackEl);
        groupEl.appendChild(label);
        
        container.appendChild(groupEl);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(text) {
    if (!text) return '';
    return text.replace(/"/g, "&quot;");
}

// --- MEMORY GRAPH RENDERING (Content Matching) ---
function renderMemoryGraph() {
    const container = document.getElementById('memory-graph-container');
    container.innerHTML = '';

    // Filter only prompts for the graph
    const items = allCaptures.filter(i => i.type === 'prompt').slice(0, 100);
    
    if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding-top:180px; color:#666;">No prompt history for graph</div>';
        return;
    }

    container.onmouseleave = () => {
        activeFilterNode = null;
        renderTable();
    };

    const nodes = [];
    const links = [];
    const nodeMap = {};

    const addNode = (id, type, label, color, r) => {
        if (!nodeMap[id]) {
            nodeMap[id] = { id, type, label, color, x: Math.random() * 800, y: Math.random() * 400, vx: 0, vy: 0, r };
            nodes.push(nodeMap[id]);
        }
        return nodeMap[id];
    };

    // 1. Create Tool Nodes
    const activeTools = new Set(items.map(i => i.aiTool));
    activeTools.forEach(toolName => {
        const toolColor = TOOL_COLORS[getToolClass(toolName)] || '#666';
        addNode(toolName, 'tool', toolName, toolColor, 25);
    });

    // 2. Create Prompt Nodes (Grouped by content)
    // We want to see if the SAME prompt content (or very similar) is used across tools.
    // For simplicity in Vanilla JS, we use exact content match.
    
    // Map: contentString -> Set(tools)
    const contentMap = {};
    items.forEach(item => {
        if(!contentMap[item.content]) contentMap[item.content] = new Set();
        contentMap[item.content].add(item.aiTool);
    });

    Object.keys(contentMap).forEach((content, idx) => {
        const tools = Array.from(contentMap[content]);
        const nodeId = 'prompt_' + idx;
        const color = '#c41e3a'; // Prompt color
        
        // Node for the prompt
        addNode(nodeId, 'item', content, color, 6);
        
        // Link Prompt to every Tool it was used in
        tools.forEach(toolName => {
            links.push({ source: toolName, target: nodeId });
        });
    });

    // Create SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    container.appendChild(svg);

    // Render loop
    const render = () => {
        svg.innerHTML = ''; 
        
        // Draw Lines
        links.forEach(l => {
            const s = nodeMap[l.source];
            const t = nodeMap[l.target];
            if (s && t) {
                const line = document.createElementNS(svgNS, "line");
                line.setAttribute("x1", s.x);
                line.setAttribute("y1", s.y);
                line.setAttribute("x2", t.x);
                line.setAttribute("y2", t.y);
                line.setAttribute("stroke", "#444");
                line.setAttribute("stroke-width", "1");
                svg.appendChild(line);
            }
        });

        // Draw Nodes
        nodes.forEach(n => {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", n.x);
            circle.setAttribute("cy", n.y);
            circle.setAttribute("r", n.r);
            circle.setAttribute("fill", n.color);
            circle.setAttribute("stroke", "#fff");
            circle.setAttribute("stroke-width", "1");
            circle.style.cursor = "pointer";

            circle.onmouseenter = () => {
                circle.setAttribute("stroke", "#fff");
                circle.setAttribute("stroke-width", "3");
                activeFilterNode = n;
                renderTable();
            };
            
            circle.onmouseleave = () => {
                circle.setAttribute("stroke", "#fff");
                circle.setAttribute("stroke-width", "1");
            };

            if (n.label) {
                const title = document.createElementNS(svgNS, "title");
                title.textContent = n.label;
                circle.appendChild(title);
            }
            
            if (n.type === 'tool') {
                 const text = document.createElementNS(svgNS, "text");
                 text.setAttribute("x", n.x);
                 text.setAttribute("y", n.y - n.r - 5);
                 text.setAttribute("text-anchor", "middle");
                 text.setAttribute("fill", "#ccc");
                 text.setAttribute("font-size", "11px");
                 text.setAttribute("font-weight", "bold");
                 text.style.pointerEvents = "none";
                 text.textContent = n.label;
                 svg.appendChild(text);
            }

            svg.appendChild(circle);
        });
    };

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    nodes.forEach(n => { n.x = width/2 + (Math.random()-0.5)*100; n.y = height/2 + (Math.random()-0.5)*100; });

    const step = () => {
        // Repulsion
        for (let i=0; i<nodes.length; i++) {
            for (let j=i+1; j<nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                const force = 600 / (dist * dist);
                const fx = (dx/dist) * force;
                const fy = (dy/dist) * force;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
        }

        // Spring
        links.forEach(l => {
            const s = nodeMap[l.source];
            const t = nodeMap[l.target];
            if(s && t) {
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                const force = (dist - 80) * 0.05; 
                const fx = (dx/dist) * force;
                const fy = (dy/dist) * force;
                s.vx += fx; s.vy += fy;
                t.vx -= fx; t.vy -= fy;
            }
        });

        // Center Gravity
        nodes.forEach(n => {
            n.vx += (width/2 - n.x) * 0.02;
            n.vy += (height/2 - n.y) * 0.02;
            
            n.vx *= 0.85; 
            n.vy *= 0.85;
            n.x += n.vx;
            n.y += n.vy;
            
            n.x = Math.max(20, Math.min(width-20, n.x));
            n.y = Math.max(20, Math.min(height-20, n.y));
        });

        render();
    };

    let ticks = 0;
    const interval = setInterval(() => {
        step();
        ticks++;
        if (ticks > 200) clearInterval(interval);
    }, 16);
}
