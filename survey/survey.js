// The evaluation survey. Each response is sent to a Google Apps Script web
// app (see apps-script.gs), which adds it as a row in the Google Sheet. If
// sending fails, the response waits in this browser and is sent again the
// next time the page opens.
import { ENDPOINT } from './config.js?v=3';
import { LANGS, ROLES, AGES, MINOR, PARTS, LINKS, ACCOUNTS, CATEGORIES, T } from './questions.js?v=3';

const app = document.getElementById('app');
const QUEUE = 'bp-survey-queue';
const DONE = 'bp-survey-done';
const LANG = 'bp-survey-lang';
const EN = T.en;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// Each role can get its own link: ?role=passenger, inspector, admin, or it.
const ROLE_KEYS = { passenger: 'Passenger', inspector: 'Line Inspector', admin: 'Admin staff', it: 'IT practitioner' };
const fixedRole = ROLE_KEYS[(new URLSearchParams(location.search).get('role') || '').toLowerCase()] || null;

let lang = LANGS.some((l) => l.code === read(LANG, '')) ? read(LANG, 'en') : 'en';
let t = T[lang];

// ---------------------------------------------------------------- sending

async function send(response) {
    if (!ENDPOINT) throw new Error('No endpoint set');
    // text/plain keeps this a "simple" request, which Apps Script accepts from another site.
    // Network failures throw here and the response is kept on the device.
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(response) });
    let reply = null;
    try { reply = JSON.parse(await res.text()); } catch { throw new Error('No reply'); }
    if (!reply.ok) { const e = new Error(reply.error || 'Rejected'); e.rejected = true; throw e; }
}

async function flushQueue() {
    const waiting = read(QUEUE, []);
    if (!waiting.length || !ENDPOINT) return;
    const left = [];
    for (const r of waiting) {
        try { await send(r); } catch (e) { if (!e.rejected) left.push(r); }
    }
    write(QUEUE, left);
}

// ---------------------------------------------------------------- drawing

// For Filipino and Bisaya, the English statement is shown under the translation.
const original = (text) => (lang === 'en' ? '' : `<span class="sv-orig" lang="en">${esc(text)}</span>`);

const scale = (name) => `<div class="sv-scale">${t.scale.map((label, i) => `<label><input class="choice-input" type="radio" name="${name}" value="${i + 1}"><span class="choice">${i + 1}<small>${esc(label)}</small></span></label>`).join('')}</div>
<div class="sv-ends" aria-hidden="true"><span>${esc(t.ends[0])}</span><span>${esc(t.ends[1])}</span></div>`;

const statement = (name, n, text, en, category = '') => `<fieldset class="sv-item" id="item-${name}">
<legend>${category ? `<span class="sv-cat">${esc(category)}</span>` : ''}${n}. ${esc(text)}${original(en)}</legend>${scale(name)}</fieldset>`;

const choices = (name, list) => list.map(([value, label, hint]) => `<label><input class="choice-input" type="radio" name="${name}" value="${esc(value)}"><span class="choice">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span></label>`).join('');

const langBar = () => `<div class="sv-langs" role="group" aria-label="${esc(t.language)}">${LANGS.map((l) => `<button type="button" class="sv-lang${l.code === lang ? ' is-on' : ''}" data-lang="${l.code}" lang="${l.code === 'ceb' ? 'ceb' : l.code}" aria-pressed="${l.code === lang}">${esc(l.label)}</button>`).join('')}</div>`;

