/**
 * Content Script for Prompt Bin
 */

declare var chrome: any;

interface CaptureData {
  type: 'prompt' | 'response';
  content: string;
  aiTool: string;
  timestamp: string;
  sessionUrl: string;
}

class AIExtensionManager {
  private buffer: string = '';
  private toolName: string;
  private lastCaptureTime: number = 0;
  
  constructor() {
    this.toolName = this.detectTool();
    this.initInputListeners();
    // In a real implementation, you would strictly verify message observers per tool
  }

  private detectTool(): string {
    const host = window.location.hostname;
    if (host.includes('openai') || host.includes('chatgpt')) return 'ChatGPT';
    if (host.includes('google') || host.includes('gemini')) return 'Gemini';
    if (host.includes('claude') || host.includes('anthropic')) return 'Claude';
    if (host.includes('perplexity')) return 'Perplexity';
    if (host.includes('microsoft') || host.includes('copilot') || host.includes('bing')) return 'Copilot';
    return 'Unknown';
  }

  private initInputListeners() {
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      if (this.isInputField(target)) {
        this.buffer = target.value || target.textContent || '';
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (this.buffer.trim().length > 3) {
          this.capture('prompt', this.buffer);
          setTimeout(() => { this.buffer = ''; }, 500);
        }
      }
    }, true);

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button');
      if (btn) {
        const label = (btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase();
        if (label.includes('send') || label.includes('submit') || label === '↑') {
           if (this.buffer.trim().length > 3) {
            this.capture('prompt', this.buffer);
            this.buffer = '';
           }
        }
      }
    }, true);
  }

  private isInputField(el: HTMLElement): boolean {
    return el.tagName === 'TEXTAREA' || 
           el.tagName === 'INPUT' || 
           el.getAttribute('contenteditable') === 'true';
  }

  private capture(type: 'prompt' | 'response', content: string) {
    if (Date.now() - this.lastCaptureTime < 1000) return;
    this.lastCaptureTime = Date.now();

    const data: CaptureData = {
      type,
      content: content.trim(),
      aiTool: this.toolName,
      timestamp: new Date().toISOString(),
      sessionUrl: window.location.href
    };

    console.log('[Prompt Bin] Capturing:', data);
    
    // Send to background script if available
    try {
      if (chrome && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'capture', data });
      }
    } catch (e) {
      // Ignore errors in disconnected contexts
    }
  }
}

new AIExtensionManager();

export {};
