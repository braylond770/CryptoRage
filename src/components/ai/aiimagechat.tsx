import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { FiSend, FiLoader, FiChevronUp, FiChevronDown } from "react-icons/fi";

interface AIChatBoxProps {
  imageData: string | null;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

const AIChatBox: React.FC<AIChatBoxProps> = ({ imageData }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    // Add the user’s message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    setHistoryOpen(true);

    try {
      const response = await fetch(
        "https://openrouter-api-indol.vercel.app/api/analyze-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: inputText, imageData }),
        }
      );
      const data = await response.json();
      const aiText =
        data.data?.content ||
        data.response ||
        "Sorry, I couldn't analyze the image.";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        isUser: false,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: "Error processing your request. Try again.",
          isUser: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (historyOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, historyOpen]);

  return (
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 w-full max-w-[500px] px-2 z-50">
      <div className="flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-cyan-200 dark:border-cyan-700 overflow-hidden">
        {/* Chat History */}
        {historyOpen && (
          <div className="flex-1 max-h-[400px] overflow-y-auto px-3 py-2 space-y-2 bg-cyan-50 dark:bg-slate-800 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-xs text-cyan-700 dark:text-cyan-200">
                No messages yet.
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`
                    px-3 
                    py-2 
                    rounded-xl 
                    max-w-[90%] 
                    text-sm 
                    whitespace-pre-wrap 
                    break-words 
                    ${
                      msg.isUser
                        ? "bg-cyan-600 text-white"
                        : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    }
                  `}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-cyan-200 dark:border-cyan-700 bg-white dark:bg-slate-900">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-1 rounded-full bg-cyan-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`ml-2 p-2 rounded-full transition-all duration-150 ${
              !inputText.trim() || isLoading
                ? "bg-cyan-300 dark:bg-cyan-700 text-white opacity-50 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 text-white"
            }`}
          >
            {isLoading ? (
              <FiLoader size={16} className="animate-spin" />
            ) : (
              <FiSend size={16} />
            )}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="ml-2 p-2 text-cyan-700 dark:text-cyan-200 hover:text-cyan-900 dark:hover:text-cyan-100"
            >
              {historyOpen ? (
                <FiChevronDown size={18} />
              ) : (
                <FiChevronUp size={18} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatBox;
