export type Category = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  fabric: string;
  image: string;
  note: string;
  tone: string;
  description?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type ColorVariant = { name: string; nameAr: string; hex: string; };

export type Product = {
  id: string;
  name: string;
  slug: string;
  code: string;
  category: string;
  categoryName: string;
  fabric: string;
  color: string;
  colorAr: string;
  colorVariants: ColorVariant[];
  price: number;
  description: string;
  shortDescription: string;
  images: string[];
  available: boolean;
  enabled?: boolean;
  discountPrice?: number | null;
  stock: number;
  featured: boolean;
  topSales: boolean;
  createdAt: string;
};

const image = (name: string) => `/images/${name.replace(/\.jpg$/i, '.webp')}${name.includes('.') ? '' : '.webp'}`;

export const categories: Category[] = [
  { id: 'chiffon', slug: 'chiffon', nameAr: 'شيفون', nameEn: 'Chiffon', fabric: 'شيفون', image: image('category-chiffon.jpg'), note: 'خفة تنساب معك', tone: '#e7cbc7' },
  { id: 'satin', slug: 'satin', nameAr: 'ساتان', nameEn: 'Satin', fabric: 'ساتان', image: image('category-satin.jpg'), note: 'لمعة هادئة للمساء', tone: '#e3d9d3' },
  { id: 'cotton', slug: 'cotton', nameAr: 'قطن', nameEn: 'Cotton', fabric: 'قطن', image: image('category-cotton.jpg'), note: 'راحة كل يوم', tone: '#cfc2b7' },
  { id: 'crepe', slug: 'crepe', nameAr: 'كريب', nameEn: 'Crepe', fabric: 'كريب', image: image('category-crepe.jpg'), note: 'ملمس ناعم وانسيابي', tone: '#d9cccf' },
  { id: 'modal', slug: 'modal', nameAr: 'مودال', nameEn: 'Modal', fabric: 'مودال', image: image('category-modal.jpg'), note: 'نعومة تشبه الغيمة', tone: '#c6c8cf' },
];

const categoryNames: Record<string, string> = Object.fromEntries(categories.map((item) => [item.slug, item.nameAr]));

const COLOR_OPTIONS: Record<string, ColorVariant> = {
  'Dusty Rose': { name: 'Dusty Rose', nameAr: 'وردي غباري', hex: '#c99b98' },
  'Blush Pink': { name: 'Blush Pink', nameAr: 'وردي فاتح', hex: '#e8d3cf' },
  'Rose Beige': { name: 'Rose Beige', nameAr: 'بيج وردي', hex: '#cfaba7' },
  Ivory: { name: 'Ivory', nameAr: 'عاجي', hex: '#eee6dc' },
  'Powder Blue': { name: 'Powder Blue', nameAr: 'أزرق بودري', hex: '#b1b2bc' },
  Mauve: { name: 'Mauve', nameAr: 'موف', hex: '#9d8282' },
  'Sand Beige': { name: 'Sand Beige', nameAr: 'بيج رملي', hex: '#cbb9a9' },
  'Light Gray': { name: 'Light Gray', nameAr: 'رمادي فاتح', hex: '#a8a3a5' },
  'Light Taupe': { name: 'Light Taupe', nameAr: 'تاوب فاتح', hex: '#b3a091' },
  Champagne: { name: 'Champagne', nameAr: 'شامبانيا', hex: '#d6bd9e' },
};

const COLOR_FAMILIES: Record<string, string[]> = {
  chiffon: ['Dusty Rose', 'Blush Pink', 'Ivory', 'Powder Blue'],
  satin: ['Ivory', 'Dusty Rose', 'Mauve', 'Champagne'],
  cotton: ['Sand Beige', 'Ivory', 'Light Taupe', 'Light Gray'],
  crepe: ['Sand Beige', 'Mauve', 'Powder Blue', 'Dusty Rose'],
  modal: ['Powder Blue', 'Mauve', 'Ivory', 'Blush Pink'],
};

function buildColorVariants(product: Pick<Product, 'category' | 'color' | 'colorAr'>): ColorVariant[] {
  const names = Array.from(new Set([...(COLOR_FAMILIES[product.category] ?? []), product.color]));
  return names.map((name) => COLOR_OPTIONS[name] ?? { name, nameAr: product.colorAr, hex: '#cbb9a9' });
}

