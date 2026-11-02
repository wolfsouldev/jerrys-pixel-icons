import { filterEntries, paramsFromState, stateFromParams } from './model.mjs';

const $ = selector => document.querySelector(selector);
const state = stateFromParams(new URLSearchParams(location.search));
const dialog = $('#icon-dialog');
let entries = [];
let selected;
let selectedOpen = false;

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const next = theme === 'dark' ? 'claro' : 'oscuro';
    $('#theme-toggle').setAttribute('aria-label', `Cambiar a modo ${next}`);
    $('#theme-label').textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
}

let storedTheme;
try { storedTheme = localStorage.getItem('jerry-gallery-theme'); } catch { /* Storage can be disabled. */ }
applyTheme(['dark', 'light'].includes(storedTheme) ? storedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('jerry-gallery-theme', theme); } catch { /* Keep this session usable. */ }
});

function updateUrl() {
    const params = paramsFromState(state).toString();
    history.replaceState(null, '', `${location.pathname}${params ? `?${params}` : ''}${location.hash}`);
}

function summary(entry) {
    const aliases = entry.type === 'folder' ? entry.names : [...entry.extensions.map(value => `.${value}`), ...entry.names];
    if (!aliases.length) {
        return entry.isDefault ? 'Predeterminado' : 'Sin asociación específica';
    }
    return `${aliases.slice(0, 2).join(' · ')}${aliases.length > 2 ? ` +${aliases.length - 2}` : ''}`;
}

function render() {
    const visible = filterEntries(entries, state);
    const fragment = document.createDocumentFragment();
    for (const entry of visible) {
        const card = $('#icon-card-template').content.firstElementChild.cloneNode(true);
        card.dataset.key = entry.key;
        card.setAttribute('aria-label', `Ver ${entry.label} (${entry.type === 'folder' ? 'carpeta' : 'archivo'})`);
        card.querySelector('.card-kind').textContent = entry.type === 'folder' ? 'Carpeta' : 'Archivo';
        card.querySelector('img').src = entry.type === 'folder' && state.open ? entry.openIcon : entry.icon;
        card.querySelector('.card-label').textContent = entry.label;
        card.querySelector('.card-associations').textContent = summary(entry);
        card.addEventListener('click', () => openDetail(entry));
        fragment.append(card);
    }
    $('#icon-grid').replaceChildren(fragment);
    $('#empty-state').hidden = visible.length !== 0;
    $('#results-count').textContent = `${visible.length} de ${entries.length} entradas${state.query.trim() ? ` para “${state.query.trim()}”` : ' · elige un icono para ver sus asociaciones'}`;
    $('#clear-search').hidden = !state.query;
    for (const button of document.querySelectorAll('[data-type]')) {
        const active = button.dataset.type === state.type;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    }
    updateUrl();
}

function showChips(selector, values, prefix = '') {
    const container = $(selector);
    container.replaceChildren();
    if (!values.length) {
        const text = document.createElement('span');
        text.className = 'no-association';
        text.textContent = 'Sin asociaciones específicas';
        container.append(text);
    }
    for (const value of values) {
        const chip = document.createElement('code');
        chip.className = 'chip';
        chip.textContent = `${prefix}${value}`;
        container.append(chip);
    }
}

function updateDetailImage() {
    const source = selected.type === 'folder' && selectedOpen ? selected.openIcon : selected.icon;
    $('#detail-id').textContent = selected.type === 'folder' && selectedOpen ? selected.openId : selected.id;
    $('#detail-image').src = source;
    $('#download-icon').href = source;
    $('#download-icon').download = source.split('/').at(-1);
    for (const button of document.querySelectorAll('[data-open]')) {
        button.setAttribute('aria-pressed', String((button.dataset.open === 'true') === selectedOpen));
    }
}