function form() {
    return `${langBar()}
<form id="survey" novalidate>
<section class="card">
    <h1>${esc(t.title)}</h1>
    <p>${esc(t.intro)}</p>
    <p>${esc(t.time)}</p>
    <p class="sv-note">${esc(t.privacy)}</p>
    <label class="check"><input type="checkbox" name="consent" id="consent" required><span>${esc(t.consent)}</span></label>
</section>

<section class="card" id="part-age">
    <p class="sv-step">${esc(t.step)} 1</p>
    <h2>${esc(t.ageTitle)}</h2>
    <fieldset class="sv-item" id="item-age"><legend class="visually-hidden">${esc(t.ageTitle)}</legend>
    <div class="sv-ages">${choices('age', AGES.map((a) => [a, a]).concat([[MINOR, t.minor]]))}</div>
    </fieldset>
    <div id="minor" class="alert sv-hidden" role="status"><div class="alert-body">${esc(t.minorNote)}</div></div>
</section>

<div id="adult" class="sv-hidden sv-stack">
<section class="card${fixedRole ? ' sv-hidden' : ''}" id="part-role">
    <p class="sv-step">${esc(t.step)} 2</p>
    <h2>${esc(t.roleTitle)}</h2>
    <fieldset class="sv-item" id="item-role"><legend class="visually-hidden">${esc(t.roleTitle)}</legend>
    <div class="sv-roles">${choices('role', (fixedRole ? [fixedRole] : ROLES).map((r) => [r, ...t.roles[r]]))}</div>
    </fieldset>
</section>

<div id="rest" class="sv-hidden sv-stack">
<section class="card" id="part-tasks">
    <p class="sv-step">${esc(t.step)} ${fixedRole ? 2 : 3}</p>
    <h2>${esc(t.tasksTitle)}</h2>
    ${fixedRole ? `<p class="sv-role-tag">${esc(t.roles[fixedRole][0])}</p>` : ''}
    <div id="tasks"></div>
</section>

<section class="card" id="part-iso">
    <p class="sv-step" data-step-iso></p>
    <h2>${esc(t.isoTitle)}</h2>
    <p class="sv-note">${esc(t.rateNote)}</p>
    ${t.iso.map((text, i) => statement(`iso${i + 1}`, i + 1, text, EN.iso[i], CATEGORIES[i])).join('')}
</section>

<section class="card" id="part-sus">
    <p class="sv-step" data-step-sus></p>
    <h2>${esc(t.susTitle)}</h2>
    <p class="sv-note">${esc(t.rateNote)} ${esc(t.susNote)}</p>
    ${t.sus.map((text, i) => statement(`sus${i + 1}`, i + 1, text, EN.sus[i])).join('')}
</section>

<section class="card sv-open" id="part-open">
    <p class="sv-step" data-step-open></p>
    <h2>${esc(t.openTitle)}</h2>
    <p class="sv-note">${esc(t.openNote)}</p>
    ${t.openQ.map((text, i) => `<div class="field"><label class="field-label" for="f-q${i + 1}">${esc(text)}${original(EN.openQ[i])}</label><textarea class="input" id="f-q${i + 1}" name="q${i + 1}" maxlength="1000"></textarea></div>`).join('')}
</section>

<div class="sv-actions">
    <div id="errors"></div>
    <button type="submit" class="btn btn-primary btn-lg btn-block"><span>${esc(t.submit)}</span></button>
    <p class="sv-progress" id="progress"></p>
</div>
</div>
</div>
</form>`;
}

function tasksFor(role) {
    const account = ACCOUNTS[role]
        ? `<p class="sv-note">${fill(esc(t.account), { account: `<strong>${esc(ACCOUNTS[role])}</strong>`, password: '<strong>demo1234</strong>' })}</p>`
        : '';
    return `<p>${esc(t.tasksIntro)}</p>
<ol>${t.tasks[role].map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${account}
<p><a class="btn btn-secondary" href="${esc(LINKS[role])}" target="_blank" rel="noopener"><span>${esc(t.open)}</span></a></p>
<p class="sv-note">${esc(t.comeBack)}</p>`;
}

function showAge(age) {
    const minor = age === MINOR;
    document.getElementById('minor').classList.toggle('sv-hidden', !minor);
    document.getElementById('adult').classList.toggle('sv-hidden', minor || !age);
    if (fixedRole && age && !minor) showRole(fixedRole);
}

function showRole(role) {
    if (!PARTS[role]) return;
    const parts = PARTS[role];
    document.getElementById('rest').classList.remove('sv-hidden');
    document.getElementById('tasks').innerHTML = tasksFor(role);
    document.getElementById('part-iso').classList.toggle('sv-hidden', !parts.iso);
    document.getElementById('part-sus').classList.toggle('sv-hidden', !parts.sus);
    let step = fixedRole ? 3 : 4;
    if (parts.iso) document.querySelector('[data-step-iso]').textContent = `${t.step} ${step++}`;
    if (parts.sus) document.querySelector('[data-step-sus]').textContent = `${t.step} ${step++}`;
    document.querySelector('[data-step-open]').textContent = `${t.step} ${step}`;
    updateProgress();
}

function thanks(saved) {
    app.innerHTML = `${langBar()}<section class="card">
<h1>${esc(t.thanks)}</h1>
<p>${esc(saved ? t.sent : t.queued)}</p>
<p class="sv-note">${esc(t.shared)}</p>
<p><button type="button" class="btn btn-secondary" data-again><span>${esc(t.again)}</span></button></p>
</section>`;
}

// ---------------------------------------------------------------- answers

function collect(f) {
    const data = new FormData(f);
    const role = fixedRole || data.get('role');
    const parts = PARTS[role] || {};
    const list = (prefix, n) => Array.from({ length: n }, (_, i) => Number(data.get(`${prefix}${i + 1}`)) || null);
    return {
        lang,
        age: data.get('age'),
        role,
        consent: f.consent.checked,
        iso: parts.iso ? list('iso', EN.iso.length) : [],
        sus: parts.sus ? list('sus', EN.sus.length) : [],
        q1: (data.get('q1') || '').trim(), q2: (data.get('q2') || '').trim(), q3: (data.get('q3') || '').trim(),
    };
}

