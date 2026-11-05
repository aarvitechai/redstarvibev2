// Route paths live in ONE place. Links and routes both use these, so renaming a URL is a one-line change.
export const ROUTES = {
  home: '/',
  students: '/students',
  directory: '/directory',
  contacts: '/contacts',
  products: '/products',
  playground: '/playground',
  login: '/login',
  register: '/register',
  account: '/account',
  admin: '/admin',
  unauthorized: '/unauthorized',
  cart: '/cart',
  destinations: '/destinations',
};

export const productPath = (id) => `${ROUTES.products}/${id}`;

// Query-string keys for the product filter (the URL is the single source of truth for filters)
export const PRODUCT_PARAMS = { category: 'category', search: 'q', sort: 'sort', page: 'page' };
export const PRODUCT_SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
];
