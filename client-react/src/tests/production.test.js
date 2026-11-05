import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from '../services/productsApi';

// Phase 15: the production build talks to "/api" on its OWN origin (nginx proxies it to the API container)
describe('image URLs in every deployment shape', () => {
  it('development: a separate API origin', () => {
    expect(resolveImageUrl('/images/products/a.png', 'http://localhost:5240/api', 'http://localhost:5173')).toBe('http://localhost:5240/images/products/a.png');
  });

  it('production behind the proxy: a RELATIVE api url resolves against the page (this used to throw)', () => {
    expect(resolveImageUrl('/images/products/a.png', '/api', 'https://shop.example.com')).toBe('https://shop.example.com/images/products/a.png');
  });

  it('no image', () => {
    expect(resolveImageUrl(null, '/api', 'https://shop.example.com')).toBeNull();
  });
});
