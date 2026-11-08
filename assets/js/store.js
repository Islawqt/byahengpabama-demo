// The demo "database": sample records like the app's demo mode, kept in this
// browser's localStorage. Changes made in the admin and inspector pages are
// saved here, so they show on the other pages of the same browser only.
import POSTS from './posts.js';

const KEY = 'bp-demo-v1';
const SESSION = 'bp-demo-session';
const MAX_AGE_DAYS = 7; // older demo data is replaced with fresh sample data

const CHECKPOINTS = [
    [1, 'CDO', 'CDO Agora Terminal', 'Cagayan de Oro City'],
    [2, 'MFT', 'Manolo Fortich', 'Manolo Fortich, Bukidnon'],
    [3, 'MLY', 'Malaybalay', 'Malaybalay City, Bukidnon'],
    [4, 'VLC', 'Valencia', 'Valencia City, Bukidnon'],
    [5, 'MRG', 'Maramag', 'Maramag, Bukidnon'],
    [6, 'DCR', 'Don Carlos', 'Don Carlos, Bukidnon'],
    [7, 'KBW', 'Kibawe', 'Kibawe, Bukidnon'],
];

// km from CDO Agora Terminal (the app's seed values, marked VERIFY there too).
const KM_FROM_CDO = { 1: 0, 2: 28, 3: 92, 4: 108, 5: 131, 6: 150, 7: 178 };

const BUSES = [
    ['101', 'KAB 3101', 'ordinary'], ['102', 'KAB 3102', 'ordinary'], ['103', 'KAC 5103', 'aircon'],
    ['104', 'KAB 3104', 'ordinary'], ['105', 'KAB 3105', 'ordinary'], ['106', 'KAC 5106', 'aircon'],
    ['107', 'KAB 3107', 'ordinary'], ['108', 'KAB 3108', 'ordinary'], ['109', 'KAB 3109', 'ordinary'],
    ['110', 'KAC 5110', 'aircon'], ['111', 'KAB 3111', 'ordinary'], ['112', 'KAB 3112', 'ordinary'],
];

// Fictional staff. Each inspector is posted at one checkpoint.
const USERS = [
    [1, 'Demo Admin', 'admin@demo.test', 'admin', null],
    [2, 'Ramon Dela Cruz', 'inspector1@demo.test', 'inspector', 4],
    [3, 'Liza Magbanua', 'inspector2@demo.test', 'inspector', 3],
    [4, 'Arnel Villaruz', 'inspector3@demo.test', 'inspector', 5],
    [5, 'Jun Abellana', 'inspector4@demo.test', 'inspector', 1],
    [6, 'Grace Tumulak', 'inspector5@demo.test', 'inspector', 2],
    [7, 'Noel Pacana', 'inspector6@demo.test', 'inspector', 6],
    [8, 'Mila Sagaral', 'inspector7@demo.test', 'inspector', 7],
];

export const PASSWORD = 'demo1234';

function seed(now = Date.now()) {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const stops = (order) => order.map((id) => ({
        checkpoint: id,
        km: Math.abs(KM_FROM_CDO[id] - KM_FROM_CDO[order[0]]),
        minutes: null,
    }));
    const at = (minutes) => (minutes === null ? null : now + minutes * 60e3);

    return {
        version: 1,
        seededAt: now,
        checkpoints: CHECKPOINTS.map(([id, code, name, location]) => ({ id, code, name, location })),
        routes: [
            { id: 1, name: 'CDO Agora Terminal → Kibawe', stops: stops(ids) },
            { id: 2, name: 'Kibawe → CDO Agora Terminal', stops: stops([...ids].reverse()) },
        ],
        buses: BUSES.map(([number, plate, cls], i) => ({
            id: i + 1, number, plate, class: cls, active: number !== '112', simulated: number !== '112',
        })),
        fares: [
            {
                id: 1, class: 'ordinary', base: 12, baseKm: 5, perKm: 2.2, discount: 0.2, rounding: 'none',
                source: 'LTFRB provincial fare adjustment, eff. 19 Mar 2026 — VERIFY MC no.', pdf: null,
                effective: Date.parse('2026-03-19T00:00:00+08:00'),
            },
            {
                id: 2, class: 'aircon', base: 12.25, baseKm: 5, perKm: 2.45, discount: 0.2, rounding: 'none',
                source: 'LTFRB provincial fare adjustment, eff. 19 Mar 2026 — VERIFY MC no.', pdf: null,
                effective: Date.parse('2026-03-19T00:00:00+08:00'),
            },
        ],
        posts: POSTS.map((p) => ({
            id: p.id, category: p.category, title: p.title, titleFil: p.title_fil, body: p.body, bodyFil: p.body_fil,
            published: at(p.published), expires: at(p.expires), pinned: p.pinned,
            views: 150 + ((p.id * 7919) % 700),
        })),
        users: USERS.map(([id, name, email, role, post]) => ({
            id, name, email, role, post, password: PASSWORD, mustChange: false,
        })),
        settings: {},
        reports: [], // reports filed in this browser (the rest are simulated)
        lookups: [], // passenger lookups made in this browser
    };
}

