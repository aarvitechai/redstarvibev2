import { Route, Routes } from 'react-router';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import { ROLES } from './constants/roles';
import AccountPage from './pages/auth/AccountPage';
import AdminPage from './pages/auth/AdminPage';
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import CartPage from './pages/CartPage';
import ContactsPage from './pages/ContactsPage';
import DestinationsPage from './pages/DestinationsPage';
import DirectoryPage from './pages/DirectoryPage';
import HomePage from './pages/HomePage';
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
//     /admin            ProtectedRoute roles=[Admin]
//     *                 NotFoundPage (catch-all: must be the last resort)
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
        <Route path="unauthorized" element={<UnauthorizedPage />} />

        {/* Phase 8: pathless LAYOUT routes that guard their children */}
        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={[ROLES.admin]} />}>
          <Route path="admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// The router itself (<BrowserRouter>) is added in main.jsx, so tests can use <MemoryRouter> instead
export default AppRoutes;
