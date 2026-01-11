import { b64UrlDecodeToBytes, b64UrlEncodeBytes, gunzipToText, gzipBytes, utf8Encode } from './encoding.js';

export const DEFAULT_KDF_ID = 1;
export const KDF_CONFIGS = {
    1: { iterations: 600000, hash: 'SHA-256' }
};

const getKdfConfig = (kdfId) => {
    const cfg = KDF_CONFIGS[kdfId];
    if (!cfg) throw new Error('invalid_data');
    return cfg;
};

export const deriveKey = async (password, salt, kdfId = DEFAULT_KDF_ID) => {
    const cfg = getKdfConfig(kdfId);
    const material = await crypto.subtle.importKey('raw', utf8Encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: cfg.iterations, hash: cfg.hash },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

export const encryptText = async ({ text, password, kdf = DEFAULT_KDF_ID }) => {
    const kdfId = Number.isInteger(kdf) ? kdf : DEFAULT_KDF_ID;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, kdfId);
    const compressed = await gzipBytes(utf8Encode(text));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed);
    const packed = new Uint8Array(16 + 12 + encrypted.byteLength);
    packed.set(salt, 0);
    packed.set(iv, 16);
    packed.set(new Uint8Array(encrypted), 28);
    return `${kdfId}.${b64UrlEncodeBytes(packed)}`;
};

export const decryptPayloadToText = async ({ payload, password }) => {
    const dotIdx = typeof payload === 'string' ? payload.indexOf('.') : -1;
    const kdfStr = dotIdx === -1 ? '' : payload.slice(0, dotIdx);
    const body = dotIdx === -1 ? payload : payload.slice(dotIdx + 1);
    if (!body) throw new Error('invalid_data');
    const kdfId = dotIdx === -1 ? DEFAULT_KDF_ID : Number(kdfStr);
    if (!Number.isInteger(kdfId)) throw new Error('invalid_data');

    const buf = b64UrlDecodeToBytes(body);
    if (buf.length < 28) throw new Error('invalid_data');
    const salt = buf.slice(0, 16);
    const iv = buf.slice(16, 28);
    const ciphertext = buf.slice(28);
    const key = await deriveKey(password, salt, kdfId);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return gunzipToText(new Uint8Array(decrypted));
};
