"""Writes the HTML shell of every demo page. Run: python3 tools/make_pages.py

Each shell only loads the styles and assets/js/main.js; the page itself is
drawn in the browser from the demo data, so the shells are all alike.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAGES = [
    # file, page key, title, description
    ('index.html', 'welcome', 'ByahengPabama',
     'See where Pabama buses are between CDO Agora Terminal and Kibawe, when the next one arrives, and how much the fare is.'),
    ('passenger.html', 'passenger', 'Track a bus · ByahengPabama',
     'See which Pabama buses are coming to your stop and about how long they will take.'),
    ('announcements.html', 'announcements', 'Announcements · ByahengPabama', 'Advisories, schedule changes and news from Pabama.'),
    ('announcement.html', 'announcement', 'Announcement · ByahengPabama', 'An announcement from Pabama.'),
    ('login.html', 'login', 'Log in · ByahengPabama', 'For Pabama admins and Line Inspectors.'),
    ('inspector.html', 'inspector', 'Checkpoint report · ByahengPabama', None),
    ('admin.html', 'admin-dashboard', 'Bus tracking · ByahengPabama', None),
    ('admin-analytics.html', 'admin-analytics', 'Analytics · ByahengPabama', None),
    ('admin-buses.html', 'admin-buses', 'Buses · ByahengPabama', None),
    ('admin-routes.html', 'admin-routes', 'Routes & fares · ByahengPabama', None),
    ('admin-bulletins.html', 'admin-bulletins', 'Bulletins · ByahengPabama', None),
    ('admin-post.html', 'admin-post', 'Post · ByahengPabama', None),
    ('admin-accounts.html', 'admin-accounts', 'Accounts · ByahengPabama', None),
    ('admin-settings.html', 'admin-settings', 'Settings · ByahengPabama', None),
    ('404.html', 'not-found', 'Page not found · ByahengPabama', None),
]

THEME = """<script>
(function (d) {
    var r = d.documentElement, p, t, m;
    try { p = localStorage.getItem('bp-theme'); } catch (e) {}
    if (p !== 'light' && p !== 'dark' && p !== 'system') p = r.getAttribute('data-theme-default') || 'system';
    t = p === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;
    r.setAttribute('data-theme-pref', p);
    r.setAttribute('data-theme', t);
    r.style.colorScheme = t;
    r.className += ' js';
    m = d.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#121212' : '#F4F3EF');
})(document);
</script>"""


def shell(page, title, description):
    inspector = page == 'inspector'
    desc = f'\n<meta name="description" content="{description}">' if description else ''
    styles = ('<link rel="stylesheet" href="assets/inspector.css">' if inspector
              else '<link rel="stylesheet" href="assets/app.css">') + '\n<link rel="stylesheet" href="assets/demo.css">'
    theme = '' if inspector else THEME + '\n'
    return f"""<!DOCTYPE html>
<html lang="en" data-theme-default="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>{desc}
<meta name="robots" content="noindex">
<meta name="theme-color" content="#F4F3EF">
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="images/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="images/apple-touch-icon.png">
{theme}{styles}
<script type="module" src="assets/js/main.js"></script>
</head>
<body data-page="{page}"{' class="inspector-page"' if inspector else ''}>
<noscript><p style="padding:24px;font-family:sans-serif">This demo needs JavaScript turned on.</p></noscript>
</body>
</html>
"""


for file, page, title, description in PAGES:
    (ROOT / file).write_text(shell(page, title, description), encoding='utf-8')
    print('wrote', file)
