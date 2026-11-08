// Dates and times as the app shows them, always in Philippine time.
import { __, lang } from './i18n.js';

const TZ = 'Asia/Manila';
const MONTHS_FIL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const partsFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
});

/** {y, m (1-12), d, H, i} in Manila time. */
export function parts(ms) {
    const p = {};
    partsFormat.formatToParts(new Date(ms)).forEach(({ type, value }) => { p[type] = value; });
    return { y: +p.year, m: +p.month, d: +p.day, H: +p.hour % 24, i: +p.minute };
}

/** Midnight (Manila) of the day containing ms. */
export function startOfDay(ms) {
    const p = parts(ms);
    return Date.UTC(p.y, p.m - 1, p.d) - 8 * 3600e3;
}

const pad = (n) => String(n).padStart(2, '0');

/** "2:36 PM" (PHP g:i A) */
export function time(ms) {
    const { H, i } = parts(ms);
    return `${H % 12 || 12}:${pad(i)} ${H < 12 ? 'AM' : 'PM'}`;
}

/** "Nov 8, 2:36 PM" (PHP M j, g:i A) */
export function shortDateTime(ms) {
    const p = parts(ms);
    return `${MONTHS_EN[p.m - 1].slice(0, 3)} ${p.d}, ${time(ms)}`;
}

/** "Mar 19, 2026" (PHP M j, Y) */
export function shortDate(ms) {
    const p = parts(ms);
    return `${MONTHS_EN[p.m - 1].slice(0, 3)} ${p.d}, ${p.y}`;
}

/** "November 7, 2026" / "Nobyembre 7, 2026" (isoFormat LL) */
export function longDate(ms) {
    const p = parts(ms);
    return `${(lang === 'fil' ? MONTHS_FIL : MONTHS_EN)[p.m - 1]} ${p.d}, ${p.y}`;
}

/** "November 7, 2026 7:30 AM" / "Nobyembre 7, 2026 7:30 N.U." (isoFormat LLL) */
export function longDateTime(ms) {
    const { H, i } = parts(ms);
    const clock = `${H % 12 || 12}:${pad(i)}`;
    const meridiem = lang === 'fil' ? (H < 12 ? 'N.U.' : 'N.H.') : (H < 12 ? 'AM' : 'PM');
    return `${longDate(ms)} ${clock} ${meridiem}`;
}

/** "Y-m-d" in Manila time, for date inputs. */
export function ymd(ms) {
    const p = parts(ms);
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** "Y-m-dTH:i" for datetime-local inputs. */
export function ymdhi(ms) {
    const p = parts(ms);
    return `${ymd(ms)}T${pad(p.H)}:${pad(p.i)}`;
}

/** Parse a date or datetime-local value as Manila time. */
export function parseLocal(value) {
    if (!value) return null;
    const [date, clock = '00:00'] = value.split('T');
    const ms = Date.parse(`${date}T${clock.slice(0, 5)}:00+08:00`);
    return Number.isNaN(ms) ? null : ms;
}

const UNITS = [
    ['year', 365 * 86400, 'taon', 'y'], ['month', 30 * 86400, 'buwan', 'mo'], ['week', 7 * 86400, 'linggo', 'w'],
    ['day', 86400, 'araw', 'd'], ['hour', 3600, 'oras', 'h'], ['minute', 60, 'minuto', 'm'], ['second', 1, 'segundo', 's'],
];

/** "13 minutes ago" / "13 minuto ang nakalipas"; short: "13m ago" (Carbon diffForHumans). */
export function ago(ms, now = Date.now(), short = false) {
    const seconds = Math.max(0, Math.floor((now - ms) / 1000));
    const [unit, size, fil, abbr] = UNITS.find(([, s]) => seconds >= s) || UNITS[UNITS.length - 1];
    const n = Math.max(seconds >= 1 ? 1 : 0, Math.floor(seconds / size));
    if (short) return `${n}${abbr} ago`;
    if (lang === 'fil') return `${n} ${fil} ang nakalipas`;
    return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/** "18 min", "1 hr 5 min" (App\Support\Duration) */
export function duration(minutes) {
    if (minutes < 60) return __(':count min', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? __(':hours hr', { hours }) : __(':hours hr :minutes min', { hours, minutes: rest });
}

/** "12.00" with thousands separators (number_format) */
export function money(amount) {
    return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "5", "2.5" (rtrim(number_format(x, 1), '0.')) */
export function km(value) {
    return String(Math.round(value * 10) / 10);
}
