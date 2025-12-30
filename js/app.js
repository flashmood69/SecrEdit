if (window.top !== window.self) {
    try {
        window.top.location.href = window.self.location.href;
    } catch {
        document.body.style.display = 'none';
    }
}
const $ = (id) => document.getElementById(id);
const header = $('header');
const burgerBtn = $('burger-btn');
const editor = $('editor');
const status = $('status');
const charCount = $('char-count');
const urlCount = $('url-count');
const keyInput = $('key-input');
const strengthBar = $('strength-bar');
const togglePass = $('toggle-pass');
const emojiBtn = $('emoji-btn');
const emojiPopover = $('emoji-popover');
const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const findBtn = $('findBtn');
const pasteBtn = $('pasteBtn');
const copyTextBtn = $('copyTextBtn');
const copySecretBtn = $('copySecretBtn');
const clearBtn = $('clearBtn');

const KDF_ITERATIONS = 600000;
const PLAINTEXT_PREFIX = 'p:';
const SYNC_DEBOUNCE_MS = 500;
const WORKER_TIMEOUT_MS = 10000;

const setStatus = (text, color = '') => {
    status.innerText = text;
    status.style.color = color;
};
const flashStatus = (text, ms = 1000) => {
    const oldText = status.innerText;
    const oldColor = status.style.color;
    setStatus(text);
    setTimeout(() => setStatus(oldText, oldColor), ms);
};

const isNonEmptyKey = (pw) => typeof pw === 'string' && pw.length > 0;
const isKeyStrongEnoughToEncrypt = (pw) => typeof pw === 'string' && pw.length >= 8;

const b64UrlEncodeBytes = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64UrlDecodeToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const gzipBytes = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};
const gunzipToText = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
};

const encodePlaintextForHash = async (text) => {
    const gz = await gzipBytes(new TextEncoder().encode(text));
    return `${PLAINTEXT_PREFIX}${b64UrlEncodeBytes(gz)}`;
};
const decodePlaintextFromHash = async (payload) => gunzipToText(b64UrlDecodeToBytes(payload));

let worker;
let workerUrl;
let requestId = 0;
const pending = new Map();

const createWorkerUrl = () => {
    const workerMain = () => {
        const enc = new TextEncoder();
        const dec = new TextDecoder();

        const b64UrlEncode = (bytes) => {
            let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        };
        const b64UrlDecode = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

        const gzip = async (bytes) => {
            const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        };
        const gunzipText = async (bytes) => {
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return dec.decode(await new Response(stream).arrayBuffer());
        };

        const deriveKey = async (password, salt, iterations) => {
            const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
            return crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
                material,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        };

        self.onmessage = async ({ data }) => {
            const { id, type, text, password, payload, iterations } = data || {};
            try {
                if (type === 'encrypt') {
                    const salt = crypto.getRandomValues(new Uint8Array(16));
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const key = await deriveKey(password, salt, iterations);
                    const compressed = await gzip(enc.encode(text));
                    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed);
                    const packed = new Uint8Array(16 + 12 + encrypted.byteLength);
                    packed.set(salt, 0);
                    packed.set(iv, 16);
                    packed.set(new Uint8Array(encrypted), 28);
                    self.postMessage({ id, result: b64UrlEncode(packed) });
                    return;
                }
                if (type === 'decrypt') {
                    const buf = b64UrlDecode(payload);
                    if (buf.length < 28) throw new Error('Invalid data');
                    const salt = buf.slice(0, 16);
                    const iv = buf.slice(16, 28);
                    const ciphertext = buf.slice(28);
                    const key = await deriveKey(password, salt, iterations);
                    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
                    self.postMessage({ id, result: await gunzipText(new Uint8Array(decrypted)) });
                    return;
                }
                throw new Error('Invalid request');
            } catch {
                self.postMessage({ id, error: 'Operation failed' });
            }
        };
    };

    return URL.createObjectURL(new Blob([`(${workerMain.toString()})()`], { type: 'text/javascript' }));
};

