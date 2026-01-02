import { decodePlaintextFromHash } from './encoding.js';
import { startUi } from './ui.js';

const isLocalhost = () => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

if (window.location.protocol === 'http:' && !isLocalhost()) {
    const url = new URL(window.location.href);
    url.protocol = 'https:';
    window.location.replace(url.toString());
}

if (window.top !== window.self) {
    try {
        window.top.location.href = window.self.location.href;
    } catch {
        document.body.style.display = 'none';
    }
}

const WORKER_TIMEOUT_MS = 10000;

let worker;
let requestId = 0;
const pending = new Map();

const restartWorkerAndFailPending = (error) => {
    for (const { reject, timeout } of pending.values()) {
        clearTimeout(timeout);
        reject(error);
    }
    pending.clear();
    initWorker();
};

const initWorker = () => {
    if (worker) worker.terminate();
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
        const { id, result, error } = data || {};
        const entry = pending.get(id);
        if (!entry) return;
        clearTimeout(entry.timeout);
        pending.delete(id);
        error ? entry.reject(error) : entry.resolve(result);
    };
    worker.onerror = () => restartWorkerAndFailPending('Operation failed');
};

const callWorker = (msg) => new Promise((resolve, reject) => {
    const id = requestId++;
    const timeout = setTimeout(() => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        restartWorkerAndFailPending('Timeout');
        reject('Timeout');
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timeout });
    worker.postMessage({ ...msg, id });
});

initWorker();

const encrypt = ({ text, password }) => callWorker({ type: 'encrypt', text, password });
const decrypt = ({ payload, password }) => callWorker({ type: 'decrypt', payload, password });

const i18n = window.I18n;
startUi({ i18n, encrypt, decrypt, decodePlaintextFromHash });
