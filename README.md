# Dyslexia Text Reader

A Chrome extension to assist readers with dyslexia by providing various tools to improve readability and text comprehension.

## Features

- **Text Rewriting**: Automatically rewrite selected text to be more dyslexia-friendly using AI
- **Text-to-Speech**: Read selected text aloud
- **Customizable Text Appearance**: Adjust font, size, spacing, and colors
- **Text Simplification**: Replace complex sentences and difficult words with easier alternatives
- **Phonetic Support**: Display syllable breakdowns for complex words
- **Color Overlays**: Customize background colors for better readability
- **Multiple OpenAI Models**: Choose between different OpenAI models (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
- **User Accounts**: Save your settings across devices
- **Browser Toggle**: Easily enable/disable with a slider on top of the browser

## Installation

### Local Development

1. Clone the repository:
```
git clone -b final https://github.com/mmokin/Dyslexia-Text-Reader
cd Dyslexia-Text-Reader
```

2. Set up the backend server:
```
cd server
npm install
```

3. Create a `.env` file in the server directory with the following:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/dyslexia-reader
JWT_SECRET=your-secret-key-change-this-in-production
CORS_ORIGIN=chrome-extension://
```

4. Start the server:
```
npm run dev
```

5. Install the Chrome Extension:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" at the top right
   - Click "Load unpacked" and select the `dyslexia_friendly_extension` directory

## Usage

1. **Enable the Extension**: Click the extension icon and toggle it on
2. **Text Processing**: Select any text on a webpage, right-click, and choose from the context menu options:
   - "Make Dyslexia Friendly" - Rewrite the text
   - "Read Text Aloud" - Have the text read to you
   - "Simplify Text" - Make the text easier to understand

3. **Customize Settings**: Click the extension icon to open the popup and adjust:
   - Font type and size
   - Letter, word, and line spacing
   - Text and background colors
   - AI model selection
   - Simplification level
   - Phonetic support

4. **User Account**: Create an account to save your settings across devices:
   - Register with a username, email, and password
   - Login to sync your settings

## API Keys

To use the AI text processing features, you'll need to add your own API key:

1. Open the extension popup
2. Go to the Settings tab
3. Enter your OpenAI API key
   - Required for text rewriting, simplification, and phonetic transcription features

## Keyboard Shortcuts

- **Ctrl+Shift+D**: Toggle extension on/off
- **Ctrl+Shift+L**: Read selected text aloud
- **Ctrl+Shift+S**: Simplify selected text
