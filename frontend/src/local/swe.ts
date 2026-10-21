/**
 * Swiss Ephemeris compilado a WebAssembly (@swisseph/browser, AGPL-3.0).
 * Es la misma biblioteca C que usa la versión de escritorio (pyswisseph), con la teoría analítica
 * de Moshier integrada: no necesita archivos de efemérides ni conexión.
 */
import { SwissEphemeris } from '@swisseph/browser'
import wasmUrl from '@swisseph/browser/dist/swisseph.wasm?url'

let instance: SwissEphemeris | null = null
let loading: Promise<SwissEphemeris> | null = null

/** Permite a las pruebas (Node) indicar otra ruta del .wasm. */
export let wasmLocation: string = wasmUrl
export function setWasmLocation(url: string) {
  wasmLocation = url
}

export function getSwe(): Promise<SwissEphemeris> {
  if (instance) return Promise.resolve(instance)
  loading ??= (async () => {
    const swe = new SwissEphemeris()
    await swe.init(wasmLocation)
    instance = swe
    return swe
  })()
  return loading
}

/** Acceso síncrono una vez inicializado (lanza si aún no se llamó a getSwe). */
export function swe(): SwissEphemeris {
  if (!instance) throw new Error('Motor astronómico no inicializado')
  return instance
}
