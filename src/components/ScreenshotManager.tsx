import React, { useState, useEffect } from 'react';
import { FiCamera, FiUpload, FiDownload, FiLink, FiTrash2, FiImage, FiX, FiUsers, FiGrid, FiPlus } from 'react-icons/fi';
import { supabase } from './supabaseClient';
import TeamManager from './TeamManager';

const PUBLISHER_URL = 'https://publisher-devnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator-devnet.walrus.space';
const EPOCHS = '5';

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

  useEffect(() => {
    fetchScreenshots();
  }, [walletAddress, selectedTeam]);

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
      (dataUrl) => {
        setLatestScreenshot(dataUrl);
      }
    );
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

        const { data, error: supabaseError } = await supabase
          .from('screenshots')
          .insert(newScreenshot);

        if (supabaseError) throw supabaseError;

        setUploadedScreenshots(prev => [...prev, newScreenshot]);
        setActiveTab('gallery');
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
    <div className="bg-gray-900 text-white w-[350px] h-[500px] flex flex-col">
      <header className="bg-gray-800 p-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">Cryptorage</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('capture')}
            className={`p-1 rounded ${activeTab === 'capture' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title="Capture"
          >
            <FiCamera size={18} />
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`p-1 rounded ${activeTab === 'gallery' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title="Gallery"
          >
            <FiGrid size={18} />
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`p-1 rounded ${activeTab === 'team' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title="Team"
          >
            <FiUsers size={18} />
          </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-3">
        {activeTab === 'capture' && (
          <div className="flex flex-col h-full">
            <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
              {latestScreenshot ? (
                <img src={latestScreenshot} alt="Latest Screenshot" className="max-w-full max-h-full object-contain" />
              ) : (
                <FiImage size={48} className="text-gray-600" />
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={captureScreenshot} 
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition duration-300"
              >
                <FiCamera className="inline-block mr-2" /> Capture Screenshot
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
                    <img src={screenshot.blobUrl} alt={screenshot.fileName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow mr-2 truncate">
                    <p className="text-sm truncate">{screenshot.fileName}</p>
                    <p className="text-xs text-gray-400">ID: {screenshot.blobId.slice(0, 10)}...</p>
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
          <TeamManager walletAddress={walletAddress} onTeamSelect={setSelectedTeam} />
        )}
      </main>

      {error && (
        <div className="bg-red-500 text-white p-2 text-sm">
          {error}
        </div>
      )}

      {previewScreenshot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg max-w-[90%] max-h-[90%] overflow-hidden">
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