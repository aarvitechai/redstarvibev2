import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import { ROLES } from './constants/roles';
import AccountPage from './pages/auth/AccountPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import CartPage from './pages/CartPage';
import ContactsPage from './pages/ContactsPage';
import DestinationsPage from './pages/DestinationsPage';
import DirectoryPage from './pages/DirectoryPage';
import HomePage from './pages/HomePage';
import MyOrdersPage from './pages/MyOrdersPage';
import NotFoundPage from './pages/NotFoundPage';
import PlaygroundPage from './pages/PlaygroundPage';
import ProductDetailPage from './pages/products/ProductDetailPage';
import ProductListPage from './pages/products/ProductListPage';
import ProductsLayout from './pages/products/ProductsLayout';
import StudentsPage from './pages/StudentsPage';

// The route tree. Child paths are RELATIVE to their parent ("products" + ":id" -> /products/4).
//   <Layout>                         header + footer + <Outlet/>
//     /                 HomePage     (index route)
//     /products         ProductsLayout (sidebar + <Outlet/>)
//         (index)       ProductListPage    ?category=&q=&sort=
//         :id           ProductDetailPage
//     ...
//     /login, /unauthorized       public
//     /account          ProtectedRoute (any logged-in user)
//     /admin            ProtectedRoute roles=[Admin] -> AdminLayout (lazy): index, products, orders
//     *                 NotFoundPage (catch-all: must be the last resort)
// CODE SPLITTING (plan 14.8 / Section 7): the admin area is a separate JavaScript chunk, downloaded only when an
// admin opens it. Customers never download admin code. <Suspense> in the layouts shows a fallback meanwhile.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminPage = lazy(() => import('./pages/auth/AdminPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout appName="RedStarVibe" />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsLayout />}>
          <Route index element={<ProductListPage />} />
          <Route path=":id" element={<ProductDetailPage />} />
        </Route>
        <Route path="students" element={<StudentsPage />} />
        <Route path="directory" element={<DirectoryPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />

        {/* Phase 8: pathless LAYOUT routes that guard their children */}
        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={[ROLES.customer]} />}>
          <Route path="orders" element={<MyOrdersPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={[ROLES.admin]} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// The router itself (<BrowserRouter>) is added in main.jsx, so tests can use <MemoryRouter> instead
export default AppRoutes;
