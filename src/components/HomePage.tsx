import React, { useState, useEffect } from "react";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import ScreenshotManager from "./ScreenshotManager";
import { FiUser, FiX, FiPower } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabaseClient";


const client = new SuiClient({ url: getFullnodeUrl("testnet") });


const HomePage: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.connectedAddress) {
        const newAddress = changes.connectedAddress.newValue;
        setAddress(newAddress);
        if (newAddress) {
          fetchUsername(newAddress);
        } else {
          setUsername("");
        }
      }
    });
  }, []);
  useEffect(() => {
    if (address) {
      fetchUsername(address);
    }
  }, [address]);

  const fetchUsername = async (address: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username")
        .eq("wallet_address", address)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No matching row found, which is fine - the user just doesn't have a username yet
          setUsername("");
        } else {
          throw error;
        }
      } else if (data) {
        setUsername(data.username || "");
      }
    } catch (error) {
      console.error("Error fetching username:", error);
      setError("Failed to fetch username");
    }
  };

  const checkConnection = () => {
    chrome.storage.local.get(["connectedAddress"], (result) => {
      if (result.connectedAddress) {
        setAddress(result.connectedAddress);
      }
    });
  };


  const handleConnect = () => {
    chrome.tabs.create({ url: "http://localhost:3000" });
  };

  const handleDisconnect = () => {
    chrome.storage.local.remove("connectedAddress", () => {
      setAddress(null);
      setUsername("");
      setShowProfile(false);
      setError(null);
    });
  };

  const ProfileModal = () => {
    const [newUsername, setNewUsername] = useState(username);

    const handleSaveUsername = async () => {
      try {
        const { error } = await supabase
          .from("users")
          .upsert({ wallet_address: address, username: newUsername });

        if (error) throw error;
        setUsername(newUsername);
        setShowProfile(false);
        setSuccessMessage("Username saved successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error("Error saving username:", error);
        setError("Failed to save username");
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-surface rounded-lg p-6 w-5/6 max-w-md shadow-lg"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-primary">Profile</h2>
            <button
              onClick={() => setShowProfile(false)}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>
          {username && (
            <p className="text-text-secondary mb-4">
              Current username: <span className="font-bold text-primary">{username}</span>
            </p>
          )}
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              {username ? 'New Username' : 'Username'}
            </label>
            <input
              type="text"
              id="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-background text-text p-2 rounded border border-primary/30 focus:border-primary focus:outline-none"
              placeholder={username ? 'Enter new username' : 'Enter username'}
            />
          </div>
          <p className="text-text-secondary mb-2">Wallet Address:</p>
          <p className="bg-background p-2 rounded text-sm mb-4 break-all text-text border border-primary/30">
            {address}
          </p>
          <button
            onClick={handleSaveUsername}
            className="w-full bg-primary hover:bg-primary/80 text-surface font-bold py-2 px-4 rounded transition duration-300 mb-2"
          >
            {username ? 'Update Username' : 'Save Username'}
          </button>
          <button
            onClick={handleDisconnect}
            className="w-full bg-error hover:bg-error/80 text-surface font-bold py-2 px-4 rounded transition duration-300 flex items-center justify-center"
          >
            <FiPower className="mr-2" /> Disconnect
          </button>
        </motion.div>
      </motion.div>
    );
  };


  return (
    <div className="w-[400px] h-auto  p-6 flex flex-col relative overflow-hidden rounded-lg shadow-2xl">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>
      
      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-md z-50"
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="flex justify-between items-center mb-2 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-xl font-extrabold text-white">Cryptorage</h1>
        {address ? (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowProfile(true)}
            className="overflow-hidden rounded-full border-2 border-white shadow-lg"
          >
            <img
              src={`https://robohash.org/${address}.png?size=48x48`}
              alt="User Avatar"
              className="w-8 h-8"
            />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-full transition duration-300 shadow-md"
          >
            Connect Wallet
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {address ? (
          <motion.div
            key="screenshot-manager"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.3 }}
          >
            <ScreenshotManager walletAddress={address} />
          </motion.div>
        ) : (
          <motion.div
            key="connect-prompt"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-grow flex items-center justify-center"
          >
            <p className="text-white text-center text-lg animate-bounce bg-gray-700 p-4 rounded-lg shadow-md">
              Connect your wallet to start using Cryptorage
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 mt-4 text-center bg-gray-700 p-2 rounded-lg shadow-md"
        >
          {error}
        </motion.p>
      )}

      <AnimatePresence>{showProfile && <ProfileModal />}</AnimatePresence>
    </div>
  );
};

export default HomePage;