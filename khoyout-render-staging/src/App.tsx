import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Footer, GlobalOverlays, Header } from './components';
import {
  AboutPage, CartPage, CategoriesPage, CategoryPage, CheckoutPage, ContactPage,
  FavoritePage, HomePage, NotFoundPage, OrderConfirmationPage, ProductDetailsPage,
  SearchPage, TopSalesPage,
} from './pages';

const AdminPage = lazy(() => import('./admin'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
}

function StoreLayout() {
  return <><Header /><Outlet /><Footer /><GlobalOverlays /></>;
}

export default function App() {
  const publicPreview = import.meta.env.VITE_PUBLIC_PREVIEW_MODE === 'true';
  return <>
    {publicPreview && <div role="status" dir="rtl" style={{ background: '#5b403d', color: '#fff', padding: '9px 14px', textAlign: 'center', fontSize: '13px', lineHeight: 1.5 }}>معاينة عامة فقط — لا يتم تسجيل الدخول أو حفظ الطلبات.</div>}
    <ScrollToTop />
    <Routes>
      <Route path="/admin" element={<Suspense fallback={<div role="status" dir="rtl" className="admin-route-loading">جار تحميل لوحة الإدارة…</div>}><AdminPage /></Suspense>} />
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="top-sales" element={<TopSalesPage />} />
        <Route path="product/:slug" element={<ProductDetailsPage />} />
        <Route path="favorites" element={<FavoritePage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation" element={<OrderConfirmationPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </>;
}
