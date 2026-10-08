import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowUpLeft, Check, ChevronLeft, ChevronRight, Heart, Instagram,
  Menu, Minus, PackageCheck, Phone, Plus, Search, ShoppingBag, Sparkles, Truck, UserRound, X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { categories, formatPrice, getColorFilter, getProductPrice, Product, searchProducts } from './data';
import { signInWithGoogle } from './auth';
import { CartLine, useShop } from './store';

const TIKTOK_PATH = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 2.99 1.75 4.05 1.12 1.06 2.57 1.59 4.03 1.66v4.24c-1.99-.04-3.92-.67-5.55-1.8-.52-.35-1.02-.76-1.44-1.22v8.82c-.02 1.71-.58 3.4-1.63 4.75-1.53 2.01-4.05 3.08-6.55 2.79-2.71-.31-5.11-2.36-5.82-4.99-.8-2.93.6-6.31 3.25-7.8 1.49-.9 3.29-1.25 5-.94v4.42c-1.47-.48-3.18-.08-4.08 1.19-.91 1.25-.84 3.05.15 4.23 1 1.2 2.84 1.58 4.2.84 1.18-.63 1.88-1.97 1.84-3.3V.02z';

function TikTokIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={TIKTOK_PATH} fill="#25F4EE" transform="translate(-.55 .35)" />
    <path d={TIKTOK_PATH} fill="#FE2C55" transform="translate(.55 -.25)" />
    <path d={TIKTOK_PATH} fill="currentColor" />
  </svg>;
}

