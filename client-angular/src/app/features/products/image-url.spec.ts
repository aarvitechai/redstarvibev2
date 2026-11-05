import { resolveImageUrl } from './products-api';

// Phase 15: the production build calls '/api' on its own origin (nginx proxies it to the API container)
describe('resolveImageUrl', () => {
  it('development: a separate API origin', () => {
    expect(resolveImageUrl('/images/products/a.png', 'http://localhost:5240/api', 'http://localhost:4200')).toBe('http://localhost:5240/images/products/a.png');
  });
  it('production behind the proxy: a relative api url resolves against the page', () => {
    expect(resolveImageUrl('/images/products/a.png', '/api', 'https://shop.example.com')).toBe('https://shop.example.com/images/products/a.png');
  });
  it('no image', () => {
    expect(resolveImageUrl(null, '/api', 'https://shop.example.com')).toBeNull();
  });
});
