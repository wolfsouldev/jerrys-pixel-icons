export const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterEntries(entries, { query = '', type = 'all', sort = 'name' } = {}) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    const selected = entries.filter(entry => {
        if (type !== 'all' && entry.type !== type) {
            return false;
        }
        const text = normalize([entry.label, entry.id, ...entry.tags, ...entry.names,
            ...entry.extensions.map(extension => `.${extension}`)].join(' '));
        return words.every(word => text.includes(word));
    });
    return selected.sort((a, b) => {
        const difference = b.names.length + b.extensions.length - a.names.length - a.extensions.length;
        if (sort === 'associations' && difference !== 0) {
            return difference;
        }
        const left = normalize(a.label);
        const right = normalize(b.label);
        return left < right ? -1 : left > right ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

export function stateFromParams(params) {
    return {
        query: params.get('q') ?? '',
        type: ['file', 'folder'].includes(params.get('type')) ? params.get('type') : 'all',
        open: params.get('folders') === 'open',
        sort: params.get('sort') === 'associations' ? 'associations' : 'name',
    };
}

export function paramsFromState(state) {
    const params = new URLSearchParams();
    if (state.query.trim()) {
        params.set('q', state.query);
    }
    if (state.type !== 'all') {
        params.set('type', state.type);
    }
    if (state.open) {
        params.set('folders', 'open');
    }
    if (state.sort !== 'name') {
        params.set('sort', state.sort);
    }
    return params;
}