const initWorker = () => {
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    workerUrl = createWorkerUrl();
    worker = new Worker(workerUrl);
    worker.onmessage = ({ data }) => {
        const { id, result, error } = data || {};
        const entry = pending.get(id);
        if (!entry) return;
        clearTimeout(entry.timeout);
        pending.delete(id);
        error ? entry.reject(error) : entry.resolve(result);
    };
    worker.onerror = () => initWorker();
};
initWorker();

const callWorker = (msg) => new Promise((resolve, reject) => {
    const id = requestId++;
    const timeout = setTimeout(() => {
        pending.delete(id);
        reject('Timeout');
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timeout });
    worker.postMessage({ ...msg, id });
});

const updateCounts = () => {
    const chars = editor.value.length;
    const urlLen = location.href.length;
    charCount.innerText = `${chars} char${chars === 1 ? '' : 's'}`;
    urlCount.innerText = `URL: ${urlLen}`;
    urlCount.style.color = urlLen > 2000 ? '#ff4757' : '';
};

const updateStrengthMeter = () => {
    const pw = keyInput.value;
    status.style.color = '';
    if (!pw) {
        strengthBar.style.width = '0';
        keyInput.style.borderColor = 'var(--border)';
        keyInput.style.boxShadow = 'none';
        if (status.innerText === 'Weak key!' || status.innerText === 'Ready') status.innerText = 'Unencrypted';
        return;
    }

    const score = [
        pw.length >= 8,
        pw.length >= 12,
        /[A-Z]/.test(pw),
        /[0-9]/.test(pw),
        /[^A-Za-z0-9]/.test(pw)
    ].filter(Boolean).length;

    const weak = pw.length < 8;
    const color = weak ? '#ff4757' : (['#ff4757', '#ff4757', '#ffa502', '#2ed573', '#1e90ff'][score - 1] || '#ff4757');

    strengthBar.style.width = `${(score / 5) * 100}%`;
    strengthBar.style.background = color;
    keyInput.style.setProperty('border-color', color, 'important');
    keyInput.style.boxShadow = `0 0 5px ${color}`;

    if (weak) setStatus('Weak key!', '#ff4757');
    else if (status.innerText === 'Weak key!' || status.innerText === 'Secret key required') setStatus('Ready');
};

const insertAtSelection = (text) => {
    editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
    editor.focus();
    scheduleSync();
};

let syncTimer;
let lastDecryptionId = 0;

const scheduleSync = () => {
    updateCounts();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToHash, SYNC_DEBOUNCE_MS);
};

const syncToHash = async () => {
    const text = editor.value;
    if (!text || text === 'undefined') return;

    const key = keyInput.value;
    if (!isNonEmptyKey(key)) {
        setStatus('Syncing (unencrypted)...');
        try {
            history.replaceState(null, '', `#${await encodePlaintextForHash(text)}`);
            updateCounts();
            setStatus('Synced (unencrypted)');
            localStorage.removeItem('secredit_cache');
        } catch {
            setStatus('Sync error');
        }
        return;
    }

    if (!isKeyStrongEnoughToEncrypt(key)) {
        setStatus('Weak key!', '#ff4757');
        return;
    }

    setStatus('Encrypting...');
    try {
        const encrypted = await callWorker({ type: 'encrypt', text, password: key, iterations: KDF_ITERATIONS });
        if (!encrypted) throw new Error('No result');
        history.replaceState(null, '', `#${encrypted}`);
        updateCounts();
        setStatus('Synced');
        localStorage.setItem('secredit_cache', JSON.stringify({ data: encrypted, iterations: KDF_ITERATIONS }));
    } catch {
        setStatus('Sync error');
    }
};

