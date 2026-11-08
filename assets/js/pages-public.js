// Passenger pages: landing, Track a bus, announcements, and the login page.
import { __, choice, lang } from './i18n.js';
import * as fmt from './fmt.js';
import * as store from './store.js';
import { approaching, onRoute, progress } from './sim.js';
import { esc, icon, badge, statusBadge, button, card, empty, alert, select, field, segmented } from './components.js';
import { publicLayout, authLayout } from './layouts.js';

const TONES = { Advisory: 'warn', Schedule: 'info', 'Fare Update': 'brand', Holiday: 'ok', 'Route Change': 'info' };
export const CATEGORIES = ['Advisory', 'Schedule', 'Fare Update', 'Holiday', 'Route Change'];
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- shared pieces

export function postStatus(post, now = Date.now()) {
    if (post.published === null) return 'draft';
    if (post.published > now) return 'scheduled';
    if (post.expires !== null && post.expires <= now) return 'expired';
    return 'live';
}

const live = (now = Date.now()) => store.load().posts.filter((p) => postStatus(p, now) === 'live').sort((a, b) => b.published - a.published);
const title = (p) => (lang === 'fil' && p.titleFil ? p.titleFil : p.title);
const body = (p) => (lang === 'fil' && p.bodyFil ? p.bodyFil : p.body);
const excerpt = (p, length) => {
    const text = body(p).replace(/\s+/g, ' ');
    return text.length > length ? text.slice(0, length).trimEnd() + '...' : text;
};

function postCard(post, { featured = false, cls = '' } = {}) {
    return `<a href="announcement.html?id=${post.id}" class="card card-link post-card${featured ? ' post-card-featured' : ''}${cls ? ' ' + cls : ''}">
<div class="post-meta">${post.pinned ? badge('danger', __('Pinned')) : ''}${badge(TONES[post.category] || 'neutral', __(post.category))}<time class="post-date">${esc(fmt.longDate(post.published))}</time></div>
<h3 class="card-link-title post-title">${esc(title(post))}</h3>
<p class="post-excerpt">${esc(excerpt(post, featured ? 220 : 140))}</p></a>`;
}

function routeLine(route, positions, highlight = null, now = Date.now()) {
    const stops = route.stops;
    const count = Math.max(1, stops.length);
    const at = (p) => Math.round(((p + 0.5) / count) * 10000) / 100;
    const markers = positions.map((p) => ({ p, progress: progress(p, now) })).filter((m) => m.progress !== null);
    return `<div class="route-line" style="--stops: ${count}"><ol class="route-stops">
${stops.map((s) => {
        const here = highlight === s.checkpoint;
        return `<li class="route-stop ${here ? 'is-here' : ''}"><span class="route-dot" aria-hidden="true"></span><span class="route-name">${esc(store.checkpoint(s.checkpoint)?.name)}</span>${here ? `<span class="route-here">${esc(__('You are here'))}</span>` : ''}</li>`;
    }).join('')}
</ol><div class="route-buses" aria-hidden="true">
${markers.map(({ p, progress: x }) => `<span class="route-bus route-bus-${p.status}" style="--at: ${at(x)}%" data-bus="${p.bus.id}" title="${esc(store.busLabel(p.bus))}">${icon('bus')}<span>${esc(p.bus.number)}</span></span>`).join('')}
</div>${markers.length ? `<p class="visually-hidden">${markers.map(({ p }) => esc(__(':bus near :stop.', { bus: store.busLabel(p.bus), stop: p.checkpoint.name }))).join(' ')}</p>` : ''}</div>`;
}

const routeEnds = (r) => `${store.checkpoint(r.stops[0]?.checkpoint)?.name} → ${store.checkpoint(r.stops[r.stops.length - 1]?.checkpoint)?.name}`;

// ---------------------------------------------------------------- landing page

