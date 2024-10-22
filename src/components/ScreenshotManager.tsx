import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCamera, FiUpload, FiDownload, FiLink, FiTrash2, FiImage, FiX, FiUsers, FiGrid, FiMaximize, FiBell, FiChevronUp, FiChevronDown, FiLoader, FiList } from 'react-icons/fi';
import { supabase } from './supabaseClient';
import TeamManager from './TeamManager';
import WebpageContentView, { WebpageContent } from './WebpageContentView';

const PUBLISHER_URL = 'https://publisher-devnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator-devnet.walrus.space';
const EPOCHS = '5';

interface ExtractedText {
  text: string;
  screenshot_id: number;
}
interface ScreenshotInfo {
  id?: number;
  fileName: string;
  blobId: string;
  blobUrl: string;
  suiUrl: string;
  walletAddress: string;
  team_id?: number | null;
  teams?: { name: string } | null;
  websiteName: string; 
}

interface ScreenshotManagerProps {
  walletAddress: string;
}

const ScreenshotManager: React.FC<ScreenshotManagerProps> = ({ walletAddress }) => {
  const [activeTab, setActiveTab] = useState<'capture' | 'gallery' | 'team' | 'webpage'>('capture');
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<ScreenshotInfo | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [userTeams, setUserTeams] = useState<{ id: number; name: string }[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<number>(0);
  const [websiteName, setWebsiteName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [webpageContent, setWebpageContent] = useState<WebpageContent>({
    images: [],
    audio: [],
    video: [],
    links: []
  });
  const [activeContentType, setActiveContentType] = useState<keyof WebpageContent | null>(null);

  useEffect(() => {
    fetchScreenshots();
  }, [walletAddress, selectedTeam]);

  const fetchWebpageContent = () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'getWebpageContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          } else if (response && response.content) {
            setWebpageContent(response.content);
          }
        });
      }
    });
  };

  useEffect(() => {
    if (activeTab === 'webpage') {
      fetchWebpageContent();
    }
  }, [activeTab]);

  const LazyImage = ({ src, alt }: { src: string; alt: string }) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      });

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => {
        observer.disconnect();
      };
    }, []);

    return (
      <img
        ref={imgRef}
        src={isLoaded ? src : ''}
        alt={alt}
        className={`w-full h-full object-cover transition duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    );
  };

  
  
  const extractTextFromImage = async (dataUrl: string) => {
    try {
      setLoading(true);
      setError(null);
  
      const apiKey = process.env.REACT_APP_OCR_API_KEY;
      if (!apiKey) {
        throw new Error('OCR API key is missing');
      }
  
      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
  
      const formData = new FormData();
      formData.append('language', 'eng');
      formData.append('file', blob, 'screenshot.png');
  
      const extractionResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': apiKey,
        },
        body: formData,
      });
  
      if (!extractionResponse.ok) {
        throw new Error('Failed to extract text from image');
      }
  
      const extractionResult = await extractionResponse.json();
      
      if (extractionResult.ParsedResults && extractionResult.ParsedResults.length > 0) {
        setExtractedText(extractionResult.ParsedResults[0].ParsedText);
      } else {
        setExtractedText('No text found in the image.');
      }
    } catch (err: any) {
      setError(`Failed to extract text from image. ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScreenshots = async () => {
    try {
      setLoading(true);

      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('walletAddress', walletAddress);

      if (teamMemberError) throw teamMemberError;

      const teamIds = teamMemberData?.map((tm) => tm.team_id) || [];

      const { data, error } = await supabase
        .from('screenshots')
        .select(`
          *,
          teams:team_id (
            name
          )
        `)
        .or(`walletAddress.eq.${walletAddress},team_id.in.(${teamIds.join(',')})`);

      if (error) throw error;

      setUploadedScreenshots(data || []);
    } catch (err: any) {
      setError('Failed to fetch screenshots. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const captureScreenshot = (imageUrl?: string) => {
    if (imageUrl) {
      // If an imageUrl is provided, use it directly
      setLatestScreenshot(imageUrl);
      extractTextFromImage(imageUrl);
      // Get the website name from the image URL
      try {
        const url = new URL(imageUrl);
        setWebsiteName(url.hostname);
      } catch (error) {
        console.error("Invalid URL:", error);
        setWebsiteName('Unknown');
      }
    } else {
      // Otherwise, capture the current tab
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          const url = new URL(activeTab.url);
          setWebsiteName(url.hostname);
        }
        
        chrome.tabs.captureVisibleTab(
          chrome.windows.WINDOW_ID_CURRENT,
          { format: 'png' },
          async (dataUrl) => {
            setLatestScreenshot(dataUrl);
            await extractTextFromImage(dataUrl);
          }
        );
      });
    }
    // Switch to the capture tab after capturing
    setActiveTab('capture');
  };

  const captureFullPageScreenshot = () => {
    setLoading(true);
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        setError('No active tab found');
        setLoading(false);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' }, (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError(`Failed to capture full page: ${chrome.runtime.lastError.message}`);
        } else if (!response || !response.success) {
          setError(`Failed to capture full page: ${response?.error || 'Unknown error'}`);
        } else {
          setLatestScreenshot(response.dataUrl);
        }
      });
    });
  };

  useEffect(() => {
    fetchUserTeams();
  }, [walletAddress]);

  const fetchUserTeams = async () => {
    try {
      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('walletAddress', walletAddress);

      if (teamMemberError) throw teamMemberError;

      const teamIds = teamMemberData?.map((tm) => tm.team_id).join(',') || '';

      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .or(`created_by.eq.${walletAddress},id.in.(${teamIds})`);

      if (error) throw error;

      setUserTeams(data || []);
    } catch (err) {
      console.error('Error fetching user teams:', err);
      setError('Failed to fetch user teams. Please try again.');
    }
  };

  const uploadScreenshot = async () => {
    if (!latestScreenshot) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(latestScreenshot);
      const blob = await response.blob();
      const file = new File([blob], `${websiteName}-${Date.now()}.png`, { type: 'image/png' });
      const uploadResponse = await fetch(`${PUBLISHER_URL}/v1/store?epochs=${EPOCHS}`, {
        method: "PUT",
        body: file,
      });
      if (uploadResponse.status === 200) {
        const info = await uploadResponse.json();
        let blobId = '', suiUrl = '';
        if (info.alreadyCertified) {
          blobId = info.alreadyCertified.blobId;
          suiUrl = `https://suiscan.xyz/testnet/tx/${info.alreadyCertified.event.txDigest}`;
        } else if (info.newlyCreated) {
          blobId = info.newlyCreated.blobObject.blobId;
          suiUrl = `https://suiscan.xyz/testnet/object/${info.newlyCreated.blobObject.id}`;
        }
        const blobUrl = `${AGGREGATOR_URL}/v1/${blobId}`;
        const newScreenshot: ScreenshotInfo = { 
          fileName: file.name, 
          blobId, 
          blobUrl, 
          suiUrl,
          walletAddress,
          team_id: selectedTeam,
          websiteName // Add this new field
        };
        
        if (extractedText) {
          const { data, error: supabaseError } = await supabase
            .from('screenshots')
            .insert({
              ...newScreenshot,
              extracted_text: extractedText
            });

          if (supabaseError) throw supabaseError;
        } else {
          const { data, error: supabaseError } = await supabase
            .from('screenshots')
            .insert(newScreenshot);

          if (supabaseError) throw supabaseError;
        }

        setUploadedScreenshots(prev => [...prev, newScreenshot]);
        setActiveTab('gallery');
        setExtractedText(null);
        setWebsiteName(''); // Reset website name after upload
      }
    } catch (err: any) {
      setError(`Failed to upload screenshot. Please try again.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadScreenshot = async (screenshotInfo: ScreenshotInfo) => {
    try {
      const response = await fetch(screenshotInfo.blobUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', screenshotInfo.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(`Failed to download ${screenshotInfo.fileName}. Please try again.`);
      console.error(err);
    }
  };

  const deleteScreenshot = async (id: number) => {
    try {
      const { error: deleteError } = await supabase
        .from('screenshots')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setUploadedScreenshots(uploadedScreenshots.filter(screenshot => screenshot.id !== id));
    } catch (err: any) {
      setError(`Failed to delete screenshot. Please try again.`);
      console.error(err);
    }
  };

  const openPreview = (screenshot: ScreenshotInfo) => {
    setPreviewScreenshot(screenshot);
  };

  const closePreview = () => {
    setPreviewScreenshot(null);
  };

  

  return (
    <div className="bg-gradient-to-br from-background to-surface text-text w-full h-screen flex flex-col border border-primary/30 rounded-[20px] overflow-hidden shadow-lg">
      <motion.header 
        className="bg-gradient-to-r from-primary/20 to-secondary/20 p-4 flex justify-between items-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex space-x-4">
          <TabButton icon={<FiCamera size={18} />} label="Capture" isActive={activeTab === 'capture'} onClick={() => setActiveTab('capture')} />
          <TabButton icon={<FiGrid size={18} />} label="Gallery" isActive={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} />
          <TabButton icon={<FiUsers size={18} />} label="Team" isActive={activeTab === 'team'} onClick={() => setActiveTab('team')} />
          <TabButton icon={<FiList size={18} />} label="Webpage" isActive={activeTab === 'webpage'} onClick={() => setActiveTab('webpage')} />
        </div>
      
      </motion.header>

      <main className="flex-grow overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'capture' && (
            <motion.div
              key="capture"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col h-full"
            >
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 ">
                  <CaptureArea latestScreenshot={latestScreenshot} onCapture={captureScreenshot} />
                  <div className="flex flex-col space-y-3 mt-4">
                    <CaptureButton icon={<FiCamera />} label="Capture Screenshot" onClick={captureScreenshot} />
                    <CaptureButton2 icon={<FiMaximize />} label="Capture Full Page" onClick={captureFullPageScreenshot} />
                    <div className="flex space-x-2">
                      <TeamSelector
                        teams={userTeams}
                        selectedTeam={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
                      />
                      <UploadButton onClick={uploadScreenshot} disabled={!latestScreenshot || loading} loading={loading} />
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-2">
                  {extractedText && <ExtractedTextDisplay text={extractedText} />}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <GalleryView
              screenshots={uploadedScreenshots}
              onPreview={openPreview}
              onDownload={downloadScreenshot}
              onDelete={deleteScreenshot}
            />
          )}

          {activeTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <TeamManager 
                walletAddress={walletAddress}
                onScreenshotCapture={captureScreenshot}
                latestScreenshot={latestScreenshot}
                extractedText={extractedText}
              />
            </motion.div>
          )}

{activeTab === 'webpage' && (
  <WebpageContentView 
    content={webpageContent}
    onCapture={captureScreenshot}
  />
)}
        </AnimatePresence>
      </main>

      {error && <ErrorDisplay message={error} />}

      <AnimatePresence>
        {previewScreenshot && (
          <ScreenshotPreview
            screenshot={previewScreenshot}
            onClose={closePreview}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TabButton: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick} 
    className={`p-2 rounded-full flex items-center space-x-2 transition-colors duration-300 ${isActive ? 'bg-primary text-background' : 'bg-transparent text-text hover:bg-primary/20'}`}
    title={label}
  >
    {icon}
    <span className="hidden md:inline">{label}</span>
  </button>
);


const CaptureArea: React.FC<{ latestScreenshot: string | null; onCapture: () => void }> = ({ latestScreenshot, onCapture }) => (
  <div className=" bg-transparent rounded-lg overflow-hidden mb-3 flex items-center justify-center h-64">
    {latestScreenshot ? (
      <img src={latestScreenshot} alt="Latest Screenshot" className="max-w-full max-h-full object-contain" />
    ) : (
      <div 
        className="relative w-64 h-64 cursor-pointer group"
        onClick={onCapture}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-black rounded-full animate-spin-slow"></div>
        <div className="absolute inset-2 bg-surface rounded-full flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-transparent via-primary to-transparent animate-swipe"></div>
        </div>
        <div className="absolute inset-4 border-2 border-primary rounded-full animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center group-hover:animate-capture-click">
            <FiCamera size={32} className="text-primary group-hover:text-accent-teal transition-colors duration-300" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 border border-secondary rounded-full animate-ping opacity-75"></div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
          <div className="w-56 h-56 border-t-2 border-r-2 border-primary rounded-full animate-spin-reverse"></div>
        </div>
        <div className="absolute bottom-0 right-0 animate-bounce">
          <div className="w-4 h-4 bg-primary rounded-full"></div>
          </div>
      </div>
    )}
  </div>
);

const CaptureButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick} 
    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white py-2 px-4 rounded-full transition duration-300 flex items-center justify-center"
  >
    {icon}
    <span className="ml-2">{label}</span>
  </button>
);
const CaptureButton2: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick} 
    className="bg-gradient-to-l from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white py-2 px-4 rounded-full transition duration-300 flex items-center justify-center"
  >
    {icon}
    <span className="ml-2">{label}</span>
  </button>
);

const TeamSelector: React.FC<{ teams: { id: number; name: string }[]; selectedTeam: number | null; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }> = ({ teams, selectedTeam, onChange }) => (
  <select
    value={selectedTeam?.toString() || ''}
    onChange={onChange}
    className="bg-surface text-text py-2 px-3 rounded flex-grow border border-primary/30 focus:border-primary focus:outline-none"
  >
    <option value="">Select a team (optional)</option>
    {teams.map((team) => (
      <option key={team.id} value={team.id}>{team.name}</option>
    ))}
  </select>
);

const UploadButton: React.FC<{ onClick: () => void; disabled: boolean; loading: boolean }> = ({ onClick, disabled, loading }) => (
  <button 
    onClick={onClick} 
    className={`flex-shrink-0 ${disabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-accent-orange to-accent-yellow hover:from-accent-orange/80 hover:to-accent-yellow/80'} text-white py-2 px-4 rounded transition duration-300 flex items-center justify-center`}
    disabled={disabled}
  >
    {loading ? <div className="fancy-loader"></div> : <FiUpload />}
  </button>
);

const ExtractedTextDisplay: React.FC<{ text: string }> = ({ text }) => (
  <div className="h-full p-4 bg-gradient-to-br from-surface to-background rounded border border-primary/30 overflow-hidden">
    <h4 className="text-lg font-semibold text-primary mb-2">Extracted Text:</h4>
    <div className="h-[calc(100%-2rem)] overflow-hidden custom-scrollbar">
      <p className="text-sm text-text whitespace-pre-wrap break-words">{text}</p>
    </div>
  </div>
);

const GalleryView: React.FC<{ screenshots: ScreenshotInfo[]; onPreview: (screenshot: ScreenshotInfo) => void; onDownload: (screenshot: ScreenshotInfo) => void; onDelete: (id: number) => void }> = ({ screenshots, onPreview, onDownload, onDelete }) => {
  const [expandedWebsites, setExpandedWebsites] = useState<Record<string, boolean>>({});

  const groupedScreenshots = screenshots.reduce((acc, screenshot) => {
    if (!acc[screenshot.websiteName]) {
      acc[screenshot.websiteName] = [];
    }
    acc[screenshot.websiteName].push(screenshot);
    return acc;
  }, {} as Record<string, ScreenshotInfo[]>);

  const toggleWebsite = (websiteName: string) => {
    setExpandedWebsites(prev => ({
      ...prev,
      [websiteName]: !prev[websiteName]
    }));
  };

  return (
    <motion.div
      key="gallery"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-3"
    >
      {Object.keys(groupedScreenshots).length === 0 ? (
        <EmptyGallery />
      ) : (
        Object.entries(groupedScreenshots).map(([websiteName, websiteScreenshots]) => (
          <WebsiteGroup
            key={websiteName}
            websiteName={websiteName}
            screenshots={websiteScreenshots}
            isExpanded={expandedWebsites[websiteName] || false}
            onToggle={() => toggleWebsite(websiteName)}
            onPreview={onPreview}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        ))
      )}
    </motion.div>
  );
};

const WebsiteGroup: React.FC<{
  websiteName: string;
  screenshots: ScreenshotInfo[];
  isExpanded: boolean;
  onToggle: () => void;
  onPreview: (screenshot: ScreenshotInfo) => void;
  onDownload: (screenshot: ScreenshotInfo) => void;
  onDelete: (id: number) => void;
}> = ({ websiteName, screenshots, isExpanded, onToggle, onPreview, onDownload, onDelete }) => (
  <div className="bg-gradient-to-br from-surface to-background rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full p-3 flex items-center justify-between text-left bg-primary/10 hover:bg-primary/20 transition-colors duration-300"
    >
      <span className="font-medium">{websiteName}</span>
      <span className="text-primary">
        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
      </span>
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {screenshots.map((screenshot) => (
            <ScreenshotItem
              key={screenshot.id}
              screenshot={screenshot}
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const EmptyGallery: React.FC = () => (
  <div className="text-center py-8">
    <div className="animate-spin">
      <FiImage size={48} className="mx-auto mb-2 text-primary" />
    </div>
    <p className="text-text">No screenshots yet</p>
  </div>
);

const ScreenshotItem: React.FC<{ screenshot: ScreenshotInfo; onPreview: (screenshot: ScreenshotInfo) => void; onDownload: (screenshot: ScreenshotInfo) => void; onDelete: (id: number) => void }> = ({ screenshot, onPreview, onDownload, onDelete }) => (
  <div className="bg-gradient-to-br from-surface to-background rounded-lg p-2 flex items-center">
    <div className="flex-grow mr-2 truncate cursor-pointer" onClick={() => onPreview(screenshot)}>
      <p className="text-sm truncate">{screenshot.websiteName}</p>
      <p className="text-xs text-text-secondary truncate">{screenshot.fileName}</p>
      <div className="flex items-center">
        <p className="text-xs text-text-secondary">ID: {screenshot.blobId.slice(0, 10)}...</p>
        {screenshot.team_id && (
          <span className="ml-2 text-xs text-primary flex items-center">
            <FiUsers size={12} className="mr-1" />
            Shared
          </span>
        )}
      </div>
    </div>
    <div className="flex space-x-1">
      <ActionButton icon={<FiDownload size={16} />} onClick={() => onDownload(screenshot)} title="Download" />
      <ActionButton icon={<FiLink size={16} />} onClick={() => window.open(screenshot.suiUrl, '_blank')} title="View on Sui Explorer" />
      <ActionButton icon={<FiTrash2 size={16} />} onClick={() => screenshot.id && onDelete(screenshot.id)} title="Delete" className="text-error hover:text-error/80" />
    </div>
  </div>
);

const ActionButton: React.FC<{ icon: React.ReactNode; onClick: () => void; title: string; className?: string }> = ({ icon, onClick, title, className }) => (
  <button
    onClick={onClick}
    className={`text-primary hover:text-primary/80 p-1 rounded transition-colors duration-300 ${className}`}
    title={title}
  >
    {icon}
  </button>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-gradient-to-r from-error to-error/80 text-background p-2 text-sm rounded-b-lg">
    {message}
  </div>
);

const ScreenshotPreview: React.FC<{ screenshot: ScreenshotInfo; onClose: () => void }> = ({ screenshot, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="fixed inset-0 bg-background bg-opacity-75 flex items-center justify-center z-50 ">
      <div className="bg-gradient-to-br from-surface to-background rounded-lg max-w-[90%] max-h-[90%] overflow-hidden shadow-lg">
        <div className="p-2 flex justify-between items-center bg-gradient-to-r from-primary/20 to-secondary/20 h-20">
          <h3 className="text-sm truncate">{screenshot.fileName}</h3>
          <button onClick={onClose} className="text-text hover:text-primary p-5  rounded transition-colors duration-300">
            <FiX size={20} />
          </button>
        </div>
        <div className="relative h-auto">
          {isLoading && (
            <div className="absolute inset-0  flex items-center justify-center bg-background bg-opacity-50">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <FiLoader size={40} className="text-primary" />
              </motion.div>
            </div>
          )}
          <img 
            src={screenshot.blobUrl} 
            alt={screenshot.fileName} 
            className="max-w-full max-h-[calc(90vh-4rem)] object-contain"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  );
};


export default ScreenshotManager;
