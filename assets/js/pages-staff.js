// Staff pages: the Line Inspector page and the admin pages. Admin pages are in
// English only, like the app.
import * as fmt from './fmt.js';
import * as store from './store.js';
import { allReports, positions } from './sim.js';
import { esc, icon, badge, statusBadge, button, card, empty, alert, stat, field, select, demoBanner } from './components.js';
import { adminLayout } from './layouts.js';
import { postStatus, CATEGORIES } from './pages-public.js';

const params = new URLSearchParams(location.search);
const TONES = { Advisory: 'warn', Schedule: 'info', 'Fare Update': 'brand', Holiday: 'ok', 'Route Change': 'info' };
const byNumber = (a, b) => a.number.localeCompare(b.number, undefined, { numeric: true });

// ---------------------------------------------------------------- Line Inspector

export function inspector({ errors = {}, old = {} } = {}) {
    document.title = 'Checkpoint report · ByahengPabama';
    const db = store.load();
    const me = store.currentUser();
    const now = Date.now();
    const reports = allReports(now);
    const latestRoute = new Map();
    reports.forEach((r) => latestRoute.set(r.bus, r.route));
    const buses = db.buses.filter((b) => b.active).sort(byNumber);
    const routes = [...db.routes].sort((a, b) => a.id - b.id);
    const checkpoints = (routes[0]?.stops || []).map((s) => store.checkpoint(s.checkpoint));
    const today = fmt.startOfDay(now);
    const recent = reports.filter((r) => r.user === me.id && r.at >= today).sort((a, b) => b.at - a.at).slice(0, 10);
    const defaultCp = +(old.checkpoint_id ?? recent[0]?.checkpoint ?? me.post ?? 0);
    const message = store.takeFlash();

    return `${demoBanner()}<div class="app">
<header><div><div class="role">LINE INSPECTOR <span style="margin-left:6px;padding:1px 8px;border-radius:999px;background:#FFEFCF;color:#7A4E00">Demo</span></div><div class="brand">ByahengPabama Checkpoint Report</div></div>
<div class="who">${esc(me.name)}<br>${me.role === 'admin' ? '<a href="admin.html">Admin</a> · ' : ''}<a href="passenger.html">Passenger view</a> · <button type="button" data-logout>Log out</button></div></header>
${message ? `<div class="flash" role="status">${esc(message)}</div>` : ''}
<form id="report-form" data-action="report" style="display:flex;flex-direction:column;">
<div class="field-group"><label class="field-label" for="bus_id">Bus number</label>
<select class="select-big" id="bus_id" name="bus_id" required>${buses.map((b) => `<option value="${b.id}" data-label="${esc(store.busLabel(b))}" data-route="${latestRoute.get(b.id) ?? ''}" ${+old.bus_id === b.id ? 'selected' : ''}>${esc(store.busLabel(b))}</option>`).join('')}</select>
${buses.length ? '' : '<div class="error">No buses are in service. Ask an admin to add one.</div>'}${errors.bus_id ? `<div class="error">${esc(errors.bus_id)}</div>` : ''}</div>
<div class="field-group"><label class="field-label" for="bus_route_id">Direction</label>
<select class="select-big" id="bus_route_id" name="bus_route_id" required>${routes.map((r) => `<option value="${r.id}" ${+old.bus_route_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
<div class="field-group"><span class="field-label">Checkpoint passed</span><div class="checkpoint-grid">
${checkpoints.map((c) => `<input type="radio" name="checkpoint_id" id="cp-${c.id}" value="${c.id}" data-name="${esc(c.name)}" ${defaultCp === c.id ? 'checked' : ''}><label class="checkpoint-btn" for="cp-${c.id}">${esc(c.name)}</label>`).join('')}
</div>${errors.checkpoint_id ? `<div class="error">${esc(errors.checkpoint_id)}</div>` : ''}</div>
<button class="confirm-btn" type="submit" id="confirm-btn" ${buses.length ? '' : 'disabled'}>Mark checkpoint</button>
</form>
<div class="log-section"><div class="log-heading">Your recent reports today</div>
${recent.length ? recent.map((r) => `<div class="log-item"><span class="log-dot"></span><span class="log-text"><span class="log-bus">${esc(store.busLabel(store.bus(r.bus)))}</span> — ${esc(store.checkpoint(r.checkpoint)?.name)}</span><span class="log-time">${esc(fmt.ago(r.at, now))}</span></div>`).join('') : '<div class="log-empty">No reports yet today.</div>'}
</div></div>`;
}

export function inspectorBehaviour(keepDirection = false) {
    const form = document.getElementById('report-form');
    const bus = document.getElementById('bus_id');
    const direction = document.getElementById('bus_route_id');
    const button = document.getElementById('confirm-btn');
    const syncDirection = () => {
        const r = bus.selectedOptions[0]?.dataset.route;
        if (r) direction.value = r;
    };
    const syncButton = () => {
        const checked = form.querySelector('input[name=checkpoint_id]:checked');
        const label = bus.selectedOptions[0] ? bus.selectedOptions[0].dataset.label : 'bus';
        button.textContent = checked ? `Mark ${label} at ${checked.dataset.name}` : 'Pick a checkpoint';
    };
    bus.addEventListener('change', () => { syncDirection(); syncButton(); });
    form.addEventListener('change', syncButton);
    if (!keepDirection) syncDirection();
    syncButton();
}

// ---------------------------------------------------------------- admin: Bus tracking

export function dashboard() {
    const now = Date.now();
    const pos = positions(now);
    const reports = allReports(now);
    const today = reports.filter((r) => r.at >= fmt.startOfDay(now));
    const recent = [...reports].sort((a, b) => b.at - a.at).slice(0, 10);
    const who = (id) => store.user(id)?.name;

    const content = `<div class="bento mb-6">
${stat('Buses in service', store.load().buses.filter((b) => b.active).length, { cls: 'span-3' })}
${stat('In transit now', pos.filter((p) => p.status === 'transit').length, { cls: 'span-3', tone: 'ok' })}
${stat('Reports today', today.length, { cls: 'span-3' })}
${stat('Inspectors reporting today', new Set(today.map((r) => r.user).filter(Boolean)).size, { cls: 'span-3' })}
</div>
${card({ flush: true, title: 'Buses' }, pos.length ? `<table class="data-table" data-stack="md"><thead><tr><th>Bus</th><th>Route</th><th>Status</th><th>Last checkpoint</th><th>Reported by</th><th class="num">Time</th></tr></thead><tbody>
${pos.map((p) => `<tr><td data-label="Bus" class="font-semibold">${esc(store.busLabel(p.bus))}</td><td data-label="Route">${esc(p.route?.name ?? '—')}</td><td data-label="Status">${statusBadge(p.status)}</td><td data-label="Last checkpoint">${esc(p.report ? store.checkpoint(p.report.checkpoint)?.name : '—')}</td><td data-label="Reported by">${esc(p.report ? (who(p.report.user) ?? '—') : '—')}</td><td data-label="Time" class="num">${p.report ? `${fmt.time(p.report.at)} <span class="muted">· ${fmt.ago(p.report.at, now, true)}</span>` : 'Never reported'}</td></tr>`).join('')}
</tbody></table>` : empty('No buses yet', 'bus', 'Add your buses first; inspectors can then report them at checkpoints.', button({ size: 'sm', href: 'admin-buses.html' }, 'Add a bus')))}
${card({ flush: true, title: 'Latest checkpoint reports', subtitle: 'The ten most recent reports from all inspectors', cls: 'mt-6' }, recent.length ? `<table class="data-table"><thead><tr><th>Time</th><th>Bus</th><th>Checkpoint</th><th>Direction</th><th>Inspector</th></tr></thead><tbody>
${recent.map((r) => `<tr><td data-label="Time" class="num">${fmt.shortDateTime(r.at)}</td><td data-label="Bus" class="font-semibold">${esc(store.busLabel(store.bus(r.bus)))}</td><td data-label="Checkpoint">${esc(store.checkpoint(r.checkpoint)?.name)}</td><td data-label="Direction">${esc(store.route(r.route)?.name)}</td><td data-label="Inspector">${esc(who(r.user) ?? 'Deleted account')}</td></tr>`).join('')}
</tbody></table>` : empty('No reports yet', 'clock', 'Reports appear here as inspectors mark buses at checkpoints.'))}`;

    return adminLayout({
        title: 'Bus tracking', active: 'tracking', heading: 'Bus tracking',
        intro: 'Live status from Line Inspector checkpoint reports. Refreshes every 30 seconds.',
        actions: button({ href: 'admin-buses.html', icon: 'bus' }, 'Add a bus'), content, message: store.takeFlash(),
    });
}

// ---------------------------------------------------------------- admin: Buses

const CLASS_OPTIONS = [['ordinary', 'Ordinary'], ['aircon', 'Aircon']];

export function buses({ errors = {}, old = {} } = {}) {
    const db = store.load();
    const now = Date.now();
    const latest = new Map();
    allReports(now).forEach((r) => latest.set(r.bus, r));
    const list = [...db.buses].sort(byNumber);

    const table = list.length ? `<table class="data-table" data-stack="md"><thead><tr><th>Bus</th><th>Plate</th><th>Class</th><th>Status</th><th>Last seen</th><th></th></tr></thead><tbody>
${list.map((b) => {
        const r = latest.get(b.id);
        const e = errors[`bus${b.id}`] || {};
        return `<tr><td data-label="Bus" class="font-semibold">${esc(store.busLabel(b))}</td><td data-label="Plate">${esc(b.plate || '—')}</td><td data-label="Class">${store.classLabel(b.class)}</td>
<td data-label="Status">${badge(b.active ? 'ok' : 'neutral', b.active ? 'In service' : 'Out of service')}</td>
<td data-label="Last seen">${r ? `${esc(store.checkpoint(r.checkpoint)?.name)} <span class="muted">· ${fmt.ago(r.at, now, true)}</span>` : '<span class="muted">Never reported</span>'}</td>
<td><details class="inline-details" ${Object.keys(e).length ? 'open' : ''}><summary class="btn btn-secondary btn-sm">Edit</summary>
<form data-action="bus-update" data-id="${b.id}" class="mt-3 grid gap-3" style="min-width: 220px">${field({ label: 'Plate number', name: 'plate_number', id: `plate-${b.id}`, value: b.plate || '', error: e.plate_number })}${select({ label: 'Class', name: 'class', id: `class-${b.id}`, options: CLASS_OPTIONS, selected: b.class })}${button({ type: 'submit', size: 'sm' }, 'Save')}</form>
<form data-action="bus-toggle" data-id="${b.id}" class="mt-2">${button({ type: 'submit', size: 'sm', variant: b.active ? 'danger' : 'secondary' }, b.active ? 'Take out of service' : 'Return to service')}</form>
</details></td></tr>`;
    }).join('')}
</tbody></table>` : empty('No buses yet', 'bus', 'Add the first bus with the form.');

    const add = `<form data-action="bus-store" class="grid gap-4">
${field({ label: 'Bus number', name: 'number', value: old.number ?? '', error: errors.number, hint: 'Shown to passengers as “Bus 18”.', attrs: 'required placeholder="e.g. 18"' })}
${field({ label: 'Plate number (optional)', name: 'plate_number', value: old.plate_number ?? '', error: errors.plate_number, attrs: 'placeholder="e.g. KVD 4118"' })}
${select({ label: 'Class', name: 'class', options: CLASS_OPTIONS, selected: old.class ?? 'ordinary', hint: 'Decides which fare applies.' })}
${button({ type: 'submit' }, 'Add bus')}</form>`;

    return adminLayout({
        title: 'Buses', active: 'buses', heading: 'Buses', message: store.takeFlash(),
        intro: 'Buses out of service are hidden from inspectors and passengers but keep their report history.',
        content: `<div class="bento">${card({ flush: true, cls: 'span-8', title: 'All buses' }, table)}${card({ cls: 'span-4', title: 'Add a bus' }, add)}</div>`,
    });
}

// ---------------------------------------------------------------- admin: Routes & fares

export function routes({ errors = {} } = {}) {
    const db = store.load();
    const now = Date.now();
    const pct = (x) => fmt.km(x * 100);
    const fe = errors.fare || {};
    const ce = errors.checkpoint || {};

    const fareSummary = ['ordinary', 'aircon'].map((cls) => {
        const s = store.fareSchedule(cls, now);
        return `<div class="mb-3"><p class="font-semibold">${store.classLabel(cls)} buses</p>${s
            ? `<p class="muted text-sm">₱${fmt.money(s.base)} for the first ${fmt.km(s.baseKm)} km, then ₱${fmt.money(s.perKm)} per km · ${pct(s.discount)}% off for students, seniors and PWDs · ${store.ROUNDING_LABELS[s.rounding]} · since ${fmt.shortDate(s.effective)}</p>`
            : `<p class="muted text-sm">No fare set yet, so passengers don't see a fare for these buses.</p>`}</div>`;
    }).join('');

    const schedules = [...db.fares].sort((a, b) => b.effective - a.effective);
    const fareTable = `<div class="card card-flush mt-4"><table class="data-table" data-stack="md"><thead><tr><th>Class</th><th class="num">Base</th><th class="num">Per km</th><th class="num">Discount</th><th>Rounding</th><th>Source</th><th>Effective</th><th></th></tr></thead><tbody>
${schedules.length ? schedules.map((s) => {
        const inForce = store.fareSchedule(s.class, now)?.id === s.id;
        const tone = inForce ? 'ok' : s.effective > now ? 'info' : 'neutral';
        return `<tr><td data-label="Class">${store.classLabel(s.class)}</td><td data-label="Base" class="num">₱${fmt.money(s.base)} / ${fmt.km(s.baseKm)} km</td><td data-label="Per km" class="num">₱${fmt.money(s.perKm)}</td><td data-label="Discount" class="num">${pct(s.discount)}%</td><td data-label="Rounding">${store.ROUNDING_LABELS[s.rounding]}</td>
<td data-label="Source">${esc(s.source)}${s.pdf ? `<br><a href="${esc(s.pdf)}" rel="noopener" target="_blank">Official PDF</a>` : ''}</td>
<td data-label="Effective">${fmt.shortDate(s.effective)}<br>${badge(tone, inForce ? 'In force' : s.effective > now ? 'Upcoming' : 'Past')}</td>
<td><form data-action="fare-destroy" data-id="${s.id}" data-confirm="Remove this fare schedule?">${button({ type: 'submit', variant: 'quiet', size: 'sm' }, 'Remove')}</form></td></tr>`;
    }).join('') : `<tr><td colspan="8">${empty('No fares yet', 'info', 'Add the LTFRB fare below.')}</td></tr>`}
</tbody></table></div>`;

    const fareForm = `<details class="inline-details mt-4" ${Object.keys(fe).length ? 'open' : ''}><summary class="btn btn-secondary">Add a fare schedule</summary>
<form data-action="fare-store" class="form-grid form-grid-3 mt-4">
${select({ label: 'Bus class', name: 'bus_class', options: CLASS_OPTIONS, error: fe.bus_class })}
${field({ label: 'Base fare (₱)', name: 'base_fare', type: 'number', error: fe.base_fare, attrs: 'step="0.01" min="0" inputmode="decimal" required' })}
${field({ label: 'Base covers the first (km)', name: 'base_km', type: 'number', value: 5, error: fe.base_km, attrs: 'step="0.1" min="0" required' })}
${field({ label: 'Each succeeding km (₱)', name: 'rate_per_succeeding_km', type: 'number', error: fe.rate_per_succeeding_km, attrs: 'step="0.01" min="0" inputmode="decimal" required' })}
${field({ label: 'Discount (%)', name: 'discount_percent', type: 'number', value: 20, hint: 'Students, senior citizens, PWDs.', error: fe.discount_percent, attrs: 'step="0.1" min="0" max="100" required' })}
${select({ label: 'Rounding', name: 'rounding', options: Object.entries(store.ROUNDING_LABELS) })}
${field({ label: 'Source (LTFRB memorandum circular no.)', name: 'source_reference', cls: 'span-full', error: fe.source_reference, attrs: 'required' })}
${field({ label: 'Effective date', name: 'effective_date', type: 'date', error: fe.effective_date, attrs: 'required' })}
${field({ label: 'Official PDF link (optional)', name: 'official_pdf_url', type: 'url', error: fe.official_pdf_url, attrs: 'placeholder="https://"' })}
<div class="span-full">${button({ type: 'submit' }, 'Save fare schedule')}</div></form></details>`;

    const ordinary = store.fareSchedule('ordinary', now);
    const routeCards = [...db.routes].sort((a, b) => a.id - b.id).map((r) => {
        const ids = r.stops.map((s) => s.checkpoint);
        const hasReturn = db.routes.some((o) => o.id !== r.id && JSON.stringify([...o.stops.map((s) => s.checkpoint)].reverse()) === JSON.stringify(ids));
        const err = errors[`route${r.id}`];
        const rows = r.stops.map((s, i) => {
            const name = store.checkpoint(s.checkpoint)?.name;
            const distance = s.km - r.stops[0].km;
            return `<tr><td data-label="#" class="num muted">${i + 1}</td><td data-label="Stop" class="font-semibold">${esc(name)}<input type="hidden" name="stops[${i}][checkpoint_id]" value="${s.checkpoint}"></td>
<td data-label="km from start"><input class="input max-w-28" type="number" step="0.1" min="0" inputmode="decimal" aria-label="${esc(name)}: km from start" name="stops[${i}][km]" value="${fmt.km(s.km)}" required></td>
<td data-label="Minutes from start"><input class="input max-w-28" type="number" step="1" min="0" inputmode="numeric" aria-label="${esc(name)}: minutes from start" name="stops[${i}][minutes]" value="${s.minutes ?? ''}"></td>
<td data-label="Fare from start" class="num">${ordinary && i > 0 ? `₱${fmt.money(store.fare(ordinary, distance))} <span class="muted">/ ₱${fmt.money(store.discountedFare(ordinary, distance))}</span>` : '—'}</td>
<td data-label="Remove">${i > 0 ? `<label class="check"><input type="checkbox" name="stops[${i}][remove]" value="1"><span class="visually-hidden">Remove ${esc(name)}</span></label>` : ''}</td></tr>`;
        }).join('');
        const n = r.stops.length;
        const others = db.checkpoints.filter((c) => !ids.includes(c.id));
        const newRow = `<tr><td data-label="#" class="muted">New</td><td data-label="Stop"><div class="select-wrap"><select class="select" name="stops[${n}][checkpoint_id]" aria-label="Add a stop"><option value="">Add a stop…</option>${others.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></td>
<td data-label="km from start"><input class="input max-w-28" type="number" step="0.1" min="0" name="stops[${n}][km]" aria-label="New stop: km from start"></td><td data-label="Minutes from start"><input class="input max-w-28" type="number" step="1" min="0" name="stops[${n}][minutes]" aria-label="New stop: minutes from start"></td><td></td><td></td></tr>`;
        return card({ title: r.name, subtitle: 'Stops are ordered by km from the first stop. Minutes are optional scheduled travel times; without them, ETAs use the average speed.', cls: 'mb-6' },
            `${err ? alert('danger', esc(err), { cls: 'mb-4', attrs: 'role="alert"' }) : ''}<form data-action="route-stops" data-id="${r.id}"><div class="card card-flush"><table class="data-table" data-stack="md"><thead><tr><th>#</th><th>Stop</th><th>km from start</th><th>Minutes from start</th><th class="num">Fare from start</th><th>Remove</th></tr></thead><tbody>${rows}${newRow}</tbody></table></div>
<div class="mt-4 flex flex-wrap items-center gap-4">${button({ type: 'submit' }, 'Save stops')}${hasReturn ? '<label class="check"><input type="checkbox" name="mirror" value="1" checked><span>Also update the return route (same stops, reversed)</span></label>' : ''}</div></form>`);
    }).join('');

    const cpTable = `<table class="data-table" data-stack="md"><thead><tr><th>Code</th><th>Name</th><th>Location</th><th></th></tr></thead><tbody>
${db.checkpoints.map((c) => {
        const e = errors[`checkpoint${c.id}`] || {};
        return `<tr><td data-label="Code" class="num">${esc(c.code)}</td><td data-label="Name" class="font-semibold">${esc(c.name)}</td><td data-label="Location">${esc(c.location || '—')}</td>
<td><details class="inline-details" ${Object.keys(e).length ? 'open' : ''}><summary class="btn btn-secondary btn-sm">Edit</summary><form data-action="checkpoint-update" data-id="${c.id}" class="mt-3 grid gap-3" style="min-width: 220px">${field({ label: 'Name', name: 'name', id: `cp-name-${c.id}`, value: c.name, error: e.name, attrs: 'required' })}${field({ label: 'Location', name: 'location', id: `cp-loc-${c.id}`, value: c.location || '' })}${button({ type: 'submit', size: 'sm' }, 'Save')}</form></details></td></tr>`;
    }).join('')}</tbody></table>`;

    const cpOptions = db.checkpoints.map((c) => [c.id, c.name]);
    const side = `<div class="span-4 grid content-start gap-4">
${card({ title: 'Add a checkpoint' }, `<form data-action="checkpoint-store" class="grid gap-4">${field({ label: 'Short code', name: 'code', hint: 'Letters and numbers, e.g. QZN.', error: ce.code, attrs: 'required maxlength="10"' })}${field({ label: 'Name', name: 'name', id: 'new-cp-name', error: ce.name, attrs: 'required' })}${field({ label: 'Location (optional)', name: 'location', id: 'new-cp-loc' })}${button({ type: 'submit' }, 'Add checkpoint')}</form>`)}
${card({ title: 'Add a route' }, `<form data-action="route-store" class="grid gap-4">${field({ label: 'Route name', name: 'name', id: 'route-name', error: (errors.route || {}).name, attrs: 'required placeholder="e.g. CDO Agora Terminal → Kibawe"' })}${select({ label: 'First stop', name: 'origin_id', options: cpOptions, placeholder: 'Choose…' })}${select({ label: 'Last stop', name: 'destination_id', options: cpOptions, placeholder: 'Choose…', error: (errors.route || {}).destination_id })}${field({ label: 'Distance between them (km)', name: 'km', type: 'number', error: (errors.route || {}).km, attrs: 'step="0.1" min="0" required' })}${button({ type: 'submit' }, 'Add route')}</form>`)}
</div>`;

    const content = `${store.setting('routes.distances_verified') ? '' : alert('warn', 'Some km values are estimates (marked VERIFY). Check each stop against Pabama\'s official fare matrix, then tick “Distances match the official fare matrix” in <a href="admin-settings.html">Settings</a>.', { title: 'Distances not yet verified', cls: 'mb-5' })}
${card({ title: 'Fares', subtitle: 'Base fare for the first km, plus a rate for each succeeding km. A new fare is a new schedule with its own start date.', cls: 'mb-6' }, fareSummary + fareTable + fareForm)}
${routeCards}
<div class="bento">${card({ flush: true, cls: 'span-8', title: 'Checkpoints', subtitle: 'Places inspectors report from. Rename them here; add them to a route above.' }, cpTable)}${side}</div>`;

    return adminLayout({ title: 'Routes & fares', active: 'routes', heading: 'Routes & fares', intro: 'Stops, distances and travel times for each route, and the LTFRB fares passengers see.', content, message: store.takeFlash() });
}

// ---------------------------------------------------------------- admin: Bulletins

export function bulletins() {
    const now = Date.now();
    const tones = { draft: 'neutral', scheduled: 'info', live: 'ok', expired: 'neutral' };
    const posts = [...store.load().posts].sort((a, b) => (b.pinned - a.pinned) || ((b.published ?? Infinity) - (a.published ?? Infinity)));
    const table = posts.length ? `<table class="data-table" data-stack="md"><thead><tr><th>Post</th><th>Category</th><th>Status</th><th>Shown</th><th></th></tr></thead><tbody>
${posts.map((p) => {
        const status = postStatus(p, now);
        return `<tr><td data-label="Post"><a class="font-semibold" href="admin-post.html?id=${p.id}">${esc(p.title)}</a>${p.pinned ? badge('danger', 'Pinned', 'ml-1') : ''}<br><span class="muted text-sm">${p.titleFil ? 'English + Filipino' : 'English only'}</span></td>
<td data-label="Category">${badge(TONES[p.category] || 'neutral', p.category)}</td><td data-label="Status">${badge(tones[status], status[0].toUpperCase() + status.slice(1))}</td>
<td data-label="Shown" class="text-sm">${p.published !== null ? `${status === 'scheduled' ? 'From' : 'Since'} ${fmt.shortDateTime(p.published)}` : '<span class="muted">Not published</span>'}${p.expires ? `<br><span class="muted">${status === 'expired' ? 'Ended' : 'Until'} ${fmt.shortDateTime(p.expires)}</span>` : ''}</td>
<td><div class="flex flex-wrap gap-2">${button({ size: 'sm', variant: 'secondary', href: `admin-post.html?id=${p.id}` }, 'Edit')}
<form data-action="post-pin" data-id="${p.id}">${button({ type: 'submit', size: 'sm', variant: 'quiet' }, p.pinned ? 'Unpin' : 'Pin')}</form>
${p.published !== null ? `<form data-action="post-unpublish" data-id="${p.id}">${button({ type: 'submit', size: 'sm', variant: 'quiet' }, 'Unpublish')}</form>` : ''}
${status === 'live' ? button({ size: 'sm', variant: 'quiet', href: `announcement.html?id=${p.id}`, attrs: 'target="_blank"' }, 'View') : ''}</div></td></tr>`;
    }).join('')}</tbody></table>` : empty('No posts yet', 'info', 'Post advisories, schedule changes and other news for passengers.', button({ size: 'sm', href: 'admin-post.html' }, 'Write the first post'));

    return adminLayout({
        title: 'Bulletins', active: 'bulletins', heading: 'Bulletins', message: store.takeFlash(),
        intro: 'Announcements on the landing page and the Announcements page. Pinned posts show first.',
        actions: button({ href: 'admin-post.html', icon: 'info' }, 'New post'),
        content: card({ flush: true }, table),
    });
}

export function postForm({ errors = {}, old = null } = {}) {
    const existing = store.post(params.get('id'));
    const editing = !!existing;
    const now = Date.now();
    const p = old || existing || { category: 'Advisory', title: '', body: '', titleFil: '', bodyFil: '', published: null, expires: null, pinned: false };
    const publish = old?.publish ?? (!editing ? 'now' : p.published === null ? 'draft' : p.published > now ? 'schedule' : 'now');
    const content = `<form data-action="post-save" data-id="${editing ? existing.id : ''}" class="bento">
${card({ cls: 'span-8', title: 'The post' }, `<div class="grid gap-4">
${select({ label: 'Category', name: 'category', options: CATEGORIES.map((c) => [c, c]), selected: p.category })}
${field({ label: 'Title (English)', name: 'title', value: p.title, error: errors.title, attrs: 'required maxlength="120"' })}
${field({ label: 'Message (English)', name: 'body', type: 'textarea', value: p.body, error: errors.body, hint: 'Up to 2,000 characters. Leave a blank line between paragraphs.', attrs: 'required maxlength="2000" rows="7"' })}
<hr class="divider">
${field({ label: 'Title (Filipino, optional)', name: 'title_fil', value: p.titleFil || '', attrs: 'maxlength="150" lang="fil"' })}
${field({ label: 'Message (Filipino, optional)', name: 'body_fil', type: 'textarea', value: p.bodyFil || '', hint: 'Shown when a passenger switches to FIL.', attrs: 'maxlength="2500" rows="7" lang="fil"' })}
</div>`)}
<div class="span-4 grid content-start gap-4">
${card({ title: 'When to show it' }, `<fieldset class="fieldset grid gap-2"><legend class="field-label">Publish</legend>${[['now', 'Publish now'], ['schedule', 'Schedule for later'], ['draft', 'Save as draft (hidden)']].map(([v, l]) => `<label class="check"><input type="radio" name="publish" value="${v}" ${publish === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
<div class="mt-3 grid gap-4">${field({ label: 'Publish on (if scheduled)', name: 'publish_at', type: 'datetime-local', value: p.published && p.published > now ? fmt.ymdhi(p.published) : (old?.publish_at || null), error: errors.publish_at })}
${field({ label: 'Hide after (optional)', name: 'expires_at', type: 'datetime-local', value: p.expires ? fmt.ymdhi(p.expires) : null, hint: 'For advisories that end, like road work.' })}
<label class="check"><input type="checkbox" name="is_pinned" value="1" ${p.pinned ? 'checked' : ''}><span>Pin to the top</span></label></div>`)}
<div class="flex flex-wrap gap-3">${button({ type: 'submit' }, editing ? 'Save changes' : 'Save post')}${button({ variant: 'quiet', href: 'admin-bulletins.html' }, 'Cancel')}</div>
</div></form>
${editing ? `<form data-action="post-destroy" data-id="${existing.id}" data-confirm="Delete this post for good?" class="mt-6">${button({ type: 'submit', variant: 'danger', size: 'sm' }, 'Delete post')}</form>` : ''}`;
    return adminLayout({
        title: editing ? 'Edit post' : 'New post', active: 'bulletins', heading: editing ? 'Edit post' : 'New post',
        intro: "Plain text only, no images, so it loads fast on weak signal. The Filipino version is optional: if it's blank, the post shows as written.", content,
    });
}

// ---------------------------------------------------------------- admin: Accounts

export function accounts({ errors = {}, old = {} } = {}) {
    const db = store.load();
    const me = store.currentUser();
    const counts = new Map();
    allReports().forEach((r) => counts.set(r.user, (counts.get(r.user) || 0) + 1));
    const table = `<table class="data-table" data-stack="md"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th class="num">Reports</th><th></th></tr></thead><tbody>
${db.users.map((u) => {
        const e = errors[`reset${u.id}`] || {};
        return `<tr><td data-label="Name"><span class="font-semibold">${esc(u.name)}</span>${u.id === me.id ? ' <span class="muted">(you)</span>' : ''}${u.mustChange ? `<br>${badge('warn', 'Temporary password')}` : ''}</td>
<td data-label="Email" style="overflow-wrap: anywhere">${esc(u.email)}</td><td data-label="Role">${badge(u.role === 'admin' ? 'brand' : 'neutral', store.roleLabel(u.role))}</td><td data-label="Reports" class="num">${counts.get(u.id) || 0}</td>
<td>${u.id === me.id ? '' : `<details class="inline-details" ${Object.keys(e).length ? 'open' : ''}><summary class="btn btn-secondary btn-sm">Manage</summary>
<form data-action="account-password" data-id="${u.id}" class="mt-3 grid gap-3" style="min-width: 230px"><p class="field-hint">Forgot their password? Set a temporary one; they choose their own at next login.</p>${field({ label: 'Temporary password', name: 'password', id: `reset-${u.id}`, revealable: true, error: e.password, attrs: 'required autocomplete="new-password"' })}${field({ label: 'Confirm', name: 'password_confirmation', id: `reset-c-${u.id}`, type: 'password', attrs: 'required autocomplete="new-password"' })}${button({ type: 'submit', size: 'sm' }, 'Reset password')}</form>
<form data-action="account-destroy" data-id="${u.id}" data-confirm="Delete the account for ${esc(u.name)}? Their past reports are kept." class="mt-3">${button({ type: 'submit', variant: 'danger', size: 'sm' }, 'Delete account')}</form></details>`}</td></tr>`;
    }).join('')}</tbody></table>`;

    const create = `<form data-action="account-store" class="grid gap-4">
${field({ label: 'Full name', name: 'name', value: old.name ?? '', error: errors.name, attrs: 'required' })}
${field({ label: 'Email', name: 'email', type: 'email', value: old.email ?? '', error: errors.email, hint: 'They log in with this.', attrs: 'required inputmode="email"' })}
${select({ label: 'Role', name: 'role', options: [['admin', 'Admin'], ['inspector', 'Line Inspector']], selected: old.role ?? 'inspector' })}
${field({ label: 'Temporary password', name: 'password', revealable: true, error: errors.password, hint: "At least 8 characters. Give it to them in person; they'll change it at first login.", attrs: 'required autocomplete="new-password"' })}
${field({ label: 'Confirm password', name: 'password_confirmation', type: 'password', attrs: 'required autocomplete="new-password"' })}
${button({ type: 'submit' }, 'Create account')}</form>`;

    return adminLayout({
        title: 'Accounts', active: 'accounts', heading: 'Accounts', message: store.takeFlash(),
        intro: 'Only admins create accounts. New accounts get a temporary password that the person must change when they first log in.',
        content: `${errors.account ? alert('danger', esc(errors.account), { cls: 'mb-5', attrs: 'role="alert"' }) : ''}<div class="bento">${card({ flush: true, cls: 'span-8', title: 'Staff accounts' }, table)}${card({ cls: 'span-4', title: 'Create an account' }, create)}</div>`,
    });
}

// ---------------------------------------------------------------- admin: Settings

export function settings({ errors = {} } = {}) {
    const fields = Object.entries(store.SETTINGS).map(([key, d]) => {
        const name = key.replace('.', '_');
        if (typeof d.default === 'boolean') {
            return `<div class="field"><label class="check"><input type="checkbox" name="${name}" value="1" ${store.setting(key) ? 'checked' : ''}><span class="font-semibold">${esc(d.label)}</span></label><p class="field-hint">${esc(d.hint)}</p></div>`;
        }
        return field({ label: `${d.label} (${d.unit})`, name, type: 'number', value: store.setting(key), error: errors[name], hint: `${d.hint} Default: ${d.default}.`, cls: 'max-w-40', attrs: `inputmode="numeric" min="${d.min}" max="${d.max}" required` });
    }).join('');
    return adminLayout({
        title: 'Settings', active: 'settings', heading: 'Settings', message: store.takeFlash(),
        intro: 'Values used for arrival estimates and reports. Changes apply right away.',
        content: card({ cls: 'max-w-3xl' }, `<form data-action="settings" class="grid gap-5">${fields}<div>${button({ type: 'submit' }, 'Save settings')}</div></form>`),
    });
}
