"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInternalDocumentIDStore = createInternalDocumentIDStore;
exports.save = save;
exports.load = load;
exports.getInternalDocumentId = getInternalDocumentId;
exports.getDocumentIdFromInternalId = getDocumentIdFromInternalId;
function createInternalDocumentIDStore() {
    return {
        idToInternalId: new Map(),
        internalIdToId: [],
        save,
        load
    };
}
function save(store) {
    return {
        internalIdToId: store.internalIdToId
    };
}
function load(zbsearch, raw) {
    const { internalIdToId } = raw;
    zbsearch.internalDocumentIDStore.idToInternalId.clear();
    zbsearch.internalDocumentIDStore.internalIdToId = [];
    const internalIdToIdLength = internalIdToId.length;
    for (let i = 0; i < internalIdToIdLength; i++) {
        const internalIdItem = internalIdToId[i];
        zbsearch.internalDocumentIDStore.idToInternalId.set(internalIdItem, i + 1);
        zbsearch.internalDocumentIDStore.internalIdToId.push(internalIdItem);
    }
}
function getInternalDocumentId(store, id) {
    if (typeof id === 'string') {
        const internalId = store.idToInternalId.get(id);
        if (internalId) {
            return internalId;
        }
        const currentId = store.idToInternalId.size + 1;
        store.idToInternalId.set(id, currentId);
        store.internalIdToId.push(id);
        return currentId;
    }
    if (id > store.internalIdToId.length) {
        return getInternalDocumentId(store, id.toString());
    }
    return id;
}
function getDocumentIdFromInternalId(store, internalId) {
    if (store.internalIdToId.length < internalId) {
        throw new Error(`Invalid internalId ${internalId}`);
    }
    return store.internalIdToId[internalId - 1];
}
//# sourceMappingURL=internal-document-id-store.js.map