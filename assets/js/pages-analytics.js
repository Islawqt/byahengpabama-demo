// Admin analytics, as designed in the paper (planned for Increment 4 of the
// real system). Every number here is computed from the demo's reports.
// Passenger lookups are simulated, plus the ones made in this browser.
import * as fmt from './fmt.js';
import * as store from './store.js';
import { allReports, simulatedReports, minutesBetween } from './sim.js';
import { esc, badge, button, card, alert, stat, select, segmented } from './components.js';
import { adminLayout } from './layouts.js';
import { postStatus } from './pages-public.js';

const DAY = 86400e3;
const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const PROFILE = { 4: 0.2, 5: 0.6, 6: 2.1, 7: 2.3, 8: 1.5, 9: 1.1, 10: 1, 11: 1, 12: 1.2, 13: 1.1, 14: 1.2, 15: 1.6, 16: 2.2, 17: 2.3, 18: 1.4, 19: 0.7, 20: 0.2, 21: 0.1 };
const STOP_WEIGHT = { 1: 0.6, 2: 0.45, 3: 0.9, 4: 1, 5: 0.7, 6: 0.5, 7: 0.35 };

function noise(...keys) {
    let h = 2166136261;
    keys.join('|').split('').forEach((c) => { h = Math.imul(h ^ c.charCodeAt(0), 16777619); });
    return ((h >>> 0) % 1000) / 1000;
}

/** Simulated anonymous lookups: { stop, hour, count } per day and hour. */
function lookups(from, to) {
    const rows = [];
    for (let day = fmt.startOfDay(from); day < to; day += DAY) {
        Object.keys(PROFILE).forEach((h) => {
            const at = day + h * 3600e3;
            if (at < from || at > to) return;
            Object.entries(STOP_WEIGHT).forEach(([stop, w]) => {
                const count = Math.round(w * PROFILE[h] * 11 * (0.75 + 0.5 * noise(day, h, stop)));
                if (count) rows.push({ stop: +stop, hour: +h, count, at });
            });
        });
    }
    store.load().lookups.filter((l) => l.at >= from && l.at <= to)
        .forEach((l) => rows.push({ stop: l.stop, hour: fmt.parts(l.at).H, count: 1, at: l.at }));
    return rows;
}

