
![cryptorage landing page](https://github.com/user-attachments/assets/2776f2b6-17b5-41e8-8308-dc294a386c37)

# Cryptorage Chrome Extension

Cryptorage is a Chrome extension that integrates with Sui wallet to provide secure storage and sharing of screenshots within teams. It allows users to capture, store, and share screenshots with team members, all while leveraging blockchain technology for enhanced security and transparency.

## Features

- Sui wallet integration for secure authentication
- Full-page screenshot capture
- Team management (create teams, add members)
- Real-time team chat with shared screenshots
- Secure storage of screenshots using Walrus (decentralized storage)
- Extracted text from screenshots using OCR
- Download and preview captured screenshots

## Technology Stack

- React.js for the frontend
- Chrome Extension APIs
- Supabase for backend and real-time features
- Sui blockchain for wallet integration
- Walrus for decentralized storage
- OCR API for text extraction from images

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
2. Connect your Sui wallet when prompted.
3. After successful connection, you can start capturing and storing screenshots.
4. Use the capture button to take a screenshot of the current tab.
5. The screenshot will be automatically encrypted and stored on the Sui blockchain.
6. Access your stored screenshots from any device by connecting your wallet.


## Supabase Tables Structure

The extension uses the following tables in Supabase:

1. `teams` table:
   - `id` (int, primary key)
   - `name` (text)
   - `created_by` (text, wallet address)
   - `created_at` (timestamp with time zone)

2. `team_members` table:
   - `id` (int, primary key)
   - `team_id` (int, foreign key referencing teams.id)
   - `walletAddress` (text)
   - `created_at` (timestamp with time zone)

3. `screenshots` table:
   - `id` (int, primary key)
   - `fileName` (text)
   - `blobId` (text)
   - `blobUrl` (text)
   - `suiUrl` (text)
   - `walletAddress` (text)
   - `team_id` (int, foreign key referencing teams.id)
   - `created_at` (timestamp with time zone)
   - `extracted_text` (text, nullable)
   - `  websiteName` (text)

4. `users` table:
   - `id` (int, primary key)
   - `wallet_address` (text, unique)
   - `username` (text, nullable)
   - `created_at` (timestamp with time zone)


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


## License

[MIT License](LICENSE)

