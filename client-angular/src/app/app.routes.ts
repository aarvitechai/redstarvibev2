import { Routes } from '@angular/router';
import { ROLES, authGuard, guestOnlyGuard, roleGuard } from './core/auth/auth';
import { HomePage } from './features/home/home-page';

const t = (page: string) => `${page} · RedStarVibe`;

// The route tree. Child paths are RELATIVE to their parent ('products' + ':id' -> /products/4).
// loadComponent = LAZY LOADING: each page is a separate JavaScript chunk, downloaded on its first visit,
// so the first page load stays small. (React gets the same with lazy() + Suspense in Phase 15.)
// `title` sets document.title on navigation; pages with data-driven titles also use the Title service.
export const routes: Routes = [
  { path: '', component: HomePage, title: t('Home') }, // eager: the landing page should appear instantly
  {
    path: 'products',
    loadComponent: () => import('./features/products/products-layout').then((m) => m.ProductsLayout),
    children: [
      { path: '', loadComponent: () => import('./features/products/product-list').then((m) => m.ProductList), title: t('Products') },
      { path: ':id', loadComponent: () => import('./features/products/product-detail').then((m) => m.ProductDetail), title: t('Product') },
    ],
  },
  { path: 'students', loadComponent: () => import('./features/students/students-page').then((m) => m.StudentsPage), title: t('Students') },
  { path: 'directory', loadComponent: () => import('./features/directory/directory-page').then((m) => m.DirectoryPage), title: t('Directory') },
  { path: 'contacts', loadComponent: () => import('./features/contacts/contacts-page').then((m) => m.ContactsPage), title: t('Contacts') },
  { path: 'playground', loadComponent: () => import('./features/playground/playground-page').then((m) => m.PlaygroundPage), title: t('Playground') },
  { path: 'cart', loadComponent: () => import('./features/cart/cart-page').then((m) => m.CartPage), title: t('Cart') },
  // Phase 8: auth. Guards are UX ONLY: the API refuses unauthorised calls with 401/403 regardless.
  { path: 'login', canActivate: [guestOnlyGuard], loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage), title: t('Log in') },
  { path: 'unauthorized', loadComponent: () => import('./features/auth/unauthorized-page').then((m) => m.UnauthorizedPage), title: t('Not allowed') },
  {
    path: 'account',
    canActivate: [authGuard],
    runGuardsAndResolvers: 'always', // re-check on a same-URL reload (after logout or expiry)
    loadComponent: () => import('./features/auth/account-page').then((m) => m.AccountPage),
    title: t('Account'),
  },
  {
    path: 'admin',
    canActivate: [roleGuard(ROLES.admin)],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./features/auth/admin-page').then((m) => m.AdminPage),
    title: t('Admin'),
  },
  // The catch-all. Order matters: the router takes the FIRST match, so '**' must be last.
  { path: '**', loadComponent: () => import('./features/home/not-found').then((m) => m.NotFound), title: t('Page not found') },
];
