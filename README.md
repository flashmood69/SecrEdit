# SecrEdit - Secure URL Editor

SecrEdit is a privacy-focused, client-side encrypted text editor that stores everything in the URL. It allows you to write, format, and share encrypted notes without any server-side storage.

![SecrEdit Icon](icon.svg)

## ✨ Features

- **End-to-End Encryption**: All encryption and decryption happen in your browser. Your secret key never leaves your device.
- **URL-Based Storage**: The encrypted content is stored entirely in the URL fragment (hash), making it easy to bookmark or share.
- **Markdown Support**: Built-in Markdown preview for rich text formatting.
- **Compression**: Uses Gzip compression to maximize the amount of text you can store in a URL.
- **Progressive Web App (PWA)**: Installable on mobile and desktop for offline use.
- **File Support**: Export and import encrypted notes as `.secredit` files.
- **Find & Replace**: Integrated search and replace functionality.
- **Emoji Picker**: Quick access to emojis for your notes.
- **Dark Mode**: Automatic dark mode support based on system preferences.
- **Password Strength Meter**: Visual feedback on the strength of your secret key.

## 🔒 Security

SecrEdit uses industry-standard cryptographic primitives provided by the Web Crypto API:

- **Algorithm**: AES-GCM (256-bit) for authenticated encryption.
- **Key Derivation**: PBKDF2 with SHA-256 and 600,000 iterations to derive the encryption key from your password.
- **Privacy**: No tracking, no cookies, and no server-side backend. Your data is yours.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, and JavaScript.
- **Cryptography**: [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
- **Compression**: [Compression Stream API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Stream_API).
- **Concurrency**: Web Workers for background crypto operations to keep the UI responsive.
- **Offline Support**: Service Workers and PWA manifest.

## 🚀 Getting Started

### Prerequisites

A modern web browser that supports the Web Crypto API and Compression Stream API (Chrome 80+, Firefox 113+, Safari 16.4+).

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/SecrEdit.git
   ```
2. Open `index.html` in your browser or serve it using a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   ```

## 📖 How to Use

1. **Enter a Secret Key**: Type a strong password in the top input field.
2. **Write Your Note**: Type your content in the editor. The URL will update automatically.
3. **Preview Markdown**: Click the **MD** button to see the formatted output.
4. **Save/Share**: Copy the URL to your bookmarks or share it with someone who has the key.
5. **Export**: Use the 💾 button to save an encrypted `.secredit` file to your computer.

## 📄 License

This is free and unencumbered software released into the public domain. For more information, please refer to the [LICENSE](LICENSE) file or [unlicense.org](https://unlicense.org/).