const performDecryption = async (data, password, iterations) => {
    if (!data) return false;

    const currentId = ++lastDecryptionId;

    if (data.startsWith(PLAINTEXT_PREFIX)) {
        setStatus('Loading (unencrypted)...');
        try {
            const decoded = await decodePlaintextFromHash(data.slice(PLAINTEXT_PREFIX.length));
            if (currentId !== lastDecryptionId) return false;
            editor.value = decoded;
            setStatus('Loaded (unencrypted)');
            updateCounts();
            scheduleSync();
            return true;
        } catch {
            if (currentId === lastDecryptionId) setStatus('Invalid data');
            return false;
        }
    }

    if (!isNonEmptyKey(password)) {
        setStatus('Secret key required', '#ff4757');
        return false;
    }

    setStatus('Decrypting...');
    const candidates = iterations ? [iterations] : [KDF_ITERATIONS, 100000, 300000, 1000000];

    for (const iter of candidates) {
        try {
            if (currentId !== lastDecryptionId) return false;
            const dec = await callWorker({ type: 'decrypt', payload: data, password: password || '', iterations: iter });
            if (currentId !== lastDecryptionId) return false;
            editor.value = dec;
            setStatus('Decrypted');
            updateCounts();
            scheduleSync();
            return true;
        } catch {}
    }

    if (currentId === lastDecryptionId) setStatus('Wrong key');
    return false;
};

burgerBtn.addEventListener('click', () => {
    header.classList.toggle('collapsed');
    burgerBtn.innerText = header.classList.contains('collapsed') ? '☰' : '✕';
});

document.querySelector('form.input-wrapper').addEventListener('submit', (e) => e.preventDefault());

window.addEventListener('load', async () => {
    updateCounts();

    const data = location.hash.substring(1);
    if (data) {
        await performDecryption(data, keyInput.value);
        return;
    }

    const cacheRaw = localStorage.getItem('secredit_cache');
    if (!cacheRaw) return;

    let cachedData;
    let cachedIterations;
    try {
        ({ data: cachedData, iterations: cachedIterations } = JSON.parse(cacheRaw));
    } catch {
        localStorage.removeItem('secredit_cache');
        return;
    }
    if (typeof cachedData !== 'string' || !cachedData) return;

    setStatus('Load from cache?');
    status.style.cursor = 'pointer';
    status.onclick = async () => {
        if (!isNonEmptyKey(keyInput.value)) {
            setStatus('Enter key to load cache');
            return;
        }
        const ok = await performDecryption(cachedData, keyInput.value, cachedIterations);
        if (ok) {
            status.onclick = null;
            status.style.cursor = 'default';
        }
    };
});

editor.addEventListener('input', scheduleSync);

keyInput.addEventListener('input', () => {
    updateStrengthMeter();
    const data = location.hash.substring(1);
    if (data && !editor.value) performDecryption(data, keyInput.value);
    else if (editor.value) scheduleSync();
});

togglePass.addEventListener('click', () => {
    const show = keyInput.type === 'password';
    keyInput.type = show ? 'text' : 'password';
    togglePass.innerText = show ? '🙈' : '👁️';
});

const emojis = ["😊", "😀", "😂", "😍", "🤔", "😎", "🥺", "😢", "😭", "😲", "💀", "❤️", "✅", "👍", "👎", "👇", "👉", "🔥", "✨", "🚀", "🌟", "🎉", "💯", "👀", "🧠", "💡", "🙏", "👏", "🙌", "💪"];
const emojiFrag = document.createDocumentFragment();
for (const emoji of emojis) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-item';
    btn.innerText = emoji;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertAtSelection(emoji);
        emojiPopover.classList.remove('show');
    });
    emojiFrag.appendChild(btn);
}
emojiPopover.appendChild(emojiFrag);

emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPopover.classList.toggle('show');
});
document.addEventListener('click', (e) => {
    if (emojiPopover.classList.contains('show') && !emojiPopover.contains(e.target) && e.target !== emojiBtn) emojiPopover.classList.remove('show');
});

