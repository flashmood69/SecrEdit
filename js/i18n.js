class I18nManager {
    constructor() {
        this.currentLang = 'en';
        this.supportedLangs = ['en', 'es', 'ar', 'it', 'fr', 'de', 'zh', 'hi', 'pt', 'bn']; // Should match loaded files
        this.resources = window.SecrEditLocales || {};
        this.observers = [];
    }

    async init() {
        // Wait for locales to be loaded if they are async (scripts at bottom of body)
        // In our case, we will include scripts before this runs or ensure they are present.
        this.resources = window.SecrEditLocales || {};
        
        const savedLang = localStorage.getItem('secredit_lang');
        const browserLangs = navigator.languages || [navigator.language];
        
        let detectedLang = 'en';
        
        // 1. Check saved preference
        if (savedLang && this.isSupported(savedLang)) {
            detectedLang = savedLang;
        } else {
            // 2. Check browser languages
            for (const lang of browserLangs) {
                const code = lang.split('-')[0];
                if (this.isSupported(code)) {
                    detectedLang = code;
                    break;
                }
            }
        }

        await this.changeLanguage(detectedLang);
    }

    isSupported(lang) {
        return !!this.resources[lang];
    }

    async changeLanguage(lang) {
        if (!this.isSupported(lang)) {
            console.warn(`Language ${lang} not supported, falling back to en`);
            lang = 'en';
        }

        this.currentLang = lang;
        localStorage.setItem('secredit_lang', lang);
        
        this.updatePage();
        this.updateDir();
        
        // Notify listeners (if any)
        this.observers.forEach(cb => cb(lang));
    }

    t(key, options = {}) {
        const langRes = this.resources[this.currentLang];
        let str = (langRes && langRes.translation && langRes.translation[key]);
        
        if (!str) {
            // Fallback to English
            const enRes = this.resources['en'];
            str = (enRes && enRes.translation && enRes.translation[key]) || key;
        }

        // Simple interpolation {{key}}
        if (options) {
            Object.keys(options).forEach(k => {
                str = str.replace(new RegExp(`{{${k}}}`, 'g'), options[k]);
            });
        }
        
        return str;
    }

    updatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            let options = {};
            try {
                const optStr = el.getAttribute('data-i18n-options');
                if (optStr) options = JSON.parse(optStr);
            } catch (e) {
                console.warn('Invalid options json', e);
            }

            if (key) {
                if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'password' || el.type === 'search')) {
                    // Do nothing for inputs unless we decide data-i18n maps to value
                } else {
                    el.innerText = this.t(key, options);
                }
            }
        });
        
        // Handle specific attributes
        document.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-i18n-') && attr.name !== 'data-i18n-options') {
                    const targetAttr = attr.name.replace('data-i18n-', '');
                    if (targetAttr) {
                         el.setAttribute(targetAttr, this.t(attr.value));
                    }
                }
            });
        });

        // Update document title
        document.title = this.t('app_title');
    }

    updateDir() {
        const langRes = this.resources[this.currentLang];
        const dir = (langRes && langRes.metadata && langRes.metadata.dir) || 'ltr';
        document.documentElement.dir = dir;
        document.documentElement.lang = this.currentLang;
        
        // Adjust UI if needed for RTL (CSS might handle most, but sometimes JS needed)
    }

    onLanguageChange(cb) {
        this.observers.push(cb);
    }
}

const I18n = new I18nManager();

window.I18nManager = I18nManager;
window.I18n = I18n;
