import { b64UrlDecodeToBytes, b64UrlEncodeBytes, gunzipToText, gzipBytes, utf8Encode } from './encoding.js';

export const deriveKey = async (password, salt, iterations) => {
    const material = await crypto.subtle.importKey('raw', utf8Encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

export const encryptText = async ({ text, password, iterations }) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, iterations);
    const compressed = await gzipBytes(utf8Encode(text));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed);
    const packed = new Uint8Array(16 + 12 + encrypted.byteLength);
    packed.set(salt, 0);
    packed.set(iv, 16);
    packed.set(new Uint8Array(encrypted), 28);
    return b64UrlEncodeBytes(packed);
};

export const decryptPayloadToText = async ({ payload, password, iterations }) => {
    const buf = b64UrlDecodeToBytes(payload);
    if (buf.length < 28) throw new Error('Invalid data');
    const salt = buf.slice(0, 16);
    const iv = buf.slice(16, 28);
    const ciphertext = buf.slice(28);
    const key = await deriveKey(password, salt, iterations);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return gunzipToText(new Uint8Array(decrypted));
};

