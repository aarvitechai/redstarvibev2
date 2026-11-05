import { ROUTES } from '../constants/routes';

// Where to go after logging in. Must be SAFE:
//  - only same-site paths ("/account"), never "https://evil.example" or "//evil.example" (an OPEN REDIRECT)
//  - never back to /login itself (a REDIRECT LOOP)
export function safeRedirect(from) {
  const path = typeof from === 'string' ? from : from ? `${from.pathname ?? ''}${from.search ?? ''}` : '';
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith(ROUTES.login)) return ROUTES.home;
  return path;
}
