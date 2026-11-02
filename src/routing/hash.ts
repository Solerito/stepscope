export type Route =
  | { readonly page: 'catalog' }
  | { readonly page: 'bench' }
  | { readonly page: 'algorithm'; readonly id: string; readonly params: Readonly<Record<string, string>> };

// Las comas no necesitan escaparse en un fragmento, y `values=5,2,4` se lee mucho mejor que `5%2C2%2C4`.
const encode = (value: string) => encodeURIComponent(value).replaceAll('%2C', ',');

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  if (path === '') return { page: 'catalog' };
  if (path === 'bench') return { page: 'bench' };

  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = separator === -1 ? pair : pair.slice(0, separator);
    const value = separator === -1 ? '' : pair.slice(separator + 1);
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      // Un enlace mal copiado no debe tumbar la página: ese parámetro se ignora.
    }
  }
  return { page: 'algorithm', id: decodeURIComponent(path), params };
}

export function formatAlgorithmHash(id: string, params: Readonly<Record<string, string>>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&');
  return `#/${id}${query ? `?${query}` : ''}`;
}
