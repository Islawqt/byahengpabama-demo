/*
 * The app's resources/js/ui.js (theme menu, Show/Hide passwords, toasts,
 * copy link), split so it can run again after a page is redrawn:
 * setUp() once per page load, bind() after every draw.
 */
const KEY = 'bp-theme';
const LABELS = { light: 'Light', dark: 'Dark', system: 'System' };
const CANVAS = { light: '#F4F3EF', dark: '#121212' };

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolve(pref) {
    return pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
}

function save(pref) {
    try {
        localStorage.setItem(KEY, pref);
    } catch (e) {
        // Private mode or storage blocked: the choice lasts for this page only.
    }
}

function syncMenu(menu) {
    const pref = root.dataset.themePref || 'system';
    menu.querySelectorAll('input[name="bp-theme"]').forEach((input) => {
        input.checked = input.value === pref;
    });
    const label = menu.dataset[`label${pref[0].toUpperCase()}${pref.slice(1)}`] || LABELS[pref];
    menu.querySelector('summary')?.setAttribute('aria-label', `${menu.dataset.labelTheme || 'Theme'}: ${label}. ${menu.dataset.labelChange || 'Change theme'}`);
}

function applyTheme(pref) {
    const theme = resolve(pref);
    root.dataset.themePref = pref;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
    document.querySelectorAll('[data-theme-menu]').forEach(syncMenu);
}

/** Listeners on the whole document: added once. */
export function setUp() {
    document.addEventListener('click', (event) => {
        document.querySelectorAll('[data-theme-menu][open]').forEach((menu) => {
            if (!menu.contains(event.target)) menu.open = false;
        });
    });

    media.addEventListener('change', () => {
        if (root.dataset.themePref === 'system') applyTheme('system');
    });

    window.addEventListener('storage', (event) => {
        if (event.key === KEY && LABELS[event.newValue]) applyTheme(event.newValue);
    });

    // Password fields: Show / Hide.
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-reveal]');
        if (!button) return;
        const input = document.getElementById(button.dataset.reveal);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? (button.dataset.hide || 'Hide') : (button.dataset.show || 'Show');
        button.setAttribute('aria-pressed', String(show));
        input.focus();
    });
}

/** Listeners on elements of the page just drawn. */
export function bind() {
    document.querySelectorAll('[data-theme-menu]').forEach((menu) => {
        const summary = menu.querySelector('summary');
        syncMenu(menu);
        menu.addEventListener('change', (event) => {
            if (event.target.name !== 'bp-theme') return;
            save(event.target.value);
            applyTheme(event.target.value);
            menu.open = false;
            summary.focus();
        });
        menu.addEventListener('toggle', () => {
            if (menu.open) (menu.querySelector('input:checked') || menu.querySelector('input'))?.focus();
        });
        menu.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && menu.open) {
                menu.open = false;
                summary.focus();
            }
        });
    });

    document.querySelectorAll('.toast').forEach((toast) => {
        const close = () => {
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 200);
        };
        toast.querySelector('.toast-close')?.addEventListener('click', close);
        setTimeout(close, 6000);
    });

    document.querySelectorAll('[data-copy-link]').forEach((button) => {
        if (!navigator.clipboard) {
            button.hidden = true;
            return;
        }
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(button.dataset.copyLink);
                button.querySelector('span').textContent = button.dataset.copiedLabel;
            } catch (e) {
                // Copying was blocked; nothing else to do.
            }
        });
    });
}
