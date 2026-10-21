// GitHub Pages no reescribe rutas: copiar index.html como 404.html permite abrir
// directamente direcciones como /astrobitacora/patrones.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('404.html creado')
