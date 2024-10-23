declare global {
    type AIModelAvailability = 'readily' | 'after-download' | 'no';
    type AISummarizerType = 'tl;dr' | 'key-points' | 'teaser' | 'headline';
    type AISummarizerFormat = 'plain-text' | 'markdown';
    type AISummarizerLength = 'short' | 'medium' | 'long';
  
    type AISummarizerCreateOptions = {
      type?: AISummarizerType;
      length?: AISummarizerLength;
      format?: AISummarizerFormat;
    };
  
    type AISummarizer = {
      capabilities: () => Promise<AISummarizerCapabilities>;
      create: (options?: AISummarizerCreateOptions) => Promise<AISummarizerSession>;
    };
  
    type AISummarizerCapabilities = {
      available: AIModelAvailability;
    };
  
    type AIModelDownloadProgressEvent = {
      loaded: number;
      total: number;
    };
  
    type AIModelDownloadCallback = (event: AIModelDownloadProgressEvent) => void;
  
    type AISummarizerSession = {
      destroy: () => void;
      ready: Promise<void>;
      summarize: (text: string) => Promise<string>;
      addEventListener: (event: string, callback: AIModelDownloadCallback) => void;
    };
  
    interface Window {
      ai?: {
        summarizer?: AISummarizer;
      };
    }
  }
  
  export {};