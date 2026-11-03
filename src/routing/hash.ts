export type Params = Readonly<Record<string, string>>;

export type Route =
  | { readonly page: 'catalog' }
  | { readonly page: 'bench' }
  | { readonly page: 'algorithm'; readonly id: string; readonly params: Params }
  /** `ids` trae lo que diga el enlace, de cero a dos: la página completa lo que falte. */
  | { readonly page: 'compare'; readonly ids: readonly string[]; readonly params: Params };

const COMPARE = 'compare';

// Las comas no necesitan escaparse en un fragmento, y `values=5,2,4` se lee mucho mejor que `5%2C2%2C4`.
const encode = (value: string) => encodeURIComponent(value).replaceAll('%2C', ',');

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseQuery(query: string): Params {
  // Sin prototipo: las claves salen del enlace, así que `__proto__` o `constructor` no deben
  // poder resolverse a nada heredado. Hoy nadie recorre estas claves y los valores son siempre
  // cadenas, pero esto lo hace cierto por construcción y no por cómo se lea el objeto.
  const params: Record<string, string> = Object.create(null);
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = decode(separator === -1 ? pair : pair.slice(0, separator));
    const value = decode(separator === -1 ? '' : pair.slice(separator + 1));
    // Un enlace mal copiado no debe tumbar la página: ese parámetro se ignora.
    if (key !== null && value !== null) params[key] = value;
  }
  return params;
}

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  if (path === '') return { page: 'catalog' };
  if (path === 'bench') return { page: 'bench' };

  const params = parseQuery(query);
  const segments = path.split('/').map((segment) => decode(segment) ?? segment);
  if (segments[0] === COMPARE) {
    return { page: 'compare', ids: segments.slice(1, 3).filter(Boolean), params };
  }
  return { page: 'algorithm', id: decode(path) ?? path, params };
}

function formatQuery(params: Params): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&');
  return query ? `?${query}` : '';
}

export function formatAlgorithmHash(id: string, params: Params): string {
  // `encode` igual que en `formatCompareHash`: hoy todo id sale de un nombre de archivo, pero
  // sin esto `formatAlgorithmHash` y `parseHash` no son inversas para un id con `%`, `?` o `&`.
  return `#/${encode(id)}${formatQuery(params)}`;
}

export function formatCompareHash(ids: readonly string[], params: Params): string {
  return `#/${[COMPARE, ...ids].map(encode).join('/')}${formatQuery(params)}`;
}
