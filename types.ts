export enum AiTool {
  ChatGPT = 'ChatGPT',
  Gemini = 'Gemini',
  Perplexity = 'Perplexity',
  Claude = 'Claude',
  Copilot = 'Copilot'
}

export enum CaptureType {
  Prompt = 'prompt',
  Response = 'response'
}

export interface CaptureItem {
  id: string;
  type: CaptureType;
  content: string;
  aiTool: AiTool;
  timestamp: string;
  category: string;
  tokens: number;
  sessionUrl?: string;
}

export interface Stats {
  total: number;
  tokens: number;
  prompts: number;
  responses: number;
}