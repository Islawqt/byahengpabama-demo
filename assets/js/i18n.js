// English and Filipino, like the app: the English phrase is the key, and the
// Filipino phrase comes from the app's own lang/fil.json (copied to fil.js).
import FIL from './fil.js';

// Phrases that exist only in this demo.
const DEMO_FIL = {
    'Demo with sample data': 'Demo na may sample na datos',
    'A student capstone project (STI College Valencia). Not an official Pabama Corporation website.':
        'Capstone project ng mga estudyante (STI College Valencia). Hindi ito opisyal na website ng Pabama Corporation.',
    'Reset demo': 'I-reset ang demo',
    'Air-conditioned bus': 'Aircon bus',
};

const KEY = 'bp-lang';

export const lang = (() => {
    try {
        return localStorage.getItem(KEY) === 'fil' ? 'fil' : 'en';
    } catch (e) {
        return 'en';
    }
})();

export function setLang(value) {
    try {
        localStorage.setItem(KEY, value === 'fil' ? 'fil' : 'en');
    } catch (e) {
        // Storage blocked: the page stays in the current language.
    }
}

/** Translate, then fill :placeholders (longest names first, like Laravel). */
export function __(key, replace = {}) {
    let text = lang === 'fil' ? (FIL[key] ?? DEMO_FIL[key] ?? key) : key;
    Object.keys(replace).sort((a, b) => b.length - a.length).forEach((name) => {
        text = text.split(':' + name).join(String(replace[name]));
    });
    return text;
}

/** Pluralised phrase, e.g. ':count bus|:count buses'. */
export function choice(key, count, replace = {}) {
    const forms = __(key).split('|');
    const form = count === 1 || forms.length === 1 ? forms[0] : forms[1];
    return form.split(':count').join(String(count)).replace(/:(\w+)/g, (m, k) => (k in replace ? replace[k] : m));
}
