![cryptorage landing page](https://github.com/user-attachments/assets/2776f2b6-17b5-41e8-8308-dc294a386c37)

# Cryptorage Chrome Extension

Cryptorage is a Chrome extension that integrates with Rainbow Wallet Kit to provide secure storage of screenshots with AI-powered analysis. It allows users to capture and store screenshots securely, leveraging blockchain technology for enhanced security and transparency, plus get AI insights about their screenshots.

## Features

- Rainbow Wallet Kit integration (supports Ethereum wallets like Trust Wallet, MetaMask, and others) for secure authentication
- Full-page screenshot capture
- **AI Image Chat** - Ask questions about your screenshots using Llama 4 Maverick AI - get insights, explanations, and analysis instantly
- Secure storage of screenshots using Walrus (decentralized storage)
- Download and preview captured screenshots

## Technology Stack

- React.js for the frontend
- Chrome Extension APIs
- Supabase for backend and real-time features
- Rainbow Wallet Kit for Ethereum wallet integration (supports Trust Wallet, MetaMask, and others)
- Ethereum blockchain for wallet authentication
- Walrus for decentralized storage
- Llama 4 Maverick AI for screenshot analysis and chat functionality(using openrouter)

## Setup and Installation

1. Clone the repository:

   ```
   git clone https://github.com/Rushikeshnimkar/cryptorage-login.git
   cd cryptorage
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following content:

   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   REACT_APP_OCR_API_KEY=your_ocr_api_key
   ```

4. Build the extension:

   ```
   npm run build:extension
   ```

5. Load the extension in Chrome:

   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `build` folder from your project directory

## Usage

1. Click on the Cryptorage extension icon in Chrome to open the popup.
2. Connect your Ethereum wallet through Rainbow Wallet Kit when prompted.
3. After successful connection, you can start capturing and storing screenshots.
4. Use the capture button to take a screenshot of the current tab.
5. The screenshot will be automatically encrypted and stored securely.
6. Use the AI Image Chat feature to ask questions about your screenshots and get instant insights from Llama 4 Maverick AI.
7. Access your stored screenshots from any device by connecting your wallet.

## Supported Wallets

Cryptorage integrates with Rainbow Wallet Kit and supports Ethereum-based wallets such as Trust Wallet, MetaMask, and others. Only the Ethereum chain is supported.

## Supabase Tables Structure

The extension uses the following tables in Supabase:

1. `screenshots` table:

   - `id` (int, primary key)
   - `fileName` (text)
   - `blobId` (text)
   - `blobUrl` (text)
   - `suiUrl` (text)
   - `walletAddress` (text)
   - `created_at` (timestamp with time zone)
   - `extracted_text` (text, nullable)
   - `websiteName` (text)

2. `users` table:

   - `id` (int, primary key)
   - `wallet_address` (text, unique)
   - `username` (text, nullable)
   - `created_at` (timestamp with time zone)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