function bars(data, w, h, gap) {
    const max = Math.max(1, ...data.map(([, v]) => v));
    const bw = (w - (data.length - 1) * gap) / data.length;
    const small = data.length > 16;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" style="display:block">${data.map(([label, v], i) => {
        const bh = Math.round(((h - 34) * v) / max);
        const x = Math.round(i * (bw + gap) * 10) / 10;
        const y = h - 20 - bh;
        const cx = Math.round((x + bw / 2) * 10) / 10;
        return `<rect x="${x}" y="${y}" width="${Math.max(1, Math.round(bw * 10) / 10)}" height="${bh}" rx="3" fill="var(--brand)"><title>${esc(label)}: ${v}</title></rect>`
            + (small ? '' : `<text x="${cx}" y="${y - 5}" text-anchor="middle" font-size="11" fill="var(--ink-2)">${v}</text>`)
            + (!small || i % 5 === 0 ? `<text x="${cx}" y="${h - 4}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${esc(label)}</text>` : '');
    }).join('')}</svg>`;
}

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const hourRange = (h) => `${h % 12 || 12}–${(h + 1) % 12 || 12} ${h + 1 < 12 || h + 1 === 24 ? 'AM' : 'PM'}`;

export function analytics() {
    const params = new URLSearchParams(location.search);
    const db = store.load();
    const now = Date.now();
    const period = ['today', '7', '30'].includes(params.get('period')) ? params.get('period') : '7';
    const days = period === 'today' ? 1 : +period;
    const from = fmt.startOfDay(now) - (days - 1) * DAY;
    const routes = [...db.routes].sort((a, b) => a.id - b.id);
    const routeId = routes.some((r) => r.id === +params.get('route')) ? +params.get('route') : 'all';
    const inRoute = (r) => routeId === 'all' || r.route === routeId;

    const reports = allReports(now).filter((r) => r.at >= from && inRoute(r));
    const missed = simulatedReports(now).filter((r) => r.missed && r.at >= from && inRoute(r));
    const completed = reports.filter((r) => {
        const route = store.route(r.route);
        return route && route.stops[route.stops.length - 1].checkpoint === r.checkpoint;
    });
    const looked = lookups(from, now).filter((l) => routeId === 'all' || store.route(routeId)?.stops.some((s) => s.checkpoint === l.stop));
    const totalLookups = looked.reduce((n, l) => n + l.count, 0);

    // Reports per day (or per hour for today)
    let perTime;
    if (period === 'today') {
        perTime = HOURS.map((h) => [hourLabel(h), reports.filter((r) => fmt.parts(r.at).H === h).length]);
    } else {
        perTime = [];
        for (let d = from; d <= now; d += DAY) {
            const p = fmt.parts(d);
            perTime.push([days > 7 ? String(p.d) : fmt.shortDate(d).replace(/, \d+$/, ''), reports.filter((r) => r.at >= d && r.at < d + DAY).length]);
        }
    }
    const perHour = HOURS.map((h) => [hourLabel(h), looked.filter((l) => l.hour === h).reduce((n, l) => n + l.count, 0)]);

    // Travel time between consecutive checkpoints of the same trip
    const route = store.route(routeId === 'all' ? routes[0]?.id : routeId);
    const samples = new Map();
    const byBus = new Map();
    reports.filter((r) => r.route === route?.id).forEach((r) => {
        if (!byBus.has(r.bus)) byBus.set(r.bus, []);
        byBus.get(r.bus).push(r);
    });
    byBus.forEach((list) => {
        list.sort((a, b) => a.at - b.at);
        for (let i = 1; i < list.length; i++) {
            const a = route.stops.findIndex((s) => s.checkpoint === list[i - 1].checkpoint);
            const b = route.stops.findIndex((s) => s.checkpoint === list[i].checkpoint);
            if (b === a + 1 && a >= 0 && list[i].at - list[i - 1].at < 6 * 3600e3) {
                if (!samples.has(a)) samples.set(a, []);
                samples.get(a).push((list[i].at - list[i - 1].at) / 60e3);
            }
        }
    });
    const segments = route ? route.stops.slice(1).map((s, i) => {
        const list = samples.get(i) || [];
        const avg = list.length ? Math.round(list.reduce((x, y) => x + y, 0) / list.length) : null;
        return {
            name: `${store.checkpoint(route.stops[i].checkpoint)?.name} → ${store.checkpoint(s.checkpoint)?.name}`,
            km: Math.abs(s.km - route.stops[i].km), trips: list.length, avg,
            min: list.length ? Math.round(Math.min(...list)) : null, max: list.length ? Math.round(Math.max(...list)) : null,
            used: minutesBetween(route, i, i + 1),
        };
    }) : [];

    // Reports and misses by checkpoint
    const cps = db.checkpoints.map((c) => ({
        name: c.name,
        n: reports.filter((r) => r.checkpoint === c.id).length,
        missed: missed.filter((r) => r.checkpoint === c.id).length,
    })).filter((c) => c.n || c.missed);

    // Most-checked stops
    const stops = Object.keys(STOP_WEIGHT).map(Number).map((id) => {
        const rows = looked.filter((l) => l.stop === id);
        const hours = new Map();
        rows.forEach((l) => hours.set(l.hour, (hours.get(l.hour) || 0) + l.count));
        const busiest = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];
        return { name: store.checkpoint(id)?.name, n: rows.reduce((x, l) => x + l.count, 0), busiest: busiest ? hourRange(busiest[0]) : '—' };
    }).filter((s) => s.name && s.n).sort((a, b) => b.n - a.n).slice(0, 6);

    const posts = db.posts.filter((p) => ['live', 'expired'].includes(postStatus(p, now))).sort((a, b) => b.views - a.views).slice(0, 4);
    const label = period === 'today' ? `${fmt.shortDate(now)}` : `${fmt.shortDate(from).replace(/, \d+$/, '')} to ${fmt.shortDate(now)}`;

    const content = `${alert('info', 'Planned for Increment 4 of the real system. In this demo, the reports come from the simulated buses and inspectors, and passenger lookups are simulated too.', { title: 'Preview', cls: 'mb-5' })}
