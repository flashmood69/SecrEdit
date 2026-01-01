# SecrEdit - Secure URL Editor

SecrEdit is a privacy-focused, client-side text editor that stores everything in the URL. It allows you to write and share encrypted notes (or plaintext notes via the "No Secrets" profile) without any server-side storage.

![SecrEdit Icon](assets/icon.svg)

## ✨ Features

- **End-to-End Encryption**: All encryption and decryption happen in your browser. Your secret key never leaves your device.
- **URL-Based Storage**: The content is stored entirely in the URL fragment (hash), making it easy to bookmark or share.
- **Compression**: Uses Gzip compression to maximize the amount of text you can store in a URL.
- **Progressive Web App (PWA)**: Installable on mobile and desktop for offline use.
- **Key Profiles**: Save multiple key profiles (with colors) and quickly switch between them.
- **Plaintext Mode**: Use the built-in "No Secrets" profile to store plaintext (still compressed) in the URL.
- **File Support**: Export and import notes as `.secredit` files (encrypted or plaintext depending on profile).
- **Find & Replace**: Integrated search and replace functionality.
- **Markdown Preview**: Toggle a vertical split to preview Markdown.
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
   git clone https://github.com/flashmood69/SecrEdit.git
   ```
   
2. Open `index.html` in your browser or serve it using a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   ```

## 📖 How to Use

1. **Pick a Profile**: Open the profiles menu and select a saved profile (or "No Secrets" for plaintext).
2. **Enter the Key (if needed)**: If you selected an encrypted profile, enter a strong password.
3. **Write Your Note**: Type your content in the editor. The URL updates automatically.
4. **Preview Markdown (optional)**: Click (MD) to toggle a vertical split preview.
5. **Save/Share**: Bookmark or share the URL. The URL includes the profile name so SecrEdit can auto-select it when opened.
6. **Export/Import**: Export a `.secredit` file for sharing or backup, and import it later to restore the note.
7. **Missing profile flow**: If you open a URL/file referencing a profile you don't have, SecrEdit opens the profile manager with the name pre-filled so you can create it by entering the password.

## 🔑 Profiles

- The profile name is stored in the URL fragment, so opening a link can automatically select the right profile.
- The built-in "No Secrets" profile always stores plaintext (compressed) and requires no password.
- Profile colors can be changed from the profile manager list.
- Duplicate profile names are prevented (saving an existing name updates it instead of creating another entry).

## 🤝 Credits

- **Flag Icons**: Provided by [Flagpedia.net](https://flagpedia.net) via [Flagcdn.com](https://flagcdn.com).

## 📄 License

This is free and unencumbered software released into the public domain. For more information, please refer to the [LICENSE](LICENSE) file or [unlicense.org](https://unlicense.org/).
