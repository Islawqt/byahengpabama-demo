// Draws the page named in <body data-page>, checks who may see it, and
// handles links and forms, standing in for the app's routes and controllers.
import { __, setLang, lang } from './i18n.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as publicPages from './pages-public.js';
import * as staff from './pages-staff.js';
import { analytics, analyticsBehaviour } from './pages-analytics.js';
import { ACTIONS } from './actions.js';
import { authLayout, publicLayout } from './layouts.js';
import { esc, field, button, card, empty } from './components.js';

document.documentElement.lang = lang;
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);

const PAGES = {
    welcome: { draw: publicPages.welcome },
    passenger: { draw: publicPages.passenger, after: publicPages.passengerBehaviour },
    announcements: { draw: publicPages.announcements },
    announcement: { draw: publicPages.announcement },
    login: { draw: publicPages.login },
    'not-found': { draw: publicPages.notFound },
    inspector: { draw: staff.inspector, after: (s) => staff.inspectorBehaviour(!!s.old?.bus_route_id), role: 'inspector' },
    'admin-dashboard': { draw: staff.dashboard, role: 'admin', after: () => setTimeout(() => location.reload(), 30000) },
    'admin-analytics': { draw: analytics, after: analyticsBehaviour, role: 'admin' },
    'admin-buses': { draw: staff.buses, role: 'admin' },
    'admin-routes': { draw: staff.routes, role: 'admin' },
    'admin-bulletins': { draw: staff.bulletins, role: 'admin' },
    'admin-post': { draw: staff.postForm, role: 'admin' },
    'admin-accounts': { draw: staff.accounts, role: 'admin' },
    'admin-settings': { draw: staff.settings, role: 'admin' },
};

function draw(html, after, state = {}) {
    document.body.innerHTML = html;
    ui.bind();
    after?.(state);
    const firstError = document.querySelector('[aria-invalid="true"], .field-error, .error, .alert-danger');
    firstError?.scrollIntoView({ block: 'center' });
}

function wrongAccount(user) {
    return publicLayout({
        title: __("This page isn't for your account"),
        content: card({}, empty(__("This page isn't for your account"), 'info',
            esc(__("You're signed in as :name (:role). Only admins can open this page.", { name: user.name, role: __(store.roleLabel(user.role)) })),
            button({ href: 'inspector.html' }, esc(__('Go to my page'))))),
    });
}

function home(user) {
    return user.role === 'admin' ? 'admin.html' : 'inspector.html';
}

// ---------------------------------------------------------------- login and first password

function changePassword(user, errors = {}) {
    return authLayout({
        title: __('Choose your password'), heading: __('Choose your own password'),
        intro: __('Your account was created with a temporary password. Choose one only you know before continuing.'),
        footer: __('Signed in as :email', { email: user.email }),
        content: `<form class="grid gap-4" data-change-password>
${field({ label: __('Temporary password'), name: 'current_password', revealable: true, error: errors.current_password, attrs: 'required autofocus' })}
${field({ label: __('New password'), name: 'password', revealable: true, hint: __('At least 8 characters.'), error: errors.password, attrs: 'required' })}
${field({ label: __('Confirm new password'), name: 'password_confirmation', type: 'password', attrs: 'required' })}
${button({ type: 'submit', size: 'lg', block: true }, esc(__('Save and continue')))}</form>`,
    });
}

function bindLogin() {
    document.querySelector('[data-login]')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target));
        const email = (data.email || '').trim().toLowerCase();
        const account = store.load().users.find((u) => u.email === email && u.password === data.password);
        if (!account) {
            draw(publicPages.login({ error: __('These credentials do not match our records.'), email: data.email }), bindLogin);
            return;
        }
        store.logIn(account);
        if (account.mustChange) {
            draw(changePassword(account), bindChangePassword);
            return;
        }
        location.href = params.get('next') && /^[\w-]+\.html$/.test(params.get('next')) ? params.get('next') : home(account);
    });
    document.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => {
        document.querySelector('[name=email]').value = b.dataset.fill;
        document.querySelector('[name=password]').value = store.PASSWORD;
        document.querySelector('[data-login] button[type=submit]').focus();
    }));
}

function bindChangePassword() {
    document.querySelector('[data-change-password]')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const user = store.currentUser();
        const d = Object.fromEntries(new FormData(event.target));
        const errors = {};
        if (d.current_password !== user.password) errors.current_password = 'The password is incorrect.';
        else if ((d.password || '').length < 8) errors.password = 'The password field must be at least 8 characters.';
        else if (d.password !== d.password_confirmation) errors.password = 'The password field confirmation does not match.';
        else if (d.password === d.current_password) errors.password = 'Choose a password different from the temporary one.';
        if (Object.keys(errors).length) {
            draw(changePassword(user, errors), bindChangePassword);
            return;
        }
        user.password = d.password;
        user.mustChange = false;
        store.save();
        store.flash(__('Your new password is saved.'));
        location.href = home(user);
    });
}

// ---------------------------------------------------------------- start

ui.setUp();

// Links and buttons that work on every page.
document.addEventListener('click', (event) => {
    const langLink = event.target.closest('[data-lang]');
    if (langLink) {
        event.preventDefault();
        setLang(langLink.dataset.lang);
        location.reload();
        return;
    }
    if (event.target.closest('[data-logout]')) {
        store.logOut();
        location.href = 'index.html';
        return;
    }
    if (event.target.closest('[data-demo-reset]')) {
        if (confirm('Reset the demo? Your changes in this browser are removed and fresh sample data is loaded.')) {
            store.reset();
            location.href = 'index.html';
        }
    }
});

// Staff forms: run the matching action, then go on or redraw with errors.
document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    const result = ACTIONS[form.dataset.action](data, form.dataset.id || null, form) || {};
    if (result.go) {
        location.href = result.go;
        return;
    }
    const spec = PAGES[page];
    draw(spec.draw(result), spec.after, result);
});

const spec = PAGES[page] || PAGES['not-found'];
const user = store.currentUser();
if (spec.role && !user) {
    location.replace(`login.html?next=${page === 'inspector' ? 'inspector.html' : location.pathname.split('/').pop() || 'admin.html'}`);
} else if (spec.role === 'admin' && user.role !== 'admin') {
    draw(wrongAccount(user));
} else if (page === 'login' && user) {
    location.replace(home(user));
} else if (page === 'login') {
    draw(spec.draw(), bindLogin);
} else {
    draw(spec.draw(), spec.after, {});
}