let db = null;

export function load() {
    if (db) return db;
    try {
        db = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
        db = null;
    }
    if (!db || db.version !== 1 || Date.now() - db.seededAt > MAX_AGE_DAYS * 86400e3) {
        db = seed();
        save();
    }
    return db;
}

export function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
        // Storage full or blocked: changes last until the page is closed.
    }
}

export function reset() {
    db = seed();
    save();
    try {
        localStorage.removeItem(SESSION);
        sessionStorage.removeItem(SESSION);
    } catch (e) { /* ignore */ }
}

export function nextId(list) {
    return list.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

// ---------------------------------------------------------------- lookups by id
export const checkpoint = (id) => load().checkpoints.find((c) => c.id === +id) || null;
export const route = (id) => load().routes.find((r) => r.id === +id) || null;
export const bus = (id) => load().buses.find((b) => b.id === +id) || null;
export const user = (id) => load().users.find((u) => u.id === +id) || null;
export const post = (id) => load().posts.find((p) => p.id === +id) || null;

export const busLabel = (b) => `Bus ${b.number}`;
export const classLabel = (cls) => (cls === 'aircon' ? 'Aircon' : 'Ordinary');
export const roleLabel = (role) => (role === 'admin' ? 'Admin' : 'Line Inspector');

// ---------------------------------------------------------------- settings
export const SETTINGS = {
    'eta.average_speed_kph': { default: 40, min: 10, max: 100, unit: 'km/h', label: 'Average bus speed', hint: 'Used for ETAs between stops that have no scheduled travel time.' },
    'eta.incoming_within_minutes': { default: 15, min: 1, max: 120, unit: 'minutes', label: 'Show "Incoming" within', hint: "A moving bus this close to the passenger's stop is marked Incoming." },
    'eta.stale_after_minutes': { default: 240, min: 30, max: 1440, unit: 'minutes', label: 'Treat a report as too old after', hint: 'Older reports are ignored for passengers and flagged for admins.' },
    'eta.dwell_minutes': { default: 5, min: 1, max: 60, unit: 'minutes', label: 'A bus at your stop has left after', hint: "After this long, a bus reported at the passenger's own stop is assumed gone." },
    'reports.duplicate_minutes': { default: 2, min: 1, max: 30, unit: 'minutes', label: 'Ignore repeat taps within', hint: 'A second report for the same bus and checkpoint this soon is not saved again.' },
    'routes.distances_verified': { default: false, label: 'Distances match the official fare matrix', hint: "Tick once every stop's km has been checked against Pabama's posted matrix." },
};

export function setting(key) {
    const value = load().settings[key];
    return value === undefined ? SETTINGS[key].default : value;
}

// ---------------------------------------------------------------- fares
const ROUND = {
    none: (x) => Math.round(x * 100 + 1e-9) / 100,
    quarter: (x) => Math.round(x * 4 + 1e-9) / 4,
    peso: (x) => Math.round(x + 1e-9),
};
export const ROUNDING_LABELS = { none: 'No rounding (to the centavo)', quarter: 'Nearest ₱0.25', peso: 'Nearest ₱1' };

/** The schedule in force for a class: the latest one whose date has come. */
export function fareSchedule(cls = 'ordinary', now = Date.now()) {
    return load().fares
        .filter((f) => f.class === cls && f.effective <= now)
        .sort((a, b) => b.effective - a.effective || b.id - a.id)[0] || null;
}

export function fare(schedule, distance) {
    const amount = distance <= schedule.baseKm ? schedule.base : schedule.base + (distance - schedule.baseKm) * schedule.perKm;
    return ROUND[schedule.rounding](amount);
}

export function discountedFare(schedule, distance) {
    return ROUND[schedule.rounding](fare(schedule, distance) * (1 - schedule.discount));
}

// ---------------------------------------------------------------- staff session
export function currentUser() {
    let id = null;
    try {
        id = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION);
    } catch (e) { /* ignore */ }
    return id ? user(id) : null;
}

// Kept in localStorage so the demo stays logged in across tabs.
export function logIn(account) {
    try {
        localStorage.setItem(SESSION, String(account.id));
    } catch (e) { /* ignore */ }
}

export function logOut() {
    try {
        localStorage.removeItem(SESSION);
        sessionStorage.removeItem(SESSION);
    } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- one-time messages (like session('status'))
export function flash(message) {
    try { sessionStorage.setItem('bp-demo-flash', message); } catch (e) { /* ignore */ }
}

export function takeFlash() {
    try {
        const message = sessionStorage.getItem('bp-demo-flash');
        sessionStorage.removeItem('bp-demo-flash');
        return message;
    } catch (e) {
        return null;
    }
}