const HUE_BY_COLOR: Record<string, number> = {
  'Dusty Rose': 5, 'Blush Pink': 350, 'Rose Beige': 12, Ivory: 38, 'Powder Blue': 218,
  Mauve: 302, 'Sand Beige': 29, 'Light Gray': 0, 'Light Taupe': 26, Champagne: 34,
};

export function getColorFilter(from: string, to: string) {
  if (from === to) return 'none';
  let rotation = (HUE_BY_COLOR[to] ?? 0) - (HUE_BY_COLOR[from] ?? 0);
  if (rotation > 180) rotation -= 360;
  if (rotation < -180) rotation += 360;
  const saturation: Record<string, number> = {
    'Dusty Rose': 1.14, 'Blush Pink': 0.82, 'Rose Beige': 0.72, Ivory: 0.42,
    'Powder Blue': 0.9, Mauve: 1.04, 'Sand Beige': 0.78, 'Light Gray': 0.4,
    'Light Taupe': 0.66, Champagne: 0.64,
  };
  const brightness: Record<string, number> = { Ivory: 1.1, 'Light Gray': 1.08, 'Blush Pink': 1.04, Champagne: 1.03 };
  return `hue-rotate(${rotation}deg) saturate(${saturation[to] ?? 1}) brightness(${brightness[to] ?? 1})`;
}

type ProductSeed = Omit<Product, 'categoryName' | 'colorVariants'>;
const makeProduct = (product: ProductSeed): Product => ({
  ...product,
  categoryName: categoryNames[product.category] ?? product.category,
  colorVariants: buildColorVariants(product),
});

export const products: Product[] = [
  makeProduct({
    id: 'kh-ch-001', name: 'Rose Mist', slug: 'rose-mist', code: 'KH-CH-001', category: 'chiffon', fabric: 'Chiffon', color: 'Dusty Rose', colorAr: 'وردي غباري', price: 349,
    shortDescription: 'شيفون خفيف بلون وردي غباري يكمل إطلالتك بهدوء.',
    description: 'طرحة شيفون خفيفة بانسيابية مريحة، بلون وردي غباري سهل التنسيق. لتمنحك إطلالة مرتبة وناعمة من الصباح وحتى المساء.',
    images: [image('product-rose')], available: true, stock: 18, featured: true, topSales: true, createdAt: '2026-09-12',
  }),
  makeProduct({
    id: 'kh-ch-002', name: 'Cloud Veil', slug: 'cloud-veil', code: 'KH-CH-002', category: 'chiffon', fabric: 'Chiffon', color: 'Blush Pink', colorAr: 'وردي فاتح', price: 329,
    shortDescription: 'لون بلش هادئ ولمسة خفيفة للمشاوير اليومية.',
    description: 'شيفون ناعم بخفة جميلة وثنية أنيقة. درجة البلش الهادئة تضيف دفئا بسيطا إلى الألوان المحايدة والدرجات الترابية.',
    images: [image('prod-cloud-veil.jpg')], available: true, stock: 12, featured: true, topSales: true, createdAt: '2026-09-03',
  }),
  makeProduct({
    id: 'kh-ch-003', name: 'Moon Dust', slug: 'moon-dust', code: 'KH-CH-003', category: 'chiffon', fabric: 'Chiffon', color: 'Light Gray', colorAr: 'رمادي فاتح', price: 359,
    shortDescription: 'رمادي فاتح ينسجم بسهولة مع خزانتك.',
    description: 'طرحة شيفون بملمس خفيف ودرجة رمادية ناعمة. قطعة أساسية تمنح إطلالتك توازنا أنيقا من دون أن تطغى على التفاصيل.',
    images: [image('prod-rose-veil.jpg')], available: true, stock: 9, featured: false, topSales: false, createdAt: '2026-08-28',
  }),
  makeProduct({
    id: 'kh-ch-004', name: 'Morning Blush', slug: 'morning-blush', code: 'KH-CH-004', category: 'chiffon', fabric: 'Chiffon', color: 'Rose Beige', colorAr: 'بيج وردي', price: 349,
    shortDescription: 'درجة وردية دافئة بتفاصيل شفافة وخفيفة.',
    description: 'شيفون بنفحة وردية دافئة وحركة انسيابية ناعمة. صممت هذه الدرجة لتنسجم مع الإطلالات اليومية والألوان الكريمية.',
    images: [image('prod-morning-blush.jpg')], available: true, stock: 14, featured: true, topSales: false, createdAt: '2026-08-20',
  }),
  makeProduct({
    id: 'kh-sa-001', name: 'Pearl Touch', slug: 'pearl-touch', code: 'KH-SA-001', category: 'satin', fabric: 'Satin', color: 'Ivory', colorAr: 'عاجي', price: 499,
    shortDescription: 'ساتان بنعومة لامعة خفيفة للمناسبات الهادئة.',
    description: 'ساتان بلمعة رقيقة وانسدال أنيق، بدرجة عاجية دافئة تضيء الإطلالة من دون مبالغة. خيار جميل للمناسبات واللحظات الخاصة.',
    images: [image('product-mauve')], available: true, stock: 8, featured: true, topSales: true, createdAt: '2026-09-15',
  }),
  makeProduct({
    id: 'kh-sa-002', name: 'Evening Blush', slug: 'evening-blush', code: 'KH-SA-002', category: 'satin', fabric: 'Satin', color: 'Mauve', colorAr: 'موف', price: 549,
    shortDescription: 'موف مطفأ بلمعة ساتان أنيقة ومتوازنة.',
    description: 'طرحة ساتان بدرجة موفة ولمعة ناعمة تتبدل مع الضوء. نسيجها الانسيابي يضيف لمسة أنثوية بسيطة للمساء.',
    images: [image('prod-moon-dust.jpg')], available: true, stock: 7, featured: true, topSales: true, createdAt: '2026-09-09',
  }),
  makeProduct({
    id: 'kh-sa-003', name: 'Rose Veil', slug: 'rose-veil', code: 'KH-SA-003', category: 'satin', fabric: 'Satin', color: 'Dusty Rose', colorAr: 'وردي غباري', price: 519,
    shortDescription: 'ساتان وردي غباري بإحساس ناعم ومتدل.',
    description: 'ساتان غني بانسدال مرن ولون وردي غباري محبوب. يمكن تنسيقه مع إطلالة بسيطة ليكون هو التفصيلة الهادئة فيها.',
    images: [image('prod-evening-blush.jpg')], available: true, stock: 10, featured: true, topSales: false, createdAt: '2026-08-30',
  }),
  makeProduct({
    id: 'kh-co-001', name: 'Soft Taupe', slug: 'soft-taupe', code: 'KH-CO-001', category: 'cotton', fabric: 'Cotton', color: 'Sand Beige', colorAr: 'بيج رملي', price: 299,
    shortDescription: 'قطن مريح وعملي بدرجة تاوب هادئة.',
    description: 'قطن ناعم بملمس مريح وثبات لطيف خلال اليوم. درجة التاوب المحايدة تجعلها قطعة سهلة التنسيق مع مختلف ألوانك.',
    images: [image('product-taupe')], available: true, stock: 21, featured: true, topSales: true, createdAt: '2026-09-11',
  }),
  makeProduct({
    id: 'kh-co-002', name: 'Oat Whisper', slug: 'oat-whisper', code: 'KH-CO-002', category: 'cotton', fabric: 'Cotton', color: 'Sand Beige', colorAr: 'بيج رملي', price: 279,
    shortDescription: 'قطن يومي بدرجة شوفان دافئة وهادئة.',
    description: 'طرحة قطنية عملية بملمس لطيف على البشرة. لون الشوفان الدافئ يضيف هدوءا طبيعيا إلى الإطلالة اليومية.',
    images: [image('prod-oat-whisper.jpg')], available: true, stock: 16, featured: true, topSales: false, createdAt: '2026-08-21',
  }),
  makeProduct({
    id: 'kh-co-003', name: 'Weekend Ivory', slug: 'weekend-ivory', code: 'KH-CO-003', category: 'cotton', fabric: 'Cotton', color: 'Ivory', colorAr: 'عاجي', price: 299,
    shortDescription: 'عاجي نقي وملمس قطني خفيف لراحة تدوم.',
    description: 'قطن يومي بدرجة عاجية سهلة التنسيق. تصميم بسيط وملمس خفيف يجعلانها رفيقتك المفضلة في الأيام المزدحمة.',
    images: [image('prod-weekend-ivory.jpg')], available: true, stock: 11, featured: false, topSales: false, createdAt: '2026-08-08',
  }),
  makeProduct({
    id: 'kh-cr-001', name: 'Nude Whisper', slug: 'nude-whisper', code: 'KH-CR-001', category: 'crepe', fabric: 'Crepe', color: 'Sand Beige', colorAr: 'بيج رملي', price: 399,
    shortDescription: 'كريب بملمس مطفأ ولون نيود دافئ.',
    description: 'كريب ناعم بملمس متوازن وثبات مريح. درجة النيود الدافئة تمنحك مساحة واسعة للتنسيق مع الألوان الهادئة والجريئة.',
    images: [image('prod-nude-whisper.jpg')], available: true, stock: 13, featured: true, topSales: true, createdAt: '2026-09-14',
  }),
  makeProduct({
    id: 'kh-cr-002', name: 'Stone Garden', slug: 'stone-garden', code: 'KH-CR-002', category: 'crepe', fabric: 'Crepe', color: 'Powder Blue', colorAr: 'أزرق بودري', price: 419,
    shortDescription: 'أزرق بودري بملمس كريب أنيق وسهل الارتداء.',
    description: 'طرحة كريب بدرجة أزرق بودري هادئة. النسيج المطفي ينسدل برقة ويحافظ على شكل مرتب يناسب يومك.',
    images: [image('prod-stone-garden.jpg')], available: true, stock: 9, featured: true, topSales: false, createdAt: '2026-09-01',
  }),
  makeProduct({
    id: 'kh-cr-003', name: 'Dusty Rose', slug: 'dusty-rose', code: 'KH-CR-003', category: 'crepe', fabric: 'Crepe', color: 'Dusty Rose', colorAr: 'وردي غباري', price: 449,
    shortDescription: 'وردي غباري بقوام كريب ناعم وانسيابي.',
    description: 'كريب بدرجة وردي غباري وقوام ناعم يساعد على لفة مرتبة. قطعة بسيطة تضيف دفئا من دون تفاصيل زائدة.',
    images: [image('prod-dusty-rose.jpg')], available: true, stock: 15, featured: true, topSales: true, createdAt: '2026-09-05',
  }),
  makeProduct({
    id: 'kh-cr-004', name: 'Mauve Still', slug: 'mauve-still', code: 'KH-CR-004', category: 'crepe', fabric: 'Crepe', color: 'Mauve', colorAr: 'موف', price: 429,
    shortDescription: 'موف مطفأ يضيف عمقا بسيطا لإطلالتك.',
    description: 'كريب بملمس ناعم ودرجة موف مطفأة. خيار متوازن بين الألوان الترابية والوردية، ويلائم الإطلالات اليومية والمساء.',
    images: [image('prod-mauve-still.jpg')], available: false, stock: 0, featured: false, topSales: false, createdAt: '2026-08-17',
  }),
  makeProduct({
    id: 'kh-mo-001', name: 'Blue Haze', slug: 'blue-haze', code: 'KH-MO-001', category: 'modal', fabric: 'Modal', color: 'Powder Blue', colorAr: 'أزرق بودري', price: 449,
    shortDescription: 'مودال ناعم بدرجة أزرق بودري تبعث على الهدوء.',
    description: 'مودال بانسيابية حريرية وملمس لطيف للغاية. الأزرق البودري الهادئ يضيف لمسة منعشة مع الحفاظ على طابع خيوط الناعم.',
    images: [image('product-ivory')], available: true, stock: 12, featured: true, topSales: true, createdAt: '2026-09-13',
  }),
  makeProduct({
    id: 'kh-mo-002', name: 'Serenity', slug: 'serenity', code: 'KH-MO-002', category: 'modal', fabric: 'Modal', color: 'Mauve', colorAr: 'موف', price: 499,
    shortDescription: 'ملمس مودال حريري ودرجة موفة.',
    description: 'طرحة مودال مرنة وناعمة بانسيابية جميلة. درجة موفة تجمع بين الرقة وسهولة التنسيق في كل موسم.',
    images: [image('product-blue')], available: true, stock: 9, featured: true, topSales: true, createdAt: '2026-09-07',
  }),
  makeProduct({
    id: 'kh-mo-003', name: 'Silk Whisper', slug: 'silk-whisper', code: 'KH-MO-003', category: 'modal', fabric: 'Modal', color: 'Ivory', colorAr: 'عاجي', price: 549,
    shortDescription: 'نعومة مودال بانطباع حريري ودرجة عاجية دافئة.',
    description: 'مودال فاخر بملمس ناعم وانسدال طبيعي، بدرجة عاجية دافئة تكمل القطع الأساسية في خزانتك.',
    images: [image('prod-silk-whisper.jpg')], available: true, stock: 5, featured: true, topSales: false, createdAt: '2026-09-10',
  }),
  makeProduct({
    id: 'kh-mo-004', name: 'Powder Bloom', slug: 'powder-bloom', code: 'KH-MO-004', category: 'modal', fabric: 'Modal', color: 'Ivory', colorAr: 'عاجي', price: 479,
    shortDescription: 'عاجي دافئ بملمس مودال خفيف وانسيابي.',
    description: 'مودال لطيف بدرجة عاجية هادئة وانسدال يواكب حركتك. صممت لتكون خيارا سهلا من الإطلالة الصباحية حتى نهاية اليوم.',
    images: [image('prod-powder-bloom.jpg')], available: true, stock: 13, featured: false, topSales: false, createdAt: '2026-09-02',
  }),

  makeProduct({
    id: 'kh-co-004', name: 'Linen Dusk', slug: 'linen-dusk', code: 'KH-CO-004', category: 'cotton', fabric: 'Cotton', color: 'Rose Beige', colorAr: 'بيج وردي', price: 319,
    shortDescription: 'قطن يومي بدرجة بيج وردي هادئة وملمس طبيعي مريح.',
    description: 'طرحة قطنية عملية بدرجة بيج وردي ناعمة، بتفاصيل هادئة وملمس مناسب لليوم الطويل. صنعت لتكون قطعة أساسية سهلة التنسيق.',
    images: [image('prod-linen-dusk.jpg')], available: true, stock: 17, featured: false, topSales: false, createdAt: '2026-09-18',
  }),
  makeProduct({
    id: 'kh-sa-004', name: 'Champagne Veil', slug: 'champagne-veil', code: 'KH-SA-004', category: 'satin', fabric: 'Satin', color: 'Champagne', colorAr: 'شامبانيا', price: 529,
    shortDescription: 'ساتان بلون الشامبانيا ولمعة خفيفة للمناسبات.',
    description: 'طرحة ساتان بانسدال ناعم ودرجة شامبانيا دافئة. لمعتها هادئة وتنسجم مع الإطلالات المسائية من دون مبالغة.',
    images: [image('prod-champagne-veil.jpg')], available: true, stock: 8, featured: true, topSales: false, createdAt: '2026-09-19',
  }),
];

export const siteInfo = {
  name: 'خيوط',
  transliteration: 'Khoyout',
  tagline: 'أناقة تنسجها التفاصيل',
  email: 'hello@khoyout.eg',
  phone: '+20 100 000 0000',
  whatsapp: '201000000000',
  instagram: 'https://instagram.com/khoyout.eg',
  tiktok: 'https://www.tiktok.com/@khoyout.eg',
};

export const shippingConfig = {
  standardFee: 50,
  freeThreshold: 1000,
  currency: 'EGP',
};

export function formatPrice(value: number, currency = 'EGP') {
  return `${currency} ${Math.round(value).toLocaleString('en-US')}`;
}

export function getProductPrice(product: Product) {
  return product.discountPrice != null && product.discountPrice >= 0 && product.discountPrice < product.price
    ? product.discountPrice
    : product.price;
}

export function getProductBySlug(slug?: string, catalog: Product[] = products) {
  return catalog.find((product) => product.slug === slug);
}

export function getCategoryBySlug(slug?: string, catalog: Category[] = categories) {
  return catalog.find((category) => category.slug === slug);
}

export function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('ar').normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').trim();
}

export function searchProducts(query: string, catalog: Product[] = products, categoryList: Category[] = categories) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  return catalog.filter((product) => {
    const category = getCategoryBySlug(product.category, categoryList);
    const variantText = product.colorVariants.map((variant) => `${variant.name} ${variant.nameAr}`).join(' ');
    const haystack = normalizeSearch([
      product.name, product.code, product.category, product.categoryName, category?.nameEn ?? '', category?.nameAr ?? '',
      product.fabric, product.color, product.colorAr, variantText, product.shortDescription, product.description,
    ].join(' '));
    return haystack.includes(needle);
  });
}