export function welcome() {
    const db = store.load();
    const now = Date.now();
    const routes = [...db.routes].sort((a, b) => a.id - b.id);
    const route = routes.find((r) => r.id === +params.get('route')) || routes[0];
    const positions = route ? onRoute(route, now) : [];
    const posts = live(now);
    const pinned = posts.filter((p) => p.pinned).slice(0, 2);
    const latest = posts.filter((p) => !pinned.includes(p)).slice(0, 3);
    const fare = store.fareSchedule('ordinary', now);

    const hero = `<section class="hero"><div class="hero-text">
<p class="eyebrow">${esc(__('Pabama buses · CDO Agora Terminal ↔ Kibawe'))}</p>
<h1 class="hero-title">${esc(__('Know where your bus is before you leave the house.'))}</h1>
<p class="lede hero-lede">${esc(__('Line Inspectors report every Pabama bus at checkpoints along the route, so you see real updates, not guesses.'))}</p>
<div class="hero-actions">${button({ size: 'lg', href: 'passenger.html', iconAfter: 'arrow-right' }, esc(__('Track a bus')))}${button({ size: 'lg', variant: 'secondary', href: 'announcements.html' }, esc(__('Announcements')))}</div>
${fare ? `<p class="hero-fare">${esc(__('Fares start at :amount for the first :km km.', { amount: '₱' + fmt.money(fare.base), km: fmt.km(fare.baseKm) }))}</p>` : ''}
</div>
${route ? `<div class="card hero-live"><div class="card-header"><div><p class="eyebrow">${esc(__('On the road now'))}</p><h2 class="card-title mt-1">${esc(route.name)}</h2></div><span class="badge badge-ok">${esc(choice(':count bus|:count buses', positions.length))}</span></div>
${routes.length > 1 ? `<nav class="direction-switch" aria-label="${esc(__('Direction'))}">${routes.map((r) => `<a href="index.html?route=${r.id}#live" ${r.id === route.id ? 'aria-current="true"' : ''}>${esc(routeEnds(r))}</a>`).join('')}</nav>` : ''}
<div id="live" class="mt-4">${routeLine(route, positions, null, now)}</div>
<p class="field-hint mt-4">${esc(__('Bus positions between checkpoints are estimates.'))}</p>
${button({ variant: 'secondary', block: true, href: `passenger.html?route=${route.id}`, iconAfter: 'arrow-right', cls: 'mt-4' }, esc(__('See arrival times')))}</div>` : ''}
</section>`;

    const news = `<section class="section" aria-labelledby="news-h"><div class="section-header"><div><h2 id="news-h" class="text-2xl">${esc(__('Announcements'))}</h2><p class="muted mt-1">${esc(__('Advisories, schedule changes and news from Pabama.'))}</p></div><a class="font-semibold" href="announcements.html">${esc(__('View all'))}</a></div>
${!pinned.length && !latest.length
        ? card({}, empty(__('No announcements right now'), 'info', esc(__('Check back later for advisories and schedule changes.'))))
        : `<div class="post-grid">${pinned.map((p) => postCard(p, { featured: true, cls: 'post-span-full' })).join('')}${latest.map((p) => postCard(p)).join('')}</div>`}
</section>`;

    const steps = [
        ['An inspector marks the bus', 'When a bus passes a checkpoint, the Line Inspector there reports it right away.'],
        ['You see where it is', 'Pick your stop to see the buses coming and about how long they will take.'],
        ['You know the fare', 'Fares follow LTFRB rates, with the discount for students, seniors and PWDs.'],
    ];
    const how = `<section class="section" aria-labelledby="how-h"><h2 id="how-h" class="text-2xl">${esc(__('How it works'))}</h2><ol class="steps mt-4">${steps.map(([h, p], i) => `<li class="card"><span class="step-num">${i + 1}</span><h3 class="card-title">${esc(__(h))}</h3><p class="muted mt-1">${esc(__(p))}</p></li>`).join('')}</ol></section>`;

    return publicLayout({ width: 'page', footer: __('Estimates come from checkpoint reports, not GPS.'), content: hero + news + how });
}

// ---------------------------------------------------------------- Track a bus

