import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCamera, FiUpload, FiDownload, FiLink, FiTrash2, FiImage, FiX, FiUsers, FiGrid, FiMaximize, FiBell } from 'react-icons/fi';
import { supabase } from './supabaseClient';
import TeamManager from './TeamManager';

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
}

interface ScreenshotManagerProps {
  walletAddress: string;
}

const ScreenshotManager: React.FC<ScreenshotManagerProps> = ({ walletAddress }) => {
  const [activeTab, setActiveTab] = useState<'capture' | 'gallery' | 'team'>('capture');
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<ScreenshotInfo | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [userTeams, setUserTeams] = useState<{ id: number; name: string }[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<number>(0);

  useEffect(() => {
    fetchScreenshots();
  }, [walletAddress, selectedTeam]);

  useEffect(() => {
    const subscription = supabase
      .channel(`user_${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'screenshots',
          filter: `team_id=eq.${selectedTeam}`
        }, (payload) => {
        if (payload.new.team_id && payload.new.walletAddress !== walletAddress) {
          setNotifications((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletAddress]);

  const clearNotifications = () => {
    setNotifications(0);
  };


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

  const captureScreenshot = () => {
    chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: 'png' },
      async (dataUrl) => {
        setLatestScreenshot(dataUrl);
        await extractTextFromImage(dataUrl);
      }
    );
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
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
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
          team_id: selectedTeam
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
        setExtractedText(null); // Reset extracted text after upload
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
    <div className="bg-surface text-text w-full h-auto flex flex-col border border-primary/30 rounded-[20px] overflow-hidden">
      <motion.header 
        className="bg-surface p-3 flex justify-between items-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex space-x-6">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab('capture')} 
            className={`p-2 rounded ${activeTab === 'capture' ? 'bg-primary text-white' : 'bg-transparent hover:bg-primary/20'}`} 
            title="Capture"
          >
            <FiCamera size={18} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab('gallery')} 
            className={`p-2 rounded ${activeTab === 'gallery' ? 'bg-primary text-white' : 'bg-transparent hover:bg-primary/20'}`} 
            title="Gallery"
          >
            <FiGrid size={18} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab('team')} 
            className={`p-2 rounded ${activeTab === 'team' ? 'bg-primary text-white' : 'bg-transparent hover:bg-primary/20'}`} 
            title="Team"
          >
            <FiUsers size={18} />
          </motion.button>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative p-2 rounded bg-transparent hover:bg-primary/20" 
          onClick={clearNotifications}
        >
          <FiBell size={18} />
          {notifications > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center"
            >
              {notifications}
            </motion.span>
          )}
        </motion.button>
      </motion.header>

      <main className="flex-grow overflow-y-auto p-3 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'capture' && (
            <motion.div
              key="capture"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col h-full"
            >
              <div className="flex-grow bg-surface rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                {latestScreenshot ? (
                  <img src={latestScreenshot} alt="Latest Screenshot" className="max-w-full max-h-full object-contain" />
                ) : (
                  <motion.div 
                    className="relative w-64 h-64 cursor-pointer group"
                    onClick={captureScreenshot}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full animate-spin-slow"></div>
                    <div className="absolute inset-2 bg-surface rounded-full flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-transparent via-primary to-transparent animate-swipe"></div>
                    </div>
                    <div className="absolute inset-4 border-2 border-primary rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center group-hover:animate-capture-click">
                        <FiCamera size={32} className="text-primary group-hover:text-secondary transition-colors duration-300" />
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
                  </motion.div>
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={captureScreenshot} 
                  className="bg-primary hover:bg-primary/80 text-white py-2 px-2 rounded-full transition duration-300"
                >
                  <FiCamera className="inline-block mr-2" /> Capture Screenshot
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={captureFullPageScreenshot} 
                  className="bg-secondary hover:bg-secondary/80 text-white py-2 px-2 rounded-full transition duration-300"
                >
                  <FiMaximize className="inline-block mr-2" /> Capture Full Page
                </motion.button>
                <div className="flex space-x-2">
                  <select
                    value={selectedTeam?.toString() || ''}
                    onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
                    className="bg-surface text-text py-2 px-3 rounded flex-grow border border-primary/30 focus:border-primary focus:outline-none"
                  >
                    <option value="">Select a team (optional)</option>
                    {userTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={uploadScreenshot} 
                    className={`flex-shrink-0 ${!latestScreenshot || loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white py-2 px-4 rounded transition duration-300`}
                    disabled={!latestScreenshot || loading}
                  >
                    {loading ? <div className="fancy-loader"></div> : <FiUpload />}
                  </motion.button>
                </div>
                {extractedText && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-2 bg-surface rounded border border-primary/30"
                  >
                    <h4 className="text-sm font-semibold text-primary mb-1">Extracted Text:</h4>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-xs text-text">{extractedText}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar"
            >
              {uploadedScreenshots.length === 0 ? (
                <div className="text-center py-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <FiImage size={48} className="mx-auto mb-2 text-primary" />
                  </motion.div>
                  <p className="text-text">No screenshots yet</p>
                </div>
              ) : (
                uploadedScreenshots.map((screenshot) => (
                  <motion.div 
                    key={screenshot.id} 
                    className="bg-surface rounded-lg p-2 flex items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                  >
                   
                    <div className="flex-grow mr-2 truncate" onClick={() => openPreview(screenshot)}>
                      <p className="text-sm truncate">{screenshot.fileName}</p>
                      <div className="flex items-center">
                        <p className="text-xs text-text">ID: {screenshot.blobId.slice(0, 10)}...</p>
                        {screenshot.team_id && (
                          <span className="ml-2 text-xs text-primary flex items-center">
                            <FiUsers size={12} className="mr-1" />
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button onClick={() => downloadScreenshot(screenshot)} className="text-primary hover:text-primary/80" title="Download">
                        <FiDownload size={16} />
                      </button>
                      <a href={screenshot.suiUrl} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary/80" title="View on Sui Explorer">
                        <FiLink size={16} />
                      </a>
                      <button onClick={() => screenshot.id && deleteScreenshot(screenshot.id)} className="text-red-500 hover:text-red-600" title="Delete">
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
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
        </AnimatePresence>
      </main>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500 text-white p-2 text-sm"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {previewScreenshot && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-surface rounded-lg max-w-[90%] max-h-[90%] overflow-hidden"
            >
              <div className="p-2 flex justify-between items-center">
                <h3 className="text-sm truncate">{previewScreenshot.fileName}</h3>
                <button onClick={closePreview} className="text-text hover:text-primary">
                  <FiX size={20} />
                </button>
              </div>
              <img 
                src={previewScreenshot.blobUrl} 
                alt={previewScreenshot.fileName} 
                className="max-w-full max-h-[calc(90vh-4rem)] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScreenshotManager;