import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiImage, FiMusic, FiVideo, FiLink, FiX, FiExternalLink, FiDownload, FiCamera } from 'react-icons/fi';

export interface WebpageContent {
  images: string[];
  audio: string[];
  video: string[];
  links: string[];
}

interface WebpageContentViewProps {
  content: WebpageContent;
  onCapture: (imageUrl: string) => void;
}

const WebpageContentView: React.FC<WebpageContentViewProps> = ({ content, onCapture }) => {
  const [activeContentType, setActiveContentType] = useState<keyof WebpageContent | null>(null);

  const contentTypes: Array<keyof WebpageContent> = ['images', 'audio', 'video', 'links'];

  const groupedLinks = useMemo(() => {
    return content.links.reduce((acc, link) => {
      const url = new URL(link);
      const domain = url.hostname;
      if (!acc[domain]) {
        acc[domain] = [];
      }
      acc[domain].push(link);
      return acc;
    }, {} as Record<string, string[]>);
  }, [content.links]);

  const downloadMedia = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    if (!activeContentType) return null;

    const items = activeContentType === 'links' ? groupedLinks : content[activeContentType];

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background z-50 overflow-hidden flex flex-col"
      >
        <div className="bg-surface p-4 flex justify-between items-center shadow-md">
          <h2 className="text-2xl font-semibold capitalize text-primary">{activeContentType}</h2>
          <button
            onClick={() => setActiveContentType(null)}
            className="text-text hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
          >
            <FiX size={24} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
          {activeContentType === 'images' || activeContentType === 'video' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(items as string[]).map((item: string, index: number) => (
                <div key={index} className="relative group aspect-w-16 aspect-h-9">
                  {activeContentType === 'images' ? (
                    <img 
                      src={item} 
                      alt={`Webpage image ${index + 1}`} 
                      className="w-full h-full object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition-opacity" 
                      onClick={() => onCapture(item)}
                    />
                  ) : (
                    <video 
                      src={item} 
                      className="w-full h-full object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition-opacity" 
                      controls
                    />
                  )}
                  {activeContentType === 'images' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                      <button
                        onClick={() => downloadMedia(item)}
                        className="p-2 bg-primary rounded-full text-white hover:bg-primary-dark transition-colors"
                        title="Download"
                      >
                        <FiDownload size={20} />
                      </button>
                     
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : activeContentType === 'audio' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(items as string[]).map((item: string, index: number) => (
                <div key={index} className="bg-surface p-4 rounded-lg shadow-md">
                  <audio controls src={item} className="w-full mb-2" />
                  <button
                    onClick={() => downloadMedia(item)}
                    className="w-full p-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors flex items-center justify-center"
                  >
                    <FiDownload size={20} className="mr-2" /> Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(items as Record<string, string[]>).map(([domain, links]) => (
                <div key={domain} className="bg-background/50 p-4 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-primary">{domain}</h3>
                  <ul className="space-y-2">
                    {links.map((link: string, index: number) => (
                      <li key={index} className="truncate">
                        <a 
                          href={link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-text hover:text-primary transition-colors flex items-center"
                        >
                          <FiExternalLink size={16} className="mr-2 flex-shrink-0" />
                          <span className="truncate">{new URL(link).pathname}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      key="webpage"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {contentTypes.map((type) => (
          <ContentTypeCard
            key={type}
            type={type}
            count={content[type].length}
            onClick={() => setActiveContentType(type)}
          />
        ))}
      </div>
      <AnimatePresence>
        {activeContentType && renderContent()}
      </AnimatePresence>
    </motion.div>
  );
};

interface ContentTypeCardProps {
  type: keyof WebpageContent;
  count: number;
  onClick: () => void;
}

const ContentTypeCard: React.FC<ContentTypeCardProps> = ({ type, count, onClick }) => {
  const icons = {
    images: FiImage,
    audio: FiMusic,
    video: FiVideo,
    links: FiLink
  };
  const Icon = icons[type];

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="p-6 rounded-lg shadow-md cursor-pointer transition-all duration-300 bg-surface hover:bg-primary/20 hover:shadow-lg"
      onClick={onClick}
    >
      <Icon size={32} className="mb-3 text-primary" />
      <h3 className="text-lg font-semibold capitalize mb-1">{type}</h3>
      <p className="text-sm text-text-secondary">{count} items</p>
    </motion.div>
  );
};

export default WebpageContentView;