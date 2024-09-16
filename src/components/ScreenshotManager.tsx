import React, { useState, useEffect } from 'react';
import { FiCamera, FiUpload, FiDownload, FiLink, FiTrash2, FiImage, FiX } from 'react-icons/fi';
import { createClient } from '@supabase/supabase-js';

const PUBLISHER_URL = 'https://publisher-devnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator-devnet.walrus.space';
const EPOCHS = '5';

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ScreenshotInfo {
  id?: number;
  fileName: string;
  blobId: string;
  blobUrl: string;
  suiUrl: string;
  walletAddress: string;
}

interface ScreenshotManagerProps {
  walletAddress: string;
}

const ScreenshotManager: React.FC<ScreenshotManagerProps> = ({ walletAddress }) => {
  const [activeTab, setActiveTab] = useState<'capture' | 'gallery'>('capture');
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<ScreenshotInfo | null>(null);

  useEffect(() => {
    fetchScreenshots();
  }, [walletAddress]);

  const fetchScreenshots = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('walletAddress', walletAddress);

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
      (dataUrl) => {
        setLatestScreenshot(dataUrl);
      }
    );
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
          walletAddress 
        };

        // Save to Supabase
        const { data, error: supabaseError } = await supabase
          .from('screenshots')
          .insert(newScreenshot);

        if (supabaseError) throw supabaseError;

        setUploadedScreenshots([...uploadedScreenshots, newScreenshot]);
        setActiveTab('gallery');
      } else {
        throw new Error("Failed to upload screenshot");
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
    <div className="bg-gradient-to-br from-[#1a1b2e] to-[#2a2d4a] rounded-3xl p-4 w-full h-[500px] flex flex-col shadow-xl">
      <div className="flex mb-4">
        <button
          className={`flex-1 py-2 px-4 rounded-tl-lg rounded-tr-lg ${activeTab === 'capture' ? 'bg-[#2c2f4a] text-white' : 'bg-[#1a1b2e] text-gray-400'}`}
          onClick={() => setActiveTab('capture')}
        >
          Capture
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-tl-lg rounded-tr-lg ${activeTab === 'gallery' ? 'bg-[#2c2f4a] text-white' : 'bg-[#1a1b2e] text-gray-400'}`}
          onClick={() => setActiveTab('gallery')}
        >
          Gallery
        </button>
      </div>

      {activeTab === 'capture' && (
        <div className="flex-grow flex flex-col">
          <div className="flex-grow flex items-center justify-center">
            {latestScreenshot ? (
              <img src={latestScreenshot} alt="Latest Screenshot" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
            ) : (
              <div className="text-white text-center">
                <FiImage size={48} className="mx-auto mb-2" />
                <p>No screenshot captured yet</p>
              </div>
            )}
          </div>
          <div className="flex space-x-4 mt-4">
            <button 
              onClick={captureScreenshot} 
              className="flex-1 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-300 shadow-md"
            >
              <FiCamera className="mr-2" /> Capture
            </button>
            <button 
              onClick={uploadScreenshot} 
              className={`flex-1 flex items-center justify-center ${!latestScreenshot || loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white py-2 px-4 rounded-lg transition duration-300 shadow-md`}
              disabled={!latestScreenshot || loading}
            >
              <FiUpload className="mr-2" /> Upload
            </button>
          </div>
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="flex-grow overflow-y-auto">
          {uploadedScreenshots.length === 0 ? (
            <div className="text-white text-center mt-8">
              <FiImage size={48} className="mx-auto mb-2" />
              <p>No screenshots uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadedScreenshots.map((screenshot, index) => (
                <div key={index} className="bg-[#2c2f4a] rounded-lg p-3 flex items-center justify-between">
                  <div 
                    className="flex-grow mr-2 cursor-pointer"
                    onClick={() => openPreview(screenshot)}
                  >
                    <span className="text-white text-sm font-medium truncate block">{screenshot.fileName}</span>
                    <span className="text-xs text-gray-400">Blob ID: {screenshot.blobId.slice(0, 10)}...</span>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => downloadScreenshot(screenshot)} 
                      className="text-blue-400 hover:text-blue-300 transition-colors duration-300"
                      title="Download"
                    >
                      <FiDownload size={20} />
                    </button>
                    <a 
                      href={screenshot.suiUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 transition-colors duration-300"
                      title="View on Sui Explorer"
                    >
                      <FiLink size={20} />
                    </a>
                    <button 
                      onClick={() => screenshot.id && deleteScreenshot(screenshot.id)}
                      className="text-red-400 hover:text-red-300 transition-colors duration-300"
                      title="Delete"
                    >
                      <FiTrash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {error && <p className="text-red-500 mt-2 text-center text-sm">{error}</p>}

      {previewScreenshot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative bg-[#2c2f4a] p-4 rounded-lg max-w-3xl max-h-[90vh] overflow-hidden">
            <button 
              onClick={closePreview}
              className="absolute top-2 right-2 text-white hover:text-gray-300 transition-colors duration-300"
            >
              <FiX size={24} />
            </button>
            <img 
              src={previewScreenshot.blobUrl} 
              alt={previewScreenshot.fileName} 
              className="max-w-full max-h-[calc(90vh-2rem)] object-contain"
            />
            <div className="mt-2 text-white text-sm">
              <p>{previewScreenshot.fileName}</p>
              <p className="text-xs text-gray-400">Blob ID: {previewScreenshot.blobId}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotManager;