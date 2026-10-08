import { FormEvent, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronDown, CreditCard, Heart, Layers3, Leaf, Minus,
  PackageCheck, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Truck, X,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Category, ColorVariant, formatPrice, getCategoryBySlug, getColorFilter, getProductBySlug, getProductPrice, Product,
  searchProducts,
} from './data';
import { Breadcrumbs, CategoryTile, EmptyState, ProductGrid, SectionHeading, TrustStrip } from './components';
import { CartLine, useShop } from './store';
import { createOrder, getLastOrder, OrderRecord, validateCoupon } from './orders';

function Reveal({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal${visible ? ' is-visible' : ''} ${className}`}>{children}</div>;
}

function Hero() {
  const { homepage, siteInfo } = useShop();
  return (
    <section className="hero-section" aria-labelledby="hero-title" dir="rtl">
      <img className="hero-image" src={homepage.heroImage || '/images/hero-editorial.webp'} alt="إطلالة ناعمة بطرحة خفيفة من خيوط" fetchPriority="high" decoding="async" />
      <div className="hero-wash" />
      <div className="hero-inner">
        <div className="hero-copy">
          {homepage.heroKicker?.trim() && <p className="hero-kicker"><span className="kicker-star">✳</span> {homepage.heroKicker}</p>}
          <span className="hero-brand-word">{siteInfo.name || 'خيوط'}</span>
          <h1 id="hero-title">{homepage.heroTitle}<br /><em>{homepage.heroTitleAccent}</em></h1>
          <p className="hero-description">{homepage.heroSubtitle}</p>
          <div className="hero-actions">
            <Link to={homepage.primaryButtonUrl || '/categories'} className="button button--primary">{homepage.primaryButtonLabel || 'اكتشفي المجموعة'} <ArrowLeft size={17} /></Link>
            <Link to={homepage.secondaryButtonUrl || '/top-sales'} className="button button--quiet">{homepage.secondaryButtonLabel || 'تسوقي الآن'} <ArrowLeft size={16} /></Link>
          </div>
          <div className="hero-footnote"><span>نصنعها في مصر، بكل حب</span></div>
        </div>
      </div>
    </section>
  );
}

function HomePage() {
  const { products, categories, homepage } = useShop();
  const topSales = products.filter((product) => product.topSales).slice(0, 5);
  const configuredFeatured = homepage.featuredProductIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  const featured = configuredFeatured.length ? configuredFeatured : products.filter((product) => product.featured && !product.topSales).slice(0, 4);
  return (
    <main className="home-page" id="top" dir="rtl">
      <div className="page-gutter"><Hero /></div>
      <div className="page-gutter"><TrustStrip /></div>
      <section className="home-section categories-section page-gutter" id="categories">
        <Reveal><SectionHeading eyebrow="تصنيفات خيوط" title="اكتشفي الخامات" description="شيفون، ساتان، قطن، كريب، ومودال — لكل خامة إحساسها." action={{ label: 'كل التصنيفات', to: '/categories' }} /></Reveal>
        <div className="category-grid">{categories.map((category, index) => <Reveal key={category.id} className="category-reveal"><CategoryTile category={category} index={index} /></Reveal>)}</div>
      </section>
      <section className="home-section bestseller-section page-gutter" id="top-sales">
        <Reveal><SectionHeading eyebrow="من صنع خيوط" title="الأكثر مبيعا" description="طرحات أحببتنها، من صنع خيوط." action={{ label: 'عرض الكل', to: '/top-sales' }} /></Reveal>
        <Reveal className="product-section-reveal"><ProductGrid items={topSales} className="product-grid--home" /></Reveal>
      </section>
      {homepage.promoVisible && <section className="editorial-section page-gutter" dir="rtl">
        <Reveal className="editorial-reveal">
          <div className="editorial-layout">
            <div className="editorial-visual">
              <img src={homepage.promoImage || '/images/category-crepe.webp'} alt="صورة من مجموعة خيوط" loading="lazy" decoding="async" />
              <div className="editorial-image-caption"><span>THE ART OF A SOFTER DAY</span><i /></div>
              <div className="editorial-floating-note"><span className="eyebrow">من قلب التفاصيل</span><strong>كل خيط<br />يحكي حكاية.</strong></div>
            </div>
            <div className="editorial-copy">
              <span className="eyebrow editorial-kicker">لمسة من خيوط</span>
              <h2>{homepage.promoTitle}</h2>
              <p>{homepage.promoText}</p>
              <Link to="/about" className="text-link">حكاية خيوط <ArrowLeft size={16} /></Link>
              <span className="editorial-watermark" aria-hidden="true">خ</span>
            </div>
          </div>
        </Reveal>
      </section>}
      <section className="home-section featured-section page-gutter">
        <Reveal><SectionHeading eyebrow="من أحدث إصدارات خيوط" title="رفيقات كل يوم" description="طرحات ناعمة نصنعها لترافق يومك." /></Reveal>
        <Reveal><ProductGrid items={featured} className="product-grid--home" /></Reveal>
      </section>
      <section className="why-section page-gutter" dir="rtl">
        <Reveal>
          <div className="why-heading"><span className="eyebrow">لماذا خيوط؟</span><h2>جمال في البساطة.<br /><em>وراحة في كل اختيار.</em></h2></div>
          <div className="why-grid">
            <div className="why-item"><span className="why-no" dir="ltr">01</span><span className="why-icon"><Layers3 size={22} strokeWidth={1.35} /></span><h3>خامات ناعمة نعتني بها</h3><p>ملمس يريحك، وجودة تشعرين بها من أول لمسة.</p></div>
            <div className="why-item"><span className="why-no" dir="ltr">02</span><span className="why-icon"><Sparkles size={22} strokeWidth={1.35} /></span><h3>ألوان سهلة التنسيق</h3><p>درجات هادئة تكمل إطلالتك، لا تنافسها.</p></div>
            <div className="why-item"><span className="why-no" dir="ltr">03</span><span className="why-icon"><Leaf size={22} strokeWidth={1.35} /></span><h3>أناقة يومية بلا تكلف</h3><p>تصاميم بسيطة ترافق إيقاع يومك كما هو.</p></div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function CategoriesPage() {
  const { categories } = useShop();
  return (
    <main className="page-shell categories-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'التصنيفات' }]} />
      <div className="page-intro page-intro--wide">
        <span className="eyebrow">ملمس يشبهك</span>
        <h1>اختاري خامتك<br /><em>على مهل.</em></h1>
        <p>من خفة الشيفون إلى نعومة المودال، اكتشفي خامات خيوط بتفاصيلها الهادئة.</p>
        <span className="intro-count" dir="ltr">05 — FABRIC STORIES</span>
      </div>
      <div className="category-grid category-grid--large">{categories.map((category, index) => <CategoryTile key={category.id} category={category} index={index} />)}</div>
      <section className="category-page-bottom"><span className="eyebrow">لا تعرفين من أين تبدئين؟</span><h2>ابدئي بما يلامس يومك.</h2><p>كل خامة تحمل إحساسا مختلفا؛ اختاري القطعة التي تناسب إيقاعك.</p><Link to="/top-sales" className="button button--primary">الأكثر مبيعا <ArrowLeft size={16} /></Link></section>
    </main>
  );
}

type Filters = { fabric: string; color: string; min: string; max: string; available: boolean; category: string };
const emptyFilters: Filters = { fabric: '', color: '', min: '', max: '', available: false, category: '' };

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'bestselling';

function FilterSheet({
  filters, setFilters, onClose, onReset, allowCategory,
}: { filters: Filters; setFilters: (filters: Filters) => void; onClose: () => void; onReset: () => void; allowCategory: boolean }) {
  const { products, categories } = useShop();
  const colors = Array.from(new Map(products.map((product) => [product.color, { name: product.color, ar: product.colorAr }])).values());
  const patch = (updates: Partial<Filters>) => setFilters({ ...filters, ...updates });
  return (
    <>
      <button className="filter-scrim" type="button" aria-label="إغلاق التصفية" onClick={onClose} />
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title" dir="rtl">
        <div className="filter-sheet-heading"><div><span className="eyebrow">ببساطة، كما تحبين</span><h2 id="filter-title">تصفية القطع</h2></div><button className="icon-button" type="button" aria-label="إغلاق" onClick={onClose}><X size={20} /></button></div>
        {allowCategory && <label className="filter-field"><span>التصنيف</span><span className="select-wrap"><select value={filters.category} onChange={(event) => patch({ category: event.target.value })}><option value="">كل التصنيفات</option>{categories.map((category) => <option key={category.id} value={category.slug}>{category.nameAr}</option>)}</select><ChevronDown size={15} /></span></label>}
        <label className="filter-field"><span>الخامة</span><span className="select-wrap"><select value={filters.fabric} onChange={(event) => patch({ fabric: event.target.value })}><option value="">كل الخامات</option>{Array.from(new Set(products.map((product) => product.fabric))).map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}</select><ChevronDown size={15} /></span></label>
        <label className="filter-field"><span>اللون</span><span className="select-wrap"><select value={filters.color} onChange={(event) => patch({ color: event.target.value })}><option value="">كل الألوان</option>{colors.map((color) => <option key={color.name} value={color.name}>{color.ar}</option>)}</select><ChevronDown size={15} /></span></label>
        <div className="filter-field"><span>نطاق السعر <small dir="ltr">(EGP)</small></span><div className="price-range-inputs"><label><span className="sr-only">أقل سعر</span><input type="number" min="0" placeholder="من" value={filters.min} onChange={(event) => patch({ min: event.target.value })} /></label><span>—</span><label><span className="sr-only">أعلى سعر</span><input type="number" min="0" placeholder="إلى" value={filters.max} onChange={(event) => patch({ max: event.target.value })} /></label></div></div>
        <label className="available-toggle"><input type="checkbox" checked={filters.available} onChange={(event) => patch({ available: event.target.checked })} /><span className="custom-check"><Check size={12} /></span><span>المتاح حاليا فقط</span></label>
        <div className="filter-sheet-actions"><button type="button" className="button button--quiet" onClick={onReset}>إعادة ضبط</button><button type="button" className="button button--primary" onClick={onClose}>عرض النتائج <ArrowLeft size={16} /></button></div>
      </section>
    </>
  );
}

function ProductListing({
  items, title, description, eyebrow = 'طرحات من صنع خيوط', currentCategory, allowCategory = false, image,
}: { items: Product[]; title: string; description?: string; eyebrow?: string; currentCategory?: Category; allowCategory?: boolean; image?: string }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<SortOption>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const activeCount = Number(Boolean(filters.fabric)) + Number(Boolean(filters.color)) + Number(Boolean(filters.min || filters.max)) + Number(filters.available) + Number(Boolean(filters.category));
  const filteredItems = useMemo(() => {
    const result = items.filter((product) => {
      if (filters.fabric && product.fabric !== filters.fabric) return false;
      if (filters.color && product.color !== filters.color) return false;
      if (filters.category && product.category !== filters.category) return false;
      if (filters.available && !product.available) return false;
      if (filters.min && getProductPrice(product) < Number(filters.min)) return false;
      if (filters.max && getProductPrice(product) > Number(filters.max)) return false;
      return true;
    });
    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return getProductPrice(a) - getProductPrice(b);
      if (sort === 'price-desc') return getProductPrice(b) - getProductPrice(a);
      if (sort === 'bestselling') return Number(b.topSales) - Number(a.topSales) || a.price - b.price;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items, filters, sort]);
  return (
    <main className="page-shell listing-page" dir="rtl">
      <Breadcrumbs items={currentCategory ? [{ label: 'التصنيفات', to: '/categories' }, { label: currentCategory.nameAr }] : [{ label: title }]} />
      {image && <div className="collection-hero"><img src={image} alt="" fetchPriority="high" decoding="async" /><span className="collection-hero-wash" /></div>}
      <div className="listing-intro">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
        <span className="listing-count"><b>{filteredItems.length.toString().padStart(2, '0')}</b><span>قطعة<br />من خيوط</span></span>
      </div>
      <div className="listing-toolbar">
        <button className={`filter-trigger-button${activeCount ? ' has-filter' : ''}`} type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={17} /> التصفية {activeCount > 0 && <span>{activeCount}</span>}</button>
        <div className="toolbar-sort"><span>ترتيب حسب</span><span className="select-wrap"><select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} aria-label="ترتيب المنتجات"><option value="newest">الأحدث</option><option value="price-asc">السعر: من الأقل</option><option value="price-desc">السعر: من الأعلى</option><option value="bestselling">الأكثر مبيعا</option></select><ChevronDown size={14} /></span></div>
        <span className="toolbar-total">عرض {filteredItems.length} قطعة</span>
      </div>
      {filterOpen && <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setFilterOpen(false)} onReset={() => setFilters(emptyFilters)} allowCategory={allowCategory} />}
      {filteredItems.length ? <ProductGrid items={filteredItems} className="listing-grid" /> : <div className="listing-no-results"><EmptyState icon="search" title="ملقيناش اللي بتدوري عليه." description="جربي تغيير خيارات التصفية أو اختيار خامة مختلفة." actionLabel="إعادة ضبط التصفية" actionTo="/categories" /></div>}
    </main>
  );
}

function CategoryPage() {
  const { slug } = useParams();
  const { products, categories } = useShop();
  const category = getCategoryBySlug(slug, categories);
  if (!category) return <NotFoundPage />;
  const items = products.filter((product) => product.category === category.slug);
  return <ProductListing items={items} currentCategory={category} title={`${category.nameAr} ${category.nameEn}`} description={`${category.note} — اكتشفي طرحاتنا المصنوعة من خامة ${category.nameAr}.`} eyebrow={`خامات خيوط / ${category.nameEn}`} image={category.image} />;
}

function TopSalesPage() {
  const { products } = useShop();
  const items = products.filter((product) => product.topSales);
  return <ProductListing items={items} title="الأكثر مبيعا" description="طرحات من صنع خيوط، صنعت لترافق يومك." eyebrow="محبوبة من أول لمسة" />;
}

function SearchPage() {
  const { products, categories } = useShop();
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const matches = query ? searchProducts(query, products, categories) : products;
  return <ProductListing items={matches} title={query ? `نتائج البحث عن «${query}»` : 'كل القطع'} description={query ? `وجدنا ${matches.length} قطعة قد تناسب ذوقك.` : 'تصفحي مجموعة خيوط واكتشفي ما يشبهك.'} eyebrow="بحث خيوط" allowCategory />;
}

function QuantityControl({ value, onChange, max, label = 'الكمية' }: { value: number; onChange: (value: number) => void; max: number; label?: string }) {
  return <div className="qty-control" dir="ltr" aria-label={label}><button type="button" aria-label="تقليل الكمية" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}><Minus size={14} /></button><span aria-live="polite">{value}</span><button type="button" aria-label="زيادة الكمية" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}><Plus size={14} /></button></div>;
}

function ProductDetailsPage() {
  const { slug } = useParams();
  const { products, shippingConfig, addToCart, toggleFavorite, isFavorite } = useShop();
  const product = getProductBySlug(slug, products);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColorName, setSelectedColorName] = useState('');
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    setSelectedImage(0);
    setQuantity(1);
    setSelectedColorName(product?.color ?? '');
  }, [slug, product?.color]);
  if (!product) return <NotFoundPage />;
  const favorite = isFavorite(product.id);
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const activeColor: ColorVariant = product.colorVariants.find((variant) => variant.name === selectedColorName)
    ?? product.colorVariants.find((variant) => variant.name === product.color)
    ?? product.colorVariants[0]
    ?? { name: product.color, nameAr: product.colorAr, hex: '#cbb9a9' };
  const colorFilter = getColorFilter(product.color, activeColor.name);
  return (
    <main className="page-shell product-detail-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'التصنيفات', to: '/categories' }, { label: product.categoryName, to: `/category/${product.category}` }, { label: product.name }]} />
      <div className="product-detail-layout">
        <div className="product-gallery">
          <div className="product-main-image"><img src={product.images[selectedImage] ?? product.images[0]} alt={`${product.name} — طرحة بلون ${activeColor.nameAr}`} style={{ filter: colorFilter }} fetchPriority="high" decoding="async" /><span className="gallery-counter" dir="ltr">0{selectedImage + 1} / 0{product.images.length}</span></div>
          {product.images.length > 1 && <div className="product-thumbnails" aria-label="صور المنتج">{product.images.map((src, index) => <button type="button" key={`${src}-${index}`} className={selectedImage === index ? 'is-selected' : ''} onClick={() => setSelectedImage(index)} aria-label={`عرض الصورة ${index + 1}`} aria-pressed={selectedImage === index}><img src={src} alt="" loading="lazy" decoding="async" style={{ filter: colorFilter }} /></button>)}</div>}
        </div>
        <div className="product-detail-info">
          <div className="product-detail-overline"><span className="eyebrow">{product.categoryName} / {product.fabric}</span><button type="button" className={`detail-favorite${favorite ? ' is-favorite' : ''}`} aria-label={favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} aria-pressed={favorite} onClick={() => toggleFavorite(product.id)}><Heart size={20} strokeWidth={1.5} fill={favorite ? 'currentColor' : 'none'} /></button></div>
          <h1>{product.name}</h1><span className="detail-code" dir="ltr">{product.code}</span>
          <div className="detail-price" dir="ltr">{formatPrice(getProductPrice(product))}{product.discountPrice != null && product.discountPrice < product.price && <del>{formatPrice(product.price)}</del>}</div>
          <p className="detail-lead">{product.shortDescription}</p>
          <div className="detail-separator" />
          <p className="detail-description">{product.description}</p>
          <div className="detail-attributes">
            <div><span>الخامة</span><strong>{product.fabric}</strong></div>
            <div><span>اللون</span><strong><i className="color-swatch" style={{ background: activeColor.hex }} />{activeColor.nameAr}</strong></div>
            <div><span>التوفر</span><strong className={product.available ? 'stock-status' : 'stock-status stock-status--out'}><i />{product.available ? (product.stock < 6 ? 'عدد محدود' : 'متاح') : 'غير متاح'}</strong></div>
          </div>
          <div className="purchase-controls">
            <div className="purchase-quantity-row"><span className="purchase-label">الكمية</span><QuantityControl value={quantity} onChange={setQuantity} max={product.stock || 1} /></div>
            <div className="color-variant-picker" aria-label="اختيار اللون">
              <div className="color-variant-heading"><span>اختاري اللون</span><strong>{activeColor.nameAr}</strong></div>
              <div className="color-variant-swatches" role="group" aria-label="الألوان المتاحة">
                {product.colorVariants.map((variant) => <button
                  key={variant.name}
                  type="button"
                  className={`color-variant-button${activeColor.name === variant.name ? ' is-selected' : ''}`}
                  aria-label={variant.nameAr}
                  aria-pressed={activeColor.name === variant.name}
                  title={variant.nameAr}
                  onClick={() => setSelectedColorName(variant.name)}
                ><span style={{ backgroundColor: variant.hex }} /></button>)}
              </div>
            </div>
            <button className="button button--primary add-to-cart-button" type="button" disabled={!product.available} onClick={() => addToCart(product.id, quantity, activeColor)}>{product.available ? 'أضيفي إلى السلة' : 'غير متاح حاليا'}<ShoppingBagIcon /></button>
          </div>
          <div className="product-perks"><div><Truck size={18} strokeWidth={1.4} /><span>توصيل لجميع المحافظات</span></div><div><RotateCcw size={18} strokeWidth={1.4} /><span>استبدال سهل خلال 14 يوما</span></div></div>
          <div className="product-accordions">
            <details open><summary>عن القطعة <ChevronDown size={16} /></summary><p>{product.description}</p></details>
            <details><summary>الشحن والتوصيل <ChevronDown size={16} /></summary><p>التوصيل متاح لجميع أنحاء مصر. رسوم الشحن {formatPrice(shippingConfig.standardFee)}، ومجانا للطلبات التي تتجاوز {formatPrice(shippingConfig.freeThreshold)}.</p></details>
            <details><summary>العناية بالخامة <ChevronDown size={16} /></summary><p>يفضل الغسيل اليدوي بماء بارد، وتجفيف القطعة بعيدا عن أشعة الشمس المباشرة للحفاظ على نعومة الخامة ولونها.</p></details>
          </div>
          <span className="detail-bottom-note"><ShieldCheck size={15} /> تسوق هادئ وواضح — الدفع عند الاستلام.</span>
        </div>
      </div>
      {related.length > 0 && <section className="related-section"><SectionHeading eyebrow="قد تعجبك أيضا" title="قطع قريبة من ذوقك" action={{ label: 'كل المجموعة', to: `/category/${product.category}` }} /><ProductGrid items={related} className="product-grid--related" /></section>}
    </main>
  );
}

function ShoppingBagIcon() { return <ArrowLeft size={17} />; }

function FavoritePage() {
  const { favorites, products, setAuthOpen } = useShop();
  const favoriteProducts = favorites.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  return (
    <main className="page-shell favorites-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'المفضلة' }]} />
      <div className="listing-intro"><div><span className="eyebrow">قطع لامست ذوقك</span><h1>مفضلتك</h1><p>اختياراتك الصغيرة، في مكان واحد.</p></div><span className="listing-count"><b>{favoriteProducts.length.toString().padStart(2, '0')}</b><span>قطعة<br />مختارة</span></span></div>
      {favoriteProducts.length ? <>
        <div className="favorites-account-note"><span className="favorites-note-icon"><Heart size={18} /></span><div><strong>هذه القائمة محفوظة مؤقتا على جهازك.</strong><span>سجلي الدخول باستخدام Google لتبقى مفضلتك معك بين الجلسات.</span></div><button type="button" className="text-link" onClick={() => setAuthOpen(true)}>تسجيل الدخول <ArrowLeft size={15} /></button></div>
        <ProductGrid items={favoriteProducts} className="listing-grid" />
      </> : <EmptyState icon="heart" title="لسه مفيش حاجات مفضلة" description="احفظي القطع اللي حبيتيها وهتلاقيها هنا." actionLabel="اكتشفي المجموعة" actionTo="/categories" />}
    </main>
  );
}

function CartPage() {
  const { cart, products, shippingConfig, updateCartQuantity, removeFromCart, showToast } = useShop();
  const lines = cart.map((line) => ({ ...line, product: products.find((product) => product.id === line.productId) })).filter((line): line is CartLine & { product: Product } => Boolean(line.product));
  const subtotal = lines.reduce((sum, line) => sum + getProductPrice(line.product) * line.quantity, 0);
  const shipping = subtotal >= shippingConfig.freeThreshold || subtotal === 0 ? 0 : shippingConfig.standardFee;
  const total = subtotal + shipping;
  if (!lines.length) return <main className="page-shell cart-page" dir="rtl"><Breadcrumbs items={[{ label: 'السلة' }]} /><EmptyState icon="bag" title="سلتك لسه فاضية" description="اكتشفي مجموعتنا واختاري اللي يناسبك." actionLabel="اكتشفي المجموعة" actionTo="/categories" /></main>;
  return (
    <main className="page-shell cart-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'السلة' }]} />
      <div className="listing-intro"><div><span className="eyebrow">اختياراتك جاهزة</span><h1>سلتك</h1><p>راجعي قطعك قبل إتمام الطلب.</p></div><span className="listing-count"><b>{cart.reduce((sum, line) => sum + line.quantity, 0).toString().padStart(2, '0')}</b><span>قطعة<br />في السلة</span></span></div>
      <div className="cart-page-layout">
        <section className="cart-items-list" aria-label="محتويات السلة">{lines.map((line) => {
          const { product, quantity } = line;
          const color = line.color ?? product.colorVariants.find((variant) => variant.name === product.color) ?? product.colorVariants[0];
          return <article className="cart-line" key={`${product.id}-${color?.name ?? product.color}`} dir="rtl">
            <Link to={`/product/${product.slug}`} className="cart-line-image"><img src={product.images[0]} alt={product.name} loading="lazy" decoding="async" style={{ filter: getColorFilter(product.color, color?.name ?? product.color) }} /></Link>
            <div className="cart-line-copy"><Link to={`/product/${product.slug}`} className="cart-line-name">{product.name}</Link><span className="product-code" dir="ltr">{product.code}</span><span className="cart-line-color">{product.categoryName} <i /> {color?.nameAr ?? product.colorAr}</span><div className="cart-line-mobile-price" dir="ltr">{formatPrice(getProductPrice(product) * quantity)}</div></div>
            <div className="cart-line-controls"><QuantityControl value={quantity} max={product.stock} onChange={(next) => updateCartQuantity(product.id, next, color?.name)} /><span className="cart-line-price" dir="ltr">{formatPrice(getProductPrice(product) * quantity)}</span><button className="remove-cart-item" type="button" onClick={() => removeFromCart(product.id, color?.name)} aria-label={`إزالة ${product.name}`}>إزالة</button></div>
          </article>;
        })}</section>
        <aside className="order-summary cart-summary" dir="rtl"><span className="eyebrow">تفاصيل الطلب</span><h2>ملخص السلة</h2><div className="summary-row"><span>قيمة المنتجات</span><span dir="ltr">{formatPrice(subtotal)}</span></div><div className="summary-row"><span>التوصيل</span><span dir="ltr">{shipping ? formatPrice(shipping) : 'مجاني'}</span></div><div className="summary-divider" /><div className="summary-row summary-total"><strong>الإجمالي</strong><strong dir="ltr">{formatPrice(total)}</strong></div><p className="summary-note"><Truck size={16} />{shipping ? `توصيل مجاني للطلبات فوق ${formatPrice(shippingConfig.freeThreshold)}.` : 'حصلت على التوصيل المجاني.'}</p><Link to="/checkout" className="button button--primary button--wide">متابعة إلى إتمام الطلب <ArrowLeft size={17} /></Link><Link className="cart-continue-link" to="/categories"><ArrowRight size={15} /> مواصلة التسوق</Link><span className="cod-note"><ShieldCheck size={14} /> الدفع عند الاستلام</span></aside>
      </div>
      <div className="cart-reassurance"><PackageCheck size={17} /><span>نجهز كل طلب بعناية، ونوصله إلى بابك في جميع أنحاء مصر.</span></div>
    </main>
  );
}

const governorates = ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'الغربية', 'القليوبية', 'المنوفية', 'كفر الشيخ', 'البحيرة', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'الوادي الجديد', 'مطروح', 'البحر الأحمر'];

function CheckoutPage() {
  const { cart, products, shippingConfig, clearCart, showToast } = useShop();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const lines = cart.map((line) => ({ ...line, product: products.find((product) => product.id === line.productId) })).filter((line): line is CartLine & { product: Product } => Boolean(line.product));
  const subtotal = lines.reduce((sum, line) => sum + getProductPrice(line.product) * line.quantity, 0);
  const shipping = subtotal >= shippingConfig.freeThreshold ? 0 : shippingConfig.standardFee;
  const total = Math.max(0, subtotal + shipping - couponDiscount);
  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponMessage('اكتب كود الخصم أولا.'); return; }
    setCouponBusy(true);
    try {
      const result = await validateCoupon(code, subtotal);
      setAppliedCoupon(result.code);
      setCouponCode(result.code);
      setCouponDiscount(result.discount);
      setCouponMessage(result.message);
    } catch (error) {
      setAppliedCoupon('');
      setCouponDiscount(0);
      setCouponMessage(error instanceof Error ? error.message : 'الكود غير صالح.');
    } finally { setCouponBusy(false); }
  };
  if (!lines.length) return <main className="page-shell checkout-page" dir="rtl"><Breadcrumbs items={[{ label: 'السلة', to: '/cart' }, { label: 'إتمام الطلب' }]} /><EmptyState icon="bag" title="سلتك لسه فاضية" description="أضيفي قطعة من خيوط إلى سلتك، ثم عودي لإتمام الطلب." actionLabel="اكتشفي المجموعة" actionTo="/categories" /></main>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (import.meta.env.VITE_PUBLIC_PREVIEW_MODE === 'true') {
      showToast('هذه معاينة عامة؛ لم يتم إرسال الطلب أو تغيير المخزون.', 'info');
      return;
    }
    setSubmitting(true);
    const data = new FormData(form);
    try {
      const order = await createOrder({
        customer: {
          fullName: String(data.get('fullName') ?? '').trim(), phone: String(data.get('phone') ?? '').trim(), email: String(data.get('email') ?? '').trim(),
          governorate: String(data.get('governorate') ?? ''), city: String(data.get('city') ?? '').trim(), address: String(data.get('address') ?? '').trim(), notes: String(data.get('notes') ?? '').trim(),
        },
        items: lines.map(({ product, quantity, color }) => ({ productId: product.id, name: product.name, code: product.code, price: getProductPrice(product), quantity, colorName: color?.name ?? product.color, colorAr: color?.nameAr ?? product.colorAr })),
        subtotal, shipping, total, paymentMethod: 'cash_on_delivery', couponCode: appliedCoupon || undefined,
      });
      clearCart();
      navigate('/order-confirmation', { state: { order } });
    } catch {
      showToast('لم نتمكن من إتمام الطلب. حاولي مرة أخرى.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell checkout-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'السلة', to: '/cart' }, { label: 'إتمام الطلب' }]} />
      <div className="listing-intro checkout-intro"><div><span className="eyebrow">خطوة أخيرة</span><h1>إتمام الطلب</h1><p>تفاصيل بسيطة، وقطعتك في طريقها إليك.</p></div><span className="checkout-step"><i>01</i><span>بيانات التوصيل</span><b>02</b><span>تأكيد الطلب</span></span></div>
      <form className="checkout-layout" onSubmit={submit}>
        <section className="checkout-form-panel">
          <div className="checkout-panel-heading"><span className="step-number">01</span><div><span className="eyebrow">بياناتك</span><h2>أين نرسل طلبك؟</h2></div></div>
          <div className="form-grid">
            <label className="form-field form-field--full"><span>الاسم بالكامل <b>*</b></span><input type="text" name="fullName" autoComplete="name" placeholder="اكتبي اسمك كما تحبين أن نناديك" required minLength={3} /></label>
            <label className="form-field"><span>رقم الهاتف <b>*</b></span><input type="tel" name="phone" autoComplete="tel" placeholder="01X XXXX XXXX" dir="ltr" inputMode="tel" pattern="[0-9+() \-]{10,17}" title="أدخلي رقم هاتف صحيحا" required /></label>
            <label className="form-field"><span>البريد الإلكتروني <b>*</b></span><input type="email" name="email" autoComplete="email" placeholder="name@email.com" dir="ltr" required /></label>
            <label className="form-field"><span>المحافظة <b>*</b></span><span className="form-select"><select name="governorate" defaultValue="" required><option value="" disabled>اختاري المحافظة</option>{governorates.map((place) => <option key={place}>{place}</option>)}</select><ChevronDown size={16} /></span></label>
            <label className="form-field"><span>المدينة / المنطقة <b>*</b></span><input type="text" name="city" placeholder="مثال: مدينة نصر" required /></label>
            <label className="form-field form-field--full"><span>العنوان بالتفصيل <b>*</b></span><input type="text" name="address" autoComplete="street-address" placeholder="الشارع، رقم العقار، الدور، وأقرب علامة مميزة" required minLength={6} /></label>
            <label className="form-field form-field--full"><span>ملاحظات إضافية <small>اختياري</small></span><textarea name="notes" rows={3} placeholder="أي تفاصيل تساعدنا في توصيل طلبك..." /></label>
          </div>
          <div className="payment-section"><div className="checkout-panel-heading"><span className="step-number">02</span><div><span className="eyebrow">طريقة الدفع</span><h2>اختاري ما يريحك</h2></div></div><div className="payment-options-grid">
            <label className="payment-option payment-option--selected"><input type="radio" name="payment" value="cash_on_delivery" defaultChecked /><span className="payment-radio" /><span className="payment-brand-icon"><Truck size={18} /></span><span className="payment-copy"><strong>الدفع عند الاستلام</strong><small>ادفعي عند وصول طلبك.</small></span><span className="payment-method-badge">متاح</span></label>
            <div className="payment-option payment-option--disabled" aria-disabled="true"><span className="payment-brand-icon"><CreditCard size={18} /></span><span className="payment-copy"><strong>بطاقة بنكية</strong><small>الدفع ببطاقة Visa أو Mastercard.</small></span><span className="payment-method-badge payment-method-badge--soon" dir="ltr">VISA · قريبا</span></div>
            <div className="payment-option payment-option--disabled" aria-disabled="true"><span className="payment-brand-icon payment-brand-icon--insta"><Building2 size={18} /></span><span className="payment-copy"><strong>InstaPay</strong><small>تحويل فوري من تطبيقك البنكي.</small></span><span className="payment-method-badge payment-method-badge--soon">قريبا</span></div>
            <div className="payment-option payment-option--disabled" aria-disabled="true"><span className="payment-brand-icon payment-brand-icon--vodafone"><Smartphone size={18} /></span><span className="payment-copy"><strong>Vodafone Cash</strong><small>الدفع من محفظتك الإلكترونية.</small></span><span className="payment-method-badge payment-method-badge--soon">قريبا</span></div>
          </div><p className="payment-later-note">وسائل الدفع الأخرى ظاهرة للتعريف فقط، وستفعل لاحقا.</p></div>
        </section>
        <aside className="order-summary checkout-summary"><span className="eyebrow">مراجعة نهائية</span><h2>ملخص طلبك</h2><div className="checkout-items">{lines.map(({ product, quantity, color }) => <div className="checkout-item" key={`${product.id}-${color?.name ?? product.color}`}><img src={product.images[0]} alt="" loading="lazy" decoding="async" style={{ filter: getColorFilter(product.color, color?.name ?? product.color) }} /><div><strong>{product.name}</strong><span>{color?.nameAr ?? product.colorAr}</span><span dir="ltr">{product.code} · × {quantity}</span></div><b dir="ltr">{formatPrice(getProductPrice(product) * quantity)}</b></div>)}</div><div className="coupon-entry"><div className="coupon-fields"><input value={couponCode} onChange={(event) => { setCouponCode(event.target.value); setAppliedCoupon(''); setCouponDiscount(0); setCouponMessage(''); }} placeholder="كود الخصم" aria-label="كود الخصم" dir="ltr" /><button type="button" onClick={() => void applyCoupon()} disabled={couponBusy}>{couponBusy ? 'جارٍ التحقق' : 'تطبيق'}</button></div>{couponMessage && <small className={appliedCoupon ? 'coupon-message is-success' : 'coupon-message'} role="status">{couponMessage}</small>}</div><div className="summary-row"><span>قيمة المنتجات</span><span dir="ltr">{formatPrice(subtotal)}</span></div>{couponDiscount > 0 && <div className="summary-row coupon-discount"><span>خصم {appliedCoupon}</span><span dir="ltr">−{formatPrice(couponDiscount)}</span></div>}<div className="summary-row"><span>التوصيل</span><span dir="ltr">{shipping ? formatPrice(shipping) : 'مجاني'}</span></div><div className="summary-divider" /><div className="summary-row summary-total"><strong>الإجمالي</strong><strong dir="ltr">{formatPrice(total)}</strong></div><p className="cod-note cod-note--checkout"><ShieldCheck size={15} /> الدفع عند الاستلام — بدون رسوم إضافية.</p><button className="button button--primary button--wide checkout-submit" type="submit" disabled={submitting}>{submitting ? 'جار تأكيد الطلب...' : 'تأكيد الطلب'}{!submitting && <ArrowLeft size={17} />}</button><span className="checkout-secure-note"><ShieldCheck size={14} /> بياناتك تستخدم لإتمام هذا الطلب فقط.</span></aside>
      </form>
    </main>
  );
}

function OrderConfirmationPage() {
  const location = useLocation();
  const stateOrder = (location.state as { order?: OrderRecord } | null)?.order;
  const [order] = useState<OrderRecord | null>(() => stateOrder ?? getLastOrder());
  if (!order) return <main className="page-shell" dir="rtl"><Breadcrumbs items={[{ label: 'تأكيد الطلب' }]} /><EmptyState icon="bag" title="لا يوجد طلب لعرضه الآن" description="اختاري قطعك أولا، وسنكون سعداء باستقبال طلبك." actionLabel="العودة إلى التسوق" actionTo="/categories" /></main>;
  return (
    <main className="confirmation-page page-shell" dir="rtl">
      <div className="confirmation-card"><span className="confirmation-mark"><Check size={30} strokeWidth={1.5} /></span><span className="eyebrow">وصلتنا حكايتك</span><h1>شكرا لاختيارك<br /><em>خيوط.</em></h1><p>طلبك صار عندنا، وسنتواصل معك قريبا لتأكيد تفاصيل التوصيل.</p><div className="order-number"><span>رقم الطلب</span><strong dir="ltr">{order.id}</strong></div><div className="confirmation-detail"><span>الإجمالي عند الاستلام</span><strong dir="ltr">{formatPrice(order.total)}</strong></div><div className="confirmation-detail"><span>عدد القطع</span><strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div><div className="confirmation-items" aria-label="تفاصيل القطع">{order.items.map((item) => <div className="confirmation-item" key={`${item.productId}-${item.colorName ?? ''}`}><div><strong>{item.name}</strong><span>{item.colorAr ? `${item.colorAr} · ` : ''}الكمية {item.quantity}</span></div><b dir="ltr">{formatPrice(item.price * item.quantity)}</b></div>)}</div><Link to="/" className="button button--primary button--wide">العودة إلى خيوط <ArrowLeft size={16} /></Link><Link to="/categories" className="text-link confirmation-continue">اكتشفي المزيد من القطع <ArrowLeft size={15} /></Link><span className="confirmation-flower" aria-hidden="true">✳</span></div>
      <p className="confirmation-footnote">صنعت كل خطوة لتكون أقرب إليك — <span dir="ltr">Khoyout</span></p>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page-shell about-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'من نحن' }]} />
      <section className="about-hero"><div className="about-hero-image"><img src="/images/hero-editorial.webp" alt="تفاصيل طرحة ناعمة ضمن حكاية خيوط" fetchPriority="high" decoding="async" /><span className="about-photo-caption" dir="ltr">MADE WITH MEANING</span></div><div className="about-hero-copy"><span className="eyebrow">حكاية تبدأ من خيط</span><h1>نؤمن أن<br /><em>البساطة تشبهك.</em></h1><p>خيوط علامة مصرية محلية للطرح، بدأت من حب الخامات والرغبة في صنع طرحة قريبة من يومك، بهدوء وأناقة بسيطة.</p><span className="about-signature">خيوط — أناقة تنسجها التفاصيل.</span></div></section>
      <section className="about-story"><span className="eyebrow">من نحن</span><h2>طرحات نصنعها.<br /><em>لتشبه يومك.</em></h2><div><p>في خيوط نصنع الطرح بعناية، من اختيار الخامة إلى اللمسة الأخيرة. نعمل على ألوان هادئة وتصاميم بسيطة لتكون كل طرحة جزءا طبيعيا من أسلوبك اليومي.</p><p>بدأت حكايتنا في مصر من حب الأقمشة والرغبة في صنع طرحة محلية بعناية. نهتم بالخامات والألوان لتكون مريحة وسهلة التنسيق، وقريبة من أسلوبك.</p></div></section>
      <section className="about-values"><div><span className="about-value-mark">01</span><strong>محلية من القلب</strong><span>حكاية مصرية تنسجها التفاصيل.</span></div><div><span className="about-value-mark">02</span><strong>جودة بلا ادعاء</strong><span>نصنع ما نحب أن نرتديه.</span></div><div><span className="about-value-mark">03</span><strong>بساطة مقصودة</strong><span>مساحة أكبر لك ولأسلوبك.</span></div></section>
      <div className="about-cta"><p>قطعتك التالية<br /><em>تنتظرك هنا.</em></p><Link to="/categories" className="button button--primary">اكتشفي المجموعة <ArrowLeft size={16} /></Link></div>
    </main>
  );
}

function ContactPage() {
  const { showToast, siteInfo, shippingConfig } = useShop();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    showToast('وصلتنا رسالتك — سنرد عليك قريبا.');
    form.reset();
  };
  const contactCards = [
    { icon: Truck, eyebrow: 'سؤال عن طلبك', label: 'واتساب', value: 'راسلينا مباشرة', href: `https://wa.me/${siteInfo.whatsapp}` },
    { icon: Sparkles, eyebrow: 'لحظات خيوط', label: 'Instagram', value: '@khoyout.eg', href: siteInfo.instagram },
    { icon: Search, eyebrow: 'نحن هنا للمساعدة', label: 'البريد الإلكتروني', value: siteInfo.email, href: `mailto:${siteInfo.email}` },
  ];
  return (
    <main className="page-shell contact-page" dir="rtl">
      <Breadcrumbs items={[{ label: 'تواصل معنا' }]} />
      <div className="contact-intro"><span className="eyebrow">رسالة منك تسعدنا</span><h1>نحن هنا،<br /><em>لأجلك.</em></h1><p>سؤال، اقتراح، أو حتى كلمة لطيفة — يسعدنا أن نسمع منك.</p></div>
      <div className="contact-layout"><div className="contact-info-column"><div className="contact-cards">{contactCards.map(({ icon: Icon, eyebrow, label, value, href }) => <a className="contact-card" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} key={label}><span className="contact-card-icon"><Icon size={19} strokeWidth={1.4} /></span><span className="contact-card-copy"><small>{eyebrow}</small><strong>{label}</strong><span dir={label === 'البريد الإلكتروني' || label === 'Instagram' ? 'ltr' : undefined}>{value}</span></span><ArrowLeft size={16} /></a>)}</div><div className="contact-response-note"><span className="contact-note-mark">✳</span><div><strong>نرد عليك بمحبة.</strong><p>عادة خلال يوم عمل واحد، من الأحد إلى الخميس.</p></div></div><div className="contact-phone-line"><span>الهاتف</span><a href={`tel:${siteInfo.phone.replace(/\s/g, '')}`} dir="ltr">{siteInfo.phone}</a></div></div>
        <form className="contact-form" onSubmit={submit}><div className="contact-form-heading"><span className="eyebrow">اكتبي لنا</span><h2>كيف نقدر نساعدك؟</h2></div><label className="form-field"><span>اسمك <b>*</b></span><input name="name" type="text" autoComplete="name" placeholder="الاسم بالكامل" required minLength={2} /></label><label className="form-field"><span>بريدك الإلكتروني <b>*</b></span><input name="email" type="email" autoComplete="email" placeholder="name@email.com" dir="ltr" required /></label><label className="form-field"><span>موضوع رسالتك <b>*</b></span><span className="form-select"><select name="subject" defaultValue="" required><option value="" disabled>اختاري الموضوع</option><option>استفسار عن منتج</option><option>متابعة طلب</option><option>الشحن والاستبدال</option><option>اقتراح أو ملاحظة</option><option>شيء آخر</option></select><ChevronDown size={16} /></span></label><label className="form-field"><span>رسالتك <b>*</b></span><textarea name="message" rows={4} placeholder="نستمع إليك..." required minLength={5} /></label><button type="submit" className="button button--primary">إرسال الرسالة <ArrowLeft size={16} /></button><span className="form-privacy"><ShieldCheck size={13} /> نحترم خصوصيتك، ولن نشارك بياناتك.</span></form></div>
      <section className="contact-faq"><SectionHeading eyebrow="قبل أن تكتبي لنا" title="أسئلة صغيرة، إجابات واضحة." /><div className="faq-list"><details><summary>كم تستغرق مدة التوصيل؟ <ChevronDown size={17} /></summary><p>التوصيل متاح لجميع المحافظات، ويستغرق عادة من يومين إلى خمسة أيام عمل حسب المنطقة.</p></details><details><summary>ما رسوم الشحن؟ <ChevronDown size={17} /></summary><p>رسوم الشحن القياسية {formatPrice(shippingConfig.standardFee)}، والشحن مجاني للطلبات فوق {formatPrice(shippingConfig.freeThreshold)}.</p></details><details><summary>هل يمكن استبدال القطعة؟ <ChevronDown size={17} /></summary><p>نعم، يمكن طلب الاستبدال خلال 14 يوما من الاستلام بشرط أن تكون القطعة بحالتها الأصلية. تواصلي معنا وسنساعدك.</p></details></div></section>
    </main>
  );
}

function NotFoundPage() {
  return <main className="page-shell not-found-page" dir="rtl"><Breadcrumbs items={[{ label: 'الصفحة غير موجودة' }]} /><div className="not-found-mark" dir="ltr">404</div><span className="eyebrow">يبدو أن الخيط انقطع هنا</span><h1>الصفحة غير موجودة.</h1><p>قد يكون الرابط تغير، لكن مجموعتنا ما زالت بانتظارك.</p><Link to="/" className="button button--primary">العودة إلى الرئيسية <ArrowLeft size={16} /></Link></main>;
}

export {
  AboutPage, CartPage, CategoriesPage, CategoryPage, CheckoutPage, ContactPage,
  FavoritePage, HomePage, NotFoundPage, OrderConfirmationPage, ProductDetailsPage,
  SearchPage, TopSalesPage,
};