function openDetail(entry) {
    selected = entry;
    selectedOpen = state.open;
    $('#icon-title').textContent = entry.label;
    $('#detail-type').textContent = entry.type === 'folder' ? 'CARPETA · DOS ESTADOS, UN MISMO CARÁCTER' : 'ARCHIVO · UN PEQUEÑO GRAN DETALLE';
    $('#detail-id').textContent = entry.id;
    $('#folder-states').hidden = entry.type !== 'folder';
    $('#default-note').hidden = !entry.isDefault;
    $('#copy-status').textContent = '';
    showChips('#detail-extensions', entry.extensions, '.');
    showChips('#detail-names', entry.names);
    updateDetailImage();
    dialog.showModal();
}

$('#controls').addEventListener('submit', event => event.preventDefault());
$('#search').value = state.query;
$('#sort').value = state.sort;
$('#open-folders').checked = state.open;
$('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
$('#sort').addEventListener('change', event => { state.sort = event.target.value; render(); });
$('#open-folders').addEventListener('change', event => { state.open = event.target.checked; render(); });
for (const button of document.querySelectorAll('[data-type]')) {
    button.addEventListener('click', () => { state.type = button.dataset.type; render(); });
}
$('#clear-search').addEventListener('click', () => { state.query = ''; $('#search').value = ''; render(); $('#search').focus(); });
$('#reset-filters').addEventListener('click', () => {
    state.query = ''; state.type = 'all'; state.sort = 'name';
    $('#search').value = ''; $('#sort').value = 'name'; render(); $('#search').focus();
});
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { dialog.close(); } });
for (const button of document.querySelectorAll('[data-open]')) {
    button.addEventListener('click', () => { selectedOpen = button.dataset.open === 'true'; updateDetailImage(); });
}
$('#copy-id').addEventListener('click', async () => {
    const entry = selected;
    const id = $('#detail-id').textContent;
    try {
        await navigator.clipboard.writeText(id);
        if (selected === entry) { $('#copy-status').textContent = `ID “${id}” copiado.`; }
    } catch {
        if (selected === entry) { $('#copy-status').textContent = `No se pudo copiar. Puedes seleccionar el ID: ${id}`; }
    }
});
document.addEventListener('keydown', event => {
    if (dialog.open || event.ctrlKey || event.metaKey || event.altKey) { return; }
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        event.preventDefault(); $('#search').focus();
    }
    if (event.key === 'Escape' && document.activeElement === $('#search')) {
        state.query = ''; $('#search').value = ''; render();
    }
});

async function load() {
    $('#load-error').hidden = true;
    $('#results-count').textContent = 'Cargando la colección…';
    try {
        const response = await fetch('./data.json');
        if (!response.ok) { throw new Error('Catalog unavailable'); }
        const data = await response.json();
        if (!Array.isArray(data.entries) || data.entries.length === 0) { throw new Error('Empty catalog'); }
        entries = data.entries;
        $('#version').textContent = `v${data.version}`;
        $('#footer-version').textContent = `v${data.version}`;
        $('#asset-count').textContent = `${data.assetCount} SVG · PURO PIXEL ART`;
        $('#collection-total').textContent = `${data.fileCount} archivos + ${data.folderCount} carpetas. Un mismo carácter.`;
        $('#count-all').textContent = entries.length;
        $('#count-file').textContent = data.fileCount;
        $('#count-folder').textContent = data.folderCount;
        $('#hero-icons').replaceChildren();
        for (const key of ['file/js', 'file/py', 'file/go', 'file/jsx', 'file/rust', 'file/astro', 'file/ts', 'file/vue', 'file/css', 'file/docker', 'folder/src', 'file/bun']) {
            const entry = entries.find(item => item.key === key);
            if (!entry) { continue; }
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'hero-icon';
            button.setAttribute('aria-label', `Ver ${entry.label} en la muestra`);
            const image = document.createElement('img'); image.src = entry.icon; image.alt = ''; image.width = 44; image.height = 44;
            button.append(image); button.addEventListener('click', () => openDetail(entry));
            $('#hero-icons').append(button);
        }
        $('#search-fields').disabled = false;
        render();
    } catch {
        $('#load-error').hidden = false;
        $('#results-count').textContent = 'La colección no está disponible.';
        $('#search-fields').disabled = true;
    }
}
$('#retry').addEventListener('click', load);
await load();