exportBtn.addEventListener('click', async () => {
    if (!editor.value) return alert('Nothing to export');
    let data;
    if (!isNonEmptyKey(keyInput.value)) {
        data = await encodePlaintextForHash(editor.value);
    } else {
        if (!isKeyStrongEnoughToEncrypt(keyInput.value)) return alert('Secret key required (8+ chars) or leave empty for plain text');
        data = await callWorker({ type: 'encrypt', text: editor.value, password: keyInput.value, iterations: KDF_ITERATIONS });
    }
    const blob = new Blob([JSON.stringify({ data, iterations: KDF_ITERATIONS, v: 2 })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `secret-${new Date().toISOString().slice(0, 10)}.secredit`;
    a.click();
});

importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.secredit';
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            let parsed;
            try {
                parsed = JSON.parse(reader.result);
            } catch {
                setStatus('Invalid file');
                return;
            }
            const { data, iterations } = parsed || {};
            if (typeof data !== 'string' || !data) {
                setStatus('Invalid file');
                return;
            }
            await performDecryption(data, keyInput.value, iterations);
        };
        reader.readAsText(file);
    };
    input.click();
});

pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) insertAtSelection(text);
    } catch {
        setStatus('Paste failed');
    }
});

const copyWithFeedback = async (btn, text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        return;
    }
    const old = btn.innerText;
    btn.innerText = '✅';
    setTimeout(() => (btn.innerText = old), 2000);
};
copyTextBtn.addEventListener('click', () => {
    const selected = editor.selectionStart !== editor.selectionEnd ? editor.value.slice(editor.selectionStart, editor.selectionEnd) : editor.value;
    copyWithFeedback(copyTextBtn, selected);
});
copySecretBtn.addEventListener('click', () => {
    if (location.hash.length <= 1) return alert('No content to share');
    copyWithFeedback(copySecretBtn, location.href);
});

clearBtn.addEventListener('click', () => {
    if (!confirm('Clear text and start new document?')) return;
    editor.value = '';
    history.replaceState(null, '', location.pathname);
    localStorage.removeItem('secredit_cache');
    setStatus('Ready');
    updateCounts();
});

const fBar = $('find-replace-bar');
const fIn = $('find-input');
const rIn = $('replace-input');
const closeFindBtn = $('close-find-btn');
const findNextBtn = $('find-next-btn');
const replaceBtn = $('replace-btn');
const replaceAllBtn = $('replace-all-btn');

const showFindBar = () => {
    fBar.classList.remove('hidden');
    fIn.focus();
};
const hideFindBar = () => {
    fBar.classList.add('hidden');
    editor.focus();
};

findBtn.addEventListener('click', () => (fBar.classList.contains('hidden') ? showFindBar() : hideFindBar()));
closeFindBtn.addEventListener('click', hideFindBar);

const findNext = () => {
    const query = fIn.value;
    if (!query) return;
    const start = editor.selectionEnd;
    const idx = editor.value.indexOf(query, start);
    const wrappedIdx = idx === -1 ? editor.value.indexOf(query) : idx;
    if (wrappedIdx === -1) return flashStatus('Not found');
    editor.focus();
    editor.setSelectionRange(wrappedIdx, wrappedIdx + query.length);
};

const replace = (all = false) => {
    const query = fIn.value;
    if (!query) return;
    const repl = rIn.value;
    if (all) {
        editor.value = editor.value.split(query).join(repl);
        flashStatus('Replaced All');
        scheduleSync();
        return;
    }
    if (editor.value.slice(editor.selectionStart, editor.selectionEnd) === query) editor.setRangeText(repl, editor.selectionStart, editor.selectionEnd, 'select');
    findNext();
    scheduleSync();
};

findNextBtn.addEventListener('click', findNext);
replaceBtn.addEventListener('click', () => replace(false));
replaceAllBtn.addEventListener('click', () => replace(true));
[fIn, rIn].forEach((el) => el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    el === fIn ? findNext() : replace(false);
}));

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        showFindBar();
        return;
    }
    if (e.key === 'Escape' && !fBar.classList.contains('hidden')) hideFindBar();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
