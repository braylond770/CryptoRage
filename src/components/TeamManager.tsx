import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { FiUsers, FiPlus, FiSend, FiImage, FiMoreVertical, FiChevronDown, FiChevronUp, FiDownload } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
interface Team {
  id: number;
  name: string;
  created_by: string;
}

interface ScreenshotInfo {
  id?: number;
  fileName: string;
  blobUrl: string;
  walletAddress: string;
  team_id: number;
  created_at: string;
  extracted_text?: string;
  websiteName: string; // Add this new field
}

interface TeamManagerProps {
  walletAddress: string;
  onScreenshotCapture: () => void;
  latestScreenshot: string | null;
  extractedText: string | null;
}

const PUBLISHER_URL = "https://publisher-devnet.walrus.space";
const AGGREGATOR_URL = "https://aggregator-devnet.walrus.space";
const EPOCHS = "5";

const TeamManager: React.FC<TeamManagerProps> = ({
  walletAddress,
  onScreenshotCapture,
  latestScreenshot,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teamChat, setTeamChat] = useState<ScreenshotInfo[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showTeamList, setShowTeamList] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [expandedTexts, setExpandedTexts] = useState<Record<number, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [websiteName, setWebsiteName] = useState<string>('');

  

  useEffect(() => {
    fetchTeams();
  }, [walletAddress]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamChat(selectedTeam);
      subscribeToTeamChat(selectedTeam);
    }
  }, [selectedTeam]);
  const handleImagePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
  };
  
  const handleClosePreview = () => {
    setPreviewImage(null);
  };
  
  const downloadScreenshot = async (screenshot: ScreenshotInfo) => {
    try {
      const response = await fetch(screenshot.blobUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', screenshot.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error(`Failed to download ${screenshot.fileName}:`, err);
      setError(`Failed to download ${screenshot.fileName}. Please try again.`);
    }
  };


  const toggleExpandText = (screenshotId: number) => {
    setExpandedTexts(prev => ({
      ...prev,
      [screenshotId]: !prev[screenshotId]
    }));
  };
  const renderExtractedText = (screenshot: ScreenshotInfo) => {
    if (!screenshot.extracted_text) return null;

    const maxLength = 100; // Adjust this value to change the preview length
    const isExpanded = expandedTexts[screenshot.id!] || false;
    const text = isExpanded ? screenshot.extracted_text : screenshot.extracted_text.slice(0, maxLength);

    return (
      <div className="text-sm text-white mt-1 break-words">
        {text}
        {screenshot.extracted_text.length > maxLength && (
          <>
            {!isExpanded && '...'}
            <button
              onClick={() => toggleExpandText(screenshot.id!)}
              className="text-blue-500 hover:text-blue-700 ml-2"
            >
              {isExpanded ? (
                <>
                  Show less <FiChevronUp className="inline" />
                </>
              ) : (
                <>
                  Show more <FiChevronDown className="inline" />
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  };

  const fetchUsernames = async (addresses: string[]) => {
    const { data, error } = await supabase
      .from("users")
      .select("wallet_address, username")
      .in("wallet_address", addresses);

    if (error) {
      console.error("Error fetching usernames:", error);
      return;
    }

    const usernameMap = data.reduce((acc, user) => {
      acc[user.wallet_address] = user.username || user.wallet_address;
      return acc;
    }, {} as Record<string, string>);

    setUsernames(usernameMap);
  };
  const fetchTeams = async () => {
    try {
      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("walletAddress", walletAddress);

      if (teamMemberError) throw teamMemberError;

      const teamIds = teamMemberData.map((tm) => tm.team_id);

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .or(`created_by.eq.${walletAddress},id.in.(${teamIds.join(",")})`);

      if (teamsError) throw teamsError;

      setTeams(teamsData || []);
    } catch (err) {
      console.error("Failed to fetch teams:", err);
      setError("Failed to fetch teams");
    }
  };

  const subscribeToTeamChat = (teamId: number) => {
    const channel = supabase.channel(`team_${teamId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "screenshots",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setTeamChat((prevChat) => [
            payload.new as ScreenshotInfo,
            ...prevChat,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      setError("Team name cannot be empty");
      return;
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({ name: newTeamName.trim(), created_by: walletAddress })
      .select();

    if (error) {
      setError("Failed to create team");
    } else if (data) {
      setTeams([...teams, data[0]]);
      setNewTeamName("");
      setError(null);
    }
  };

  const addTeamMember = async () => {
    if (!selectedTeam) {
      setError("Please select a team first");
      return;
    }

    if (!newMemberAddress.trim()) {
      setError("Member address cannot be empty");
      return;
    }

    const { data, error } = await supabase
      .from("team_members")
      .insert({ team_id: selectedTeam, walletAddress: newMemberAddress.trim() })
      .select();

    if (error) {
      setError("Failed to add team member");
    } else if (data) {
      setNewMemberAddress("");
      setError(null);
    }
  };

  const sendScreenshot = async () => {
    if (!selectedTeam || !latestScreenshot) return;

    setIsSending(true);
    setError(null);

    try {
      // Convert data URL to Blob
      const response = await fetch(latestScreenshot);
      const blob = await response.blob();
      const file = new File([blob], `screenshot-${Date.now()}.png`, {
        type: "image/png",
      });

      // Upload to Walrus
      const uploadResponse = await fetch(
        `${PUBLISHER_URL}/v1/store?epochs=${EPOCHS}`,
        {
          method: "PUT",
          body: file,
        }
      );

      if (uploadResponse.status !== 200) {
        throw new Error("Failed to upload to Walrus");
      }

      const info = await uploadResponse.json();
      let blobId = "",
        suiUrl = "";

      if (info.alreadyCertified) {
        blobId = info.alreadyCertified.blobId;
        suiUrl = `https://suiscan.xyz/testnet/tx/${info.alreadyCertified.event.txDigest}`;
      } else if (info.newlyCreated) {
        blobId = info.newlyCreated.blobObject.blobId;
        suiUrl = `https://suiscan.xyz/testnet/object/${info.newlyCreated.blobObject.id}`;
      } else {
        throw new Error("Unexpected response from Walrus");
      }

      const blobUrl = `${AGGREGATOR_URL}/v1/${blobId}`;

      // Save to Supabase
      const { data, error } = await supabase
      .from("screenshots")
      .insert({
        fileName: file.name,
        blobId,
        blobUrl,
        suiUrl,
        walletAddress,
        team_id: selectedTeam,
        created_at: new Date().toISOString(),
        websiteName: websiteName,
      })
      .select();

      if (error) throw error;

      if (data) {
        await fetchTeamChat(selectedTeam);
      }
    } catch (err) {
      console.error("Failed to send screenshot:", err);
      setError("Failed to send screenshot. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const fetchTeamChat = async (teamId: number) => {
    const { data, error } = await supabase
      .from("screenshots")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) {
      setError("Failed to fetch team chat");
    } else {
      setTeamChat(data || []);
      const addresses = Array.from(
        new Set(data.map((screenshot) => screenshot.walletAddress))
      );
      await fetchUsernames(addresses);
    }
  };

  return (
    <div className="bg-background text-text h-[480px] flex flex-col rounded-lg overflow-hidden">
      {showTeamList ? (
        <div className="flex-grow overflow-y-auto">
          <h2 className="text-xl font-bold p-4 bg-surface shadow">
            Teams
          </h2>
          <div className="p-4">
            <div className="flex mb-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New Team Name"
                className="bg-surface text-text p-2 rounded-l flex-grow border border-primary/30 focus:outline-none focus:border-primary"
              />
              <button
                onClick={createTeam}
                className="bg-primary hover:bg-primary/80 text-background font-bold py-2 px-4 rounded-r transition duration-300"
              >
                <FiPlus />
              </button>
            </div>
            {teams.map((team) => (
              <motion.div
                key={team.id}
                onClick={() => {
                  setSelectedTeam(team.id);
                  setShowTeamList(false);
                }}
                className="p-3 bg-surface rounded-lg shadow mb-2 flex items-center cursor-pointer hover:bg-primary/20 transition duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="bg-primary text-background rounded-full w-10 h-10 flex items-center justify-center mr-3">
                  <FiUsers size={20} />
                </div>
                <span className="font-medium">{team.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className=" bg-primary p-4 h-5 flex items-center justify-between shadow">
            <div className="flex items-center">
              <button
                onClick={() => setShowTeamList(true)}
                className="text-background mr-3 hover:text-surface transition duration-300"
              >
                <FiUsers size={24} />
              </button>
              <h2 className="text-xm font-bold text-background">
                {teams.find((t) => t.id === selectedTeam)?.name}
              </h2>
            </div>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-background hover:text-surface transition duration-300"
            >
              <FiMoreVertical size={24} />
            </button>
          </div>

          {showAddMember && (
            <div className="p-4 bg-surface shadow">
              <div className="flex">
                <input
                  type="text"
                  value={newMemberAddress}
                  onChange={(e) => setNewMemberAddress(e.target.value)}
                  placeholder="New Member Address"
                  className="bg-background text-text p-2 rounded-l flex-grow border border-primary/30 focus:outline-none focus:border-primary"
                />
                <button
                  onClick={addTeamMember}
                  className="bg-primary hover:bg-primary/80 text-background font-bold py-2 px-4 rounded-r transition duration-300"
                >
                  <FiPlus />
                </button>
              </div>
            </div>
          )}

<div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
            {teamChat.map((screenshot) => (
              <motion.div 
                key={screenshot.id} 
                className="mb-4 flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-[#45464a3e] rounded-lg shadow p-3 max-w-[80%] self-start">
                  <div className="text-sm text-text-secondary mb-1 break-words">
                    {usernames[screenshot.walletAddress] || screenshot.walletAddress}
                  </div>
                  <div className="text-xs text-primary mb-1">{screenshot.websiteName}</div>
                  <div className="relative group">
                    <img
                      src={screenshot.blobUrl}
                      alt={screenshot.fileName}
                      className="w-full h-auto rounded mb-2 cursor-pointer"
                      onClick={() => handleImagePreview(screenshot.blobUrl)}
                    />
                    <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => downloadScreenshot(screenshot)}
                        className="bg-primary text-white rounded-full p-1 shadow hover:bg-primary/80 transition duration-300"
                        title="Download"
                      >
                        <FiDownload size={20} />
                      </button>
                    </div>
                  </div>
                  
                  {renderExtractedText(screenshot)}
                  <div className="text-xs text-gray-500 text-right">
                    {new Date(screenshot.created_at).toLocaleString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
      {selectedTeam && !showTeamList && (
        <div className="pt-2 h-14 bg-surface border-t border-primary/30">
          <div className="flex items-center">
            <motion.button
              whileHover={{ scale: 0.80 }}
              whileTap={{ scale: 0.70 }}
              onClick={onScreenshotCapture}
              className="bg-primary hover:bg-primary/80 text-background rounded-full p-2 mr-2 transition duration-300"
              disabled={isSending}
            >
              <FiImage size={16} />
            </motion.button>
            <motion.button
            whileHover={{ scale: 0.80 }}
            whileTap={{ scale: 0.70 }}
              onClick={sendScreenshot}
              disabled={!latestScreenshot || isSending}
              className={`${
                latestScreenshot && !isSending
                  ? "bg-primary hover:bg-primary/80"
                  : "bg-secondary"
              } text-background rounded-full p-2 flex items-center justify-center transition duration-300`}
            >
              {isSending ? (
                <svg
                  className="animate-spin h-6 w-6  text-teal-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <FiSend size={16} />
              )}
            </motion.button>
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background bg-opacity-75 flex items-center justify-center z-50" 
            onClick={handleClosePreview}
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-3xl max-h-[90vh] overflow-auto bg-surface rounded-lg shadow-lg"
            >
              <img src={previewImage} alt="Preview" className="w-full h-auto" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-error text-background"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default TeamManager;