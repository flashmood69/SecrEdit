import { decryptPayloadToText, encryptText } from './crypto.js';

self.onmessage = async ({ data }) => {
    const { id, type, text, password, payload } = data || {};
    try {
        if (type === 'encrypt') {
            self.postMessage({ id, result: await encryptText({ text, password }) });
            return;
        }
        if (type === 'decrypt') {
            self.postMessage({ id, result: await decryptPayloadToText({ payload, password }) });
            return;
        }
        throw new Error('Invalid request');
    } catch (err) {
        const msg = err && typeof err === 'object' && typeof err.message === 'string' ? err.message : '';
        if (msg === 'invalid_data' || msg === 'Decompression limit exceeded') {
            self.postMessage({ id, error: msg });
            return;
        }
        self.postMessage({ id, error: 'Operation failed' });
    }
};
