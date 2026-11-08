// The app's Blade components (resources/views/components) as small functions
// that return the same HTML, so the app's own CSS styles them.
import { __, lang } from './i18n.js';
import { STATUS_LABEL, STATUS_TONE } from './sim.js';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

const ICONS = {
    alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.3v.2"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bus: '<rect x="4" y="3" width="16" height="14.5" rx="3"/><path d="M4 10.5h16M8 17.5v2.5M16 17.5v2.5"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export const icon = (name, attrs = '') => `<svg aria-hidden="true" focusable="false" ${attrs} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

export const badge = (tone, text, cls = '', attrs = '') => `<span class="badge badge-${tone}${cls ? ' ' + cls : ''}" ${attrs}>${esc(text)}</span>`;

export const statusBadge = (status, cls = '') => badge(STATUS_TONE[status] || 'neutral', __(STATUS_LABEL[status]), cls);

export function logo(height = 36) {
    const big = height > 40;
    const ratio = 966 / 837; // viewBox of both logo files
    return `<span class="logo-tile"><img src="images/${big ? 'pabama-logo.svg' : 'pabama-logo-small.svg'}" alt="Pabama" width="${Math.round(ratio * height)}" height="${height}" decoding="async"></span>`;
}

export function button({ variant = 'primary', size = null, href = null, type = 'button', block = false, icon: before = null, iconAfter = null, cls = '', attrs = '' } = {}, text = '') {
    const classes = ['btn', `btn-${variant}`, size ? `btn-${size}` : null, block ? 'btn-block' : null, cls || null].filter(Boolean).join(' ');
    const inner = `${before ? icon(before) : ''}<span>${text}</span>${iconAfter ? icon(iconAfter) : ''}`;
    return href
        ? `<a href="${esc(href)}" class="${classes}" ${attrs}>${inner}</a>`
        : `<button type="${type}" class="${classes}" ${attrs}>${inner}</button>`;
}

export function card({ title = null, subtitle = null, flush = false, cls = '', actions = '', as = 'section', attrs = '' } = {}, inner = '') {
    const header = title || actions
        ? `<header class="card-header"><div>${title ? `<h2 class="card-title">${esc(title)}</h2>` : ''}${subtitle ? `<p class="card-subtitle">${esc(subtitle)}</p>` : ''}</div>${actions}</header>`
        : '';
    return `<${as} class="card${flush ? ' card-flush' : ''}${cls ? ' ' + cls : ''}" ${attrs}>${header}${inner}</${as}>`;
}

export function empty(title, iconName = 'info', body = '', actions = '') {
    return `<div class="empty">${icon(iconName)}<p class="empty-title">${esc(title)}</p>${body ? `<div class="empty-body">${body}</div>` : ''}${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
}

export function alert(tone, body, { title = null, cls = '', attrs = '' } = {}) {
    const name = { ok: 'check-circle', warn: 'alert', danger: 'alert' }[tone] || 'info';
    return `<div class="alert alert-${tone}${cls ? ' ' + cls : ''}" ${attrs}>${icon(name)}<div class="alert-body">${title ? `<p class="alert-title">${esc(title)}</p>` : ''}<div>${body}</div></div></div>`;
}

export function stat(label, value, { tone = null, cls = '', hint = null } = {}) {
    return `<div class="tile${tone ? ' stat-' + tone : ''}${cls ? ' ' + cls : ''}"><p class="stat-value">${esc(value)}</p><p class="stat-label">${esc(label)}</p>${hint ? `<p class="field-hint mt-1">${esc(hint)}</p>` : ''}</div>`;
}

const fieldId = (name) => 'f-' + name.replace(/[^a-z0-9]+/gi, '-');

export function field({ label, name, type = 'text', value = null, hint = null, error = null, id = null, size = null, revealable = false, attrs = '', cls = '' }) {
    id = id || fieldId(name);
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
    const common = `id="${id}" name="${name}" ${error ? 'aria-invalid="true"' : ''} ${describedBy ? `aria-describedby="${describedBy}"` : ''}`;
    const classes = `input${size ? ' input-' + size : ''}${cls ? ' ' + cls : ''}`;
    let control;
    if (type === 'textarea') {
        control = `<textarea ${common} class="${classes}" ${attrs}>${esc(value ?? '')}</textarea>`;
    } else if (revealable) {
        control = `<div class="input-reveal"><input ${common} type="password" class="${classes}" ${attrs}><button type="button" class="reveal-btn" data-reveal="${id}" data-show="${esc(__('Show'))}" data-hide="${esc(__('Hide'))}" aria-controls="${id}" aria-pressed="false">${esc(__('Show'))}</button></div>`;
    } else {
        control = `<input ${common} type="${type}" ${value !== null && type !== 'password' ? `value="${esc(value)}"` : ''} class="${classes}" ${attrs}>`;
    }
    return `<div class="field"><label class="field-label" for="${id}">${esc(label)}</label>${control}${hint ? `<p class="field-hint" id="${id}-hint">${esc(hint)}</p>` : ''}${error ? `<p class="field-error" id="${id}-error">${icon('alert')}<span>${esc(error)}</span></p>` : ''}</div>`;
}

export function select({ label, name, options = [], selected = null, placeholder = null, hint = null, error = null, id = null, size = null, attrs = '' }) {
    id = id || fieldId(name);
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
    const opts = (placeholder !== null ? `<option value="">${esc(placeholder)}</option>` : '')
        + options.map(([value, text]) => `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('');
    return `<div class="field"><label class="field-label" for="${id}">${esc(label)}</label><div class="select-wrap"><select id="${id}" name="${name}" ${error ? 'aria-invalid="true"' : ''} ${describedBy ? `aria-describedby="${describedBy}"` : ''} class="select${size ? ' select-' + size : ''}" ${attrs}>${opts}</select></div>${hint ? `<p class="field-hint" id="${id}-hint">${esc(hint)}</p>` : ''}${error ? `<p class="field-error" id="${id}-error">${icon('alert')}<span>${esc(error)}</span></p>` : ''}</div>`;
}

export function segmented({ label, name, options, selected }) {
    return `<fieldset class="fieldset"><legend class="field-label">${esc(label)}</legend><div class="segmented">${options.map(([value, text]) => `<label><input class="choice-input" type="radio" name="${name}" value="${esc(value)}" ${String(selected) === String(value) ? 'checked' : ''}><span class="segment">${esc(text)}</span></label>`).join('')}</div></fieldset>`;
}

export function langSwitch() {
    return `<nav class="lang-switch" aria-label="${esc(__('Language'))}"><a href="#" data-lang="en" lang="en" hreflang="en" ${lang === 'en' ? 'aria-current="true"' : ''} aria-label="English">EN</a><a href="#" data-lang="fil" lang="fil" hreflang="fil" ${lang === 'fil' ? 'aria-current="true"' : ''} aria-label="Filipino">FIL</a></nav>`;
}

export function themeMenu() {
    const t = (s) => esc(__(s));
    return `<details class="theme-menu" data-theme-menu data-label-light="${t('Light')}" data-label-dark="${t('Dark')}" data-label-system="${t('System')}" data-label-theme="${t('Theme')}" data-label-change="${t('Change theme')}">
<summary class="btn btn-quiet btn-sm" aria-label="${t('Change theme')}">${icon('theme')}<span>${t('Theme')}</span><span class="theme-menu-value" aria-hidden="true"><span data-v="light">${t('Light')}</span><span data-v="dark">${t('Dark')}</span><span data-v="system">${t('System')}</span></span></summary>
<fieldset class="theme-menu-panel"><legend class="visually-hidden">${t('Theme')}</legend>
<label class="theme-option"><input type="radio" name="bp-theme" value="light">${icon('sun')} ${t('Light')}</label>
<label class="theme-option"><input type="radio" name="bp-theme" value="dark">${icon('moon')} ${t('Dark')}</label>
<label class="theme-option"><input type="radio" name="bp-theme" value="system">${icon('monitor')}<span class="theme-option-text">${t('System')} <span class="theme-option-hint">${t('Same as your phone')}</span></span></label>
</fieldset></details>`;
}

export function toast(message) {
    return message
        ? `<div class="toast-region" role="status" aria-live="polite"><div class="toast">${icon('check-circle')}<span>${esc(message)}</span><button type="button" class="toast-close" aria-label="${esc(__('Close'))}">×</button></div></div>`
        : '';
}

/** The yellow strip on every page that says this is a demo. */
export function demoBanner() {
    return `<div class="demo-banner" role="note"><div class="demo-banner-inner"><span class="badge badge-warn">${esc(__('Demo with sample data'))}</span><span class="demo-banner-text">${esc(__('A student capstone project (STI College Valencia). Not an official Pabama Corporation website.'))}</span><button type="button" class="demo-banner-reset" data-demo-reset>${esc(__('Reset demo'))}</button></div></div>`;
}
