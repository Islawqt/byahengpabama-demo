// The app's page layouts (resources/views/components/layouts).
import { __ } from './i18n.js';
import { esc, icon, badge, button, logo, langSwitch, themeMenu, toast, demoBanner } from './components.js';
import { currentUser } from './store.js';

function setTitle(title) {
    document.title = title ? `${title} · ByahengPabama` : 'ByahengPabama';
}

/** Passenger pages: header with the main links, EN | FIL and theme. */
export function publicLayout({ title = null, width = 'narrow', active = null, footer = null, content }) {
    setTitle(title);
    const cur = (key) => (active === key ? 'aria-current="page"' : '');
    return `${demoBanner()}<a class="skip-link" href="#main">Skip to content</a>
<div class="page">
<header class="app-header"><div class="wrap wrap-${width} app-header-inner">
<a class="brand-mark" href="index.html" aria-label="${esc(__('ByahengPabama home'))}">${logo(30)}<span class="brand-text">Byaheng<span class="brand-accent">Pabama</span></span></a>
<nav class="app-nav" aria-label="${esc(__('Main'))}"><a href="passenger.html" ${cur('track')}>${esc(__('Track a bus'))}</a><a href="announcements.html" ${cur('announcements')}>${esc(__('Announcements'))}</a></nav>
<div class="app-header-actions">${langSwitch()}${themeMenu()}</div>
</div></header>
<main id="main" class="page-main"><div class="wrap wrap-${width}">${content}</div></main>
<footer class="app-footer"><div class="wrap wrap-${width} footer-inner">
${footer ? `<div class="footer-note">${esc(footer)}</div>` : ''}
<nav class="footer-links" aria-label="${esc(__('More'))}"><a href="passenger.html">${esc(__('Track a bus'))}</a><a href="announcements.html">${esc(__('Announcements'))}</a><a href="login.html">${esc(__('Staff log in'))}</a></nav>
<p>${esc(__('Pabama Corporation · CDO Agora Terminal ↔ Kibawe, Bukidnon'))}</p>
</div></footer>
</div>`;
}

/** Login page: one centred column. */
export function authLayout({ title, heading = null, intro = null, content, footer = null }) {
    setTitle(title);
    return `${demoBanner()}<a class="skip-link" href="#main">Skip to content</a>
<div class="auth-shell"><div class="auth-top">${langSwitch()}${themeMenu()}</div>
<main id="main" class="auth-main">
<a class="auth-brand" href="index.html">${logo(48)}<span class="auth-brand-name">Byaheng<span class="brand-accent">Pabama</span></span></a>
<div class="card p-5 sm:p-6">${heading ? `<h1 class="text-2xl">${esc(heading)}</h1>` : ''}${intro ? `<p class="lede mt-2">${esc(intro)}</p>` : ''}<div class="${heading || intro ? 'mt-5' : ''}">${content}</div></div>
<div class="auth-footer">${esc(footer ?? __('Pabama Corporation · for staff only'))}</div>
</main></div>`;
}

const ADMIN_LINKS = [
    ['tracking', 'admin.html', 'Bus tracking', 'bus'],
    ['analytics', 'admin-analytics.html', 'Analytics', 'chart'],
    ['buses', 'admin-buses.html', 'Buses', 'bus'],
    ['routes', 'admin-routes.html', 'Routes & fares', 'pin'],
    ['bulletins', 'admin-bulletins.html', 'Bulletins', 'info'],
    ['accounts', 'admin-accounts.html', 'Accounts', 'check-circle'],
    ['settings', 'admin-settings.html', 'Settings', 'clock'],
];

/** Admin pages: side menu, signed-in user, page heading. */
export function adminLayout({ title, active = null, heading = null, intro = null, actions = '', content, message = null }) {
    setTitle(title);
    const user = currentUser();
    return `${demoBanner()}<a class="skip-link" href="#main">Skip to content</a>
<div class="admin-shell">
<aside class="admin-side">
<a class="brand-mark" href="admin.html" aria-label="ByahengPabama admin">${logo(28)}<span class="brand-text">Byaheng<span class="brand-accent">Pabama</span></span>${badge('warn', 'Demo', '', 'title="Demo: sample data in this browser only"')}</a>
<nav class="admin-nav" aria-label="Admin">
${ADMIN_LINKS.map(([key, href, label, name]) => `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${icon(name)}<span>${label}</span></a>`).join('')}
<span class="admin-nav-divider" aria-hidden="true"></span>
<a href="inspector.html">${icon('check')}<span>Inspector view</span></a>
<a href="passenger.html">${icon('arrow-right')}<span>Passenger view</span></a>
</nav>
<div class="admin-user"><p class="admin-user-name">${esc(user?.name)}</p><p class="admin-user-email">${esc(user?.email)}</p>
<div class="admin-user-actions">${themeMenu()}${button({ variant: 'quiet', size: 'sm', attrs: 'data-logout' }, 'Log out')}</div></div>
</aside>
<main id="main" class="admin-main">${toast(message)}
${heading ? `<div class="section-header"><div><h1 class="text-2xl">${esc(heading)}</h1>${intro ? `<p class="lede mt-1 max-w-3xl">${esc(intro)}</p>` : ''}</div>${actions}</div>` : ''}
${content}
</main></div>`;
}