function trip() {
    const routes = [...store.load().routes].sort((a, b) => a.id - b.id);
    const route = routes.find((r) => r.id === +params.get('route')) || routes[0] || null;
    if (!route) return { routes, route };
    // Defaults to the end of the line, so every bus on the route is listed.
    const from = route.stops.find((s) => s.checkpoint === +params.get('from')) || route.stops[route.stops.length - 1];
    let to = route.stops.find((s) => s.checkpoint === +params.get('to')) || null;
    if (to && route.stops.indexOf(to) <= route.stops.indexOf(from)) to = null;
    return { routes, route, from, to };
}

function tripForm({ routes, route, from, to }) {
    const fromIdx = route.stops.indexOf(from);
    return `<form id="trip" class="card tracker-form" method="GET" action="passenger.html" data-tracker-form>
<h2 class="visually-hidden">${esc(__('Your trip'))}</h2>
${segmented({ label: __('Direction'), name: 'route', options: routes.map((r) => [r.id, routeEnds(r)]), selected: route.id })}
${select({ label: __("I'm waiting at"), name: 'from', id: 'from', size: 'lg', options: route.stops.map((s) => [s.checkpoint, store.checkpoint(s.checkpoint)?.name]), selected: from.checkpoint })}
${select({ label: __('Going to'), name: 'to', id: 'to', placeholder: __('Choose to see the fare'), options: route.stops.slice(fromIdx + 1).map((s) => [s.checkpoint, store.checkpoint(s.checkpoint)?.name]), selected: to?.checkpoint ?? '' })}
</form>`;
}

function liveSection({ route, from, to }, now = Date.now()) {
    const stopName = store.checkpoint(from.checkpoint)?.name;
    const buses = approaching(route, from.checkpoint, now);
    const where = (p) => (p.status === 'terminal' ? __('Waiting at :stop', { stop: p.checkpoint.name }) : __('Last seen at :stop', { stop: p.checkpoint.name }));

    let list;
    if (!buses.length) {
        list = card({}, empty(__('No buses on their way yet'), 'bus', esc(__('Buses appear here once a Line Inspector reports them before your stop.'))));
    } else {
        const next = buses[0];
        list = `<article class="card next-bus"><p class="eyebrow">${esc(__('Next bus'))}</p><div class="next-bus-row"><div><p class="next-bus-name">${esc(store.busLabel(next.bus))}</p><div class="mt-2 flex flex-wrap gap-2">${statusBadge(next.status)}${badge('neutral', __(store.classLabel(next.bus.class)))}</div></div>
<div class="eta">${next.eta === 0 ? `<span class="eta-value eta-now">${esc(__('Arriving now'))}</span>` : `<span class="eta-label">${esc(next.status === 'terminal' ? __('After it leaves') : __('About'))}</span><span class="eta-value num">${esc(fmt.duration(next.eta))}</span>`}</div></div>
<p class="muted mt-3">${esc(where(next))} · ${esc(fmt.ago(next.report.at, now))}</p></article>`;
        if (buses.length > 1) {
            list += `<ul class="card card-flush bus-list" aria-label="${esc(__('Later buses'))}">${buses.slice(1).map((p) => `<li class="bus-row"><div class="min-w-0"><p class="font-semibold">${esc(store.busLabel(p.bus))}</p><div class="mt-1 flex flex-wrap gap-1">${statusBadge(p.status)}${badge('neutral', __(store.classLabel(p.bus.class)))}</div><p class="muted text-sm mt-1">${esc(where(p))} · ${esc(fmt.ago(p.report.at, now))}</p></div><p class="bus-row-eta num">${esc(p.eta === 0 ? __('Now') : fmt.duration(p.eta))}</p></li>`).join('')}</ul>`;
        }
    }

    let fareBody = `<p class="muted">${esc(__("Choose where you're going to see the fare."))}</p>`;
    if (to) {
        const distance = Math.abs(to.km - from.km);
        const rows = ['ordinary', 'aircon'].map((cls) => [cls, store.fareSchedule(cls, now)]).filter(([, s]) => s);
        fareBody = `<p class="muted text-sm">${esc(stopName)} → ${esc(store.checkpoint(to.checkpoint)?.name)} · ${fmt.km(distance)} km</p><dl class="fare-list mt-3">${rows.map(([cls, s]) => `<div><dt>${esc(__(store.classLabel(cls) + ' bus'))}</dt><dd class="num"><strong>₱${fmt.money(store.fare(s, distance))}</strong> <span class="muted">· ${esc(__('₱:amount student, senior or PWD', { amount: fmt.money(store.discountedFare(s, distance)) }))}</span></dd></div>`).join('')}</dl>`;
    }

    return `<section id="live" class="tracker-live" aria-live="polite" aria-busy="false" aria-labelledby="live-h"><div class="live-content grid gap-4">
<div class="live-status"><h2 id="live-h" class="text-lg">${esc(__('Buses coming to :stop', { stop: stopName }))}</h2><p class="muted text-sm"><span data-updated>${esc(__('Updated :time', { time: fmt.time(now) }))}</span></p></div>
${list}
${card({ title: __('Fare') }, fareBody)}
${card({ title: __('Along the route') }, routeLine(route, onRoute(route, now), from.checkpoint, now) + `<p class="field-hint mt-3">${esc(__('Bus positions between checkpoints are estimates.'))}</p>`)}
</div></section>`;
}

