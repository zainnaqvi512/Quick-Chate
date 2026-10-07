// Native builds bundle the UI, but use the same authenticated HTTPS API.
const configured = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') || '';
if(configured && (!configured.startsWith('https://') || new URL(configured).origin!==configured)) {
  throw new Error('VITE_API_ORIGIN must be an HTTPS origin without a path');
}
export function apiUrl(path:string) { return `${configured}${path}`; }
