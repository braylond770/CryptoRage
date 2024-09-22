import React, { useState, useEffect } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import ScreenshotManager from './ScreenshotManager';
import { FiUser, FiX, FiPower } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });


const HomePage: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.connectedAddress) {
        setAddress(changes.connectedAddress.newValue);
      }
    });
  }, []);

  const checkConnection = () => {
    chrome.storage.local.get(['connectedAddress'], (result) => {
      if (result.connectedAddress) {
        setAddress(result.connectedAddress);
      }
    });
  };

  const handleConnect = () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  };

  const handleDisconnect = () => {
    chrome.storage.local.remove('connectedAddress', () => {
      setAddress(null);
      setShowProfile(false);
      setError(null);
    });
  };

  const ProfileModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-surface rounded-lg p-6 w-5/6 max-w-md shadow-lg"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-primary">Profile</h2>
          <button onClick={() => setShowProfile(false)} className="text-text-secondary hover:text-primary transition-colors">
            <FiX size={24} />
          </button>
        </div>
        <p className="text-text-secondary mb-2">Wallet Address:</p>
        <p className="bg-background p-2 rounded text-sm mb-4 break-all text-text">{address}</p>
        <button 
          onClick={handleDisconnect}
          className="w-full bg-error hover:bg-error/80 text-text font-bold py-2 px-4 rounded transition duration-300 flex items-center justify-center"
        >
          <FiPower className="mr-2" /> Disconnect
        </button>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="w-[400px] h-[600px] bg-background p-6 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none"></div>
      <motion.div 
        className="flex justify-between items-center mb-6 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-2xl font-bold text-primary">Cryptorage</h1>
        {address ? (
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowProfile(true)}
            className="bg-primary hover:bg-primary/80 text-text p-2 rounded-full transition duration-300"
          >
            <FiUser size={24} />
          </motion.button>
        ) : (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="bg-primary hover:bg-primary/80 text-text font-bold py-2 px-4 rounded transition duration-300"
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
            <p className="text-primary text-center text-lg animate-float">
              Connect your wallet to start using Cryptorage
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 mt-4 text-center"
        >
          {error}
        </motion.p>
      )}
      
      <AnimatePresence>
        {showProfile && <ProfileModal />}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;