function recordLookup(t) {
    const db = store.load();
    db.lookups.push({ route: t.route.id, stop: t.from.checkpoint, to: t.to?.checkpoint ?? null, at: Date.now() });
    db.lookups = db.lookups.slice(-500);
    store.save();
}

export function passenger() {
    const t = trip();
    const content = !t.route
        ? `<h1 class="text-3xl">${esc(__('Track a bus'))}</h1>${card({ cls: 'mt-5' }, empty(__('No routes yet'), 'pin', esc(__('Routes appear here once Pabama sets them up.'))))}`
        : `<h1 class="text-3xl">${esc(__('Track a bus'))}</h1><div class="tracker">${tripForm(t)}${liveSection(t)}</div>`;
    if (t.route && params.has('from')) recordLookup(t);
    return publicLayout({ title: __('Track a bus'), width: 'page', active: 'track', footer: __('Estimates come from checkpoint reports, not GPS.'), content });
}

/** Like tracker.js: pickers redraw in place, and the list refreshes every 30 s. */
export function passengerBehaviour() {
    const form = document.querySelector('[data-tracker-form]');
    if (!form) return;
    let timer;
    const redraw = () => {
        const t = trip();
        document.getElementById('live').outerHTML = liveSection(t);
    };
    form.addEventListener('change', (event) => {
        if (event.target.name === 'route') form.querySelector('[name="to"]').value = '';
        const query = new URLSearchParams(new FormData(form));
        history.replaceState(null, '', `passenger.html?${query}`);
        [...params.keys()].forEach((k) => params.delete(k));
        query.forEach((v, k) => params.set(k, v));
        const t = trip();
        const focused = event.target.id || event.target.name;
        form.outerHTML = tripForm(t);
        document.getElementById('live').outerHTML = liveSection(t);
        recordLookup(t);
        passengerBehaviour();
        (document.getElementById(focused) || document.querySelector(`[name="${focused}"]:checked`))?.focus();
        clearInterval(timer);
    });
    timer = setInterval(() => { if (document.visibilityState === 'visible') redraw(); }, 30000);
    window.__bpTimer && clearInterval(window.__bpTimer);
    window.__bpTimer = timer;
}

// ---------------------------------------------------------------- announcements

export function announcements() {
    const category = CATEGORIES.includes(params.get('category')) ? params.get('category') : null;
    const posts = live().filter((p) => !category || p.category === category)
        .sort((a, b) => (b.pinned - a.pinned) || (b.published - a.published));
    const chips = `<nav class="chips mb-5" aria-label="${esc(__('Filter by category'))}"><a class="chip" href="announcements.html" ${category ? '' : 'aria-current="true"'}>${esc(__('All'))}</a>${CATEGORIES.map((c) => `<a class="chip" href="announcements.html?category=${encodeURIComponent(c)}" ${category === c ? 'aria-current="true"' : ''}>${esc(__(c))}</a>`).join('')}</nav>`;
    const list = posts.length
        ? `<div class="post-grid">${posts.map((p) => postCard(p, { featured: p.pinned, cls: p.pinned ? 'post-span-full' : '' })).join('')}</div>`
        : card({}, empty(category ? __('No :category posts right now', { category: __(category) }) : __('No announcements right now'), 'info', esc(__('Check back later for advisories and schedule changes.'))));
    return publicLayout({
        title: __('Announcements'), width: 'page', active: 'announcements',
        content: `<div class="section-header"><div><h1 class="text-3xl">${esc(__('Announcements'))}</h1><p class="lede mt-1">${esc(__('Advisories, schedule changes and news from Pabama.'))}</p></div></div>${chips}${list}`,
    });
}

