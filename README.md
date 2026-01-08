# SecrEdit

<img src="assets/icon.svg" alt="SecrEdit logo" width="48" height="48">

A client-side text editor that stores your note in the URL fragment. Notes can be encrypted in-browser (no server storage) or kept as compressed plaintext using the built-in “Plaintext” profile.

## Features

- Encrypt/decrypt locally in the browser (Web Crypto API)
- URL-fragment storage for easy sharing/bookmarking
- Gzip compression to fit more text into a URL
- Profiles: save multiple keys (with colors) and switch quickly
- Optional master password to protect saved profiles in localStorage
- Import/export `.secredit` files
- Find/replace, emoji picker, dark mode
- 11 languages (locale files load on demand)

## Security Notes

- Encryption: AES-GCM (256-bit)
- Key derivation: PBKDF2 (SHA-256) with 600,000 iterations
- Master password: also uses PBKDF2 with a high iteration count to encrypt saved profile keys
- DoS protections: import size limit (5MB) and decompression limit (10MB)

## Run Locally

Serve the folder and open the site:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000/

## Usage

1. Pick a profile (choose “Plaintext” for unencrypted mode).
2. Type your note; the URL updates automatically.
3. Share/bookmark the URL, or export/import a `.secredit` file.
4. If you open a link referencing a missing profile, SecrEdit prompts you to create it.

## Credits

- Flag icons: https://flagpedia.net (served via flagcdn.com)

## License

Public domain. See [LICENSE](LICENSE).
