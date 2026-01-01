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

export const gunzipToText = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return utf8Decode(new Uint8Array(await new Response(stream).arrayBuffer()));
};

export const decodePlaintextFromHash = async (payload) => gunzipToText(b64UrlDecodeToBytes(payload));
