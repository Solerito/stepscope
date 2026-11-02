// Presupuesto del bundle inicial: el JS y el CSS que enlaza index.html, comprimidos con gzip. Es lo que
// descarga cualquiera que abra el sitio, antes de elegir algoritmo. El texto de los algoritmos, el worker
// y las fuentes llegan después y no cuentan. Se ejecuta en CI tras `npm run build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Medido en F4 (2026-11-02): 119 kB. Subirlo es una decisión, no un efecto secundario de una dependencia.
const BUDGET_KB = 140;

const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);

if (assets.length === 0) {
  console.error('No hay JS ni CSS en dist/index.html: ¿falta `npm run build`?');
  process.exit(1);
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
let total = 0;
for (const asset of assets) {
  const size = gzipSync(readFileSync(new URL(asset, dist)), { level: 9 }).length;
  total += size;
  console.log(`${kb(size).padStart(7)} kB  ${asset}`);
}

console.log(`${kb(total).padStart(7)} kB  en total, de un presupuesto de ${BUDGET_KB} kB`);
if (total > BUDGET_KB * 1024) {
  console.error(`El bundle inicial pasa del presupuesto por ${kb(total - BUDGET_KB * 1024)} kB.`);
  process.exit(1);
}
