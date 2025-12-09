
// Content Script - Prompt Bin
// Features: WebNav URL Tracking, Robust Paste, Auto-Capture

console.log('[Prompt Bin] Content Script Active');

// --- STATE ---
let inputBuffer = '';
let pendingPrompt = null; 
let isComposing = false;
let suggestionBox = null;
let safetyTimer = null;
let currentUrl = window.location.href;

const getToolName = () => {
    const host = window.location.hostname;
    if (host.includes('openai') || host.includes('chatgpt')) return 'ChatGPT';
    if (host.includes('google') || host.includes('gemini')) return 'Gemini';
    if (host.includes('claude') || host.includes('anthropic')) return 'Claude';
    if (host.includes('perplexity')) return 'Perplexity';
    if (host.includes('microsoft') || host.includes('copilot') || host.includes('bing')) return 'Copilot';
    return 'Unknown AI';
};

const TOOL_NAME = getToolName();

// --- 1. URL TRACKING (Secure Method) ---

// Listen for updates from Background script (WebNavigation API)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'url_changed') {
        currentUrl = request.url;
        // Update pending prompt if waiting
        if (pendingPrompt) {
            pendingPrompt.sessionUrl = currentUrl;
        }
    }
});

// Fallback: Poll for URL changes (handles cases where WebNav might miss internal state)
setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        if (pendingPrompt) pendingPrompt.sessionUrl = currentUrl;
    }
}, 1000);


// --- 2. CAPTURE LOGIC ---

const sendToBackground = (type, content, specificUrl = null) => {
    if (!content || content.trim().length < 2) return;
    
    const finalUrl = specificUrl || currentUrl;

    try {
        chrome.runtime.sendMessage({
            action: 'capture',
            data: {
                type: type,
                content: content.trim(),
                aiTool: TOOL_NAME,
                timestamp: new Date().toISOString(),
                sessionUrl: finalUrl
            }
        });
        console.log(`[Prompt Bin] Saved ${type}`);
    } catch (e) {
        // Context invalidated
    }
};

const queuePrompt = (content) => {
    if (!content || content.trim().length < 2) return;
    
    // Store prompt and current URL
    pendingPrompt = {
        content: content,
        timestamp: Date.now(),
        sessionUrl: currentUrl 
    };
    
    console.log('[Prompt Bin] Prompt Queued. Waiting for response...');
    
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(() => {
        if (pendingPrompt) {
            finalizePrompt();
        }
    }, 15000);
};

const finalizePrompt = () => {
    if (!pendingPrompt) return;
    
    // Send with the latest URL we have
    sendToBackground('prompt', pendingPrompt.content, pendingPrompt.sessionUrl);
    
    pendingPrompt = null;
    if (safetyTimer) clearTimeout(safetyTimer);
};


// --- 3. INPUT MONITORING ---

document.addEventListener('compositionstart', () => isComposing = true, true);
document.addEventListener('compositionend', () => isComposing = false, true);

document.addEventListener('input', (e) => {
    if (isComposing) return;
    
    let target = e.target;
    // Find the relevant editable element
    let editableElement = target.closest('textarea, input, [contenteditable="true"]');

    if (editableElement) {
        const val = editableElement.value || editableElement.innerText || editableElement.textContent || '';
        inputBuffer = val;
        
        if (inputBuffer.length > 3) {
            fetchSuggestions(inputBuffer, editableElement);
        } else {
            removeSuggestionBox();
        }
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeSuggestionBox();
    
    if (e.key === 'Enter' && !e.shiftKey) {
        const textToSave = inputBuffer;
        if (textToSave && textToSave.trim().length > 1) {
            removeSuggestionBox();
            queuePrompt(textToSave);
            setTimeout(() => { inputBuffer = ''; }, 100);
        }
    }
}, true);

document.addEventListener('click', (e) => {
    if (suggestionBox && !suggestionBox.contains(e.target)) {
        removeSuggestionBox();
    }

    const btn = e.target.closest('button, [role="button"]');
    if (btn) {
        const label = (btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase();
        const isSend = label.includes('send') || label.includes('submit') || label === '↑' || btn.querySelector('svg');
                       
        if (isSend) {
             if (inputBuffer && inputBuffer.trim().length > 1) {
                queuePrompt(inputBuffer);
                inputBuffer = '';
             }
        }
    }
}, true);


// --- 4. RESPONSE TRIGGER ---

let responseDebounceTimer = null;
let lastResponseText = '';

const observer = new MutationObserver((mutations) => {
    let hasAddedNodes = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            hasAddedNodes = true;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element
                   const text = node.innerText;
                   if (text && text.length > 50) {
                       clearTimeout(responseDebounceTimer);
                       responseDebounceTimer = setTimeout(() => {
                           if (text !== inputBuffer && text !== lastResponseText) {
                               sendToBackground('response', text);
                               lastResponseText = text;
                           }
                       }, 3000);
                   }
                }
            });
        }
    }

    if (hasAddedNodes && pendingPrompt) {
        // AI is responding! Finalize the pending prompt.
        setTimeout(() => {
            finalizePrompt();
        }, 500);
    }
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}


