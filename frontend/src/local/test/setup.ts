/** Entorno de pruebas (Node): IndexedDB simulada y carga del .wasm desde node_modules. */
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('@swisseph/browser/dist/swisseph.wasm')
const realFetch = globalThis.fetch
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('.wasm')
    ? new Response(readFileSync(wasmPath), { headers: { 'Content-Type': 'application/wasm' } })
    : realFetch(url, init)) as typeof fetch
