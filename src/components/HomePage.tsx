import React, { useState, useEffect } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import ScreenshotManager from './ScreenshotManager';
import { FiUser, FiX } from 'react-icons/fi';

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
    <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-5/6 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Profile</h2>
          <button onClick={() => setShowProfile(false)} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>
        <p className="text-gray-600 mb-2">Wallet Address:</p>
        <p className="bg-gray-100 p-2 rounded text-sm mb-4 break-all">{address}</p>
        <button 
          onClick={handleDisconnect}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-300"
        >
          Disconnect
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-[400px] h-[600px] bg-gradient-to-br from-[#3f1a66] to-[#28153d] p-6 flex flex-col relative ">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Cryptorage</h1>
        {address ? (
          <button 
            onClick={() => setShowProfile(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition duration-300"
          >
            <FiUser size={24} />
          </button>
        ) : (
          <button 
            onClick={handleConnect}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Connect Wallet
          </button>
        )}
      </div>
      
      {address ? (
        <ScreenshotManager walletAddress={address} />
      ) : (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-white text-center text-lg">
            Connect your wallet to start using Cryptorage
          </p>
        </div>
      )}
      
      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      
      {showProfile && <ProfileModal />}
    </div>
  );
};

export default HomePage;