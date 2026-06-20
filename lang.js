// ============================================
// FLY INFINITY - LANGUAGE MANAGER
// ============================================

const LANGUAGES = {
    en: { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
    fa: { code: 'fa', name: 'فارسی', flag: '🇮🇷', dir: 'rtl' },
    ar: { code: 'ar', name: 'العربية', flag: '🇮🇶', dir: 'rtl' },
    tr: { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
    ru: { code: 'ru', name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
    zh: { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
    es: { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
    pt: { code: 'pt', name: 'Português', flag: '🇵🇹', dir: 'ltr' }
};

let currentLang = 'en';
let translations = {};
let currentPage = '';

function getPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().split('.')[0] || 'index';
    return page;
}

function getDefaultLang() {
    const saved = localStorage.getItem('fit_lang');
    if (saved && LANGUAGES[saved]) return saved;
    const browserLang = navigator.language.split('-')[0];
    if (LANGUAGES[browserLang]) return browserLang;
    return 'en';
}

async function loadLanguage(lang) {
    currentPage = getPageName();
    try {
        const response = await fetch(`lang/${currentPage}/${lang}.json?t=${Date.now()}`);
        if (response.ok) {
            translations = await response.json();
            return true;
        }
    } catch(e) {
        console.log(`⚠️ Could not load ${lang}.json for ${currentPage}, trying fallback`);
    }
    
    // Fallback to English
    try {
        const response = await fetch(`lang/${currentPage}/en.json?t=${Date.now()}`);
        if (response.ok) {
            translations = await response.json();
            return true;
        }
    } catch(e) {
        console.log('❌ Could not load any language file');
        return false;
    }
    return false;
}

function t(key) {
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
        if (value && value[k] !== undefined) {
            value = value[k];
        } else {
            return key;
        }
    }
    return value || key;
}

function tWithReplace(key, replacements) {
    let text = t(key);
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`{${k}}`, v);
        }
    }
    return text;
}

function setLanguage(lang) {
    if (!LANGUAGES[lang]) return;
    currentLang = lang;
    localStorage.setItem('fit_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGES[lang].dir;
    updateAllTranslations();
    updateLangButton();
}

function updateAllTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
}

// ===== LANGUAGE BUTTON =====
function createLangButton() {
    const btn = document.createElement('button');
    btn.id = 'langBtn';
    btn.className = 'lang-btn';
    btn.setAttribute('aria-label', 'Change language');
    btn.innerHTML = '🌐';
    btn.addEventListener('click', toggleLangDropdown);
    return btn;
}

function createLangDropdown() {
    const dropdown = document.createElement('div');
    dropdown.id = 'langDropdown';
    dropdown.className = 'lang-dropdown';
    
    Object.keys(LANGUAGES).forEach(code => {
        const lang = LANGUAGES[code];
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'lang-item' + (code === currentLang ? ' active' : '');
        item.setAttribute('data-lang', code);
        item.innerHTML = `${lang.flag} ${lang.name}`;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage(code);
            closeLangDropdown();
        });
        dropdown.appendChild(item);
    });
    
    return dropdown;
}

function toggleLangDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('langDropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('open');
}

function closeLangDropdown() {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.classList.remove('open');
}

function updateLangButton() {
    const btn = document.getElementById('langBtn');
    if (btn) {
        btn.innerHTML = LANGUAGES[currentLang].flag;
    }
    document.querySelectorAll('.lang-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-lang') === currentLang);
    });
}

// ===== INIT =====
async function initLanguageSystem() {
    currentLang = getDefaultLang();
    document.documentElement.lang = currentLang;
    document.documentElement.dir = LANGUAGES[currentLang].dir;
    
    // Load translations
    await loadLanguage(currentLang);
    
    // Create and insert language button
    const langBtn = createLangButton();
    const topBar = document.querySelector('.top-bar .logo');
    if (topBar && topBar.parentNode) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        const logoClone = topBar.cloneNode(true);
        wrapper.appendChild(logoClone);
        wrapper.appendChild(langBtn);
        topBar.parentNode.replaceChild(wrapper, topBar);
    } else {
        const topBarContainer = document.querySelector('.top-bar');
        if (topBarContainer) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
            const logo = topBarContainer.querySelector('.logo');
            if (logo) {
                const logoClone = logo.cloneNode(true);
                wrapper.appendChild(logoClone);
            }
            wrapper.appendChild(langBtn);
            topBarContainer.prepend(wrapper);
        }
    }
    
    // Create and insert dropdown
    const dropdown = createLangDropdown();
    document.body.appendChild(dropdown);
    
    document.addEventListener('click', closeLangDropdown);
    
    updateAllTranslations();
    updateLangButton();
}

document.addEventListener('DOMContentLoaded', initLanguageSystem);
