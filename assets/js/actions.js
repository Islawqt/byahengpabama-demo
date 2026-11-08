// What happens when a staff form is sent: the same checks and messages as the
// app's controllers, saved to the demo data in this browser.
// Each handler returns { errors, old } to redraw the page with errors, or
// { go: 'page.html' } after saving (the message shows on the next page).
import * as store from './store.js';
import * as fmt from './fmt.js';
import { allReports } from './sim.js';
import { CATEGORIES } from './pages-public.js';

const MIN = 60e3;
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const done = (message, go) => { store.flash(message); store.save(); return { go }; };

export const ACTIONS = {
    report(d) {
        const db = store.load();
        const me = store.currentUser();
        const errors = {};
        const bus = store.bus(d.bus_id);
        const route = store.route(d.bus_route_id);
        if (!bus || !bus.active) errors.bus_id = 'The selected bus id is invalid.';
        if (!d.checkpoint_id) errors.checkpoint_id = 'Pick the checkpoint the bus passed.';
        if (Object.keys(errors).length || !route) return { errors, old: d };
        if (!route.stops.some((s) => s.checkpoint === +d.checkpoint_id)) {
            return { errors: { checkpoint_id: `That checkpoint is not on the ${route.name} route.` }, old: d };
        }
        const cp = store.checkpoint(d.checkpoint_id);
        const now = Date.now();
        const window = store.setting('reports.duplicate_minutes') * MIN;
        const duplicate = allReports(now).some((r) => r.bus === bus.id && r.checkpoint === cp.id && r.route === route.id && r.at >= now - window);
        if (duplicate) return done(`${store.busLabel(bus)} was already marked at ${cp.name} a moment ago.`, 'inspector.html');
        db.reports.push({ id: `m${now}`, bus: bus.id, route: route.id, checkpoint: cp.id, at: now, user: me.id });
        return done(`${store.busLabel(bus)} marked at ${cp.name}.`, 'inspector.html');
    },

    'bus-store'(d) {
        const db = store.load();
        const errors = {};
        const number = (d.number || '').trim();
        const plate = (d.plate_number || '').trim() || null;
        if (!number) errors.number = 'The number field is required.';
        else if (db.buses.some((b) => b.number === number)) errors.number = 'The number has already been taken.';
        if (plate && db.buses.some((b) => b.plate === plate)) errors.plate_number = 'The plate number has already been taken.';
        if (Object.keys(errors).length) return { errors, old: d };
        db.buses.push({ id: store.nextId(db.buses), number, plate, class: d.class, active: true, simulated: false });
        return done(`Bus ${number} added.`, 'admin-buses.html');
    },

    'bus-update'(d, id) {
        const db = store.load();
        const bus = store.bus(id);
        const plate = (d.plate_number || '').trim() || null;
        if (plate && db.buses.some((b) => b.plate === plate && b.id !== bus.id)) {
            return { errors: { [`bus${bus.id}`]: { plate_number: 'The plate number has already been taken.' } } };
        }
        bus.plate = plate;
        bus.class = d.class;
        return done(`${store.busLabel(bus)} saved.`, 'admin-buses.html');
    },

    'bus-toggle'(d, id) {
        const bus = store.bus(id);
        bus.active = !bus.active;
        return done(bus.active ? `${store.busLabel(bus)} is back in service.` : `${store.busLabel(bus)} taken out of service.`, 'admin-buses.html');
    },

    'fare-store'(d) {
        const db = store.load();
        const e = {};
        const need = (key, label, max) => {
            const v = num(d[key]);
            if (v === null || Number.isNaN(v)) e[key] = `The ${label} field is required.`;
            else if (v < 0 || v > max) e[key] = `The ${label} field must be between 0 and ${max}.`;
            return v;
        };
        const base = need('base_fare', 'base fare', 9999);
        const baseKm = need('base_km', 'base km', 999);
        const perKm = need('rate_per_succeeding_km', 'rate per succeeding km', 999);
        const discount = need('discount_percent', 'discount percent', 100);
        if (!(d.source_reference || '').trim()) e.source_reference = 'The source reference field is required.';
        const effective = fmt.parseLocal(d.effective_date);
        if (!effective) e.effective_date = 'The effective date field is required.';
        else if (db.fares.some((f) => f.class === d.bus_class && f.effective === effective)) e.effective_date = 'The effective date has already been taken.';
        if (d.official_pdf_url && !/^https?:\/\//.test(d.official_pdf_url)) e.official_pdf_url = 'The official pdf url field must be a valid URL.';
        if (Object.keys(e).length) return { errors: { fare: e } };
        db.fares.push({
            id: store.nextId(db.fares), class: d.bus_class, base, baseKm, perKm, discount: discount / 100, rounding: d.rounding,
            source: d.source_reference.trim(), pdf: d.official_pdf_url || null, effective,
        });
        const when = effective > Date.now() ? `from ${fmt.shortDate(effective)}` : 'now';
        return done(`${store.classLabel(d.bus_class)} fare saved; it applies ${when}.`, 'admin-routes.html');
    },

    'fare-destroy'(d, id) {
        const db = store.load();
        db.fares = db.fares.filter((f) => f.id !== +id);
        return done('Fare schedule removed.', 'admin-routes.html');
    },

    'route-stops'(d, id, form) {
        const db = store.load();
        const route = store.route(id);
        const rows = [];
        form.querySelectorAll('[name$="[checkpoint_id]"]').forEach((input) => {
            const i = input.name.match(/stops\[(\d+)\]/)[1];
            const get = (k) => form.querySelector(`[name="stops[${i}][${k}]"]`);
            if (!input.value || get('remove')?.checked) return;
            rows.push({ checkpoint: +input.value, km: num(get('km').value), minutes: num(get('minutes').value) });
        });
        const fail = (message) => ({ errors: { [`route${route.id}`]: message } });
        if (new Set(rows.map((r) => r.checkpoint)).size !== rows.length) return fail('A checkpoint can only appear once on a route.');
        if (rows.some((r) => r.km === null)) return fail('Every stop needs its km from the start.');
        if (rows.length < 2) return fail('A route needs at least two stops.');
        rows.sort((a, b) => a.km - b.km);
        if (rows[0].km !== 0) return fail('The first stop must be at 0 km.');
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].km <= rows[i - 1].km) return fail('Each stop must be further along (more km) than the one before.');
            const [a, b] = [rows[i - 1].minutes, rows[i].minutes];
            if (a !== null && b !== null && b <= a) return fail('Scheduled minutes must also increase along the route.');
        }
        const oldIds = route.stops.map((s) => s.checkpoint);
        const back = db.routes.find((r) => r.id !== route.id && JSON.stringify(r.stops.map((s) => s.checkpoint).reverse()) === JSON.stringify(oldIds));
        route.stops = rows;
        if (d.mirror && back) {
            const total = rows[rows.length - 1].km;
            const totalMinutes = rows[rows.length - 1].minutes;
            back.stops = [...rows].reverse().map((s) => ({
                checkpoint: s.checkpoint,
                km: Math.round((total - s.km) * 10) / 10,
                minutes: s.minutes !== null && totalMinutes !== null ? totalMinutes - s.minutes : null,
            }));
        }
        return done(`Stops for "${route.name}" saved.`, 'admin-routes.html');
    },

    'checkpoint-store'(d) {
        const db = store.load();
        const e = {};
        const code = (d.code || '').trim();
        if (!code) e.code = 'The code field is required.';
        else if (!/^[a-z0-9]+$/i.test(code)) e.code = 'The code field must only contain letters and numbers.';
        else if (db.checkpoints.some((c) => c.code.toLowerCase() === code.toLowerCase())) e.code = 'The code has already been taken.';
        if (!(d.name || '').trim()) e.name = 'The name field is required.';
        if (Object.keys(e).length) return { errors: { checkpoint: e } };
        const cp = { id: store.nextId(db.checkpoints), code: code.toUpperCase(), name: d.name.trim(), location: (d.location || '').trim() || null };
        db.checkpoints.push(cp);
        return done(`Checkpoint ${cp.name} added. Add it to a route's stops to use it.`, 'admin-routes.html');
    },

    'checkpoint-update'(d, id) {
        const db = store.load();
        const cp = store.checkpoint(id);
        const name = (d.name || '').trim();
        if (!name) return { errors: { [`checkpoint${cp.id}`]: { name: 'The name field is required.' } } };
        if (db.checkpoints.some((c) => c.id !== cp.id && c.name === name)) return { errors: { [`checkpoint${cp.id}`]: { name: 'The name has already been taken.' } } };
        cp.name = name;
        cp.location = (d.location || '').trim() || null;
        return done(`Checkpoint ${cp.name} saved.`, 'admin-routes.html');
    },

    'route-store'(d) {
        const db = store.load();
        const e = {};
        const name = (d.name || '').trim();
        const km = num(d.km);
        if (!name) e.name = 'The name field is required.';
        else if (db.routes.some((r) => r.name === name)) e.name = 'The name has already been taken.';
        if (!d.origin_id || !d.destination_id) e.destination_id = 'Choose the first and last stops.';
        else if (d.origin_id === d.destination_id) e.destination_id = 'The destination id field and origin id must be different.';
        if (km === null || !(km > 0)) e.km = 'The km field must be greater than 0.';
        if (Object.keys(e).length) return { errors: { route: e } };
        db.routes.push({ id: store.nextId(db.routes), name, stops: [{ checkpoint: +d.origin_id, km: 0, minutes: null }, { checkpoint: +d.destination_id, km, minutes: null }] });
        return done(`Route "${name}" added. Add the stops in between below.`, 'admin-routes.html');
    },

    'post-save'(d, id) {
        const db = store.load();
        const now = Date.now();
        const e = {};
        if (!(d.title || '').trim()) e.title = 'The title field is required.';
        if (!(d.body || '').trim()) e.body = 'The body field is required.';
        const publishAt = fmt.parseLocal(d.publish_at);
        const expires = fmt.parseLocal(d.expires_at);
        if (d.publish === 'schedule' && !publishAt) e.publish_at = 'Choose when to publish it.';
        else if (d.publish === 'schedule' && publishAt <= now) e.publish_at = 'Pick a time in the future, or choose "Publish now".';
        if (expires && expires <= now) e.expires_at = 'The end date must be in the future.';
        if (!CATEGORIES.includes(d.category)) e.category = 'The selected category is invalid.';
        const values = {
            category: d.category, title: (d.title || '').trim(), body: (d.body || '').trim(),
            titleFil: (d.title_fil || '').trim() || null, bodyFil: (d.body_fil || '').trim() || null,
            pinned: !!d.is_pinned, expires: expires || null,
        };
        if (Object.keys(e).length) return { errors: e, old: { ...values, publish: d.publish, publish_at: d.publish_at } };
        let post = id ? store.post(id) : null;
        if (!post) {
            post = { id: store.nextId(db.posts), views: 0 };
            db.posts.push(post);
        }
        const keep = post.published && post.published <= now ? post.published : now;
        Object.assign(post, values, { published: d.publish === 'draft' ? null : d.publish === 'schedule' ? publishAt : keep });
        const message = post.published === null ? "Saved as a draft. Passengers can't see it yet."
            : post.published > now ? `Scheduled for ${fmt.shortDateTime(post.published)}.` : 'Published. Passengers can see it now.';
        return done(message, 'admin-bulletins.html');
    },

    'post-pin'(d, id) {
        const post = store.post(id);
        post.pinned = !post.pinned;
        return done(post.pinned ? 'Pinned to the top.' : 'Unpinned.', 'admin-bulletins.html');
    },

    'post-unpublish'(d, id) {
        const post = store.post(id);
        post.published = null;
        return done(`"${post.title}" is now a draft and hidden from passengers.`, 'admin-bulletins.html');
    },

    'post-destroy'(d, id) {
        const db = store.load();
        db.posts = db.posts.filter((p) => p.id !== +id);
        return done('Post deleted.', 'admin-bulletins.html');
    },

    'account-store'(d) {
        const db = store.load();
        const e = {};
        const email = (d.email || '').trim().toLowerCase();
        if (!(d.name || '').trim()) e.name = 'The name field is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'The email field must be a valid email address.';
        else if (db.users.some((u) => u.email === email)) e.email = 'The email has already been taken.';
        if ((d.password || '').length < 8) e.password = 'The password field must be at least 8 characters.';
        else if (d.password !== d.password_confirmation) e.password = 'The password field confirmation does not match.';
        if (Object.keys(e).length) return { errors: e, old: d };
        const account = { id: store.nextId(db.users), name: d.name.trim(), email, role: d.role, post: null, password: d.password, mustChange: true };
        db.users.push(account);
        return done(`${store.roleLabel(account.role)} account created for ${account.name}. Give them the temporary password; they will choose their own when they first log in.`, 'admin-accounts.html');
    },

    'account-password'(d, id) {
        const account = store.user(id);
        let error = null;
        if ((d.password || '').length < 8) error = 'The password field must be at least 8 characters.';
        else if (d.password !== d.password_confirmation) error = 'The password field confirmation does not match.';
        if (error) return { errors: { [`reset${account.id}`]: { password: error } } };
        account.password = d.password;
        account.mustChange = true;
        return done(`Temporary password set for ${account.name}. They must choose their own at next login.`, 'admin-accounts.html');
    },

    'account-destroy'(d, id) {
        const db = store.load();
        const account = store.user(id);
        if (account.id === store.currentUser().id) return { errors: { account: 'You cannot delete your own account.' } };
        if (account.role === 'admin' && db.users.filter((u) => u.role === 'admin').length === 1) return { errors: { account: 'You cannot delete the last admin account.' } };
        db.users = db.users.filter((u) => u.id !== account.id);
        return done(`Account for ${account.name} deleted.`, 'admin-accounts.html');
    },

    settings(d) {
        const db = store.load();
        const e = {};
        const values = {};
        Object.entries(store.SETTINGS).forEach(([key, def]) => {
            const name = key.replace('.', '_');
            if (typeof def.default === 'boolean') {
                values[key] = !!d[name];
                return;
            }
            const v = num(d[name]);
            if (v === null || !Number.isInteger(v)) e[name] = `The ${def.label.toLowerCase()} field must be a whole number.`;
            else if (v < def.min || v > def.max) e[name] = `The ${def.label.toLowerCase()} field must be between ${def.min} and ${def.max}.`;
            else values[key] = v;
        });
        if (Object.keys(e).length) return { errors: e };
        Object.assign(db.settings, values);
        return done('Settings saved.', 'admin-settings.html');
    },
};
