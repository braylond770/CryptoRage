
import React from 'react';
import { WalletKitProvider } from '@mysten/wallet-kit';
import HomePage from './components/HomePage';
import './App.css'


const App: React.FC = () => {
  return (
    <WalletKitProvider>
      <HomePage />
    </WalletKitProvider>
  );
};

export default App;