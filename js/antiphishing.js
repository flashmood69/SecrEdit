export const CANONICAL_BASE_URL = 'https://flashmood69.github.io/SecrEdit/';

const TRUST_STATUS_ID = 'trust-status';

const isLocalhostHost = (host) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

const normalizeBaseUrl = (url) => {
    const u = new URL(url, window.location.href);
    const base = new URL('.', u);
    base.hash = '';
    base.search = '';
    return base.href;
};

const isLikelyIpHost = (host) => {
    if (!host) return false;
    if (host.startsWith('[') && host.endsWith(']')) return true;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
};

const hasNonAscii = (s) => /[^\x00-\x7F]/.test(s || '');
const isPunycodeHost = (host) => (host || '').toLowerCase().includes('xn--');

const computeTrustState = () => {
    const currentBase = normalizeBaseUrl(window.location.href);
    const canonicalBase = normalizeBaseUrl(CANONICAL_BASE_URL);
    const host = window.location.hostname || '';
    const isLocalhost = isLocalhostHost(host);
    const isOfficial = !isLocalhost && currentBase === canonicalBase;
    const suspiciousHost = isLikelyIpHost(host) || isPunycodeHost(host) || hasNonAscii(host);
    const trusted = isLocalhost || isOfficial;

    return {
        trusted,
        isLocalhost,
        isOfficial,
        suspiciousHost,
        host,
        currentBase,
        canonicalBase
    };
};

export const getCanonicalShareUrl = () => {
    const base = normalizeBaseUrl(CANONICAL_BASE_URL);
    const hash = typeof window.location.hash === 'string' ? window.location.hash : '';
    return hash && hash.startsWith('#') ? `${base}${hash}` : base;
};

export const initAntiPhishing = () => {
    let i18n = null;
    let lastRenderText = '';
    let lastRenderClass = '';
    let flashTimer = null;

    const setTrustStatus = (text, className, title) => {
        const el = document.getElementById(TRUST_STATUS_ID);
        if (!el) return;
        if (typeof className === 'string') {
            if (lastRenderClass) el.classList.remove(lastRenderClass);
            if (className) el.classList.add(className);
            lastRenderClass = className;
        }
        if (typeof title === 'string') el.title = title;
        if (typeof text === 'string' && text !== lastRenderText) {
            el.innerText = text;
            lastRenderText = text;
        }
    };

    const flashTrustStatus = (text, ms = 2000) => {
        clearTimeout(flashTimer);
        const { host, canonicalBase } = computeTrustState();
        const title = `Official: ${canonicalBase}`;
        setTrustStatus(text, 'trust-flash', title);
        flashTimer = setTimeout(() => renderTrustStatus(), ms);
    };

    const renderTrustStatus = () => {
        const { trusted, isLocalhost, isOfficial, suspiciousHost, host, currentBase, canonicalBase } = computeTrustState();
        const title = `Current: ${currentBase}\nOfficial: ${canonicalBase}`;

        if (isLocalhost) {
            setTrustStatus(`Local: ${host}`, 'trust-local', title);
            return;
        }
        if (isOfficial) {
            setTrustStatus(`Verified: ${host}`, 'trust-verified', title);
            return;
        }
        if (suspiciousHost) {
            setTrustStatus(`Unverified: ${host}`, 'trust-suspicious', title);
            return;
        }
        setTrustStatus(`Unverified: ${host}`, trusted ? 'trust-verified' : 'trust-unverified', title);
    };

    const withBlockedUi = (fn) => (e) => {
        const { trusted, canonicalBase } = computeTrustState();
        if (trusted) return fn(e);
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        flashTrustStatus('Blocked on unverified host');
        try {
            alert(`Unverified host.\nOpen: ${canonicalBase}`);
        } catch {}
    };

    const disableSensitiveButtons = () => {
        const { trusted } = computeTrustState();
        const ids = ['profile-btn', 'exportBtn', 'importBtn'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.disabled = !trusted;
            if (!trusted) el.setAttribute('aria-disabled', 'true');
            else el.removeAttribute('aria-disabled');
        }
    };

    const installShareOverride = () => {
        const btn = document.getElementById('copySecretBtn');
        if (!btn) return;

        const handler = async (e) => {
            if (typeof window.location.hash !== 'string' || window.location.hash.length <= 1) {
                const msg = i18n ? i18n.t('no_content_to_share') : 'No content to share';
                alert(msg);
                return;
            }

            const url = getCanonicalShareUrl();

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: i18n ? i18n.t('app_title') : 'SecrEdit',
                        text: i18n ? i18n.t('app_title') : 'SecrEdit',
                        url
                    });
                    flashTrustStatus('Shared official link');
                    return;
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                }
            }

            try {
                await navigator.clipboard.writeText(url);
                flashTrustStatus('Copied official link');
                return;
            } catch {}

            try {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(textArea);
                flashTrustStatus(ok ? 'Copied official link' : 'Copy failed');
            } catch {
                flashTrustStatus('Copy failed');
            }
        };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            handler(e);
        }, true);
    };

    const installSensitiveActionGuards = () => {
        const guardedIds = ['profile-btn', 'exportBtn', 'importBtn'];
        for (const id of guardedIds) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener('click', withBlockedUi(() => {}), true);
            el.addEventListener('keydown', withBlockedUi(() => {}), true);
        }

        document.addEventListener('focusin', (e) => {
            const { trusted, canonicalBase } = computeTrustState();
            if (trusted) return;
            const target = e && e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
            const type = (target.getAttribute('type') || '').toLowerCase();
            const name = (target.getAttribute('name') || '').toLowerCase();
            const autocomplete = (target.getAttribute('autocomplete') || '').toLowerCase();
            const looksSensitive = type === 'password' || autocomplete === 'one-time-code' || name.startsWith('profile_key_');
            if (!looksSensitive) return;
            target.blur();
            flashTrustStatus('Blocked secret entry');
            try {
                alert(`Unverified host.\nOpen: ${canonicalBase}`);
            } catch {}
        }, true);
    };

    const refresh = () => {
        renderTrustStatus();
        disableSensitiveButtons();
    };

    const setI18n = (nextI18n) => {
        i18n = nextI18n;
    };

    installShareOverride();
    installSensitiveActionGuards();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    refresh();

    return { refresh, setI18n };
};