export function BrandLogo({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  const { siteInfo } = useShop();
  const brandName = siteInfo.name || 'خيوط';
  return (
    <Link to="/" className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`} onClick={onClick} aria-label={`${brandName} — الرئيسية`}>
      <span className="brand-ornament" aria-hidden="true">۞</span>
      <span className="brand-word">{brandName}</span>
    </Link>
  );
}

export function Header() {
  const { cartCount, favorites, shippingConfig, setMenuOpen, setSearchOpen, setAuthOpen, setCartOpen } = useShop();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [location.pathname]);

  return (
    <>
      <div className="announcement-bar" dir="rtl">
        <span className="announcement-mark" aria-hidden="true">✳</span>
        <span>توصيل مجاني للطلبات فوق <bdi>{formatPrice(shippingConfig.freeThreshold)}</bdi></span>
      </div>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`} dir="rtl">
        <div className="header-inner">
          <button className="icon-button menu-trigger" type="button" aria-label="فتح القائمة" onClick={() => setMenuOpen(true)}>
            <Menu size={22} strokeWidth={1.45} />
            <span className="desktop-action-label">القائمة</span>
          </button>
          <BrandLogo compact />
          <div className="header-actions">
            <button className="icon-button search-trigger" type="button" aria-label="البحث عن منتج" onClick={() => setSearchOpen(true)}>
              <Search size={20} strokeWidth={1.55} /><span className="desktop-action-label">ابحثي</span>
            </button>
            <button className="icon-button favorite-trigger" type="button" aria-label="المفضلة" onClick={() => setAuthOpen(true)}>
              <span className="header-action-icon"><Heart size={20} strokeWidth={1.55} /></span>
              {favorites.length > 0 && <span className="count-dot">{favorites.length}</span>}
              <span className="desktop-action-label">المفضلة</span>
            </button>
            <button className="icon-button cart-trigger" type="button" aria-label="السلة" onClick={() => setCartOpen(true)}>
              <span className="header-action-icon"><ShoppingBag size={20} strokeWidth={1.55} /></span>
              {cartCount > 0 && <span className="count-dot">{cartCount}</span>}
              <span className="desktop-action-label">السلة</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { isFavorite, toggleFavorite } = useShop();
  const favorite = isFavorite(product.id);
  return (
    <article className="product-card" dir="rtl">
      <div className="product-card-visual">
        <Link to={`/product/${product.slug}`} className="product-image-link" aria-label={`شاهدي ${product.name}`}>
          <img className="product-image" src={product.images[0]} alt={`طرحة ${product.name} بلون ${product.colorAr}`} loading="lazy" decoding="async" />
        </Link>
        <button
          type="button"
          className={`favorite-button${favorite ? ' is-favorite' : ''}`}
          aria-label={favorite ? `إزالة ${product.name} من المفضلة` : `إضافة ${product.name} إلى المفضلة`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(product.id)}
        >
          <Heart size={17} strokeWidth={1.55} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="product-card-copy">
        <div className="product-name-line">
          <Link to={`/product/${product.slug}`} className="product-name">{product.name}</Link>
          <span className="product-code" dir="ltr">{product.code}</span>
        </div>
        <span className="product-price-row" dir="ltr">{formatPrice(getProductPrice(product))}{product.discountPrice != null && product.discountPrice < product.price && <del>{formatPrice(product.price)}</del>}</span>
      </div>
    </article>
  );
}

export function ProductGrid({ items, className = '' }: { items: Product[]; className?: string }) {
  return <div className={`product-grid ${className}`}>{items.map((item) => <ProductCard key={item.id} product={item} />)}</div>;
}

function DrawerCartLine({ line }: { line: CartLine }) {
  const { updateCartQuantity, removeFromCart, setCartOpen, products } = useShop();
  const product = products.find((item) => item.id === line.productId);
  if (!product) return null;
  const color = line.color ?? product.colorVariants.find((variant) => variant.name === product.color) ?? product.colorVariants[0];
  const filter = getColorFilter(product.color, color?.name ?? product.color);
  return (
    <div className="drawer-cart-row" dir="rtl">
      <Link to={`/product/${product.slug}`} className="drawer-cart-image" onClick={() => setCartOpen(false)}>
        <img src={product.images[0]} alt={product.name} loading="lazy" decoding="async" style={{ filter }} />
      </Link>
      <div className="drawer-cart-info">
        <Link to={`/product/${product.slug}`} className="drawer-cart-name" onClick={() => setCartOpen(false)}>{product.name}</Link>
        <span className="product-code" dir="ltr">{product.code}</span>
        <span className="drawer-cart-color">{color?.nameAr ?? product.colorAr}</span>
        <div className="drawer-cart-bottom">
          <div className="qty-control qty-control--small" dir="ltr" aria-label="تعديل الكمية">
            <button type="button" aria-label="تقليل الكمية" onClick={() => updateCartQuantity(product.id, line.quantity - 1, color?.name)}><Minus size={13} /></button>
            <span>{line.quantity}</span>
            <button type="button" aria-label="زيادة الكمية" onClick={() => updateCartQuantity(product.id, line.quantity + 1, color?.name)}><Plus size={13} /></button>
          </div>
          <span className="product-price" dir="ltr">{formatPrice(product.price * line.quantity)}</span>
        </div>
      </div>
      <button className="remove-line" type="button" aria-label={`إزالة ${product.name}`} onClick={() => removeFromCart(product.id, color?.name)}><X size={16} /></button>
    </div>
  );
}

function CartDrawer() {
  const { cart, setCartOpen, products, shippingConfig } = useShop();
  const lines = cart.map((line) => ({ ...line, product: products.find((item) => item.id === line.productId) })).filter((line) => line.product);
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= shippingConfig.freeThreshold ? 0 : shippingConfig.standardFee;
  return (
    <>
      <div className="modal-scrim" onClick={() => setCartOpen(false)} />
      <aside className="side-drawer cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" dir="rtl">
        <div className="drawer-heading">
          <div><span className="eyebrow">اختياراتك</span><h2 id="cart-drawer-title">سلتك <span className="drawer-count">({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2></div>
          <button className="icon-button" type="button" aria-label="إغلاق السلة" onClick={() => setCartOpen(false)}><X size={21} /></button>
        </div>
        {lines.length === 0 ? (
          <div className="drawer-empty empty-state">
            <span className="empty-icon"><ShoppingBag size={25} strokeWidth={1.3} /></span>
            <h3>سلتك لسه فاضية</h3>
            <p>اكتشفي مجموعتنا واختاري اللي يناسبك.</p>
            <Link to="/categories" className="button button--primary" onClick={() => setCartOpen(false)}>اكتشفي المجموعة <ArrowLeft size={16} /></Link>
          </div>
        ) : (
          <>
            <div className="drawer-cart-list">{lines.map((line) => <DrawerCartLine key={`${line.productId}-${line.color?.name ?? ''}`} line={line} />)}</div>
            <div className="drawer-shipping-note"><Truck size={17} strokeWidth={1.5} />{subtotal >= shippingConfig.freeThreshold ? 'تهانينا، حصلت على التوصيل المجاني.' : `أضيفي ${formatPrice(shippingConfig.freeThreshold - subtotal)} لتحصلي على التوصيل المجاني.`}</div>
            <div className="drawer-total-line"><span>الإجمالي</span><strong dir="ltr">{formatPrice(subtotal + shipping)}</strong></div>
            <span className="drawer-total-caption">{shipping === 0 ? 'يشمل التوصيل المجاني' : `يشمل التوصيل ${formatPrice(shipping)}`}</span>
            <Link to="/checkout" className="button button--primary button--wide" onClick={() => setCartOpen(false)}>متابعة إلى الدفع <ArrowLeft size={17} /></Link>
            <Link to="/cart" className="text-link drawer-cart-link" onClick={() => setCartOpen(false)}>عرض السلة كاملة <ArrowLeft size={15} /></Link>
          </>
        )}
        <div className="drawer-bottom-mark"><span>خيوط</span></div>
      </aside>
    </>
  );
}

function SideMenu() {
  const { setMenuOpen, setSearchOpen, setAuthOpen, siteInfo } = useShop();
  const navigate = useNavigate();
  const close = () => setMenuOpen(false);
  const items = [
    { label: 'الرئيسية', to: '/' },
    { label: 'التصنيفات', to: '/categories' },
    { label: 'الأكثر مبيعا', to: '/top-sales' },
    { label: 'المفضلة', to: '/favorites' },
    { label: 'السلة', to: '/cart' },
    { label: 'من نحن', to: '/about' },
    { label: 'تواصل معنا', to: '/contact' },
  ];
  return (
    <>
      <div className="modal-scrim" onClick={close} />
      <aside className="side-drawer menu-drawer" role="dialog" aria-modal="true" aria-label="القائمة الرئيسية" dir="rtl">
        <div className="drawer-heading menu-heading"><BrandLogo onClick={close} /><button className="icon-button" type="button" aria-label="إغلاق القائمة" onClick={close}><X size={21} /></button></div>
        <p className="eyebrow menu-eyebrow">تصفحي خيوط</p>
        <nav className="drawer-nav">
          {items.map((item) => (
            <Link to={item.to} key={item.to} onClick={close}>
              <span>{item.label}</span><ArrowUpLeft size={17} strokeWidth={1.35} />
            </Link>
          ))}
        </nav>
        <div className="menu-shortcuts">
          <button type="button" onClick={() => { close(); setSearchOpen(true); }}><Search size={17} /> ابحثي عن قطعة</button>
          <button type="button" onClick={() => { close(); setAuthOpen(true); }}><UserRound size={16} strokeWidth={1.5} /> تسجيل الدخول</button>
        </div>
        <div className="drawer-socials" aria-label="تابعينا على"><span className="social-label">تابعينا على</span><a href={siteInfo.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a><a href={siteInfo.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><TikTokIcon /></a><a href={`https://wa.me/${siteInfo.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Phone size={16} /></a></div>
      </aside>
    </>
  );
}

function SearchOverlay() {
  const { setSearchOpen, products, categories } = useShop();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const allMatches = useMemo(() => searchProducts(query, products, categories), [query, products, categories]);
  const matches = allMatches.slice(0, 4);
  const close = () => setSearchOpen(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    close();
    navigate(clean ? `/search?q=${encodeURIComponent(clean)}` : '/search');
  };
  return (
    <div className="search-layer" role="dialog" aria-modal="true" aria-label="البحث" dir="rtl">
      <button className="search-scrim" type="button" aria-label="إغلاق البحث" onClick={close} />
      <div className="search-panel">
        <div className="search-panel-top"><span className="eyebrow">شيء على ذوقك</span><button className="icon-button" type="button" aria-label="إغلاق" onClick={close}><X size={21} /></button></div>
        <form className="search-form" onSubmit={submit}>
          <Search size={21} strokeWidth={1.5} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي بالاسم، الخامة أو اللون..." aria-label="ابحثي عن منتج" />
          {query && <button className="search-clear" type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={16} /></button>}
          <button className="search-submit" type="submit" aria-label="عرض النتائج"><ArrowLeft size={19} /></button>
        </form>
        {query.trim() ? (
          <div className="search-results">
            <div className="search-results-heading"><span>نتائج مقترحة</span><span>{matches.length} من {allMatches.length}</span></div>
            {matches.length ? matches.map((product) => (
              <Link key={product.id} to={`/product/${product.slug}`} className="search-result-row" onClick={close}>
                <img src={product.images[0]} alt="" loading="lazy" decoding="async" /><span className="search-result-text"><strong>{product.name}</strong><small dir="ltr">{product.code}</small></span><span dir="ltr">{formatPrice(product.price)}</span><ChevronLeft size={16} />
              </Link>
            )) : <div className="search-no-results"><span className="eyebrow">جربي كلمة مختلفة</span><p>ملقيناش اللي بتدوري عليه.</p></div>}
            {matches.length > 0 && <button className="search-all-link" type="button" onClick={submit}>عرض كل النتائج <ArrowLeft size={15} /></button>}
          </div>
        ) : (
          <div className="popular-searches"><span className="eyebrow">الأكثر بحثا</span><div>{['شيفون', 'ساتان', 'وردي غباري', 'أزرق بودري'].map((term) => <button type="button" key={term} onClick={() => setQuery(term)}>{term}</button>)}</div></div>
        )}
        <p className="search-bottom-note">ابحثي باسم القطعة أو كودها أو لونها المفضل.</p>
      </div>
    </div>
  );
}

function AuthModal() {
  const { setAuthOpen, googleOAuthConfigured } = useShop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const close = () => { setAuthOpen(false); setError(''); };
  const startGoogleSignIn = () => {
    setError('');
    if (!googleOAuthConfigured) {
      setError('يلزم إعداد GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET على الخادم لإكمال تسجيل Google.');
      return;
    }
    setLoading(true);
    signInWithGoogle(`${window.location.pathname}${window.location.search}` || '/favorites');
  };
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="auth-title" dir="rtl">
      <button className="modal-scrim" type="button" aria-label="إغلاق نافذة الدخول" onClick={close} />
      <div className="auth-modal">
        <button className="icon-button modal-close" type="button" aria-label="إغلاق" onClick={close}><X size={20} /></button>
        <span className="auth-emblem"><Heart size={22} strokeWidth={1.4} /></span>
        <span className="eyebrow">مساحتك الخاصة</span>
        <h2 id="auth-title">قطعتك المفضلة،<br /><em>في مكان واحد.</em></h2>
        <p>سجلي الدخول لحفظ اختياراتك ومتابعتها في أي وقت.</p>
        <button className="google-button" type="button" onClick={startGoogleSignIn} disabled={loading}>
          <span className="google-g" aria-hidden="true">G</span>{loading ? 'جار الاتصال...' : 'تسجيل الدخول باستخدام Google'}
        </button>
        {error && <p className="auth-config-note" role="status">{error}</p>}
        <span className="auth-privacy">حسابك ومعلوماتك في أمان. لا نشارك بياناتك مع أحد.</span>
      </div>
    </div>
  );
}

function ToastNotice() {
  const { toast } = useShop();
  if (!toast) return null;
  return (
    <div className={`toast-notice toast--${toast.tone}`} role="status" aria-live="polite" key={toast.id} dir="rtl">
      <span className="toast-icon">{toast.tone === 'error' ? <X size={15} /> : <Check size={15} />}</span>{toast.message}
    </div>
  );
}

export function GlobalOverlays() {
  const { menuOpen, cartOpen, searchOpen, authOpen, setMenuOpen, setCartOpen, setSearchOpen, setAuthOpen } = useShop();
  const anyOpen = menuOpen || cartOpen || searchOpen || authOpen;
  useEffect(() => {
    if (!anyOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false); setCartOpen(false); setSearchOpen(false); setAuthOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anyOpen, setMenuOpen, setCartOpen, setSearchOpen, setAuthOpen]);
  return <>
    {menuOpen && <SideMenu />}
    {cartOpen && <CartDrawer />}
    {searchOpen && <SearchOverlay />}
    {authOpen && <AuthModal />}
    <ToastNotice />
  </>;
}

export function Footer() {
  const { showToast, siteInfo } = useShop();
  const submitNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    showToast('وصلنا بريدك — شكرا لانضمامك إلى خيوط.');
    form.reset();
  };
  return (
    <footer className="site-footer" dir="rtl">
      <div className="footer-top">
        <div className="footer-brand-column"><BrandLogo /><p>{siteInfo.tagline || 'أناقة تنسجها التفاصيل.'}<br />طرحات نصنعها لترافق يومك.</p><div className="footer-socials"><span className="social-label">تابعينا على</span><a href={siteInfo.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a><a href={siteInfo.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><TikTokIcon /></a><a href={`https://wa.me/${siteInfo.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Phone size={16} /></a></div></div>
        <div className="footer-links-column"><span className="footer-heading">تصفحي</span><Link to="/">الرئيسية</Link><Link to="/categories">التصنيفات</Link><Link to="/top-sales">الأكثر مبيعا</Link><Link to="/about">من نحن</Link><Link to="/contact">تواصل معنا</Link></div>
        <div className="footer-links-column"><span className="footer-heading">مساعدتك</span><Link to="/contact">الشحن والتوصيل</Link><Link to="/contact">سياسة الاسترجاع</Link><Link to="/contact">الأسئلة الشائعة</Link><a href={`mailto:${siteInfo.email}`}>راسلينا</a></div>
        <div className="footer-newsletter"><h3>اشتركي في خيوط</h3><p>أفكار تنسيق، ألوان جديدة، وحكايات صغيرة تصلك بلطف.</p><form onSubmit={submitNewsletter} className="newsletter-form"><input type="email" dir="ltr" placeholder="بريدك الإلكتروني" aria-label="بريدك الإلكتروني" required /><button type="submit" aria-label="اشتراك"><ArrowLeft size={17} /></button></form></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Khoyout. All rights reserved.</span><span className="footer-signoff"><bdi>Khoyout</bdi><span>صنعت بحب في مصر</span></span><a href="#root" className="back-to-top">إلى الأعلى <ArrowUpLeft size={14} /></a></div>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: { label: string; to: string } }) {
  return (
    <div className="section-heading" dir="rtl">
      <div className="section-heading-copy">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action && <Link to={action.to} className="text-link section-heading-action">{action.label}<ArrowLeft size={16} /></Link>}
    </div>
  );
}

export function CategoryTile({ category, index = 0 }: { category: typeof categories[number]; index?: number }) {
  return (
    <Link to={`/category/${category.slug}`} className={`category-tile category-tile--${index + 1}`} dir="rtl" aria-label={`تصفحي طرح ${category.nameAr} ${category.nameEn}`}>
      <span className="category-circle"><img src={category.image} alt={`نسيج خامة ${category.nameAr}`} loading="lazy" decoding="async" /></span>
      <span className="category-tile-content"><span className="category-en" dir="ltr">{category.nameEn}</span><strong className="category-ar">{category.nameAr}</strong><span className="category-note">{category.note}</span></span>
    </Link>
  );
}

export function EmptyState({ icon = 'bag', title, description, actionLabel = 'اكتشفي المجموعة', actionTo = '/categories' }: { icon?: 'bag' | 'heart' | 'search'; title: string; description: string; actionLabel?: string; actionTo?: string }) {
  const Icon = icon === 'heart' ? Heart : icon === 'search' ? Search : ShoppingBag;
  return (
    <div className="empty-state page-empty" dir="rtl">
      <span className="empty-icon"><Icon size={27} strokeWidth={1.35} /></span>
      <span className="eyebrow">مساحة تنتظر اختيارك</span>
      <h2>{title}</h2><p>{description}</p>
      <Link to={actionTo} className="button button--primary">{actionLabel}<ArrowLeft size={16} /></Link>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return <nav className="breadcrumbs" aria-label="مسار الصفحة" dir="rtl"><Link to="/">الرئيسية</Link>{items.map((item, index) => <span key={`${item.label}-${index}`} className="breadcrumb-part"><ChevronLeft size={13} />{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}

export function TrustStrip() {
  const items = [
    { icon: Truck, title: 'توصيل لكل مصر', detail: 'خلال ٢–٥ أيام عمل' },
    { icon: PackageCheck, title: 'تغليف يليق بك', detail: 'تفاصيل نحبها' },
    { icon: Sparkles, title: 'طرحات نصنعها', detail: 'بمحبة في مصر' },
  ];
  return <div className="trust-strip" dir="rtl">{items.map(({ icon: Icon, title, detail }) => <div className="trust-item" key={title}><span className="trust-icon"><Icon size={19} strokeWidth={1.4} /></span><span><strong>{title}</strong><small>{detail}</small></span></div>)}</div>;
}
