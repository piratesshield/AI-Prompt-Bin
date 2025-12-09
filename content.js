// Content Script - Prompt Bin (Root)

console.log('[Prompt Bin] Content Script Active');

let inputBuffer = '';
let isComposing = false;
let suggestionBox = null;

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

const capture = (type, content) => {
    if (!content || content.trim().length < 2) return;
    try {
        chrome.runtime.sendMessage({
            action: 'capture',
            data: {
                type: type,
                content: content.trim(),
                aiTool: TOOL_NAME,
                timestamp: new Date().toISOString(),
                sessionUrl: window.location.href
            }
        });
    } catch (e) {
        // Context invalidated
    }
};

// INPUT MONITORING
document.addEventListener('compositionstart', () => isComposing = true, true);
document.addEventListener('compositionend', () => isComposing = false, true);

document.addEventListener('input', (e) => {
    if (isComposing) return;
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        inputBuffer = target.value || target.innerText || target.textContent || '';
        
        if (inputBuffer.length > 3) {
            fetchSuggestions(inputBuffer, target);
        } else {
            removeSuggestionBox();
        }
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeSuggestionBox();
    if (e.key === 'Enter' && !e.shiftKey) {
        const textToSave = inputBuffer;
        if (textToSave && textToSave.length > 1) {
            removeSuggestionBox();
            setTimeout(() => {
                capture('prompt', textToSave);
                inputBuffer = '';
            }, 50);
        }
    }
}, true);

document.addEventListener('click', (e) => {
    // Only remove if clicking outside the box
    if (suggestionBox && !suggestionBox.contains(e.target)) {
        removeSuggestionBox();
    }

    const btn = e.target.closest('button, [role="button"]');
    if (btn) {
        const label = (btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase();
        if (label.includes('send') || label.includes('submit') || label === '↑' || btn.querySelector('svg')) {
             if (inputBuffer && inputBuffer.length > 1) {
                capture('prompt', inputBuffer);
                inputBuffer = '';
             }
        }
    }
}, true);

// RESPONSE MONITORING
let responseDebounceTimer = null;
let lastResponseText = '';

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    const text = node.innerText;
                    if (text && text.length > 50) {
                        clearTimeout(responseDebounceTimer);
                        responseDebounceTimer = setTimeout(() => {
                            if (text !== inputBuffer && text !== lastResponseText) {
                                capture('response', text);
                                lastResponseText = text;
                            }
                        }, 2500);
                    }
                }
            });
        }
    }
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
}

// AUTOCOMPLETE
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

function setNativeValue(element, value) {
    // Robust method to set React/Framework controlled inputs
    const lastValue = element.value;
    element.value = value;
    
    // React 16+ hack: access the native setter
    const tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    
    // Attempt standard events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Perplexity specific: Textarea auto-resize or framework triggers often listen to specific input types
    const event = new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value,
    });
    element.dispatchEvent(event);
}

function renderSuggestionBox(items, targetInput) {
    removeSuggestionBox();
    const rect = targetInput.getBoundingClientRect();
    
    const box = document.createElement('div');
    box.id = 'prompt-bin-autocomplete';
    box.style.cssText = `position: fixed; top: ${rect.top - (items.length * 36) - 30}px; left: ${rect.left}px; width: ${Math.min(rect.width, 500)}px; background-color: #1a1a1a; border: 1px solid #c41e3a; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 2147483647; font-family: sans-serif; overflow: hidden;`;
    
    // Header Row
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'background:#c41e3a; color:white; display:flex; justify-content:space-between; align-items:center; padding:4px 8px;';

    const title = document.createElement('span');
    title.innerText = 'SUGGESTED PROMPTS';
    title.style.cssText = 'font-size:10px; font-weight:bold;';
    
    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'cursor:pointer; font-weight:bold; font-size:12px; margin-left:10px;';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeSuggestionBox();
    };

    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    box.appendChild(headerRow);
    
    items.forEach(item => {
        const row = document.createElement('div');
        row.innerText = item.content;
        row.style.cssText = 'padding:8px 12px; color:#e0e0e0; font-size:12px; cursor:pointer; border-bottom:1px solid #333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
        
        row.onmouseenter = () => row.style.backgroundColor = '#333';
        row.onmouseleave = () => row.style.backgroundColor = '#1a1a1a';
        
        row.onmousedown = (e) => {
            e.preventDefault(); // Prevent focus loss
            e.stopPropagation();
            
            if (targetInput.tagName === 'INPUT' || targetInput.tagName === 'TEXTAREA') {
                setNativeValue(targetInput, item.content);
            } else {
                // ContentEditable divs
                targetInput.innerText = item.content;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            inputBuffer = item.content;
            removeSuggestionBox();
        };
        box.appendChild(row);
    });
    
    document.body.appendChild(box);
    suggestionBox = box;
}