/* Staðbundin vistun í IndexedDB. Hver skrif bíða eftir að færslan klárist (oncomplete) áður en
   þau teljast vistuð – „Vistað í þessu tæki“ birtist aðeins eftir staðfestingu.
   Ef IndexedDB er ekki tiltækt (t.d. lokað í stillingum) er reynt localStorage; annars er villa tilkynnt. */
(function (root) {
  'use strict';
  const T = (k, v) => (root.OdyI18n ? root.OdyI18n.t(k, v) : k);
  const DB_NAME = 'odysseifskvida-lestrarstofa';
  const STORE = 'kv';
  const LS_PREFIX = 'odysseifskvida-lestrarstofa:';

  function openIdb() {
    return new Promise((resolve, reject) => {
      let req;
      try {
        if (!root.indexedDB) throw new Error(T('store.noIdb'));
        req = root.indexedDB.open(DB_NAME, 1);
      } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error(T('store.openFail')));
      req.onblocked = () => reject(new Error(T('store.blocked')));
    });
  }

  /* Safari (sérstaklega á iPad) getur misst IndexedDB-tenginguna, t.d. eftir að flipi hefur verið í
     bakgrunni; þá geta færslur hangið án þess að skila villu. Hver færsla hefur því tímamörk, og ef
     hún mistekst eða rennur út er tengingin opnuð upp á nýtt og reynt einu sinni enn. */
  const TX_TIMEOUT = 4000;
  function idbBackend(firstDb) {
    let db = firstDb;
    const watch = d => {
      d.onclose = () => { if (db === d) db = null; };
      d.onversionchange = () => { try { d.close(); } catch (e) { /* */ } if (db === d) db = null; };
    };
    watch(db);
    async function conn() {
      if (!db) { db = await openIdb(); watch(db); }
      return db;
    }
    const once = (d, mode, fn) => new Promise((resolve, reject) => {
      let t, done = false;
      const timer = setTimeout(() => { if (!done) { done = true; try { t && t.abort(); } catch (e) { /* */ } reject(new Error(T('store.timeout'))); } }, TX_TIMEOUT);
      const fin = (f, v) => { if (!done) { done = true; clearTimeout(timer); f(v); } };
      try { t = d.transaction(STORE, mode); } catch (e) { fin(reject, e); return; }
      let result;
      try { result = fn(t.objectStore(STORE)); } catch (e) { fin(reject, e); return; }
      t.oncomplete = () => fin(resolve, result && 'result' in result ? result.result : undefined);
      t.onerror = () => fin(reject, t.error || new Error(T('store.writeFail')));
      t.onabort = () => fin(reject, t.error || new Error(T('store.aborted')));
    });
    async function tx(mode, fn) {
      try {
        return await once(await conn(), mode, fn);
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw e; // fullt geymslupláss lagast ekki við endurtengingu
        try { if (db) db.close(); } catch (x) { /* */ }
        db = null;
        return once(await conn(), mode, fn);
      }
    }
    return {
      kind: 'indexeddb',
      get: key => tx('readonly', st => st.get(key)),
      set: (key, value) => tx('readwrite', st => { st.put(value, key); }),
      setMany: entries => tx('readwrite', st => { for (const [k, v] of entries) st.put(v, k); }),
      del: key => tx('readwrite', st => { st.delete(key); }),
    };
  }

  function lsBackend() {
    const ls = root.localStorage;
    const probe = LS_PREFIX + '__probe';
    ls.setItem(probe, '1'); ls.removeItem(probe);
    return {
      kind: 'localstorage',
      get: async key => { const v = ls.getItem(LS_PREFIX + key); return v == null ? undefined : JSON.parse(v); },
      set: async (key, value) => { ls.setItem(LS_PREFIX + key, JSON.stringify(value)); },
      setMany: async entries => { for (const [k, v] of entries) ls.setItem(LS_PREFIX + k, JSON.stringify(v)); },
      del: async key => { ls.removeItem(LS_PREFIX + key); },
    };
  }

  async function openStore() {
    let idbError = null;
    try {
      const db = await openIdb();
      const b = idbBackend(db);
      await b.get('__probe');
      return { backend: b, warning: null };
    } catch (e) { idbError = e; }
    try {
      return { backend: lsBackend(), warning: T('store.fallback') };
    } catch (e) {
      const err = new Error(T('store.none', { err: idbError && idbError.message || e.message }));
      err.cause = e;
      throw err;
    }
  }

  root.OdyStore = { openStore };
})(typeof self !== 'undefined' ? self : this);
