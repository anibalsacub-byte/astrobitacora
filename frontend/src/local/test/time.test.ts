/** Hora local → UTC en el navegador (Intl) frente a zoneinfo de Python, y casos de cambio de horario. */
import { describe, expect, it } from 'vitest'
import { resolveLocalTime, timezoneAt, TimeError } from '../time'
import ref from './python_reference.json'

describe('mismas conversiones que el motor Python (zoneinfo)', () => {
  for (const t of ref.times) {
    it(`${t.local} ${t.tz} fold=${t.fold}`, () => {
      const r = resolveLocalTime(t.local, t.tz, null, t.fold as 0 | 1)
      expect(r.utc).toBe(t.utc)
      expect(r.status).toBe(t.status)
      if (t.status === 'ok') expect(r.dst).toBe(t.dst)
    })
  }
})

describe('casos especiales', () => {
  it('desfase manual', () => {
    expect(resolveLocalTime('1890-05-01T09:00', null, -(4 * 60 + 16)).utc).toBe('1890-05-01T13:16:00Z')
  })
  it('años de un solo dígito no se confunden con 19xx', () => {
    expect(resolveLocalTime('0005-03-01T12:00', null, 0).utc).toBe('0005-03-01T12:00:00Z')
  })
  it('fechas y zonas no válidas', () => {
    expect(() => resolveLocalTime('2024-02-30T10:00', 'UTC')).toThrow(TimeError)
    expect(() => resolveLocalTime('2024-01-01T00:00', 'Mars/Olympus')).toThrow(TimeError)
  })
  it('zona horaria a partir de coordenadas, sin conexión', () => {
    expect(timezoneAt(40.4168, -3.7038)).toBe('Europe/Madrid')
    expect(timezoneAt(-34.6037, -58.3816)).toBe('America/Argentina/Buenos_Aires')
    expect(timezoneAt(19.4326, -99.1332)).toBe('America/Mexico_City')
  })
})