function missing(a) {
    const out = [];
    if (!a.consent) out.push(['consent', t.fixConsent]);
    if (!a.age) out.push(['item-age', t.fixAge]);
    if (!a.role) out.push(['item-role', t.fixRole]);
    a.iso.forEach((v, i) => { if (!v) out.push([`item-iso${i + 1}`, fill(t.fixIso, { n: i + 1 })]); });
    a.sus.forEach((v, i) => { if (!v) out.push([`item-sus${i + 1}`, fill(t.fixSus, { n: i + 1 })]); });
    return out;
}

function updateProgress() {
    const f = document.getElementById('survey');
    const a = collect(f);
    const total = a.iso.length + a.sus.length;
    const done = a.iso.concat(a.sus).filter(Boolean).length;
    document.getElementById('progress').textContent = total ? fill(t.progress, { done, total }) : '';
}

// Keeps the answers when the language changes.
function snapshot() {
    const f = document.getElementById('survey');
    if (!f) return null;
    return Array.from(f.elements).filter((el) => el.name).map((el) => [el.name, el.type, el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value, el.value]);
}

function restore(state) {
    const f = document.getElementById('survey');
    if (!state || !f) return;
    for (const [name, type, v, value] of state) {
        if (type === 'radio') { if (v) { const el = f.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`); if (el) el.checked = true; } }
        else if (type === 'checkbox') { if (f.elements[name]) f.elements[name].checked = v; }
        else if (f.elements[name]) f.elements[name].value = v;
    }
    showAge(f.elements.age.value);
    if (f.elements.role.value) showRole(f.elements.role.value);
}

function bind() {
    const f = document.getElementById('survey');
    f.addEventListener('change', (e) => {
        if (e.target.name === 'age') showAge(e.target.value);
        if (e.target.name === 'role') showRole(e.target.value);
        e.target.closest('.sv-item')?.classList.remove('sv-missing');
        updateProgress();
    });
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const a = collect(f);
        if (a.age === MINOR) return;
        const gaps = missing(a);
        document.querySelectorAll('.sv-missing').forEach((el) => el.classList.remove('sv-missing'));
        const box = document.getElementById('errors');
        if (gaps.length) {
            gaps.forEach(([id]) => document.getElementById(id)?.closest('.sv-item')?.classList.add('sv-missing'));
            box.innerHTML = `<div class="alert alert-danger sv-errors" role="alert"><div class="alert-body"><p class="alert-title">${esc(t.fixTitle)}</p><ul>${gaps.slice(0, 8).map(([id, text]) => `<li><a href="#${id}">${esc(text)}</a></li>`).join('')}${gaps.length > 8 ? `<li>${esc(fill(t.more, { n: gaps.length - 8 }))}</li>` : ''}</ul></div></div>`;
            document.getElementById(gaps[0][0])?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }
        box.innerHTML = '';
        const button = f.querySelector('[type=submit]');
        button.disabled = true;
        button.querySelector('span').textContent = t.sending;

        const response = { id: newId(), ...a };
        let saved = true;
        try {
            await send(response);
        } catch (err) {
            if (err.rejected) {
                box.innerHTML = `<div class="alert alert-danger" role="alert"><div class="alert-body"><p class="alert-title">${esc(t.rejected)}</p><div>${esc(err.message)}</div></div></div>`;
                button.disabled = false;
                button.querySelector('span').textContent = t.submit;
                return;
            }
            saved = false;
            write(QUEUE, read(QUEUE, []).concat([response]));
        }
        write(DONE, true);
        thanks(saved);
        window.scrollTo(0, 0);
    });
}

function setText() {
    document.documentElement.lang = lang === 'ceb' ? 'ceb' : lang;
    const foot = document.getElementById('foot');
    if (foot) foot.textContent = t.footer;
}

function start(state = null) {
    setText();
    app.innerHTML = form();
    bind();
    restore(state);
    if (!ENDPOINT) {
        app.insertAdjacentHTML('afterbegin', `<div class="alert alert-warn" role="status"><div class="alert-body">${esc(t.testMode)}</div></div>`);
    }
}

app.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-lang]');
    if (pick && pick.dataset.lang !== lang) {
        const state = snapshot();
        lang = pick.dataset.lang;
        t = T[lang];
        write(LANG, lang);
        if (document.getElementById('survey')) start(state);
        else { setText(); thanks(read(QUEUE, []).length === 0); }
        return;
    }
    if (e.target.closest('[data-again]')) {
        write(DONE, false);
        start();
        window.scrollTo(0, 0);
    }
});

await flushQueue();
if (read(DONE, false)) { setText(); thanks(read(QUEUE, []).length === 0); }
else start();
