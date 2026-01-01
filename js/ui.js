import { PLAINTEXT_PREFIX, b64UrlDecodeToBytes, b64UrlEncodeBytes, gzipBytes, utf8Decode, utf8Encode } from './encoding.js';

const $ = (id) => document.getElementById(id);

export const startUi = ({ i18n, encrypt, decrypt, kdfIterations, decodePlaintextFromHash }) => {
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
            const encrypted = await encrypt({ text, password: key, iterations: kdfIterations });
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

    const performDecryption = async (data, password, iterations) => {
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
        const candidates = iterations ? [iterations] : [kdfIterations, 100000, 300000, 1000000];

        for (const iter of candidates) {
            try {
                if (currentId !== lastDecryptionId) return false;
                const dec = await decrypt({ payload: data, password: password || '', iterations: iter });
                if (currentId !== lastDecryptionId) return false;
                editor.value = dec;
                setStatus('decrypted');
                updateCounts();
                scheduleSync();
                return true;
            } catch {}
        }

        if (currentId === lastDecryptionId) setStatus('wrong_key');
        return false;
    };

    if (burgerBtn && header) {
        burgerBtn.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            burgerBtn.innerText = header.classList.contains('collapsed') ? '☰' : '✕';
        });
    }

    window.addEventListener('load', async () => {
        await i18n.init();

        const languages = ['en', 'es', 'ar', 'it', 'fr', 'de', 'zh', 'hi', 'pt', 'bn'];

        if (langBtn && langPopover) {
            const updateLangBtn = (lang) => {
                langBtn.innerHTML = `<img src="assets/flags/${lang}.svg" alt="${lang}" class="flag-icon">`;
            };
            updateLangBtn(i18n.currentLang);

            const langFrag = document.createDocumentFragment();
            for (const lang of languages) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'lang-item';
                btn.innerHTML = `<img src="assets/flags/${lang}.svg" alt="${lang}" class="flag-icon">`;
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
            if (profileName) await ensureProfileAvailable(profileName);
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
    const loadProfiles = () => {
        try {
            return JSON.parse(localStorage.getItem('secredit_profiles') || '[]');
        } catch {
            return [];
        }
    };

    const saveProfiles = (profiles) => {
        localStorage.setItem('secredit_profiles', JSON.stringify(profiles));
    };

    const renderProfiles = (opts = {}) => {
        const profiles = loadProfiles();
        profilePopover.innerHTML = '';

        const saveContainer = document.createElement('div');
        saveContainer.id = 'save-profile-container';
        saveContainer.style.flexDirection = 'column';
        saveContainer.style.gap = '8px';
        saveContainer.style.padding = '10px';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = i18n.t('profile_name');
        nameInput.addEventListener('click', (e) => e.stopPropagation());
        if (opts.prefillName) nameInput.value = opts.prefillName;

        const keyWrapper = document.createElement('div');
        keyWrapper.className = 'input-wrapper';
        keyWrapper.style.width = '100%';
        keyWrapper.style.margin = '0';

        const newKeyInput = document.createElement('input');
        newKeyInput.type = 'password';
        newKeyInput.placeholder = i18n.t('key_placeholder');
        newKeyInput.style.width = '100%';
        newKeyInput.addEventListener('click', (e) => e.stopPropagation());

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
        toggleBtn.innerText = '👁️';
        toggleBtn.style.position = 'absolute';
        toggleBtn.style.right = '5px';
        toggleBtn.style.top = '50%';
        toggleBtn.style.transform = 'translateY(-50%)';
        toggleBtn.style.background = 'none';
        toggleBtn.style.border = 'none';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const show = newKeyInput.type === 'password';
            newKeyInput.type = show ? 'text' : 'password';
            toggleBtn.innerText = show ? '🙈' : '👁️';
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
        colorInput.value = '#6c5ce7';
        colorInput.style.width = '40px';
        colorInput.style.height = '40px';
        colorInput.style.border = '1px solid var(--border)';
        colorInput.style.borderRadius = '4px';
        colorInput.style.cursor = 'pointer';
        colorInput.style.padding = '0';
        colorInput.style.background = 'transparent';
        colorInput.title = i18n.t('profile_color') || 'Profile Color';

        colorWrapper.appendChild(colorLabel);
        colorWrapper.appendChild(colorInput);

        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-profile-btn';
        saveBtn.innerText = i18n.t('save_profile');
        saveBtn.type = 'button';
        saveBtn.style.width = '100%';
        saveBtn.style.padding = '8px';
        
        const handleSave = (e) => {
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

            const current = loadProfiles();
            const created = { name, pass, color };
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
            renderProfiles();
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
        if (opts.focusPassword) setTimeout(() => newKeyInput.focus(), 0);

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
                colorBtn.value = p.color || '#6c5ce7';
                colorBtn.title = i18n.t('profile_color') || 'Profile Color';
                colorBtn.style.width = '28px';
                colorBtn.style.height = '28px';
                colorBtn.style.border = '1px solid var(--border)';
                colorBtn.style.borderRadius = '4px';
                colorBtn.style.cursor = 'pointer';
                colorBtn.style.padding = '0';
                colorBtn.style.background = 'transparent';
                colorBtn.addEventListener('click', (e) => e.stopPropagation());
                colorBtn.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const nextColor = colorBtn.value;
                    const current = loadProfiles();
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
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const current = loadProfiles();
                    current.splice(idx, 1);
                    saveProfiles(current);
                    renderProfiles();
                    flashStatus('profile_deleted');
                });

                item.addEventListener('click', () => {
                    selectProfileInUi(p);
                    const { payload } = parseHashWithProfile(location.hash.substring(1));
                    if (payload && !editor.value) performDecryption(payload, keyInput.value);
                    else if (editor.value) scheduleSync();
                    profilePopover.classList.remove('show');
                });

                item.appendChild(label);
                item.appendChild(colorBtn);
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

    const selectProfileInUi = (p) => {
        keyInput.value = p.pass || '';
        updateStrengthMeter(keyInput, strengthBar);
        if (profileBtn) profileBtn.style.background = p.color || '';
        if (profileNameEl) {
            profileNameEl.removeAttribute('data-i18n');
            profileNameEl.innerText = p.name;
        }
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
            return;
        }

        const profiles = loadProfiles();
        const existing = profiles.find((p) => p && normalizeProfileName(p.name) === normalizeProfileName(profileName));
        if (existing) {
            selectProfileInUi(existing);
            return;
        }

        const created = await requestProfileCreationViaManager(profileName);
        if (created) selectProfileInUi(created);
    };

    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renderProfiles();
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
                    data = await encrypt({ text: editor.value, password: keyInput.value, iterations: kdfIterations });
                }
            } catch {
                return alert(i18n.t('operation_failed'));
            }
            const selectedProfileName = getSelectedProfileName();
            const payload = { data, iterations: kdfIterations, formatVersion: 1, profile: encodeProfileName(selectedProfileName) };
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
                    const { data, iterations, profile } = parsed || {};
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
                            await ensureProfileAvailable(profileName);
                        }
                    }
                    await performDecryption(data, keyInput.value, iterations);
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
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            return;
        }
        const old = btn.innerText;
        btn.innerText = '✅';
        setTimeout(() => (btn.innerText = old), 2000);
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

    if ('serviceWorker' in navigator) {
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