export function announcement() {
    const post = store.post(params.get('id'));
    if (!post || postStatus(post) !== 'live') return notFound();
    post.views = (post.views || 0) + 1;
    store.save();
    const more = live().filter((p) => p.id !== post.id).slice(0, 3);
    const link = new URL(`announcement.html?id=${post.id}`, location.href).href;
    const content = `<a class="font-semibold" href="announcements.html">← ${esc(__('All announcements'))}</a>
<article class="mt-5"><div class="post-meta">${post.pinned ? badge('danger', __('Pinned')) : ''}${badge(TONES[post.category] || 'neutral', __(post.category))}<time class="post-date">${esc(__('Posted :date', { date: fmt.longDateTime(post.published) }))}</time></div>
<h1 class="mt-3 text-3xl">${esc(title(post))}</h1>
<div class="post-body mt-4">${body(post).trim().split(/\n\s*\n/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('')}</div>
${post.expires ? `<p class="field-hint mt-5">${esc(__('This notice is shown until :date.', { date: fmt.longDateTime(post.expires) }))}</p>` : ''}
<div class="mt-5">${button({ variant: 'secondary', size: 'sm', icon: 'check', attrs: `data-copy-link="${esc(link)}" data-copied-label="${esc(__('Link copied'))}"` }, esc(__('Copy link')))}</div></article>
${more.length ? `<section class="section" aria-labelledby="more-h"><h2 id="more-h">${esc(__('More announcements'))}</h2><div class="mt-4 grid gap-3">${more.map((p) => postCard(p)).join('')}</div></section>` : ''}`;
    return publicLayout({ title: title(post), active: 'announcements', content });
}

export function notFound() {
    return publicLayout({
        title: __("We can't find that page"),
        content: card({}, empty(__("We can't find that page"), 'info', esc(__('The link may be old or mistyped. Check the address, or start from the home page.')), button({ href: 'index.html' }, esc(__('Go to the home page'))))),
    });
}

// ---------------------------------------------------------------- login

export function login({ error = null, email = '' } = {}) {
    const accounts = [
        ['admin@demo.test', 'Admin'],
        ['inspector1@demo.test', 'Line Inspector (Valencia)'],
        ['inspector2@demo.test', 'Line Inspector (Malaybalay)'],
    ];
    const content = `<form class="grid gap-4" novalidate data-login>
${field({ label: __('Email'), name: 'email', type: 'email', value: email, error, attrs: 'required autofocus autocomplete="username" inputmode="email"' })}
${field({ label: __('Password'), name: 'password', revealable: true, attrs: 'required autocomplete="current-password"' })}
<div class="flex flex-wrap items-center justify-between gap-2"><label class="check"><input type="checkbox" name="remember"><span>${esc(__('Keep me logged in'))}</span></label></div>
${button({ type: 'submit', size: 'lg', block: true }, esc(__('Log in')))}
</form>
<div class="demo-accounts">${alert('info', `Demo accounts, password <strong>${store.PASSWORD}</strong>. Tap one to fill it in.<table>${accounts.map(([e, role]) => `<tr><td><button type="button" data-fill="${e}">${e}</button></td><td class="muted">${role}</td></tr>`).join('')}</table>`, { title: 'Try it' })}</div>`;
    return authLayout({ title: __('Log in'), heading: __('Log in'), intro: __('For Pabama admins and Line Inspectors.'), content });
}
