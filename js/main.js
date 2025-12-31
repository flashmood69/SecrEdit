import { decodePlaintextFromHash, encodePlaintextForHash } from './encoding.js';
import { startUi } from './ui.js';

if (window.top !== window.self) {
    try {
        window.top.location.href = window.self.location.href;
    } catch {
        document.body.style.display = 'none';
    }
}

const KDF_ITERATIONS = 600000;
const WORKER_TIMEOUT_MS = 10000;

let worker;
let requestId = 0;
const pending = new Map();

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
    worker.onerror = () => initWorker();
};

const callWorker = (msg) => new Promise((resolve, reject) => {
    const id = requestId++;
    const timeout = setTimeout(() => {
        pending.delete(id);
        reject('Timeout');
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timeout });
    worker.postMessage({ ...msg, id });
});

initWorker();

const encrypt = ({ text, password, iterations }) => callWorker({ type: 'encrypt', text, password, iterations });
const decrypt = ({ payload, password, iterations }) => callWorker({ type: 'decrypt', payload, password, iterations });

const i18n = window.I18n;
startUi({ i18n, encrypt, decrypt, kdfIterations: KDF_ITERATIONS, encodePlaintextForHash, decodePlaintextFromHash });

