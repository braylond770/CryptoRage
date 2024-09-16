import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './components/HomePage';

import { WalletKitProvider } from '@mysten/wallet-kit';

test('renders learn react link', () => {
  render(
    <WalletKitProvider>
      <HomePage />
    </WalletKitProvider>
  );
  const welcomeText = screen.getByText(/Welcome to Cryptorage/i);
  expect(welcomeText).toBeInTheDocument();

  const connectWalletButton = screen.getByRole('button', { name: /Connect Wallet/i });
  expect(connectWalletButton).toBeInTheDocument();
});