<form class="card mb-6" style="padding:16px 20px" data-analytics-form><div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end">
${segmented({ label: 'Period', name: 'period', options: [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']], selected: period })}
<div style="min-width:280px">${select({ label: 'Route', name: 'route', options: [['all', 'All routes'], ...routes.map((r) => [r.id, r.name])], selected: routeId })}</div>
<p class="muted" style="margin:0 0 10px">${esc(label)}</p></div></form>
<div class="bento mb-6">
${stat('Checkpoint reports', reports.length.toLocaleString('en-US'), { cls: 'span-3' })}
${stat('Completed trips', completed.length.toLocaleString('en-US'), { cls: 'span-3', tone: 'ok' })}
${stat('Buses in service', db.buses.filter((b) => b.active).length, { cls: 'span-3' })}
${stat('Passenger lookups', totalLookups.toLocaleString('en-US'), { cls: 'span-3' })}
</div>
<div class="bento mb-6">
${card({ cls: 'span-6', title: period === 'today' ? 'Reports per hour' : 'Reports per day', subtitle: routeId === 'all' ? 'All checkpoints, all routes' : 'All checkpoints' }, bars(perTime, 520, 190, days > 7 ? 4 : 14))}
${card({ cls: 'span-6', title: 'Passenger lookups by hour', subtitle: 'Bus tracking page, all stops' }, bars(perHour, 520, 190, 6))}
</div>
${card({ flush: true, title: 'Travel time between checkpoints', subtitle: `${route?.name ?? ''}, actual minutes from consecutive reports of the same bus` }, `<table class="data-table" data-stack="md"><thead><tr><th>Segment</th><th class="num">Distance</th><th class="num">Trips</th><th class="num">Average</th><th class="num">Shortest</th><th class="num">Longest</th><th class="num">Used for estimates</th></tr></thead><tbody>
${segments.map((s) => `<tr><td data-label="Segment" class="font-semibold">${esc(s.name)}</td><td data-label="Distance" class="num">${fmt.km(s.km)} km</td><td data-label="Trips" class="num">${s.trips}</td><td data-label="Average" class="num">${s.avg ?? '—'}${s.avg !== null ? ' min' : ''}</td><td data-label="Shortest" class="num">${s.min ?? '—'}${s.min !== null ? ' min' : ''}</td><td data-label="Longest" class="num">${s.max ?? '—'}${s.max !== null ? ' min' : ''}</td><td data-label="Used for estimates" class="num">${s.used} min ${s.avg !== null && s.avg - s.used >= 3 ? badge('warn', `+${s.avg - s.used} min`) : ''}</td></tr>`).join('')}
</tbody></table>`)}
<div class="bento mt-6">
${card({ flush: true, cls: 'span-4', title: 'Reports by checkpoint' }, `<table class="data-table"><thead><tr><th>Checkpoint</th><th class="num">Reports</th><th class="num">Missed</th></tr></thead><tbody>${cps.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.n}</td><td class="num">${c.missed ? badge('warn', `${c.missed}`) : '—'}</td></tr>`).join('')}</tbody></table>`)}
${card({ flush: true, cls: 'span-4', title: 'Most-checked waiting stops' }, `<table class="data-table"><thead><tr><th>Stop</th><th class="num">Lookups</th><th class="num">Busiest hour</th></tr></thead><tbody>${stops.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">${s.n}</td><td class="num">${s.busiest}</td></tr>`).join('')}</tbody></table>`)}
${card({ flush: true, cls: 'span-4', title: 'Announcement reach' }, `<table class="data-table"><thead><tr><th>Announcement</th><th class="num">Views</th></tr></thead><tbody>${posts.map((p) => `<tr><td>${esc(p.title)}</td><td class="num">${p.views}</td></tr>`).join('')}</tbody></table>`)}
</div>
<p class="field-hint mt-4">“Missed” counts trips that passed a checkpoint without a report, so the travel time across it can't be measured.</p>`;

    return adminLayout({
        title: 'Analytics', active: 'analytics', heading: 'Analytics',
        intro: 'Travel times, reporting activity, and passenger interest built from the stored checkpoint reports and anonymous lookups.',
        actions: button({ variant: 'secondary', attrs: `data-csv="${period}|${routeId}"` }, 'Download CSV reports'),
        content,
    });
}

export function analyticsBehaviour() {
    document.querySelector('[data-analytics-form]')?.addEventListener('change', (event) => {
        const query = new URLSearchParams(new FormData(event.currentTarget));
        location.href = `admin-analytics.html?${query}`;
    });
    document.querySelector('[data-csv]')?.addEventListener('click', (event) => {
        const [period, routeId] = event.currentTarget.dataset.csv.split('|');
        const now = Date.now();
        const days = period === 'today' ? 1 : +period;
        const from = fmt.startOfDay(now) - (days - 1) * DAY;
        const rows = allReports(now).filter((r) => r.at >= from && (routeId === 'all' || r.route === +routeId));
        const csv = [['Time', 'Bus', 'Direction', 'Checkpoint', 'Inspector'], ...rows.map((r) => [
            `${fmt.ymd(r.at)} ${fmt.time(r.at)}`, store.busLabel(store.bus(r.bus)), store.route(r.route)?.name, store.checkpoint(r.checkpoint)?.name, store.user(r.user)?.name ?? '',
        ])].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
        link.download = `byahengpabama-reports-${fmt.ymd(now)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
}
