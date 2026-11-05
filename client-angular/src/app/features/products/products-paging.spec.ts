import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PRODUCTS_PAGE_SIZE, ProductsApi, imageSrc } from './products-api';

describe('ProductsApi (Phase 11: paged)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends page and pageSize with the filters, and returns the page object', async () => {
    const http = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(TestBed.inject(ProductsApi).list({ category: 'pizza', sort: 'priceDesc', page: 2 }));

    const req = http.expectOne((r) => r.url === 'http://localhost:5240/api/products');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe(String(PRODUCTS_PAGE_SIZE));
    expect(req.request.params.get('category')).toBe('pizza');
    req.flush({ success: true, data: { items: [], page: 2, pageSize: 9, totalCount: 10, totalPages: 2, hasNext: false, hasPrevious: true }, errors: [] });

    expect((await result).hasPrevious).toBe(true);
  });

  it('builds image URLs on the API origin', () => {
    expect(imageSrc('/images/products/abc.png')).toBe('http://localhost:5240/images/products/abc.png');
    expect(imageSrc(null)).toBeNull();
  });
});
