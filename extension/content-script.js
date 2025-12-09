// Content Script - Prompt Bin v2.0
// Feature: Robust Capture (Buffer System), Autocomplete, Response Detection

console.log('[Prompt Bin] Active on ' + window.location.hostname);

// --- STATE ---
let inputBuffer = '';
let isComposing = false; // For IME (Chinese/Japanese/etc) handling
let suggestionBox = null;

// --- TOOL IDENTIFICATION ---
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

// --- API: SEND TO BACKGROUND ---
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
        // Extension context invalidated (browser updated/reloaded)
        console.warn('[Prompt Bin] Context invalid, cannot save.');
    }
};

// ==========================================
// 1. PROMPT CAPTURE (THE ROBUST METHOD)
// ==========================================

// We monitor ALL input events. We do not trust the DOM to hold the value 
// at the moment of submission because frameworks clear it too fast.
document.addEventListener('compositionstart', () => isComposing = true, true);
document.addEventListener('compositionend', () => isComposing = false, true);

document.addEventListener('input', (e) => {
    if (isComposing) return; // Don't capture partial IME inputs

    const target = e.target;
    const isEditable = target.tagName === 'TEXTAREA' || 
                       target.tagName === 'INPUT' || 
                       target.getAttribute('contenteditable') === 'true';

    if (isEditable) {
        // Normalize: value for inputs, innerText for divs (Gemini/Claude)
        const val = target.value || target.innerText || '';
        inputBuffer = val;
        
        // Trigger Autocomplete
        if (inputBuffer.length > 3) {
            fetchSuggestions(inputBuffer, target);
        } else {
            removeSuggestionBox();
        }
    }
}, true);

// Trigger 1: Enter Key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeSuggestionBox();

    // Check for Enter (No Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
        // We use the buffer because the UI might clear instantly
        const textToSave = inputBuffer;
        
        if (textToSave && textToSave.length > 1) {
            removeSuggestionBox();
            
            // Allow a tiny delay to ensure it wasn't a "new line" command
            // But rely on the buffer we captured *before* the keypress processed fully
            setTimeout(() => {
                capture('prompt', textToSave);
                inputBuffer = ''; // Clear buffer after send
            }, 100);
        }
    }
}, true);

// Trigger 2: Click on "Send" Button
document.addEventListener('click', (e) => {
    removeSuggestionBox();
    
    const target = e.target;
    const btn = target.closest('button, [role="button"]');
    
    if (btn) {
        // Heuristic: Check if it looks like a send button
        const label = (btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase();
        const isSend = label.includes('send') || label.includes('submit') || label === '↑' || btn.querySelector('svg'); // Icons often used for send
        
        if (isSend && inputBuffer.length > 1) {
            capture('prompt', inputBuffer);
            inputBuffer = '';
        }
    }
}, true);

// ==========================================
// 2. RESPONSE CAPTURE (OBSERVER METHOD)
// ==========================================
// We watch for large text blocks being added to the DOM.
// This is harder to make generic, but we use heuristics.

let responseDebounceTimer = null;
let lastResponseText = '';

const observer = new MutationObserver((mutations) => {
    // Only process if we recently sent a prompt (simple state machine could go here)
    // For now, we capture *new* large text blocks that appear.
    
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach(node => {
                // Look for element nodes containing text
                if (node.nodeType === 1) { // Element
                    const text = node.innerText;
                    // Filter out short UI updates, loading states, etc.
                    if (text && text.length > 50) {
                        // Debounce the capture so we don't capture streaming tokens one by one
                        clearTimeout(responseDebounceTimer);
                        responseDebounceTimer = setTimeout(() => {
                            // Check if this looks like an AI response container
                            // (Usually has specific classes, but we are being robust/generic)
                            // We avoid capturing our own input buffer
                            if (text !== inputBuffer && text !== lastResponseText) {
                                capture('response', text);
                                lastResponseText = text;
                            }
                        }, 2000); // Wait 2 seconds for generation to pause/finish block
                    }
                }
            });
        }
    }
});

// Start observing the chat container (body is a safe fallback)
if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
}


// ==========================================
// 3. INLINE AUTOCOMPLETE UI
// ==========================================

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

function renderSuggestionBox(items, targetInput) {
    removeSuggestionBox();
    
    const rect = targetInput.getBoundingClientRect();
    
    const box = document.createElement('div');
    box.id = 'prompt-bin-autocomplete';
    
    // Styles
    Object.assign(box.style, {
        position: 'absolute',
        top: (window.scrollY + rect.top - (items.length * 35) - 10) + 'px', // Position ABOVE input
        left: (window.scrollX + rect.left) + 'px',
        width: Math.min(rect.width, 400) + 'px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #c41e3a',
        borderRadius: '8px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        zIndex: 10000,
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });
    
    // Header
    const header = document.createElement('div');
    header.innerText = 'PROMPT BIN SUGGESTIONS';
    Object.assign(header.style, {
        backgroundColor: '#c41e3a',
        color: 'white',
        fontSize: '10px',
        fontWeight: 'bold',
        padding: '4px 8px',
        letterSpacing: '1px'
    });
    box.appendChild(header);
    
    // Items
    items.forEach(item => {
        const row = document.createElement('div');
        row.innerText = item.content;
        Object.assign(row.style, {
            padding: '8px 12px',
            color: '#e0e0e0',
            fontSize: '12px',
            cursor: 'pointer',
            borderBottom: '1px solid #333',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        });
        
        row.onmouseenter = () => row.style.backgroundColor = '#333';
        row.onmouseleave = () => row.style.backgroundColor = 'transparent';
        
        row.onmousedown = (e) => {
            e.preventDefault(); // Stop blur event
            e.stopPropagation();
            
            // Insert Text
            if (targetInput.tagName === 'INPUT' || targetInput.tagName === 'TEXTAREA') {
                targetInput.value = item.content;
            } else {
                targetInput.innerText = item.content;
            }
            
            // Trigger React/Framework state update
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            inputBuffer = item.content;
            removeSuggestionBox();
        };
        
        box.appendChild(row);
    });
    
    document.body.appendChild(box);
    suggestionBox = box;
}