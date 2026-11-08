// Simulated buses, and the app's tracking rules (App\Services\BusTracker).
//
// Every simulated bus shuttles between CDO Agora Terminal and Kibawe around
// the clock, starting from a fixed date, with random but repeatable travel
// and stop times. Each time it reaches a checkpoint, the inspector posted
// there "reports" it, exactly like the real system receives reports. About
// 3% of reports are "missed", as happens in real life. Reports filed on the
// demo's inspector page are added on top.
import { load, route, checkpoint, setting } from './store.js';

const MIN = 60e3;
const EPOCH = Date.parse('2026-10-01T00:00:00+08:00');
const KEEP_DAYS = 31; // reports older than this aren't needed by any page

// Slower segments (km/h), e.g. the climb out of Cagayan de Oro.
const SPEED = { '1-2': 36, '2-3': 41 };
const speedFor = (a, b) => SPEED[[a, b].sort((x, y) => x - y).join('-')] || 47;

function generator(...keys) {
    let h = 2166136261;
    keys.join('|').split('').forEach((c) => { h = Math.imul(h ^ c.charCodeAt(0), 16777619); });
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let cache = { key: null, value: null };

/** All simulated reports up to now (including missed ones, flagged). */
export function simulatedReports(now = Date.now()) {
    const db = load();
    const key = [Math.floor(now / MIN), JSON.stringify(db.routes), db.buses.map((b) => `${b.id}${b.simulated ? 's' : ''}`).join(),
        db.users.map((u) => `${u.id}:${u.post}`).join()].join('#');
    if (cache.key === key) return cache.value;

    const there = route(1);
    const back = route(2);
    const reports = [];
    const since = now - KEEP_DAYS * 86400e3;
    const inspectorAt = new Map(db.users.filter((u) => u.post).map((u) => [u.post, u.id]));

    if (there && back && there.stops.length > 1 && back.stops.length > 1) {
        db.buses.filter((b) => b.simulated).forEach((bus) => {
            let start = EPOCH + (bus.id - 1) * 37 * MIN;
            let r = bus.id % 2 === 1 ? there : back;
            for (let trip = 0; start <= now; trip++) {
                const rnd = generator(bus.id, trip);
                const add = (i, at, missed = false) => {
                    if (at > now || at < since) return;
                    const cp = r.stops[i].checkpoint;
                    reports.push({
                        id: `s${bus.id}-${trip}-${i}`, bus: bus.id, route: r.id, checkpoint: cp, at: Math.round(at),
                        user: inspectorAt.get(cp) ?? null, missed, sim: true,
                    });
                };
                add(0, start + rnd() * 2 * MIN); // boarding at the terminal
                let clock = start + (4 + rnd() * 6) * MIN; // leaves the terminal
                for (let i = 1; i < r.stops.length; i++) {
                    const km = Math.abs(r.stops[i].km - r.stops[i - 1].km);
                    const speed = speedFor(r.stops[i - 1].checkpoint, r.stops[i].checkpoint) * (0.9 + rnd() * 0.22);
                    clock += (km / speed) * 60 * MIN;
                    const last = i === r.stops.length - 1;
                    add(i, clock + rnd() * 1.5 * MIN, !last && rnd() < 0.03);
                    if (!last) clock += (2 + rnd() * 4) * MIN; // passengers getting on and off
                }
                start = clock + (40 + rnd() * 30) * MIN; // rest, then boarding for the trip back
                r = r === there ? back : there;
            }
        });
    }

    reports.sort((a, b) => a.at - b.at);
    cache = { key, value: reports };
    return reports;
}

/** Every report a person would see: simulated ones that weren't missed, plus ones filed here. */
export function allReports(now = Date.now()) {
    const filed = load().reports.filter((r) => r.at <= now);
    return simulatedReports(now).filter((r) => !r.missed).concat(filed).sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------- BusTracker

export function travelMinutes(km) {
    return Math.round((km / setting('eta.average_speed_kph')) * 60);
}

/** Scheduled minutes when both stops have them, otherwise distance at the average speed. */
export function minutesBetween(r, i, j) {
    const a = r.stops[i].minutes;
    const b = r.stops[j].minutes;
    if (a !== null && a !== undefined && b !== null && b !== undefined) return Math.abs(b - a);
    return travelMinutes(Math.abs(r.stops[j].km - r.stops[i].km));
}

/** Position of every bus in service, from its latest report. */
export function positions(now = Date.now()) {
    const db = load();
    const latest = new Map();
    allReports(now).forEach((report) => latest.set(report.bus, report));
    const staleAfter = setting('eta.stale_after_minutes') * MIN;

    return db.buses.filter((b) => b.active)
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
        .map((bus) => {
            const report = latest.get(bus.id) || null;
            if (!report || now - report.at > staleAfter) return { bus, report, status: 'none' };
            const r = route(report.route);
            const idx = r ? r.stops.findIndex((s) => s.checkpoint === report.checkpoint) : -1;
            if (idx < 0) return { bus, report, status: 'none' };
            const status = idx === 0 ? 'terminal' : idx === r.stops.length - 1 ? 'arrived' : 'transit';
            return { bus, report, route: r, idx, checkpoint: checkpoint(report.checkpoint), status };
        });
}

/** Buses on the route that haven't passed the stop yet, soonest first, with ETAs. */
export function approaching(r, stopId, now = Date.now()) {
    const stopIdx = r.stops.findIndex((s) => s.checkpoint === +stopId);
    if (stopIdx < 0) return [];
    const dwell = setting('eta.dwell_minutes') * MIN;
    const incoming = setting('eta.incoming_within_minutes');

    return positions(now)
        .filter((p) => p.route && p.route.id === r.id && p.status !== 'arrived' && p.idx <= stopIdx
            && !(p.idx === stopIdx && p.status !== 'terminal' && p.report.at < now - dwell))
        .map((p) => {
            let minutes = minutesBetween(r, p.idx, stopIdx);
            // A bus waiting at the terminal hasn't started moving yet.
            if (p.status !== 'terminal') minutes = Math.max(0, minutes - Math.floor((now - p.report.at) / MIN));
            const status = p.status === 'transit' && minutes <= incoming ? 'incoming' : p.status;
            return { ...p, status, eta: minutes };
        })
        .sort((a, b) => a.eta - b.eta);
}

/** Where a bus probably is, as a stop index with a fraction, for the route line. */
export function progress(p, now = Date.now()) {
    if (!p.route) return null;
    const next = p.route.stops[p.idx + 1];
    if ((p.status !== 'transit' && p.status !== 'incoming') || !next) return p.idx;
    const expected = Math.max(1, minutesBetween(p.route, p.idx, p.idx + 1));
    const elapsed = (now - p.report.at) / MIN;
    return p.idx + Math.min(0.9, Math.max(0, elapsed / expected));
}

/** Buses moving on, or waiting to leave on, the given route (route line markers). */
export function onRoute(r, now = Date.now()) {
    return positions(now).filter((p) => p.route && p.route.id === r.id && (p.status === 'transit' || p.status === 'terminal'));
}

export const STATUS_LABEL = { terminal: 'At Terminal', transit: 'In Transit', incoming: 'Incoming', arrived: 'Arrived', none: 'No recent report' };
export const STATUS_TONE = { transit: 'ok', incoming: 'warn', terminal: 'info' };
