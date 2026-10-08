import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Category, ColorVariant, Product, categories as seedCategories, products as seedProducts, shippingConfig as seedShipping, siteInfo as seedSiteInfo } from './data';
import { AuthUser, getCurrentUser } from './auth';
import { isFavoritesRepositoryConfigured, loadUserFavorites, saveUserFavorites } from './favorites';

export type CartLine = { productId: string; quantity: number; color?: ColorVariant };
export type ToastMessage = { id: number; message: string; tone: 'success' | 'info' | 'error' };
export type StoreSettings = { name: string; currency: string; lowStockThreshold: number; acceptingOrders: boolean };
export type StoreHomepage = {
  heroImage: string; heroKicker: string; heroTitle: string; heroTitleAccent: string; heroSubtitle: string;
  primaryButtonLabel: string; primaryButtonUrl: string; secondaryButtonLabel: string; secondaryButtonUrl: string;
  featuredProductIds: string[]; sectionOrder: string[]; promoVisible: boolean; promoTitle: string; promoText: string; promoImage: string;
};

type ShopContextValue = {
  products: Product[];
  categories: Category[];
  siteInfo: Record<string, string>;
  shippingConfig: typeof seedShipping;
  storeSettings: StoreSettings;
  homepage: StoreHomepage;
  dataReady: boolean;
  googleOAuthConfigured: boolean;
  cart: CartLine[];
  favorites: string[];
  user: AuthUser | null;
  cartCount: number;
  menuOpen: boolean;
  cartOpen: boolean;
  searchOpen: boolean;
  authOpen: boolean;
  toast: ToastMessage | null;
  setMenuOpen: (open: boolean) => void;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setAuthOpen: (open: boolean) => void;
  setAuthenticatedUser: (user: AuthUser) => Promise<void>;
  showToast: (message: string, tone?: ToastMessage['tone']) => void;
  addToCart: (productId: string, quantity?: number, color?: ColorVariant) => void;
  updateCartQuantity: (productId: string, quantity: number, colorName?: string) => void;
  removeFromCart: (productId: string, colorName?: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
};

const ShopContext = createContext<ShopContextValue | null>(null);
const fallbackHomepage: StoreHomepage = {
  heroImage: '/images/hero-editorial.webp', heroKicker: '', heroTitle: 'أناقة تنسجها', heroTitleAccent: 'التفاصيل',
  heroSubtitle: 'طرحات نصنعها بخامات ناعمة وألوان هادئة، لتكمل أناقتك في كل يوم.',
  primaryButtonLabel: 'اكتشفي المجموعة', primaryButtonUrl: '/categories', secondaryButtonLabel: 'تسوقي الآن', secondaryButtonUrl: '/top-sales',
  featuredProductIds: [], sectionOrder: ['categories','topSales','editorial','featured','why'], promoVisible: true,
  promoTitle: 'ألوان هادئة، تحكي عنك', promoText: 'خامات ناعمة وألوان صممت لترافقك كل يوم.', promoImage: '/images/category-crepe.webp',
};

function readStorage<T>(storage: Storage | undefined, key: string, fallback: T): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ShopProvider({ children }: PropsWithChildren) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(seedProducts);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>(seedCategories);
  const [siteInformation, setSiteInformation] = useState<Record<string, string>>(seedSiteInfo);
  const [shipping, setShipping] = useState(seedShipping);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ name: 'خيوط', currency: 'EGP', lowStockThreshold: 5, acceptingOrders: true });
  const [homepage, setHomepage] = useState<StoreHomepage>(fallbackHomepage);
  const [dataReady, setDataReady] = useState(false);
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(() => {
    const initial = readStorage<CartLine[]>(typeof window === 'undefined' ? undefined : window.localStorage, 'khoyout-cart-v1', []);
    if (!Array.isArray(initial)) return [];
    return initial.filter((line) => line && typeof line.productId === 'string' && Number(line.quantity) > 0)
      .map((line) => ({ productId: line.productId, quantity: Math.max(1, Number(line.quantity)), color: line.color }));
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const initial = readStorage<string[]>(typeof window === 'undefined' ? undefined : window.sessionStorage, 'khoyout-guest-favorites-v1', []);
    return Array.isArray(initial) ? initial.filter((id) => typeof id === 'string') : [];
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const refreshCatalog = useCallback(async () => {
    try {
      const response = await fetch('/api/store/catalog');
      if (!response.ok) throw new Error('CATALOG_API_UNAVAILABLE');
      const payload = await response.json();
      if (Array.isArray(payload.products)) setCatalogProducts(payload.products as Product[]);
      if (Array.isArray(payload.categories)) setCatalogCategories(payload.categories as Category[]);
      if (payload.siteInfo && typeof payload.siteInfo === 'object') setSiteInformation({ ...seedSiteInfo, ...payload.siteInfo });
      if (payload.shipping && typeof payload.shipping === 'object') setShipping({ ...seedShipping, ...payload.shipping });
      if (payload.store && typeof payload.store === 'object') setStoreSettings((current) => ({ ...current, ...payload.store }));
      if (payload.homepage && typeof payload.homepage === 'object') setHomepage((current) => ({ ...current, ...payload.homepage }));
    } catch { /* Static seed content remains usable while the API is offline. */ }
    finally { setDataReady(true); }
  }, []);

  useEffect(() => {
    void refreshCatalog();
    const refresh = () => { void refreshCatalog(); };
    window.addEventListener('khoyout:catalog-updated', refresh);
    let active = true;
    fetch('/api/health').then((response) => response.json()).then((payload) => {
      if (active) setGoogleOAuthConfigured(Boolean(payload.googleOAuthConfigured));
    }).catch(() => { if (active) setGoogleOAuthConfigured(false); });
    return () => { active = false; window.removeEventListener('khoyout:catalog-updated', refresh); };
  }, [refreshCatalog]);

  useEffect(() => {
    if (!dataReady) return;
    setCart((current) => current.flatMap((line) => {
      const product = catalogProducts.find((item) => item.id === line.productId);
      if (!product || product.enabled === false || !product.available || product.stock < 1) return [];
      const selected = product.colorVariants.find((variant) => variant.name === line.color?.name)
        ?? product.colorVariants.find((variant) => variant.name === product.color)
        ?? product.colorVariants[0];
      return [{ productId: product.id, quantity: Math.min(product.stock, Math.max(1, Math.floor(line.quantity) || 1)), color: selected }];
    }));
  }, [dataReady, catalogProducts]);

  const showToast = useCallback((message: string, tone: ToastMessage['tone'] = 'success') => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const setAuthenticatedUser = useCallback(async (nextUser: AuthUser) => {
    setUser(nextUser);
    setFavoritesReady(false);
    try {
      const persisted = await loadUserFavorites(nextUser.id);
      if (persisted) {
        setFavorites((current) => Array.from(new Set([...persisted, ...current])));
      } else {
        showToast('تم الاتصال بالحساب. لحفظ المفضلة بين الجلسات، أكملي ربط FavoritesRepository.', 'info');
      }
    } catch {
      showToast('تم تسجيل الدخول، لكن تعذر تحميل المفضلة من مزود التخزين.', 'error');
    } finally {
      setFavoritesReady(true);
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then((currentUser) => {
      if (mounted && currentUser) void setAuthenticatedUser(currentUser);
    }).catch(() => { /* The storefront remains usable if a provider session cannot be restored. */ });
    return () => { mounted = false; };
  }, [setAuthenticatedUser]);

  useEffect(() => {
    try { window.localStorage.setItem('khoyout-cart-v1', JSON.stringify(cart)); } catch { /* Storage is optional. */ }
  }, [cart]);

  useEffect(() => {
    try { window.sessionStorage.setItem('khoyout-guest-favorites-v1', JSON.stringify(favorites)); } catch { /* Temporary favorites still work in memory. */ }
  }, [favorites]);

  useEffect(() => {
    if (!user || !favoritesReady || !isFavoritesRepositoryConfigured()) return;
    let active = true;
    saveUserFavorites(user.id, favorites).catch(() => {
      if (active) showToast('تعذر مزامنة المفضلة. تحققي من إعداد مزود التخزين.', 'error');
    });
    return () => { active = false; };
  }, [user, favorites, favoritesReady, showToast]);

  const addToCart = useCallback((productId: string, quantity = 1, requestedColor?: ColorVariant) => {
    const product = catalogProducts.find((item) => item.id === productId);
    if (!product || !product.available) {
      showToast('هذه القطعة غير متاحة حاليا.', 'error');
      return;
    }
    const color = product.colorVariants.find((variant) => variant.name === requestedColor?.name)
      ?? product.colorVariants.find((variant) => variant.name === product.color)
      ?? product.colorVariants[0];
    const lineColorName = color?.name ?? product.color;
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId
        && (line.color?.name ?? product.color) === lineColorName);
      const nextQuantity = Math.min(product.stock, (existing?.quantity ?? 0) + Math.max(1, quantity));
      if (existing) return current.map((line) => line === existing ? { ...line, quantity: nextQuantity, color } : line);
      return [...current, { productId, quantity: Math.min(product.stock, Math.max(1, quantity)), color }];
    });
    showToast('أضيفت القطعة إلى سلتك.');
    setCartOpen(true);
  }, [catalogProducts, showToast]);

  const updateCartQuantity = useCallback((productId: string, quantity: number, colorName?: string) => {
    const product = catalogProducts.find((item) => item.id === productId);
    if (!product) return;
    const targetColorName = colorName ?? product.color;
    setCart((current) => current.map((line) => productId === line.productId
      && (line.color?.name ?? product.color) === targetColorName
      ? { ...line, quantity: Math.max(1, Math.min(product.stock, Math.floor(quantity) || 1)) }
      : line));
  }, [catalogProducts]);

  const removeFromCart = useCallback((productId: string, colorName?: string) => {
    const product = catalogProducts.find((item) => item.id === productId);
    if (!product) return;
    const targetColorName = colorName ?? product.color;
    setCart((current) => current.filter((line) => line.productId !== productId
      || (line.color?.name ?? product.color) !== targetColorName));
    showToast('أزيلت القطعة من السلة.', 'info');
  }, [catalogProducts, showToast]);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleFavorite = useCallback((productId: string) => {
    const willRemove = favorites.includes(productId);
    setFavorites((current) => current.includes(productId)
      ? current.filter((item) => item !== productId)
      : [...current, productId]);
    showToast(willRemove ? 'أزيلت من مفضلتك.' : 'أضيفت إلى مفضلتك.');
  }, [favorites, showToast]);

  const value = useMemo<ShopContextValue>(() => ({
    products: catalogProducts,
    categories: catalogCategories,
    siteInfo: siteInformation,
    shippingConfig: shipping,
    storeSettings,
    homepage,
    dataReady,
    googleOAuthConfigured,
    cart,
    favorites,
    user,
    cartCount: cart.reduce((sum, line) => sum + line.quantity, 0),
    menuOpen,
    cartOpen,
    searchOpen,
    authOpen,
    toast,
    setMenuOpen,
    setCartOpen,
    setSearchOpen,
    setAuthOpen,
    setAuthenticatedUser,
    showToast,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    toggleFavorite,
    isFavorite: (productId: string) => favorites.includes(productId),
  }), [catalogProducts, catalogCategories, siteInformation, shipping, storeSettings, homepage, dataReady, googleOAuthConfigured, cart, favorites, user, menuOpen, cartOpen, searchOpen, authOpen, toast, setAuthenticatedUser, showToast, addToCart, updateCartQuantity, removeFromCart, clearCart, toggleFavorite]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}
