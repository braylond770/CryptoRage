import React, { useState, useEffect, useRef } from 'react';
import { FiCamera, FiUpload, FiDownload, FiLink, FiTrash2, FiImage, FiX, FiUsers, FiGrid, FiPlus, FiMaximize, FiBell } from 'react-icons/fi';
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

  const getThumbnailUrl = (originalUrl: string) => {
    // Append a query parameter to request a smaller image
    return `${originalUrl}?width=30&quality=30`;
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
    <div className="bg-[#121212] text-white w-[350px] h-[500px] flex flex-col border border-[#333] rounded-[20px]">
      <header className="bg-[#222] p-3 flex justify-between items-center rounded-t-[20px]">
        <div className="flex space-x-10">
          <button onClick={() => setActiveTab('capture')} className={`p-1 rounded ${activeTab === 'capture' ? 'bg-emerald-500' : 'bg-transparent hover:bg-[#333]'}`} title="Capture">
            <FiCamera size={18} />
          </button>
          <button onClick={() => setActiveTab('gallery')} className={`p-1 rounded ${activeTab === 'gallery' ? 'bg-emerald-500' : 'bg-transparent hover:bg-[#333]'}`} title="Gallery">
            <FiGrid size={18} />
          </button>
          <button onClick={() => setActiveTab('team')} className={`p-1 rounded ${activeTab === 'team' ? 'bg-emerald-500' : 'bg-transparent hover:bg-[#333]'}`} title="Team">
            <FiUsers size={18} />
          </button>
        </div>
        <button className="relative p-1 rounded bg-transparent hover:bg-[#333]" onClick={clearNotifications}>
          <FiBell size={18} />
          {notifications > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>
      </header>

      <main className="flex-grow overflow-y-auto p-3">
        {activeTab === 'capture' && (
          <div className="flex flex-col h-full">
            <div className="flex-grow  bg-transparent rounded-lg overflow-hidden mb-3 flex items-center justify-center">
              {latestScreenshot ? (
                <img src={latestScreenshot} alt="Latest Screenshot" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="relative w-64 h-64 cursor-pointer group" onClick={captureScreenshot}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-emerald-500 rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-2 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-transparent via-blue-500 to-transparent animate-swipe"></div>
                  </div>
                  <div className="absolute inset-4 border-2 border-blue-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center group-hover:animate-capture-click">
                      <FiCamera size={32} className="text-blue-400 group-hover:text-purple-400 transition-colors duration-300" />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border border-purple-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                    <div className="w-56 h-56 border-t-2 border-r-2 border-blue-400 rounded-full animate-spin-reverse"></div>
                  </div>
                  <div className="absolute bottom-0 right-0 animate-bounce">
                    <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={captureScreenshot} 
                className="bg-[#4c23a399] hover:bg-[#5a3a9d99] text-white py-2 px-2 rounded-full transition duration-300"
              >
                <FiCamera className="inline-block mr-2" /> Capture Screenshot
              </button>
              <button 
                onClick={captureFullPageScreenshot} 
                className="bg-[#4c23a399] hover:bg-[#5a3a9d99] text-white py-2 px-2 rounded-full transition duration-300"
              >
                <FiMaximize className="inline-block mr-2" /> Capture Full Page
              </button>
              <div className="flex space-x-2">
                <select
                  value={selectedTeam?.toString() || ''}
                  onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
                  className="bg-gray-800 text-white py-2 px-3 rounded flex-grow"
                >
                  <option value="">Select a team (optional)</option>
                  {userTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                
                <button 
                  onClick={uploadScreenshot} 
                  className={`flex-shrink-0 ${!latestScreenshot || loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white py-2 px-4 rounded transition duration-300`}
                  disabled={!latestScreenshot || loading}
                >
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <FiUpload />}
                </button>
              </div>
              {extractedText && (
                <div className="mt-2 p-2 bg-gray-800 rounded">
                  <h4 className="text-sm font-semibold text-white mb-1">Extracted Text:</h4>
                  <p className="text-xs text-gray-300">{extractedText}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-3">
            {uploadedScreenshots.length === 0 ? (
              <div className="text-center py-8">
                <FiImage size={48} className="mx-auto mb-2 text-gray-600" />
                <p className="text-gray-400">No screenshots yet</p>
              </div>
            ) : (
              uploadedScreenshots.map((screenshot) => (
                <div key={screenshot.id} className="bg-gray-800 rounded-lg p-2 flex items-center">
                  <div 
                    className="w-12 h-12 bg-gray-700 rounded mr-2 flex-shrink-0 overflow-hidden cursor-pointer"
                    onClick={() => openPreview(screenshot)}
                  >
                    <LazyImage src={getThumbnailUrl(screenshot.blobUrl)} alt={screenshot.fileName} />
                  </div>
                  <div className="flex-grow mr-2 truncate">
                    <p className="text-sm truncate">{screenshot.fileName}</p>
                    <div className="flex items-center">
                      <p className="text-xs text-gray-400">ID: {screenshot.blobId.slice(0, 10)}...</p>
                      {screenshot.team_id && (
                        <span className="ml-2 text-xs text-blue-400 flex items-center">
                          <FiUsers size={12} className="mr-1" />
                          Shared
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => downloadScreenshot(screenshot)} className="text-blue-400 hover:text-blue-300" title="Download">
                      <FiDownload size={16} />
                    </button>
                    <a href={screenshot.suiUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300" title="View on Sui Explorer">
                      <FiLink size={16} />
                    </a>
                    <button onClick={() => screenshot.id && deleteScreenshot(screenshot.id)} className="text-red-400 hover:text-red-300" title="Delete">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <TeamManager 
            walletAddress={walletAddress}
            onScreenshotCapture={captureScreenshot}
            latestScreenshot={latestScreenshot}
            extractedText={extractedText}
          />
        )}
      </main>

      {error && (
        <div className="bg-red-500 text-white p-2 text-sm">
          {error}
        </div>
      )}

      {previewScreenshot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-[#222] rounded-lg max-w-[90%] max-h-[90%] overflow-hidden">
            <div className="p-2 flex justify-between items-center">
              <h3 className="text-sm truncate">{previewScreenshot.fileName}</h3>
              <button onClick={closePreview} className="text-gray-400 hover:text-white">
                <FiX size={20} />
              </button>
            </div>
            <img 
              src={previewScreenshot.blobUrl} 
              alt={previewScreenshot.fileName} 
              className="max-w-full max-h-[calc(90vh-4rem)] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotManager;