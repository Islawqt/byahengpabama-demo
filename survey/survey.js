// The evaluation survey. Each response is sent to a Google Apps Script web
// app (see apps-script.gs), which adds it as a row in the Google Sheet. If
// sending fails, the response waits in this browser and is sent again the
// next time the page opens.
import { ENDPOINT } from './config.js';
import { ROLES, PARTS, TASKS, ISO, SUS, OPEN, SCALE } from './questions.js';

const app = document.getElementById('app');
const QUEUE = 'bp-survey-queue';
const DONE = 'bp-survey-done';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// ---------------------------------------------------------------- sending

async function send(response) {
    if (!ENDPOINT) throw new Error('No endpoint set');
    // text/plain keeps this a "simple" request, which Apps Script accepts from another site.
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(response) });
}

async function flushQueue() {
    const waiting = read(QUEUE, []);
    if (!waiting.length || !ENDPOINT) return;
    const left = [];
    for (const r of waiting) {
        try { await send(r); } catch { left.push(r); }
    }
    write(QUEUE, left);
}

// ---------------------------------------------------------------- drawing

const scale = (name) => `<div class="sv-scale">${SCALE.map((label, i) => `<label><input class="choice-input" type="radio" name="${name}" value="${i + 1}"><span class="choice">${i + 1}<small>${esc(label)}</small></span></label>`).join('')}</div>
<div class="sv-ends" aria-hidden="true"><span>1 Strongly disagree</span><span>5 Strongly agree</span></div>`;

const statement = (name, n, text, category = '') => `<fieldset class="sv-item" id="item-${name}">
<legend>${category ? `<span class="sv-cat">${esc(category)}</span>` : ''}${n}. ${esc(text)}</legend>${scale(name)}</fieldset>`;

function form() {
    return `<form id="survey" novalidate>
<section class="card">
    <h1>Help us evaluate ByahengPabama</h1>
    <p>We are BSIT students of STI College Valencia. ByahengPabama is our capstone project: a bus tracking and fare matrix system for Pabama Corporation's CDO Agora Terminal – Kibawe route.</p>
    <p>This survey takes about 10 minutes. You first try a few tasks in the system, then rate some statements. There are no right or wrong answers.</p>
    <p class="sv-note">Answering is voluntary. We do not ask for your name or contact details; we only record your role and your answers. Under the Data Privacy Act of 2012 (Republic Act No. 10173), your answers are used only for this study and are reported as group results.</p>
    <label class="check"><input type="checkbox" name="consent" id="consent" required><span>I have read the above and agree to take part.</span></label>
</section>

<section class="card" id="part-role">
    <p class="sv-step">Step 1</p>
    <h2>Which describes you?</h2>
    <fieldset class="sv-item" id="item-role"><legend class="visually-hidden">Your role</legend>
    <div class="sv-roles">${ROLES.map((r) => `<label><input class="choice-input" type="radio" name="role" value="${esc(r.value)}"><span class="choice">${esc(r.label)}<small>${esc(r.hint)}</small></span></label>`).join('')}</div>
    </fieldset>
</section>

<div id="rest" class="sv-hidden" style="display:grid;gap:var(--s-4)">
<section class="card" id="part-tasks">
    <p class="sv-step">Step 2</p>
    <h2>Try the system</h2>
    <div id="tasks"></div>
</section>

<section class="card" id="part-iso">
    <p class="sv-step" data-step-iso></p>
    <h2>Software quality</h2>
    <p class="sv-note">Rate each statement from 1 (strongly disagree) to 5 (strongly agree).</p>
    ${ISO.map(([cat, text], i) => statement(`iso${i + 1}`, i + 1, text, cat)).join('')}
</section>

<section class="card" id="part-sus">
    <p class="sv-step" data-step-sus></p>
    <h2>Ease of use</h2>
    <p class="sv-note">Rate each statement from 1 (strongly disagree) to 5 (strongly agree). Answer every statement; if you are unsure, choose 3.</p>
    ${SUS.map((text, i) => statement(`sus${i + 1}`, i + 1, text)).join('')}
</section>

<section class="card sv-open" id="part-open">
    <p class="sv-step" data-step-open></p>
    <h2>Your comments</h2>
    <p class="sv-note">Optional, in English, Filipino, or Bisaya.</p>
    ${OPEN.map(([name, text]) => `<div class="field"><label class="field-label" for="f-${name}">${esc(text)}</label><textarea class="input" id="f-${name}" name="${name}" maxlength="1000"></textarea></div>`).join('')}
</section>

<div class="sv-actions">
    <div id="errors"></div>
    <button type="submit" class="btn btn-primary btn-lg btn-block"><span>Submit my answers</span></button>
    <p class="sv-progress" id="progress"></p>
</div>
</div>
</form>`;
}

