import { jwtDecode } from 'jwt-decode';

// plan.md: "JWT decoding on client: jwt-decode. Decoding is NOT verifying; the server verifies."
// The client reads the token only for UX: when does it expire? It never trusts the role in it for security,
// because anyone can make a token that DECODES fine. Only the server can check the signature.
export function tokenExpiresAt(token) {
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === 'number' ? exp * 1000 : null; // exp is in SECONDS since 1970
  } catch {
    return null; // not a JWT, or corrupted
  }
}
