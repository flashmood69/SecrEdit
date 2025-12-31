import { decryptPayloadToText, encryptText } from './crypto.js';

self.onmessage = async ({ data }) => {
    const { id, type, text, password, payload, iterations } = data || {};
    try {
        if (type === 'encrypt') {
            self.postMessage({ id, result: await encryptText({ text, password, iterations }) });
            return;
        }
        if (type === 'decrypt') {
            self.postMessage({ id, result: await decryptPayloadToText({ payload, password, iterations }) });
            return;
        }
        throw new Error('Invalid request');
    } catch {
        self.postMessage({ id, error: 'Operation failed' });
    }
};