function tasksFor(role) {
    const t = TASKS[role];
    const account = t.account
        ? `<p class="sv-note">Demo account: <strong>${esc(t.account)}</strong>, password <strong>demo1234</strong>. You can also tap an account on the login page to fill it in.</p>`
        : '';
    return `<p>Use the system shown by the proponents, or open the online demo in a new tab. Then:</p>
<ol>${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${account}
<p><a class="btn btn-secondary" href="${esc(t.link)}" target="_blank" rel="noopener"><span>Open the demo in a new tab</span></a></p>
<p class="sv-note">Come back to this tab when you are done.</p>`;
}

function showRole(role) {
    const parts = PARTS[role];
    document.getElementById('rest').classList.remove('sv-hidden');
    document.getElementById('tasks').innerHTML = tasksFor(role);
    document.getElementById('part-iso').classList.toggle('sv-hidden', !parts.iso);
    document.getElementById('part-sus').classList.toggle('sv-hidden', !parts.sus);
    let step = 3;
    if (parts.iso) document.querySelector('[data-step-iso]').textContent = `Step ${step++}`;
    if (parts.sus) document.querySelector('[data-step-sus]').textContent = `Step ${step++}`;
    document.querySelector('[data-step-open]').textContent = `Step ${step}`;
    updateProgress();
}

function thanks(saved) {
    app.innerHTML = `<section class="card">
<h1>Salamat! Thank you.</h1>
<p>${saved ? 'Your answers were sent.' : 'Your answers are saved on this device and will be sent the next time this page is opened with an internet connection.'}</p>
<p class="sv-note">If this device is shared, the next respondent can start a new survey.</p>
<p><button type="button" class="btn btn-secondary" data-again><span>Start a new survey for another respondent</span></button></p>
</section>`;
}

// ---------------------------------------------------------------- answers

function collect(f) {
    const data = new FormData(f);
    const role = data.get('role');
    const parts = PARTS[role] || {};
    const list = (prefix, n) => Array.from({ length: n }, (_, i) => Number(data.get(`${prefix}${i + 1}`)) || null);
    return {
        role,
        consent: f.consent.checked,
        iso: parts.iso ? list('iso', ISO.length) : [],
        sus: parts.sus ? list('sus', SUS.length) : [],
        q1: (data.get('q1') || '').trim(), q2: (data.get('q2') || '').trim(), q3: (data.get('q3') || '').trim(),
    };
}

function missing(a) {
    const out = [];
    if (!a.consent) out.push(['consent', 'Agree to take part (at the top).']);
    if (!a.role) out.push(['item-role', 'Choose which describes you.']);
    a.iso.forEach((v, i) => { if (!v) out.push([`item-iso${i + 1}`, `Software quality, statement ${i + 1}`]); });
    a.sus.forEach((v, i) => { if (!v) out.push([`item-sus${i + 1}`, `Ease of use, statement ${i + 1}`]); });
    return out;
}

function updateProgress() {
    const f = document.getElementById('survey');
    const a = collect(f);
    const total = a.iso.length + a.sus.length;
    const done = a.iso.concat(a.sus).filter(Boolean).length;
    document.getElementById('progress').textContent = total ? `${done} of ${total} statements answered` : '';
}

function bind() {
    const f = document.getElementById('survey');
    f.addEventListener('change', (e) => {
        if (e.target.name === 'role') showRole(e.target.value);
        e.target.closest('.sv-item')?.classList.remove('sv-missing');
        updateProgress();
    });
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const a = collect(f);
        const gaps = missing(a);
        document.querySelectorAll('.sv-missing').forEach((el) => el.classList.remove('sv-missing'));
        const box = document.getElementById('errors');
        if (gaps.length) {
            gaps.forEach(([id]) => document.getElementById(id)?.closest('.sv-item')?.classList.add('sv-missing'));
            box.innerHTML = `<div class="alert alert-danger sv-errors" role="alert"><div class="alert-body"><p class="alert-title">Please answer ${gaps.length === 1 ? 'this' : `these ${gaps.length}`} first:</p><ul>${gaps.slice(0, 8).map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}${gaps.length > 8 ? `<li>and ${gaps.length - 8} more</li>` : ''}</ul></div></div>`;
            document.getElementById(gaps[0][0])?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }
        box.innerHTML = '';
        const button = f.querySelector('[type=submit]');
        button.disabled = true;
        button.querySelector('span').textContent = 'Sending…';

        const response = { id: newId(), ...a };
        let saved = true;
        try {
            await send(response);
        } catch {
            saved = false;
            write(QUEUE, read(QUEUE, []).concat([response]));
        }
        write(DONE, true);
        thanks(saved);
        window.scrollTo(0, 0);
    });
}

function start() {
    app.innerHTML = form();
    bind();
    if (!ENDPOINT) {
        app.insertAdjacentHTML('afterbegin', '<div class="alert alert-warn" role="status"><div class="alert-body"><p class="alert-title">Test mode</p><div>This survey is not connected to the response sheet yet, so answers stay in this browser only.</div></div></div>');
    }
}

app.addEventListener('click', (e) => {
    if (e.target.closest('[data-again]')) {
        write(DONE, false);
        start();
        window.scrollTo(0, 0);
    }
});

await flushQueue();
if (read(DONE, false)) thanks(read(QUEUE, []).length === 0);
else start();