// --- 5. ROBUST INSERTION (AUTOCOMPLETE) ---

function simulateReplacement(element, text) {
    if (!element) return;
    
    if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
        const contentEditable = element.closest('[contenteditable="true"]');
        if (contentEditable) element = contentEditable;
    }

    element.focus();
    
    // Strategy 1: Select All + Insert Text (Works for ContentEditable)
    // This replaces "good" with "Good morning"
    if (document.queryCommandSupported('insertText')) {
        document.execCommand('selectAll', false, null);
        const success = document.execCommand('insertText', false, text);
        if (success) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
    }

    // Strategy 2: React Value Setter (For Textarea/Input)
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const proto = Object.getPrototypeOf(element);
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        
        if (nativeSetter) {
            nativeSetter.call(element, text);
            element.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            element.value = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } else {
        // Fallback for divs
        element.innerText = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}


// --- 6. AUTOCOMPLETE UI ---

function fetchSuggestions(query, target) {
    try {
        chrome.runtime.sendMessage({ action: 'search_history', query }, (response) => {
            if (response && response.matches && response.matches.length > 0) {
                renderSuggestionBox(response.matches, target);
            } else {
                removeSuggestionBox();
            }
        });
    } catch(e) {}
}

function removeSuggestionBox() {
    if (suggestionBox) {
        suggestionBox.remove();
        suggestionBox = null;
    }
}

function getToolColor(tool) {
    const t = (tool || '').toLowerCase();
    if (t.includes('chatgpt')) return '#10a37f';
    if (t.includes('gemini')) return '#1d4ed8';
    if (t.includes('claude')) return '#d97706';
    if (t.includes('perplexity')) return '#14b8a6';
    if (t.includes('copilot')) return '#7c3aed';
    return '#666';
}

function renderSuggestionBox(items, targetInput) {
    removeSuggestionBox();
    const rect = targetInput.getBoundingClientRect();
    
    const box = document.createElement('div');
    box.id = 'prompt-bin-autocomplete';
    box.style.cssText = `
        position: fixed; 
        top: ${Math.max(10, rect.top - Math.min(items.length * 60, 300) - 20)}px; 
        left: ${rect.left}px; 
        width: ${Math.min(rect.width, 600)}px; 
        background-color: #1e1e1e; 
        border: 1px solid #c41e3a; 
        border-radius: 8px; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.9); 
        z-index: 2147483647; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        display: flex;
        flex-direction: column;
    `;
    
    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'background:#c41e3a; color:white; display:flex; justify-content:space-between; align-items:center; padding:6px 12px; border-bottom:1px solid #901025;';

    const title = document.createElement('span');
    title.innerText = 'SUGGESTIONS';
    title.style.cssText = 'font-size:11px; font-weight:bold; letter-spacing:1px;';
    
    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'cursor:pointer; font-weight:bold; font-size:14px; margin-left:10px; opacity:0.8;';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeSuggestionBox();
    };

    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    box.appendChild(headerRow);
    
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'overflow-y:auto; max-height:300px; background:#1e1e1e;';

    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 12px; border-bottom:1px solid #333; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:background 0.2s;';
        
        const metaRow = document.createElement('div');
        metaRow.style.cssText = 'display:flex; justify-content:flex-start; align-items:center; width:100%; gap: 10px;';

        const badgeColor = getToolColor(item.aiTool);
        const badge = document.createElement('span');
        badge.innerText = (item.aiTool || 'UNKNOWN').toUpperCase();
        badge.style.cssText = `background:${badgeColor}; color:white; padding:2px 6px; border-radius:3px; font-weight:bold; font-size:9px;`;
        
        metaRow.appendChild(badge);

        const contentDiv = document.createElement('div');
        contentDiv.innerText = item.content;
        contentDiv.style.cssText = 'color:#e0e0e0; font-size:13px; font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

        row.appendChild(metaRow);
        row.appendChild(contentDiv);
        
        row.onmouseenter = () => row.style.backgroundColor = '#2c2c2c';
        row.onmouseleave = () => row.style.backgroundColor = 'transparent';
        
        // Click to Replace (Paste)
        row.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            simulateReplacement(targetInput, item.content);
            inputBuffer = item.content;
            removeSuggestionBox();
        };

        listContainer.appendChild(row);
    });

    box.appendChild(listContainer);
    document.body.appendChild(box);
    suggestionBox = box;
}