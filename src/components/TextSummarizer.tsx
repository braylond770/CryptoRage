import React, { useState, useEffect } from 'react';

interface TextSummarizerProps {
  text: string;
  onSummarize: (summary: string) => void;
}

const TextSummarizer: React.FC<TextSummarizerProps> = ({ text, onSummarize }) => {
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<AISummarizerType>('key-points');
  const [summaryFormat, setSummaryFormat] = useState<AISummarizerFormat>('markdown');
  const [summaryLength, setSummaryLength] = useState<AISummarizerLength>('short');

  useEffect(() => {
    checkSummarizerAvailability();
  }, []);

  const checkSummarizerAvailability = async () => {
    if (!window.ai?.summarizer) {
      setError("Summarization API is not available. Make sure you've enabled it in Chrome's flags.");
      return;
    }

    try {
      const canSummarize = await window.ai.summarizer.capabilities();
      if (canSummarize.available === 'no') {
        setError("Summarization is not supported on this device.");
      }
    } catch (err: any) {
      setError(`Error checking summarizer availability: ${err.message}`);
    }
  };

  const summarizeText = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!window.ai?.summarizer) {
        throw new Error("Summarization API is not available");
      }

      const session = await window.ai.summarizer.create({
        type: summaryType,
        format: summaryFormat,
        length: summaryLength,
      });

      if (session.ready) {
        await session.ready;
      }

      const result = await session.summarize(text);
      setSummary(result);
      onSummarize(result);
      session.destroy();
    } catch (err: any) {
      setError(`Failed to summarize text: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMarkdown = (markdown: string) => {
    // Convert markdown to HTML with proper formatting
    return markdown
      .split('\n')
      .map(line => {
        // Handle headers
        if (line.startsWith('# ')) {
          return `<h1 class="text-2xl font-bold mb-4">${line.slice(2)}</h1>`;
        }
        if (line.startsWith('## ')) {
          return `<h2 class="text-xl font-bold mb-3">${line.slice(3)}</h2>`;
        }
        if (line.startsWith('### ')) {
          return `<h3 class="text-lg font-bold mb-2">${line.slice(4)}</h3>`;
        }

        // Handle bold text
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');

        // Handle bullet points
        if (line.startsWith('* ')) {
          return `<li class="ml-4 mb-2 list-disc">${line.slice(2)}</li>`;
        }

        // Handle paragraphs
        if (line.trim()) {
          return `<p class="mb-4 leading-relaxed">${line}</p>`;
        }

        return '';
      })
      .join('');
  };

  return (
    <div className="mt-4">
      <div className="mb-4">
        <label htmlFor="summaryType" className="block text-sm font-medium  text-slate-200">Summary Type:</label>
        <select
          id="summaryType"
          value={summaryType}
          onChange={(e) => setSummaryType(e.target.value as AISummarizerType)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-white bg-black border-2 border-white focus:outline-none focus:ring-[#00ADB5] focus:border-[#00ADB5] sm:text-sm rounded-md"
        >
          <option value="key-points">Key Points</option>
          <option value="tl;dr">TL;DR</option>
          <option value="teaser">Teaser</option>
          <option value="headline">Headline</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="summaryFormat" className="block text-sm font-medium text-slate-200">Format:</label>
        <select
          id="summaryFormat"
          value={summaryFormat}
          onChange={(e) => setSummaryFormat(e.target.value as AISummarizerFormat)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-white bg-black border-2 border-gray-300 focus:outline-none focus:ring-[#00ADB5] focus:border-[#00ADB5] sm:text-sm rounded-md"
        >
          <option value="markdown">Markdown</option>
          <option value="plain-text">Plain text</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="summaryLength" className="block text-sm font-medium text-slate-200">Length:</label>
        <select
          id="summaryLength"
          value={summaryLength}
          onChange={(e) => setSummaryLength(e.target.value as AISummarizerLength)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-white bg-black border-2 border-gray-300 focus:outline-none focus:ring-[#00ADB5] focus:border-[#00ADB5] sm:text-sm rounded-md"
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </div>
      <button 
        onClick={summarizeText}
        disabled={isLoading || !!error}
        className="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded transition duration-300"
      >
        {isLoading ? 'Summarizing...' : 'Summarize Text'}
      </button>
      {error && <p className="text-error mt-2">{error}</p>}
      {summary && (
        <div className="mt-4 bg-surface p-4 rounded-lg shadow-lg border border-primary/30">
          <h3 className="text-xl font-bold mb-4 text-primary">Summary</h3>
          <div className="prose prose-invert max-w-none text-justify">
            {summaryFormat === 'markdown' ? (
              <div 
                className="text-text space-y-2"
                dangerouslySetInnerHTML={{ 
                  __html: formatMarkdown(summary)
                }}
              />
            ) : (
              <p className="text-text leading-relaxed whitespace-pre-line">
                {summary}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextSummarizer;
