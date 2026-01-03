const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PLAINTEXT_PREFIX = 'p:';

export const utf8Encode = (text) => encoder.encode(text);
export const utf8Decode = (bytes) => decoder.decode(bytes);

export const b64UrlEncodeBytes = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const b64UrlDecodeToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const gzipBytes = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

const MAX_DECOMPRESSED_SIZE = 10 * 1024 * 1024; // 10MB limit

export const gunzipToText = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    let total = 0;
    const chunks = [];
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_DECOMPRESSED_SIZE) {
            await reader.cancel();
            throw new Error('Decompression limit exceeded');
        }
        chunks.push(value);
    }
    
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    
    return utf8Decode(result);
};

export const decodePlaintextFromHash = async (payload) => gunzipToText(b64UrlDecodeToBytes(payload));
