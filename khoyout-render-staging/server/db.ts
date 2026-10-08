import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { categories, products, shippingConfig, siteInfo } from '../src/data.ts';

const databasePath = path.resolve(process.env.DATABASE_PATH || 'data/khoyout.sqlite');
const catalogSeedPath = path.resolve('data/khoyout.seed.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
if (databasePath !== catalogSeedPath && !fs.existsSync(databasePath) && fs.existsSync(catalogSeedPath)) {
  fs.copyFileSync(catalogSeedPath, databasePath);
}

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
    created_at TEXT NOT NULL,
    last_login TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    return_to TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    last_order_at TEXT
  );
  CREATE TABLE IF NOT EXISTS admin_invites (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    added_by TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    fabric TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '#e7cbc7',
    description TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL REFERENCES categories(slug) ON UPDATE CASCADE,
    fabric TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    color_ar TEXT NOT NULL DEFAULT '',
    color_variants TEXT NOT NULL DEFAULT '[]',
    price REAL NOT NULL CHECK (price >= 0),
    discount_price REAL,
    description TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT '[]',
    available INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    featured INTEGER NOT NULL DEFAULT 0,
    top_sales INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    shipping REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    coupon_code TEXT,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
    status TEXT NOT NULL DEFAULT 'pending',
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY COLLATE NOCASE,
    kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
    value REAL NOT NULL CHECK (value > 0),
    minimum_order REAL NOT NULL DEFAULT 0,
    expires_at TEXT,
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
  CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
  CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
  CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
`);

const now = () => new Date().toISOString();
const settingDefaults: Record<string, unknown> = {
  siteInfo,
  shipping: shippingConfig,
  store: {
    name: 'خيوط',
    currency: 'EGP',
    lowStockThreshold: 5,
    acceptingOrders: true,
  },
  homepage: {
    heroImage: '/images/hero-editorial.webp',
    heroKicker: '',
    heroTitle: 'أناقة تنسجها',
    heroTitleAccent: 'التفاصيل',
    heroSubtitle: 'طرحات نصنعها بخامات ناعمة وألوان هادئة، لتكمل أناقتك في كل يوم.',
    primaryButtonLabel: 'اكتشفي المجموعة',
    primaryButtonUrl: '/categories',
    secondaryButtonLabel: 'تسوقي الآن',
    secondaryButtonUrl: '/top-sales',
    featuredProductIds: products.filter((item) => item.featured).slice(0, 4).map((item) => item.id),
    sectionOrder: ['categories', 'topSales', 'editorial', 'featured', 'why'],
    promoVisible: true,
    promoTitle: 'ألوان هادئة، تحكي عنك',
    promoText: 'خامات ناعمة وألوان صممت لترافقك كل يوم.',
    promoImage: '/images/category-crepe.webp',
  },
};

const seed = db.transaction(() => {
  const insertCategory = db.prepare(`INSERT OR IGNORE INTO categories
    (id,slug,name_ar,name_en,fabric,image,note,tone,description,enabled,sort_order)
    VALUES (@id,@slug,@nameAr,@nameEn,@fabric,@image,@note,@tone,@description,1,@sortOrder)`);
  categories.forEach((category, index) => insertCategory.run({
    ...category,
    description: category.note,
    sortOrder: index,
  }));

  const insertProduct = db.prepare(`INSERT OR IGNORE INTO products
    (id,name,slug,code,category,fabric,color,color_ar,color_variants,price,discount_price,description,short_description,images,available,enabled,stock,featured,top_sales,created_at)
    VALUES (@id,@name,@slug,@code,@category,@fabric,@color,@colorAr,@colorVariants,@price,NULL,@description,@shortDescription,@images,@available,@enabled,@stock,@featured,@topSales,@createdAt)`);
  products.forEach((product) => insertProduct.run({
    id: product.id,
    name: product.name,
    slug: product.slug,
    code: product.code,
    category: product.category,
    fabric: product.fabric,
    color: product.color,
    colorAr: product.colorAr,
    colorVariants: JSON.stringify(product.colorVariants),
    price: product.price,
    description: product.description,
    shortDescription: product.shortDescription,
    images: JSON.stringify(product.images),
    available: Number(product.available),
    enabled: Number(product.enabled ?? true),
    stock: product.stock,
    featured: Number(product.featured),
    topSales: Number(product.topSales),
    createdAt: product.createdAt,
  }));

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value_json,updated_at) VALUES (?,?,?)');
  for (const [key, value] of Object.entries(settingDefaults)) insertSetting.run(key, JSON.stringify(value), now());

  const ownerEmail = (process.env.OWNER_ADMIN_EMAIL || 'owner@example.invalid').trim().toLowerCase();
  db.prepare(`INSERT INTO admin_invites (email,is_primary,is_active,added_by,created_at)
    VALUES (?,1,1,'system',?) ON CONFLICT(email) DO UPDATE SET is_primary=1,is_active=1`)
    .run(ownerEmail, now());
});
seed();

// Remove the former default hero kicker without overwriting any custom homepage copy.
const homepageRow = db.prepare('SELECT value_json FROM settings WHERE key=?').get('homepage') as { value_json: string } | undefined;
if (homepageRow) {
  try {
    const homepage = JSON.parse(homepageRow.value_json) as Record<string, unknown>;
    if (typeof homepage.heroKicker === 'string' && homepage.heroKicker.trim() === 'طرحات نصنعها بعناية') {
      homepage.heroKicker = '';
      db.prepare('UPDATE settings SET value_json=?,updated_at=? WHERE key=?')
        .run(JSON.stringify(homepage), now(), 'homepage');
    }
  } catch { /* Preserve an unreadable setting rather than replacing it. */ }
}

export function readSetting<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT value_json FROM settings WHERE key=?').get(key) as { value_json: string } | undefined;
  if (!row) return fallback;
  try { return JSON.parse(row.value_json) as T; } catch { return fallback; }
}

export function writeSetting(key: string, value: unknown) {
  db.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`)
    .run(key, JSON.stringify(value), now());
}

export function currentIso() { return now(); }
