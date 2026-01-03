import { PLAINTEXT_PREFIX, b64UrlDecodeToBytes, b64UrlEncodeBytes, gzipBytes, utf8Decode, utf8Encode } from './encoding.js';

const $ = (id) => document.getElementById(id);

const createSvgIcon = (d) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', d);
    return svg;
};

const ICON_VISIBLE = () => createSvgIcon("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z");
const ICON_HIDDEN = () => createSvgIcon("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-4.01.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z");
const ICON_CHECK = () => createSvgIcon("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");

export const startUi = ({ i18n, encrypt, decrypt, decodePlaintextFromHash }) => {
    const header = $('header');
    const burgerBtn = $('burger-btn');
    const editor = $('editor');
    const status = $('status');
    const profileNameEl = $('profile-name');
    const charCount = $('char-count');
    const urlCount = $('url-count');
    let keyInput = document.createElement('input'); // Virtual input since it's now in the popover
    keyInput.type = 'password';
    let strengthBar = document.createElement('div');
    const emojiBtn = $('emoji-btn');
    const emojiPopover = $('emoji-popover');
    const profileBtn = $('profile-btn');
    const profilePopover = $('profile-popover');
    const langBtn = $('lang-btn');
    const langPopover = $('lang-popover');
    const exportBtn = $('exportBtn');
    const importBtn = $('importBtn');
    const findBtn = $('findBtn');
    const pasteBtn = $('pasteBtn');
    const copyTextBtn = $('copyTextBtn');
    const copySecretBtn = $('copySecretBtn');
    const clearBtn = $('clearBtn');

    const SYNC_DEBOUNCE_MS = 500;
    const PROFILE_PREFIX = 'pr:';
    const NO_SECRETS_PROFILE = 'no_secrets';

    const normalizeProfileName = (name) => (name || '').trim().toLowerCase();

    const encodeProfileName = (name) => b64UrlEncodeBytes(utf8Encode(name));
    const decodeProfileName = (encoded) => utf8Decode(b64UrlDecodeToBytes(encoded));
    const encodePlaintextPayload = async (text) => b64UrlEncodeBytes(await gzipBytes(utf8Encode(text)));

    const sanitizeForFilename = (name) => {
        const base = (name || '').trim() || 'profile';
        return base
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 60);
    };

    const getSelectedProfileNameForFilename = () => {
        if (!profileNameEl) return 'profile';
        if (profileNameEl.getAttribute('data-i18n') === NO_SECRETS_PROFILE) return i18n.t('no_secrets');
        return profileNameEl.innerText.trim() || 'profile';
    };

    const parseHashWithProfile = (raw) => {
        if (typeof raw !== 'string' || !raw) return { payload: '', profileName: null };
        if (!raw.startsWith(PROFILE_PREFIX)) return { payload: raw, profileName: null };
        const rest = raw.slice(PROFILE_PREFIX.length);
        const idx = rest.indexOf(':');
        if (idx === -1) return { payload: raw, profileName: null };
        const profileEncoded = rest.slice(0, idx);
        const payload = rest.slice(idx + 1);
        if (!profileEncoded || !payload) return { payload, profileName: null };
        try {
            return { payload, profileName: decodeProfileName(profileEncoded) };
        } catch {
            return { payload, profileName: null };
        }
    };

    const getSelectedProfileName = () => {
        if (!profileNameEl) return NO_SECRETS_PROFILE;
        if (profileNameEl.getAttribute('data-i18n') === NO_SECRETS_PROFILE) return NO_SECRETS_PROFILE;
        const name = profileNameEl.innerText.trim();
        return name || NO_SECRETS_PROFILE;
    };

    const setStatus = (key, color = '', params = {}) => {
        if (!status) return;
        status.setAttribute('data-i18n', key);
        if (Object.keys(params).length) {
            status.setAttribute('data-i18n-options', JSON.stringify(params));
        } else {
            status.removeAttribute('data-i18n-options');
        }
        status.innerText = i18n.t(key, params);
        status.style.color = color;
    };

    const flashStatus = (key, ms = 1000) => {
        if (!status) return;
        const oldKey = status.getAttribute('data-i18n');
        const oldOptions = status.getAttribute('data-i18n-options');
        const oldColor = status.style.color;
        setStatus(key);
        setTimeout(() => {
            const opts = oldOptions ? JSON.parse(oldOptions) : {};
            setStatus(oldKey, oldColor, opts);
        }, ms);
    };

    const isNonEmptyKey = (pw) => typeof pw === 'string' && pw.length > 0;
    const isKeyStrongEnoughToEncrypt = (pw) => typeof pw === 'string' && pw.length >= 8;

    const updateCounts = () => {
        if (!editor || !charCount || !urlCount) return;
        const chars = editor.value.length;
        const urlLen = location.href.length;

        const charKey = chars === 1 ? 'chars_count_one' : 'chars_count';
        charCount.setAttribute('data-i18n', charKey);
        charCount.setAttribute('data-i18n-options', JSON.stringify({ count: chars }));
        charCount.innerText = i18n.t(charKey, { count: chars });

        urlCount.setAttribute('data-i18n', 'url_label');
        urlCount.setAttribute('data-i18n-options', JSON.stringify({ count: urlLen }));
        urlCount.innerText = i18n.t('url_label', { count: urlLen });

        urlCount.style.color = urlLen > 2000 ? '#ff4757' : '';
    };

    const updateModeIndicator = (mode) => {
        if (!burgerBtn) return;
        burgerBtn.classList.remove('mode-plain', 'mode-encrypted');
        if (mode === 'plain') burgerBtn.classList.add('mode-plain');
        else if (mode === 'encrypted') burgerBtn.classList.add('mode-encrypted');
    };

    const updateStrengthMeter = (input = keyInput, bar = strengthBar) => {
        const pw = input.value;
        status.style.color = '';
        if (!pw) {
            bar.style.width = '0';
            input.style.borderColor = 'var(--border)';
            input.style.boxShadow = 'none';
            const currentKey = status.getAttribute('data-i18n');
            if (currentKey === 'weak_key' || currentKey === 'status_ready' || currentKey === 'ready_encrypted' || currentKey === 'unencrypted') {
                setStatus('unencrypted', '#ff4757');
            }
            updateModeIndicator('plain');
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

        bar.style.width = `${(score / 5) * 100}%`;
        bar.style.background = color;
        input.style.setProperty('border-color', color, 'important');
        input.style.boxShadow = `0 0 5px ${color}`;

        if (weak) {
            setStatus('weak_key', '#ff4757');
            updateModeIndicator('plain');
        } else {
            const currentKey = status.getAttribute('data-i18n');
            if (currentKey === 'weak_key' || currentKey === 'secret_key_required' || currentKey === 'status_ready' || currentKey === 'unencrypted') {
                setStatus('ready_encrypted');
            }
            updateModeIndicator('encrypted');
        }
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
            setStatus('syncing_unencrypted');
            try {
                const plain = await encodePlaintextPayload(text);
                const selectedProfileName = getSelectedProfileName();
                const payload = `${PROFILE_PREFIX}${encodeProfileName(selectedProfileName)}:${plain}`;
                history.replaceState(null, '', `#${payload}`);
                updateCounts();
                setStatus('synced_unencrypted', '#ff4757');
            } catch {
                setStatus('sync_error');
            }
            return;
        }

        if (!isKeyStrongEnoughToEncrypt(key)) {
            setStatus('weak_key', '#ff4757');
            return;
        }

        setStatus('encrypting');
        try {
            const encrypted = await encrypt({ text, password: key });
            if (!encrypted) throw new Error('No result');
            const selectedProfileName = getSelectedProfileName();
            const payload = `${PROFILE_PREFIX}${encodeProfileName(selectedProfileName)}:${encrypted}`;
            history.replaceState(null, '', `#${payload}`);
            updateCounts();
            setStatus('synced_encrypted');
        } catch {
            setStatus('sync_error');
        }
    };

    const performDecryption = async (data, password) => {
        if (!data || !editor) return false;

        const currentId = ++lastDecryptionId;

        if (data.startsWith(PLAINTEXT_PREFIX)) {
            setStatus('loading_unencrypted', '#ff4757');
            try {
                const decoded = await decodePlaintextFromHash(data.slice(PLAINTEXT_PREFIX.length));
                if (currentId !== lastDecryptionId) return false;
                editor.value = decoded;
                setStatus('loaded_unencrypted', '#ff4757');
                updateCounts();
                scheduleSync();
                return true;
            } catch {
                if (currentId === lastDecryptionId) setStatus('invalid_data');
                return false;
            }
        }

        if (!isNonEmptyKey(password)) {
            setStatus('loading_unencrypted', '#ff4757');
            try {
                const decoded = await decodePlaintextFromHash(data);
                if (currentId !== lastDecryptionId) return false;
                editor.value = decoded;
                setStatus('loaded_unencrypted', '#ff4757');
                updateCounts();
                scheduleSync();
                return true;
            } catch {
                if (currentId === lastDecryptionId) setStatus('secret_key_required', '#ff4757');
                return false;
            }
        }

        setStatus('decrypting');
        try {
            if (currentId !== lastDecryptionId) return false;
            const dec = await decrypt({ payload: data, password: password || '' });
            if (currentId !== lastDecryptionId) return false;
            editor.value = dec;
            setStatus('decrypted');
            updateCounts();
            scheduleSync();
            return true;
        } catch {}

        if (currentId === lastDecryptionId) setStatus('wrong_key');
        return false;
    };

    if (burgerBtn && header) {
        burgerBtn.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            const iconMenu = burgerBtn.querySelector('.icon-menu');
            const iconClose = burgerBtn.querySelector('.icon-close');
            if (iconMenu && iconClose) {
                if (header.classList.contains('collapsed')) {
                    iconMenu.classList.remove('hidden');
                    iconClose.classList.add('hidden');
                } else {
                    iconMenu.classList.add('hidden');
                    iconClose.classList.remove('hidden');
                }
            }
        });
    }

    window.addEventListener('load', async () => {
        await i18n.init();

        const languages = ['en', 'es', 'ar', 'it', 'fr', 'de', 'zh', 'hi', 'pt', 'bn', 'ru'];

        if (langBtn && langPopover) {
            const updateLangBtn = (lang) => {
                const img = document.createElement('img');
                img.src = `assets/flags/${lang}.svg`;
                img.alt = lang;
                img.className = 'flag-icon';
                langBtn.replaceChildren(img);
            };
            updateLangBtn(i18n.currentLang);

            const langFrag = document.createDocumentFragment();
            for (const lang of languages) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'lang-item';
                const img = document.createElement('img');
                img.src = `assets/flags/${lang}.svg`;
                img.alt = lang;
                img.className = 'flag-icon';
                btn.appendChild(img);
                btn.title = lang.toUpperCase();
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    i18n.changeLanguage(lang);
                    updateLangBtn(lang);
                    updateCounts();
                    updateStrengthMeter(keyInput, strengthBar);
                    langPopover.classList.remove('show');
                });
                langFrag.appendChild(btn);
            }
            langPopover.appendChild(langFrag);

            langBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                langPopover.classList.toggle('show');
                emojiPopover.classList.remove('show');
                profilePopover.classList.remove('show');
            });

            document.addEventListener('click', (e) => {
                if (langPopover.classList.contains('show') && !langPopover.contains(e.target) && e.target !== langBtn) langPopover.classList.remove('show');
            });
        }

        updateCounts();
        updateStrengthMeter(keyInput, strengthBar);

        const raw = location.hash.substring(1);
        if (raw) {
            const { payload, profileName } = parseHashWithProfile(raw);
            if (profileName) {
                const ok = await ensureProfileAvailable(profileName);
                if (!ok) return;
            }
            await performDecryption(payload, keyInput.value);
            return;
        }
    });

    if (editor) {
        editor.addEventListener('input', scheduleSync);
    }

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

    if (emojiBtn) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPopover.classList.toggle('show');
            if (langPopover) langPopover.classList.remove('show');
            profilePopover.classList.remove('show');
        });
    }
    document.addEventListener('click', (e) => {
        if (emojiPopover.classList.contains('show') && !emojiPopover.contains(e.target) && e.target !== emojiBtn) emojiPopover.classList.remove('show');
    });

    // Profile Management
    const ENCRYPTED_PROFILES_KEY = 'secredit_profiles_enc';
    const ENCRYPTED_PROFILES_SALT_KEY = 'secredit_profiles_enc_salt';
    const ENCRYPTED_PROFILES_CHECK_KEY = 'secredit_profiles_enc_check';
    const PROFILE_KDF_ITERATIONS = 600000;

    let profilesMasterKey = null;

    const createPasswordManagerUsernameInput = () => {
        const u = document.createElement('input');
        u.type = 'text';
        u.value = 'SecrEdit';
        u.setAttribute('autocomplete', 'username');
        u.setAttribute('name', 'username');
        u.style.position = 'absolute';
        u.style.left = '-9999px';
        u.style.width = '1px';
        u.style.height = '1px';
        u.style.opacity = '0';
        u.setAttribute('tabindex', '-1');
        u.setAttribute('aria-hidden', 'true');
        return u;
    };

    const deriveProfilesMasterKey = async (masterPassword, salt) => {
        const material = await crypto.subtle.importKey('raw', utf8Encode(masterPassword), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PROFILE_KDF_ITERATIONS, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    };

    const encryptStringWithKey = async (key, plaintext) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8Encode(String(plaintext ?? '')));
        return { iv: b64UrlEncodeBytes(iv), ct: b64UrlEncodeBytes(new Uint8Array(ciphertext)) };
    };

    const decryptStringWithKey = async (key, enc) => {
        if (!enc || typeof enc !== 'object') throw new Error('Invalid data');
        const iv = b64UrlDecodeToBytes(enc.iv);
        const ct = b64UrlDecodeToBytes(enc.ct);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return utf8Decode(new Uint8Array(plaintext));
    };

    const hasProfilesMasterPassword = () => Boolean(localStorage.getItem(ENCRYPTED_PROFILES_CHECK_KEY));

    const loadProfilesSalt = () => {
        const raw = localStorage.getItem(ENCRYPTED_PROFILES_SALT_KEY);
        if (!raw) return null;
        try {
            const bytes = b64UrlDecodeToBytes(raw);
            return bytes && bytes.length ? bytes : null;
        } catch {
            return null;
        }
    };

    const getOrCreateProfilesSalt = () => {
        const existing = loadProfilesSalt();
        if (existing) return existing;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem(ENCRYPTED_PROFILES_SALT_KEY, b64UrlEncodeBytes(salt));
        return salt;
    };

    const unlockProfilesMasterKey = async (masterPassword) => {
        if (profilesMasterKey) return profilesMasterKey;
        if (!hasProfilesMasterPassword()) throw new Error('No master password set');
        if (!masterPassword) throw new Error('Missing master password');

        const actualSalt = loadProfilesSalt() || getOrCreateProfilesSalt();
        const key = await deriveProfilesMasterKey(masterPassword, actualSalt);

        const checkRaw = localStorage.getItem(ENCRYPTED_PROFILES_CHECK_KEY);
        if (!checkRaw) throw new Error('Operation failed');
        let check;
        try {
            check = JSON.parse(checkRaw);
        } catch {
            throw new Error('Operation failed');
        }
        try {
            await decryptStringWithKey(key, check);
        } catch {
            throw new Error('Wrong master password');
        }
        profilesMasterKey = key;
        return key;
    };

    const createProfilesMasterKey = async (masterPassword) => {
        if (profilesMasterKey) return profilesMasterKey;
        if (hasProfilesMasterPassword()) throw new Error('Master password already set');
        if (!masterPassword) throw new Error('Missing master password');
        if (!isKeyStrongEnoughToEncrypt(masterPassword)) throw new Error('Weak');

        const salt = getOrCreateProfilesSalt();
        const key = await deriveProfilesMasterKey(masterPassword, salt);
        const check = await encryptStringWithKey(key, 'ok');
        localStorage.setItem(ENCRYPTED_PROFILES_CHECK_KEY, JSON.stringify(check));
        profilesMasterKey = key;
        return key;
    };

    const lockProfilesMasterKey = () => {
        profilesMasterKey = null;
    };

    const loadEncryptedProfiles = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(ENCRYPTED_PROFILES_KEY) || '[]');
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && p.name)
                .map((p) => ({
                    name: p.name,
                    color: typeof p.color === 'string' && p.color ? p.color : '#2ed573',
                    passEnc: p.passEnc
                }));
        } catch {
            return [];
        }
    };

    const saveEncryptedProfiles = (profiles) => {
        const sanitized = Array.isArray(profiles) ? profiles
            .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && p.name)
            .map((p) => ({
                name: p.name,
                color: typeof p.color === 'string' && p.color ? p.color : '#2ed573',
                passEnc: p.passEnc
            })) : [];
        localStorage.setItem(ENCRYPTED_PROFILES_KEY, JSON.stringify(sanitized));
    };

    const loadProfiles = async () => {
        return loadEncryptedProfiles();
    };

    const saveProfiles = (profiles) => {
        saveEncryptedProfiles(profiles);
    };

    const renderProfiles = async (opts = {}) => {
        let profiles = [];
        try {
            profiles = await loadProfiles();
        } catch {
            profiles = [];
        }
        profilePopover.replaceChildren();

        let masterFocusEl = null;
        const isRtl = document.documentElement.dir === 'rtl';

        const unlockContainer = document.createElement('div');
        unlockContainer.id = 'unlock-profiles-container';

        const unlockHeader = document.createElement('div');
        unlockHeader.className = 'unlock-profiles-header';

        const unlockTitle = document.createElement('div');
        unlockTitle.className = 'unlock-profiles-title';

        const lockBtn = document.createElement('button');
        lockBtn.type = 'button';
        lockBtn.className = 'unlock-profiles-lock-btn';
        lockBtn.innerText = i18n.t('lock_profiles');
        lockBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            lockProfilesMasterKey();
            await renderProfiles({ ...opts, focusUnlock: true });
            flashStatus('profiles_locked');
        });

        unlockHeader.appendChild(unlockTitle);

        if (profilesMasterKey) {
            unlockTitle.innerText = i18n.t('profiles_unlocked');
            unlockHeader.appendChild(lockBtn);
            unlockContainer.appendChild(unlockHeader);
        } else if (hasProfilesMasterPassword()) {
            unlockTitle.innerText = i18n.t('unlock_profiles');
            unlockContainer.appendChild(unlockHeader);

            const unlockForm = document.createElement('form');
            unlockForm.autocomplete = 'on';
            unlockForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUnlock();
            });

            const mpWrapper = document.createElement('div');
            mpWrapper.className = 'input-wrapper';
            mpWrapper.style.width = '100%';
            mpWrapper.style.margin = '0';

            const mpInput = document.createElement('input');
            mpInput.type = 'password';
            mpInput.placeholder = i18n.t('master_password');
            mpInput.setAttribute('autocomplete', 'current-password');
            mpInput.setAttribute('name', 'password');
            mpInput.setAttribute('autocapitalize', 'none');
            mpInput.setAttribute('spellcheck', 'false');
            mpInput.addEventListener('click', (e) => e.stopPropagation());
            if (isRtl) mpInput.style.paddingLeft = '35px';
            else mpInput.style.paddingRight = '35px';

            const mpStrengthMeter = document.createElement('div');
            mpStrengthMeter.className = 'strength-meter';
            const mpStrengthBar = document.createElement('div');
            mpStrengthBar.className = 'strength-bar';
            mpStrengthMeter.appendChild(mpStrengthBar);

            mpInput.addEventListener('input', () => {
                updateStrengthMeter(mpInput, mpStrengthBar);
            });

            const mpToggle = document.createElement('button');
            mpToggle.type = 'button';
            mpToggle.appendChild(ICON_VISIBLE());
            mpToggle.style.position = 'absolute';
            if (isRtl) mpToggle.style.left = '5px';
            else mpToggle.style.right = '5px';
            mpToggle.style.top = '50%';
            mpToggle.style.transform = 'translateY(-50%)';
            mpToggle.style.background = 'none';
            mpToggle.style.border = 'none';
            mpToggle.style.cursor = 'pointer';
            mpToggle.style.display = 'flex';
            mpToggle.style.alignItems = 'center';
            mpToggle.style.justifyContent = 'center';
            mpToggle.style.padding = '0';
            mpToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const show = mpInput.type === 'password';
                mpInput.type = show ? 'text' : 'password';
                mpToggle.replaceChildren(show ? ICON_HIDDEN() : ICON_VISIBLE());
            });

            const unlockBtn = document.createElement('button');
            unlockBtn.type = 'button';
            unlockBtn.className = 'unlock-profiles-btn';
            unlockBtn.innerText = i18n.t('unlock');

            const handleUnlock = async (e) => {
                if (e) e.stopPropagation();
                try {
                    await unlockProfilesMasterKey(mpInput.value);
                } catch (err) {
                    flashStatus(err && err.message === 'Wrong master password' ? 'wrong_master_password' : 'operation_failed');
                    mpInput.focus();
                    return;
                }
                mpInput.value = '';
                await renderProfiles({ ...opts, prefillName: nameInput.value, prefillPass: newKeyInput.value, prefillColor: colorInput.value });
                flashStatus('profiles_unlocked');
            };

            unlockBtn.addEventListener('click', handleUnlock);
            mpInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                handleUnlock();
            });

            mpWrapper.appendChild(mpInput);
            mpWrapper.appendChild(mpStrengthMeter);
            mpWrapper.appendChild(mpToggle);
            unlockForm.appendChild(createPasswordManagerUsernameInput());
            unlockForm.appendChild(mpWrapper);
            unlockForm.appendChild(unlockBtn);
            unlockContainer.appendChild(unlockForm);
            masterFocusEl = mpInput;
        } else {
            unlockTitle.innerText = i18n.t('set_master_password');
            unlockContainer.appendChild(unlockHeader);

            const setForm = document.createElement('form');
            setForm.autocomplete = 'on';
            setForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSet();
            });

            const mpWrapper = document.createElement('div');
            mpWrapper.className = 'input-wrapper';
            mpWrapper.style.width = '100%';
            mpWrapper.style.margin = '0';

            const mpInput = document.createElement('input');
            mpInput.type = 'password';
            mpInput.placeholder = i18n.t('master_password');
            mpInput.setAttribute('autocomplete', 'new-password');
            mpInput.setAttribute('name', 'new-password');
            mpInput.setAttribute('autocapitalize', 'none');
            mpInput.setAttribute('spellcheck', 'false');
            mpInput.addEventListener('click', (e) => e.stopPropagation());
            if (isRtl) mpInput.style.paddingLeft = '35px';
            else mpInput.style.paddingRight = '35px';

            const mpStrengthMeter = document.createElement('div');
            mpStrengthMeter.className = 'strength-meter';
            const mpStrengthBar = document.createElement('div');
            mpStrengthBar.className = 'strength-bar';
            mpStrengthMeter.appendChild(mpStrengthBar);

            mpInput.addEventListener('input', () => {
                updateStrengthMeter(mpInput, mpStrengthBar);
            });

            const mpToggle = document.createElement('button');
            mpToggle.type = 'button';
            mpToggle.appendChild(ICON_VISIBLE());
            mpToggle.style.position = 'absolute';
            if (isRtl) mpToggle.style.left = '5px';
            else mpToggle.style.right = '5px';
            mpToggle.style.top = '50%';
            mpToggle.style.transform = 'translateY(-50%)';
            mpToggle.style.background = 'none';
            mpToggle.style.border = 'none';
            mpToggle.style.cursor = 'pointer';
            mpToggle.style.display = 'flex';
            mpToggle.style.alignItems = 'center';
            mpToggle.style.justifyContent = 'center';
            mpToggle.style.padding = '0';
            mpToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const show = mpInput.type === 'password';
                mpInput.type = show ? 'text' : 'password';
                mpToggle.replaceChildren(show ? ICON_HIDDEN() : ICON_VISIBLE());
            });

            const setBtn = document.createElement('button');
            setBtn.type = 'button';
            setBtn.className = 'unlock-profiles-btn';
            setBtn.innerText = i18n.t('set_password');

            const handleSet = async (e) => {
                if (e) e.stopPropagation();
                if (!isKeyStrongEnoughToEncrypt(mpInput.value)) {
                    flashStatus('weak_key');
                    mpInput.focus();
                    return;
                }
                try {
                    await createProfilesMasterKey(mpInput.value);
                } catch {
                    flashStatus('operation_failed');
                    mpInput.focus();
                    return;
                }
                mpInput.value = '';
                await renderProfiles({ ...opts, prefillName: nameInput.value, prefillPass: newKeyInput.value, prefillColor: colorInput.value });
                flashStatus('master_password_set');
            };

            setBtn.addEventListener('click', handleSet);
            mpInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                handleSet();
            });

            mpWrapper.appendChild(mpInput);
            mpWrapper.appendChild(mpStrengthMeter);
            mpWrapper.appendChild(mpToggle);

            setForm.appendChild(createPasswordManagerUsernameInput());
            setForm.appendChild(mpWrapper);
            setForm.appendChild(setBtn);
            unlockContainer.appendChild(setForm);
            masterFocusEl = mpInput;
        }

        profilePopover.appendChild(unlockContainer);

        const saveContainer = document.createElement('div');
        saveContainer.id = 'save-profile-container';
        saveContainer.style.flexDirection = 'column';
        saveContainer.style.gap = '8px';
        saveContainer.style.padding = '10px';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = i18n.t('profile_name');
        nameInput.setAttribute('autocomplete', 'off');
        nameInput.setAttribute('name', 'profile_name');
        nameInput.addEventListener('click', (e) => e.stopPropagation());
        if (opts.prefillName) nameInput.value = opts.prefillName;

        const keyWrapper = document.createElement('div');
        keyWrapper.className = 'input-wrapper';
        keyWrapper.style.width = '100%';
        keyWrapper.style.margin = '0';

        const newKeyInput = document.createElement('input');
        newKeyInput.type = 'password';
        newKeyInput.placeholder = i18n.t('key_placeholder');
        newKeyInput.setAttribute('autocomplete', 'off');
        newKeyInput.setAttribute('name', 'profile_key');
        newKeyInput.style.width = '100%';
        newKeyInput.addEventListener('click', (e) => e.stopPropagation());
        if (typeof opts.prefillPass === 'string') newKeyInput.value = opts.prefillPass;
        if (isRtl) newKeyInput.style.paddingLeft = '35px';
        else newKeyInput.style.paddingRight = '35px';

        const newStrengthMeter = document.createElement('div');
        newStrengthMeter.className = 'strength-meter';
        const newStrengthBar = document.createElement('div');
        newStrengthBar.className = 'strength-bar';
        newStrengthMeter.appendChild(newStrengthBar);

        newKeyInput.addEventListener('input', () => {
            updateStrengthMeter(newKeyInput, newStrengthBar);
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.appendChild(ICON_VISIBLE());
        toggleBtn.style.position = 'absolute';
        if (isRtl) toggleBtn.style.left = '5px';
        else toggleBtn.style.right = '5px';
        toggleBtn.style.top = '50%';
        toggleBtn.style.transform = 'translateY(-50%)';
        toggleBtn.style.background = 'none';
        toggleBtn.style.border = 'none';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.display = 'flex';
        toggleBtn.style.alignItems = 'center';
        toggleBtn.style.justifyContent = 'center';
        toggleBtn.style.padding = '0';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const show = newKeyInput.type === 'password';
            newKeyInput.type = show ? 'text' : 'password';
            toggleBtn.replaceChildren(show ? ICON_HIDDEN() : ICON_VISIBLE());
        });

        keyWrapper.appendChild(newKeyInput);
        keyWrapper.appendChild(newStrengthMeter);
        keyWrapper.appendChild(toggleBtn);
        
        const colorWrapper = document.createElement('div');
        colorWrapper.style.display = 'flex';
        colorWrapper.style.alignItems = 'center';
        colorWrapper.style.gap = '10px';
        colorWrapper.style.marginTop = '8px';

        const colorLabel = document.createElement('label');
        colorLabel.innerText = i18n.t('profile_color') || 'Profile Color';
        colorLabel.style.fontSize = '12px';
        colorLabel.style.color = 'var(--text)';
        colorLabel.style.flex = '1';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = typeof opts.prefillColor === 'string' && opts.prefillColor ? opts.prefillColor : '#2ed573';
        colorInput.style.width = '40px';
        colorInput.style.height = '40px';
        colorInput.style.border = '1px solid var(--border)';
        colorInput.style.borderRadius = '4px';
        colorInput.style.cursor = 'pointer';
        colorInput.style.padding = '0';
        colorInput.style.background = 'transparent';
        colorInput.title = i18n.t('profile_color') || 'Profile Color';

        colorWrapper.appendChild(colorInput);
        colorWrapper.appendChild(colorLabel);

        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-profile-btn';
        saveBtn.className = 'unlock-profiles-btn';
        saveBtn.innerText = i18n.t('save_profile');
        saveBtn.type = 'button';
        saveBtn.style.width = '100%';
        saveBtn.style.padding = '8px';
        
        const handleSave = async (e) => {
            if (e) e.stopPropagation();
            const name = nameInput.value.trim();
            const pass = newKeyInput.value;
            const color = colorInput.value;
            
            if (!name) {
                flashStatus('name_required');
                nameInput.focus();
                return;
            }
            if (normalizeProfileName(name) === NO_SECRETS_PROFILE) {
                flashStatus('invalid_request');
                nameInput.focus();
                return;
            }
            if (!isKeyStrongEnoughToEncrypt(pass)) {
                flashStatus('weak_key');
                newKeyInput.focus();
                return;
            }

            if (!profilesMasterKey) {
                flashStatus(hasProfilesMasterPassword() ? 'profiles_locked' : 'master_password_required');
                if (masterFocusEl) masterFocusEl.focus();
                return;
            }
            const current = await loadProfiles();
            const created = { name, color, passEnc: await encryptStringWithKey(profilesMasterKey, pass) };
            const existingIdx = current.findIndex((p) => p && normalizeProfileName(p.name) === normalizeProfileName(name));
            if (existingIdx >= 0) current[existingIdx] = created;
            else current.push(created);
            saveProfiles(current);

            if (opts.onSaved) {
                opts.onSaved(created);
                profilePopover.classList.remove('show');
                return;
            }

            nameInput.value = '';
            newKeyInput.value = '';
            updateStrengthMeter(newKeyInput, newStrengthBar);
            await renderProfiles();
            flashStatus('profile_saved');
        };

        saveBtn.addEventListener('click', handleSave);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                newKeyInput.focus();
            }
        });
        newKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        });

        saveContainer.appendChild(nameInput);
        saveContainer.appendChild(keyWrapper);
        saveContainer.appendChild(colorWrapper);
        saveContainer.appendChild(saveBtn);
        profilePopover.appendChild(saveContainer);
        if (opts.focusUnlock && masterFocusEl) setTimeout(() => masterFocusEl.focus(), 0);
        else if (opts.focusPassword) setTimeout(() => newKeyInput.focus(), 0);

        // Default "No Secrets" profile
        const defaultProfile = { name: i18n.t('no_secrets'), pass: '' };
        const defaultItem = document.createElement('div');
        defaultItem.className = 'profile-item';
        defaultItem.style.fontWeight = 'bold';
        defaultItem.style.borderBottom = '1px solid var(--border)';
        defaultItem.style.marginBottom = '5px';
        defaultItem.style.borderRadius = '0';
        
        const defaultLabel = document.createElement('span');
        defaultLabel.className = 'label';
        defaultLabel.innerText = defaultProfile.name;
        
        defaultItem.appendChild(defaultLabel);
        defaultItem.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNoSecretsInUi();
            const { payload } = parseHashWithProfile(location.hash.substring(1));
            if (payload && !editor.value) performDecryption(payload, '');
            else if (editor.value) scheduleSync();
            profilePopover.classList.remove('show');
        });
        profilePopover.appendChild(defaultItem);

        if (profiles.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'profile-item';
            empty.style.justifyContent = 'center';
            empty.innerText = i18n.t('no_profiles');
            profilePopover.appendChild(empty);
        } else {
            profiles.forEach((p, idx) => {
                const item = document.createElement('div');
                item.className = 'profile-item';
                
                const label = document.createElement('span');
                label.className = 'label';
                label.innerText = p.name;
                label.title = p.name;

                const colorBtn = document.createElement('input');
                colorBtn.type = 'color';
                colorBtn.value = p.color || '#2ed573';
                colorBtn.title = i18n.t('profile_color') || 'Profile Color';
                colorBtn.style.width = '28px';
                colorBtn.style.height = '28px';
                colorBtn.style.border = '1px solid var(--border)';
                colorBtn.style.borderRadius = '4px';
                colorBtn.style.cursor = 'pointer';
                colorBtn.style.padding = '0';
                colorBtn.style.marginRight = '8px';
                colorBtn.style.background = 'transparent';
                colorBtn.addEventListener('click', (e) => e.stopPropagation());
                colorBtn.addEventListener('input', async (e) => {
                    e.stopPropagation();
                    const nextColor = colorBtn.value;
                    const current = await loadProfiles();
                    const target = current[idx];
                    if (target) target.color = nextColor;
                    saveProfiles(current);
                    p.color = nextColor;
                    if (profileNameEl && profileNameEl.getAttribute('data-i18n') !== 'no_secrets' && profileNameEl.innerText.trim() === p.name) {
                        if (profileBtn) profileBtn.style.background = nextColor;
                    }
                });
                
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-profile';
                delBtn.innerText = '✕';
                delBtn.title = i18n.t('delete_profile');
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const current = await loadProfiles();
                    current.splice(idx, 1);
                    saveProfiles(current);
                    await renderProfiles();
                    flashStatus('profile_deleted');
                });

                item.addEventListener('click', async () => {
                    if (!profilesMasterKey) {
                        flashStatus(hasProfilesMasterPassword() ? 'profiles_locked' : 'master_password_required');
                        if (masterFocusEl) masterFocusEl.focus();
                        return;
                    }
                    await selectProfileInUi(p);
                    const { payload } = parseHashWithProfile(location.hash.substring(1));
                    if (payload && !editor.value) performDecryption(payload, keyInput.value);
                    else if (editor.value) scheduleSync();
                    profilePopover.classList.remove('show');
                });

                item.appendChild(colorBtn);
                item.appendChild(label);
                item.appendChild(delBtn);
                profilePopover.appendChild(item);
            });
        }
    };

    const selectNoSecretsInUi = () => {
        keyInput.value = '';
        updateStrengthMeter(keyInput, strengthBar);
        if (profileBtn) profileBtn.style.background = '';
        if (profileNameEl) {
            profileNameEl.setAttribute('data-i18n', 'no_secrets');
            profileNameEl.innerText = i18n.t('no_secrets');
        }
    };

    const selectProfileInUi = async (p) => {
        if (!profilesMasterKey) {
            await renderProfiles({ focusUnlock: true });
            profilePopover.classList.add('show');
            emojiPopover.classList.remove('show');
            if (langPopover) langPopover.classList.remove('show');
            flashStatus(hasProfilesMasterPassword() ? 'profiles_locked' : 'master_password_required');
            return false;
        }
        try {
            keyInput.value = await decryptStringWithKey(profilesMasterKey, p.passEnc);
        } catch {
            flashStatus('operation_failed');
            return false;
        }
        updateStrengthMeter(keyInput, strengthBar);
        if (profileBtn) profileBtn.style.background = p.color || '';
        if (profileNameEl) {
            profileNameEl.removeAttribute('data-i18n');
            profileNameEl.innerText = p.name;
        }
        return true;
    };

    const requestProfileCreationViaManager = (profileName) => {
        return new Promise((resolve) => {
            let resolved = false;
            renderProfiles({
                prefillName: profileName,
                focusPassword: true,
                onSaved: (created) => {
                    resolved = true;
                    resolve(created);
                }
            });
            profilePopover.classList.add('show');
            emojiPopover.classList.remove('show');
            if (langPopover) langPopover.classList.remove('show');

            const check = setInterval(() => {
                if (resolved) {
                    clearInterval(check);
                    return;
                }
                if (!profilePopover.classList.contains('show')) {
                    clearInterval(check);
                    resolve(null);
                }
            }, 200);
        });
    };

    const ensureProfileAvailable = async (profileName) => {
        if (profileName === NO_SECRETS_PROFILE) {
            selectNoSecretsInUi();
            return true;
        }

        let profiles = [];
        try {
            profiles = await loadProfiles();
        } catch {
            profiles = [];
        }
        const existing = profiles.find((p) => p && normalizeProfileName(p.name) === normalizeProfileName(profileName));
        if (existing) {
            return await selectProfileInUi(existing);
        }

        const created = await requestProfileCreationViaManager(profileName);
        if (!created) return false;
        return await selectProfileInUi(created);
    };

    if (profileBtn) {
        profileBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await renderProfiles();
            profilePopover.classList.toggle('show');
            emojiPopover.classList.remove('show');
            if (langPopover) langPopover.classList.remove('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (profilePopover.classList.contains('show') && !profilePopover.contains(e.target) && e.target !== profileBtn) {
            profilePopover.classList.remove('show');
        }
    });

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!editor.value) return alert(i18n.t('nothing_to_export'));
            let data;
            try {
                if (!isNonEmptyKey(keyInput.value)) {
                    data = await encodePlaintextPayload(editor.value);
                } else {
                    if (!isKeyStrongEnoughToEncrypt(keyInput.value)) return alert(i18n.t('export_key_required'));
                    data = await encrypt({ text: editor.value, password: keyInput.value });
                }
            } catch {
                return alert(i18n.t('operation_failed'));
            }
            const selectedProfileName = getSelectedProfileName();
            const payload = { data, formatVersion: 2, profile: encodeProfileName(selectedProfileName) };
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const profilePrefix = sanitizeForFilename(getSelectedProfileNameForFilename());
            a.download = `${profilePrefix}-${new Date().toISOString().slice(0, 10)}.secredit`;
            a.click();
        });
    }

    if (importBtn) {
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
                        setStatus('invalid_file');
                        return;
                    }
                    if (!parsed || typeof parsed !== 'object') {
                        setStatus('invalid_file');
                        return;
                    }
                    if ('iterations' in parsed) {
                        setStatus('invalid_file');
                        return;
                    }
                    const { data, profile, formatVersion } = parsed || {};
                    if (formatVersion !== 2) {
                        setStatus('invalid_file');
                        return;
                    }
                    if (typeof data !== 'string' || !data) {
                        setStatus('invalid_file');
                        return;
                    }
                    if (typeof profile === 'string' && profile) {
                        let profileName;
                        try {
                            profileName = decodeProfileName(profile);
                        } catch {}
                        if (profileName) {
                            const ok = await ensureProfileAvailable(profileName);
                            if (!ok) return;
                        }
                    }
                    await performDecryption(data, keyInput.value);
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) insertAtSelection(text);
            } catch {
                setStatus('paste_failed');
            }
        });
    }

    const copyWithFeedback = async (btn, text) => {
        if (!text) return;
        let success = false;
        try {
            await navigator.clipboard.writeText(text);
            success = true;
        } catch {
            // Fallback for older devices/browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed'; // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                success = document.execCommand('copy');
            } catch (err) {
                console.error('Copy failed', err);
            }
            document.body.removeChild(textArea);
        }

        if (success) {
            const oldChildren = Array.from(btn.childNodes);
            btn.replaceChildren(ICON_CHECK());
            setTimeout(() => btn.replaceChildren(...oldChildren), 2000);
        }
    };

    if (copyTextBtn) {
        copyTextBtn.addEventListener('click', () => {
            const selected = editor.selectionStart !== editor.selectionEnd ? editor.value.slice(editor.selectionStart, editor.selectionEnd) : editor.value;
            copyWithFeedback(copyTextBtn, selected);
        });
    }

    if (copySecretBtn) {
        copySecretBtn.addEventListener('click', () => {
            if (location.hash.length <= 1) return alert(i18n.t('no_content_to_share'));
            copyWithFeedback(copySecretBtn, location.href);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm(i18n.t('clear_confirm'))) return;
            editor.value = '';
            keyInput.value = '';
            history.replaceState(null, '', location.pathname);
            updateStrengthMeter();
            updateCounts();
            editor.focus();
        });
    }

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

    if (findBtn) findBtn.addEventListener('click', () => (fBar.classList.contains('hidden') ? showFindBar() : hideFindBar()));
    if (closeFindBtn) closeFindBtn.addEventListener('click', hideFindBar);

    const findNext = () => {
        const query = fIn.value;
        if (!query) return;
        const start = editor.selectionEnd;
        const idx = editor.value.indexOf(query, start);
        const wrappedIdx = idx === -1 ? editor.value.indexOf(query) : idx;
        if (wrappedIdx === -1) return flashStatus('not_found');
        editor.focus();
        editor.setSelectionRange(wrappedIdx, wrappedIdx + query.length);
    };

    const replace = (all = false) => {
        const query = fIn.value;
        if (!query) return;
        const repl = rIn.value;
        if (all) {
            editor.value = editor.value.split(query).join(repl);
            flashStatus('replaced_all');
            scheduleSync();
            return;
        }
        if (editor.value.slice(editor.selectionStart, editor.selectionEnd) === query) editor.setRangeText(repl, editor.selectionStart, editor.selectionEnd, 'select');
        findNext();
        scheduleSync();
    };

    if (findNextBtn) findNextBtn.addEventListener('click', findNext);
    if (replaceBtn) replaceBtn.addEventListener('click', () => replace(false));
    if (replaceAllBtn) replaceAllBtn.addEventListener('click', () => replace(true));
    [fIn, rIn].forEach((el) => {
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                el === fIn ? findNext() : replace(false);
            });
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            showFindBar();
            return;
        }
        if (e.key === 'Escape' && fBar && !fBar.classList.contains('hidden')) hideFindBar();
    });

    const showUpdateNotification = () => {
        setStatus('update_available', '#2ed573');
        status.style.cursor = 'pointer';
        status.title = i18n.t('update_available');
        status.onclick = () => {
            status.onclick = null;
            window.location.reload();
        };
    };

    const isLocalhost = () => {
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    };

    if ('serviceWorker' in navigator && window.isSecureContext && (window.location.protocol === 'https:' || isLocalhost())) {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateNotification();
                    }
                });
            });
        }).catch(() => {});

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            showUpdateNotification();
        });
    }
};
