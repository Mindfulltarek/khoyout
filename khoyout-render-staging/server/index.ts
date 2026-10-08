import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, currentIso, readSetting, writeSetting } from './db.ts';
import type { Category, ColorVariant, Product } from '../src/data.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const distDir = path.join(root, 'dist');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const PUBLIC_PREVIEW_MODE = process.env.PUBLIC_PREVIEW_MODE === 'true';
const DISABLE_STORE_ORDERS = process.env.DISABLE_STORE_ORDERS === 'true';
const OWNER_ADMIN_EMAIL = (process.env.OWNER_ADMIN_EMAIL || 'owner@example.invalid').trim().toLowerCase();
const SESSION_COOKIE = 'khoyout_session';
const SESSION_DAYS = 7;
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = typeof ORDER_STATUSES[number];
type UserRole = 'customer' | 'admin';

type UserRecord = {
  id: string;
  email: string;
  display_name: string;
  picture: string;
  role: UserRole;
  created_at: string;
  last_login: string;
};

type AuthRequest = Request & { authUser?: UserRecord };
type SqlRow = Record<string, unknown>;
const jsonFallback = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieValue = (req: Request, name: string) => {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
};
const safeReturnTo = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
const oauthRedirectUri = `${APP_BASE_URL}/api/auth/google/callback`;
const oauthConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '1d' }));

function readCategory(row: SqlRow): Category {
  return {
    id: String(row.id), slug: String(row.slug), nameAr: String(row.name_ar), nameEn: String(row.name_en),
    fabric: String(row.fabric), image: String(row.image), note: String(row.note), tone: String(row.tone),
    description: String(row.description), enabled: Boolean(row.enabled), sortOrder: Number(row.sort_order),
  };
}
function readProduct(row: SqlRow): Product {
  return {
    id: String(row.id), name: String(row.name), slug: String(row.slug), code: String(row.code), category: String(row.category),
    categoryName: String(row.category_name || ''), fabric: String(row.fabric), color: String(row.color), colorAr: String(row.color_ar),
    colorVariants: jsonFallback<ColorVariant[]>(row.color_variants, []), price: Number(row.price),
    discountPrice: row.discount_price == null ? null : Number(row.discount_price),
    description: String(row.description), shortDescription: String(row.short_description),
    images: jsonFallback<string[]>(row.images, []), available: Boolean(row.available), enabled: Boolean(row.enabled),
    stock: Number(row.stock), featured: Boolean(row.featured), topSales: Boolean(row.top_sales), createdAt: String(row.created_at),
  };
}
function categoryJoin() {
  return `SELECT p.*, COALESCE(c.name_ar,'') AS category_name FROM products p LEFT JOIN categories c ON c.slug=p.category`;
}
function readOrder(row: SqlRow) {
  return {
    id: String(row.id), userId: row.user_id ? String(row.user_id) : null,
    customer: jsonFallback<Record<string, string>>(row.customer_json, {}),
    items: jsonFallback<Array<Record<string, unknown>>>(row.items_json, []),
    subtotal: Number(row.subtotal), shipping: Number(row.shipping), discount: Number(row.discount),
    couponCode: row.coupon_code ? String(row.coupon_code) : null,
    total: Number(row.total), paymentMethod: String(row.payment_method), status: String(row.status),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function getRequestUser(req: Request): UserRecord | null {
  const rawToken = cookieValue(req, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = hash(rawToken);
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash, currentIso()) as UserRecord | undefined;
  if (!row) {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
    return null;
  }
  return row;
}
function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'سجلي الدخول للمتابعة.' });
  req.authUser = user;
  next();
}
function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'يلزم تسجيل الدخول كمسؤولة.' });
  const invite = db.prepare('SELECT is_active FROM admin_invites WHERE email=? COLLATE NOCASE').get(user.email) as { is_active: number } | undefined;
  if (user.role !== 'admin' || !invite?.is_active) return res.status(403).json({ error: 'ADMIN_REQUIRED', message: 'هذه الصفحة مخصصة للمسؤولات فقط.' });
  req.authUser = user;
  next();
}
function enforceSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const allowedHosts = new Set([APP_BASE_URL, req.get('host') || ''].filter(Boolean).map((value) => {
        try { return new URL(value.includes('://') ? value : `https://${value}`).host; } catch { return ''; }
      }));
      if (!allowedHosts.has(originHost)) return res.status(403).json({ error: 'CROSS_ORIGIN_REQUEST' });
    } catch { return res.status(403).json({ error: 'INVALID_ORIGIN' }); }
  }
  next();
}
const publicUser = (user: UserRecord) => ({ id: user.id, email: user.email, displayName: user.display_name, picture: user.picture, role: user.role });

app.get('/api/health', (_req, res) => res.json({ ok: true, googleOAuthConfigured: oauthConfigured, publicPreviewMode: PUBLIC_PREVIEW_MODE }));

app.get('/api/auth/me', (req, res) => {
  const user = getRequestUser(req);
  if (!user) return res.json({ user: null });
  const invite = db.prepare('SELECT is_active FROM admin_invites WHERE email=? COLLATE NOCASE').get(user.email) as { is_active: number } | undefined;
  if (user.role === 'admin' && !invite?.is_active) {
    db.prepare("UPDATE users SET role='customer' WHERE id=?").run(user.id);
    user.role = 'customer';
  }
  res.json({ user: publicUser(user), googleOAuthConfigured: oauthConfigured });
});

app.get('/api/auth/google', enforceSameOrigin, (req, res) => {
  if (PUBLIC_PREVIEW_MODE) return res.status(503).json({ error: 'PREVIEW_MODE_AUTH_DISABLED', message: 'تسجيل الدخول متوقف في المعاينة العامة.' });
  if (!oauthConfigured) return res.status(503).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server, then register the callback URL shown in the setup checklist.');
  const state = randomBytes(24).toString('base64url');
  const returnTo = safeReturnTo(req.query.returnTo);
  db.prepare('INSERT INTO oauth_states(state,return_to,expires_at) VALUES(?,?,?)')
    .run(state, returnTo, new Date(Date.now() + 10 * 60 * 1000).toISOString());
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, oauthRedirectUri);
  const url = client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res, next) => {
  if (PUBLIC_PREVIEW_MODE) return res.status(503).send('Google sign-in is disabled in public preview mode.');
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateRecord = db.prepare('SELECT return_to FROM oauth_states WHERE state=? AND expires_at>?').get(state, currentIso()) as { return_to: string } | undefined;
    db.prepare('DELETE FROM oauth_states WHERE state=?').run(state);
    if (!stateRecord || !code || !oauthConfigured) return res.status(400).send('OAuth callback could not be verified. Please return to the store and try again.');

    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, oauthRedirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return res.status(401).send('Google did not return an identity token.');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    const email = profile?.email?.trim().toLowerCase();
    if (!profile?.sub || !email || !profile.email_verified) return res.status(403).send('A verified Google email is required.');

    const invitation = db.prepare('SELECT is_active FROM admin_invites WHERE email=? COLLATE NOCASE').get(email) as { is_active: number } | undefined;
    const role: UserRole = (email === OWNER_ADMIN_EMAIL || invitation?.is_active) ? 'admin' : 'customer';
    const timestamp = currentIso();
    let user = db.prepare('SELECT * FROM users WHERE google_sub=? OR email=? COLLATE NOCASE').get(profile.sub, email) as UserRecord | undefined;
    const id = user?.id || `usr_${randomUUID()}`;
    if (user) {
      db.prepare(`UPDATE users SET google_sub=?,email=?,display_name=?,picture=?,role=?,last_login=? WHERE id=?`)
        .run(profile.sub, email, profile.name || '', profile.picture || '', role, timestamp, id);
    } else {
      db.prepare(`INSERT INTO users(id,google_sub,email,display_name,picture,role,created_at,last_login)
        VALUES(?,?,?,?,?,?,?,?)`).run(id, profile.sub, email, profile.name || '', profile.picture || '', role, timestamp, timestamp);
    }
    db.prepare(`INSERT INTO customers(id,user_id,email,name,created_at)
      VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id,name=excluded.name`)
      .run(`cus_${id}`, id, email, profile.name || '', timestamp);
    const sessionToken = randomBytes(32).toString('base64url');
    const sessionHash = hash(sessionToken);
    const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sessionHash, id, expires);
    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true, sameSite: 'lax', secure: APP_BASE_URL.startsWith('https://'),
      path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
    res.redirect(safeReturnTo(stateRecord.return_to));
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', enforceSameOrigin, (req, res) => {
  const rawToken = cookieValue(req, SESSION_COOKIE);
  if (rawToken) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(rawToken));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: APP_BASE_URL.startsWith('https://'), path: '/' });
  res.json({ ok: true });
});

app.get('/api/store/catalog', (_req, res) => {
  const categoryRows = db.prepare('SELECT * FROM categories WHERE enabled=1 ORDER BY sort_order,name_ar').all() as SqlRow[];
  const categoryList = categoryRows.map(readCategory);
  const slugs = new Set(categoryList.map((category) => category.slug));
  const productRows = db.prepare(`${categoryJoin()} WHERE p.enabled=1 ORDER BY p.created_at DESC`).all() as SqlRow[];
  const productList = productRows.map(readProduct).filter((product) => slugs.has(product.category));
  res.json({
    products: productList,
    categories: categoryList,
    siteInfo: readSetting('siteInfo', {}),
    shipping: readSetting('shipping', { standardFee: 50, freeThreshold: 1000, currency: 'EGP' }),
    store: readSetting('store', { name: 'خيوط', currency: 'EGP', lowStockThreshold: 5, acceptingOrders: true }),
    homepage: readSetting('homepage', {}),
  });
});

app.post('/api/store/coupons/validate', enforceSameOrigin, (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const subtotal = Math.max(0, Number(req.body?.subtotal) || 0);
  if (!code) return res.status(400).json({ error: 'COUPON_REQUIRED' });
  const coupon = db.prepare('SELECT * FROM coupons WHERE code=? COLLATE NOCASE AND active=1').get(code) as SqlRow | undefined;
  if (!coupon) return res.status(404).json({ error: 'COUPON_NOT_FOUND', message: 'كود الخصم غير صالح.' });
  if (coupon.expires_at && String(coupon.expires_at) < currentIso()) return res.status(400).json({ error: 'COUPON_EXPIRED', message: 'انتهت صلاحية كود الخصم.' });
  if (Number(coupon.usage_limit) > 0 && Number(coupon.usage_count) >= Number(coupon.usage_limit)) return res.status(400).json({ error: 'COUPON_LIMIT_REACHED', message: 'تم استخدام هذا الكود بالكامل.' });
  if (subtotal < Number(coupon.minimum_order)) return res.status(400).json({ error: 'MINIMUM_NOT_MET', message: `الحد الأدنى لهذا الكود هو EGP ${Number(coupon.minimum_order)}.` });
  const rawDiscount = coupon.kind === 'percent' ? subtotal * Number(coupon.value) / 100 : Number(coupon.value);
  const discount = Math.min(subtotal, Math.round(rawDiscount * 100) / 100);
  res.json({ code: String(coupon.code), discount, message: 'تم تطبيق كود الخصم.' });
});

app.post('/api/store/orders', enforceSameOrigin, async (req, res, next) => {
  if (PUBLIC_PREVIEW_MODE || DISABLE_STORE_ORDERS) return res.status(503).json({ error: 'PREVIEW_MODE_READ_ONLY', message: 'هذه معاينة فقط؛ لم يتم حفظ الطلب أو تغيير المخزون.' });
  try {
    const store = readSetting<{ acceptingOrders?: boolean }>('store', {});
    if (store.acceptingOrders === false) return res.status(503).json({ error: 'STORE_PAUSED', message: 'الطلبات متوقفة مؤقتا.' });
    const customer = req.body?.customer as Record<string, unknown> | undefined;
    const itemsInput = req.body?.items;
    if (!customer || !Array.isArray(itemsInput) || !itemsInput.length || itemsInput.length > 40) return res.status(400).json({ error: 'INVALID_ORDER' });
    const fullName = String(customer.fullName || '').trim();
    const phone = String(customer.phone || '').trim();
    const email = (getRequestUser(req)?.email || String(customer.email || '')).trim().toLowerCase();
    const governorate = String(customer.governorate || '').trim();
    const city = String(customer.city || '').trim();
    const address = String(customer.address || '').trim();
    const notes = String(customer.notes || '').trim().slice(0, 1000);
    if (fullName.length < 3 || phone.length < 8 || !/^\S+@\S+\.\S+$/.test(email) || !governorate || !city || address.length < 6) return res.status(400).json({ error: 'INVALID_CUSTOMER_DETAILS', message: 'راجعي بيانات التوصيل وحاولي مرة أخرى.' });

    const items: Array<{ productId: string; name: string; code: string; price: number; quantity: number; colorName: string; colorAr: string }> = [];
    for (const raw of itemsInput) {
      const productId = String(raw?.productId || '');
      const quantity = Math.floor(Number(raw?.quantity));
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return res.status(400).json({ error: 'INVALID_ORDER_ITEM' });
      const row = db.prepare(`${categoryJoin()} WHERE p.id=?`).get(productId) as SqlRow | undefined;
      if (!row) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND', productId });
      const product = readProduct(row);
      if (!product.enabled || !product.available || product.stock < quantity) return res.status(409).json({ error: 'PRODUCT_UNAVAILABLE', productId, message: `${product.name} لم تعد متاحة بالكمية المطلوبة.` });
      const selected = product.colorVariants.find((variant) => variant.name === raw?.colorName) || product.colorVariants.find((variant) => variant.name === product.color) || product.colorVariants[0];
      const price = product.discountPrice && product.discountPrice < product.price ? product.discountPrice : product.price;
      items.push({ productId, name: product.name, code: product.code, price, quantity, colorName: selected?.name || product.color, colorAr: selected?.nameAr || product.colorAr });
    }
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const shippingSettings = readSetting<{ standardFee?: number; freeThreshold?: number }>('shipping', { standardFee: 50, freeThreshold: 1000 });
    const shipping = subtotal >= Number(shippingSettings.freeThreshold ?? 1000) ? 0 : Number(shippingSettings.standardFee ?? 50);
    const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : '';
    let discount = 0;
    let coupon: SqlRow | undefined;
    if (couponCode) {
      coupon = db.prepare('SELECT * FROM coupons WHERE code=? COLLATE NOCASE AND active=1').get(couponCode) as SqlRow | undefined;
      if (!coupon || (coupon.expires_at && String(coupon.expires_at) < currentIso()) || (Number(coupon.usage_limit) > 0 && Number(coupon.usage_count) >= Number(coupon.usage_limit)) || subtotal < Number(coupon.minimum_order)) {
        return res.status(400).json({ error: 'COUPON_INVALID', message: 'تعذر تطبيق كود الخصم.' });
      }
      discount = Math.min(subtotal, Math.round((coupon.kind === 'percent' ? subtotal * Number(coupon.value) / 100 : Number(coupon.value)) * 100) / 100);
    }
    const total = Math.max(0, Math.round((subtotal + shipping - discount) * 100) / 100);
    const signedUser = getRequestUser(req);
    const timestamp = currentIso();
    const orderId = `KH-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const customerSnapshot = { fullName, phone, email, governorate, city, address, notes };
    const create = db.transaction(() => {
      const customerId = `cus_${randomUUID()}`;
      db.prepare(`INSERT INTO customers(id,user_id,email,name,phone,created_at,last_order_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET
        user_id=COALESCE(excluded.user_id,customers.user_id), name=excluded.name, phone=excluded.phone, last_order_at=excluded.last_order_at`)
        .run(customerId, signedUser?.id || null, email, fullName, phone, timestamp, timestamp);
      const savedCustomer = db.prepare('SELECT id FROM customers WHERE email=? COLLATE NOCASE').get(email) as { id: string };
      for (const item of items) {
        const updated = db.prepare('UPDATE products SET stock=stock-?,available=CASE WHEN stock-?<=0 THEN 0 ELSE available END WHERE id=? AND stock>=? AND enabled=1')
          .run(item.quantity, item.quantity, item.productId, item.quantity);
        if (updated.changes !== 1) throw new Error('STOCK_CHANGED');
      }
      db.prepare(`INSERT INTO orders(id,user_id,customer_id,customer_json,subtotal,shipping,discount,coupon_code,total,payment_method,status,items_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,'cash_on_delivery','pending',?,?,?)`)
        .run(orderId, signedUser?.id || null, savedCustomer.id, JSON.stringify(customerSnapshot), subtotal, shipping, discount, couponCode || null, total, JSON.stringify(items), timestamp, timestamp);
      if (coupon) db.prepare('UPDATE coupons SET usage_count=usage_count+1 WHERE code=?').run(coupon.code);
    });
    try { create(); } catch (error) {
      if (error instanceof Error && error.message === 'STOCK_CHANGED') return res.status(409).json({ error: 'STOCK_CHANGED', message: 'تغير المخزون أثناء إتمام الطلب. راجعي السلة.' });
      throw error;
    }
    const order = readOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(orderId) as SqlRow);
    res.status(201).json({ order });
  } catch (error) { next(error); }
});

app.get('/api/account/orders', requireUser, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.authUser!.id) as SqlRow[];
  res.json({ orders: rows.map(readOrder) });
});
app.get('/api/account/favorites', requireUser, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT product_id FROM favorites WHERE user_id=? ORDER BY added_at DESC').all(req.authUser!.id) as Array<{ product_id: string }>;
  res.json({ favorites: rows.map((row) => row.product_id) });
});
app.put('/api/account/favorites', requireUser, enforceSameOrigin, (req: AuthRequest, res) => {
  if (!Array.isArray(req.body?.favorites) || req.body.favorites.length > 1000) return res.status(400).json({ error: 'INVALID_FAVORITES' });
  const ids = Array.from(new Set(req.body.favorites.filter((id: unknown) => typeof id === 'string')));
  const save = db.transaction(() => {
    db.prepare('DELETE FROM favorites WHERE user_id=?').run(req.authUser!.id);
    const insert = db.prepare('INSERT OR IGNORE INTO favorites(user_id,product_id,added_at) SELECT ?,id,? FROM products WHERE id=? AND enabled=1');
    for (const id of ids) insert.run(req.authUser!.id, currentIso(), id);
  });
  save();
  res.json({ favorites: ids });
});

app.use('/api/admin', requireAdmin, enforceSameOrigin);

app.get('/api/admin/dashboard', (_req, res) => {
  const range = String(_req.query.range || '30d');
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === 'year' ? 365 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const allOrderCounts = db.prepare(`SELECT status,COUNT(*) AS count FROM orders GROUP BY status`).all() as Array<{ status: string; count: number }>;
  const countFor = (status: string) => Number(allOrderCounts.find((item) => item.status === status)?.count || 0);
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE status!='cancelled'").get() as { total: number };
  const period = db.prepare("SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS revenue FROM orders WHERE created_at>=?").get(since) as { orders: number; revenue: number };
  const customers = db.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number };
  const productCounts = db.prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN stock>0 AND stock<=? THEN 1 ELSE 0 END) AS low,SUM(CASE WHEN stock<=0 OR available=0 THEN 1 ELSE 0 END) AS out FROM products WHERE enabled=1').get(Number(readSetting<{ lowStockThreshold?: number }>('store',{lowStockThreshold:5}).lowStockThreshold || 5)) as { total: number; low: number; out: number };
  const orderRows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as SqlRow[];
  const nonCancelledOrders = orderRows.filter((row) => row.status !== 'cancelled');
  const sales = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const row of nonCancelledOrders) for (const item of jsonFallback<Array<{ productId: string; name: string; quantity: number; price: number }>>(row.items_json, [])) {
    const entry = sales.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
    entry.quantity += item.quantity; entry.revenue += item.quantity * item.price; sales.set(item.productId, entry);
  }
  const lowStock = (db.prepare(`${categoryJoin()} WHERE p.enabled=1 AND (p.stock<=? OR p.available=0) ORDER BY p.stock ASC LIMIT 8`).all(Number(readSetting<{ lowStockThreshold?: number }>('store',{lowStockThreshold:5}).lowStockThreshold || 5)) as SqlRow[]).map(readProduct);
  const recentOrders = orderRows.slice(0, 8).map(readOrder);
  const recentCustomers = db.prepare('SELECT * FROM customers ORDER BY COALESCE(last_order_at,created_at) DESC LIMIT 6').all() as SqlRow[];
  res.json({
    revenue: Number(revenue.total || 0), orders: orderRows.length, pendingOrders: countFor('pending'), confirmedOrders: countFor('confirmed'),
    preparingOrders: countFor('preparing'), shippedOrders: countFor('shipped'), deliveredOrders: countFor('delivered'), cancelledOrders: countFor('cancelled'), customers: Number(customers.count), products: Number(productCounts.total || 0),
    lowStockCount: Number(productCounts.low || 0), outOfStockCount: Number(productCounts.out || 0), period,
    recentOrders, recentCustomers: recentCustomers.map((row) => ({ id: row.id, name: row.name, email: row.email, phone: row.phone, createdAt: row.created_at })),
    bestSellers: Array.from(sales.entries()).map(([productId, item]) => ({ productId, ...item })).sort((a,b) => b.quantity-a.quantity).slice(0,6),
    lowStockProducts: lowStock,
  });
});

app.get('/api/admin/analytics', (req, res) => {
  const range = String(req.query.range || '30d');
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === 'year' ? 365 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const orders = db.prepare("SELECT * FROM orders WHERE created_at>=? AND status!='cancelled' ORDER BY created_at").all(since) as SqlRow[];
  const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
  const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
  const categoryStats = new Map<string, { category: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    const date = String(order.created_at).slice(0, 10);
    const day = byDay.get(date) || { date, orders: 0, revenue: 0 };
    day.orders += 1; day.revenue += Number(order.total); byDay.set(date, day);
    for (const item of jsonFallback<Array<{ productId: string; name: string; quantity: number; price: number }>>(order.items_json, [])) {
      const product = db.prepare('SELECT category FROM products WHERE id=?').get(item.productId) as { category: string } | undefined;
      const p = productStats.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
      p.quantity += item.quantity; p.revenue += item.price * item.quantity; productStats.set(item.productId, p);
      const slug = product?.category || 'unknown'; const c = categoryStats.get(slug) || { category: slug, quantity: 0, revenue: 0 };
      c.quantity += item.quantity; c.revenue += item.price * item.quantity; categoryStats.set(slug, c);
    }
  }
  const totalRevenue = orders.reduce((sum,row)=>sum+Number(row.total),0);
  const categoryNames = new Map((db.prepare('SELECT slug,name_ar FROM categories').all() as Array<{slug:string;name_ar:string}>).map((c)=>[c.slug,c.name_ar]));
  res.json({ range, revenue: totalRevenue, orders: orders.length, customers: new Set(orders.map((row)=>row.customer_id)).size, averageOrderValue: orders.length ? totalRevenue/orders.length : 0,
    byDay: Array.from(byDay.values()), bestProducts: Array.from(productStats.values()).sort((a,b)=>b.quantity-a.quantity).slice(0,10),
    bestCategories: Array.from(categoryStats.entries()).map(([slug,item])=>({name:categoryNames.get(slug)||slug,...item})).sort((a,b)=>b.quantity-a.quantity).slice(0,10),
  });
});

app.get('/api/admin/orders', (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '');
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as SqlRow[];
  const result = rows.map(readOrder).filter((order) => (!status || order.status === status) && (!q || [order.id, order.customer.fullName, order.customer.email, order.customer.phone].some((value) => String(value || '').toLowerCase().includes(q.toLowerCase()))));
  res.json({ orders: result });
});
app.patch('/api/admin/orders/:id', (req, res) => {
  const status = String(req.body?.status || '') as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
  const result = db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(status, currentIso(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  res.json({ order: readOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id) as SqlRow) });
});

function cleanProduct(input: Record<string, unknown>, previousId?: string): Omit<Product, 'categoryName'> {
  const name = String(input.name || '').trim();
  const slug = String(input.slug || '').trim().toLowerCase();
  const code = String(input.code || '').trim().toUpperCase();
  const category = String(input.category || '').trim();
  const categoryRow = db.prepare('SELECT slug FROM categories WHERE slug=?').get(category);
  if (!name || !/^[a-z0-9-]{2,80}$/.test(slug) || !/^[A-Z0-9-]{3,40}$/.test(code) || !categoryRow) throw new Error('INVALID_PRODUCT');
  const images = Array.isArray(input.images) ? input.images.filter((v) => typeof v === 'string' && (v.startsWith('/images/') || v.startsWith('/uploads/'))).slice(0, 12) as string[] : [];
  if (!images.length) throw new Error('PRODUCT_IMAGE_REQUIRED');
  const variants = Array.isArray(input.colorVariants) ? input.colorVariants.filter((v) => v && typeof v.name === 'string' && typeof v.nameAr === 'string' && /^#[0-9a-f]{6}$/i.test(String(v.hex))).slice(0, 24) as ColorVariant[] : [];
  const numeric = (key: string, fallback = 0) => Number.isFinite(Number(input[key])) ? Number(input[key]) : fallback;
  return {
    id: previousId || (typeof input.id === 'string' ? input.id : `kh-custom-${randomUUID().slice(0,8)}`),
    name, slug, code, category, fabric: String(input.fabric || '').trim(), color: String(input.color || variants[0]?.name || '').trim(),
    colorAr: String(input.colorAr || variants[0]?.nameAr || '').trim(), colorVariants: variants,
    price: Math.max(0, numeric('price')), discountPrice: input.discountPrice == null || input.discountPrice === '' ? null : Math.max(0, numeric('discountPrice')),
    description: String(input.description || '').trim(), shortDescription: String(input.shortDescription || '').trim(), images,
    available: Boolean(input.available), enabled: input.enabled !== false, stock: Math.max(0, Math.floor(numeric('stock'))),
    featured: Boolean(input.featured), topSales: Boolean(input.topSales), createdAt: String(input.createdAt || currentIso()).slice(0, 30),
  };
}
function persistProduct(product: Omit<Product, 'categoryName'>) {
  db.prepare(`INSERT INTO products(id,name,slug,code,category,fabric,color,color_ar,color_variants,price,discount_price,description,short_description,images,available,enabled,stock,featured,top_sales,created_at)
    VALUES(@id,@name,@slug,@code,@category,@fabric,@color,@colorAr,@colorVariants,@price,@discountPrice,@description,@shortDescription,@images,@available,@enabled,@stock,@featured,@topSales,@createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,code=excluded.code,category=excluded.category,fabric=excluded.fabric,color=excluded.color,color_ar=excluded.color_ar,color_variants=excluded.color_variants,price=excluded.price,discount_price=excluded.discount_price,description=excluded.description,short_description=excluded.short_description,images=excluded.images,available=excluded.available,enabled=excluded.enabled,stock=excluded.stock,featured=excluded.featured,top_sales=excluded.top_sales`)
    .run({ ...product, colorVariants: JSON.stringify(product.colorVariants), images: JSON.stringify(product.images), available: Number(product.available), enabled: Number(product.enabled !== false), featured: Number(product.featured), topSales: Number(product.topSales) });
}
app.get('/api/admin/products', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const rows = db.prepare(`${categoryJoin()} ORDER BY p.created_at DESC`).all() as SqlRow[];
  let list = rows.map(readProduct);
  const category = String(req.query.category || '');
  const stock = String(req.query.stock || '');
  if (category) list = list.filter((product) => product.category === category);
  if (stock === 'low') list = list.filter((product) => product.enabled && product.stock > 0 && product.stock <= Number(readSetting<{lowStockThreshold?:number}>('store',{lowStockThreshold:5}).lowStockThreshold || 5));
  if (stock === 'out') list = list.filter((product) => product.stock <= 0 || !product.available);
  if (stock === 'disabled') list = list.filter((product) => !product.enabled);
  if (q) list = list.filter((product) => `${product.name} ${product.code} ${product.colorAr} ${product.slug}`.toLowerCase().includes(q));
  res.json({ products: list });
});
app.post('/api/admin/products', (req, res) => {
  try {
    const product = cleanProduct(req.body || {});
    persistProduct(product);
    res.status(201).json({ product: readProduct(db.prepare(`${categoryJoin()} WHERE p.id=?`).get(product.id) as SqlRow) });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'INVALID_PRODUCT' }); }
});
app.patch('/api/admin/products/:id', (req, res) => {
  try {
    const row = db.prepare(`${categoryJoin()} WHERE p.id=?`).get(req.params.id) as SqlRow | undefined;
    if (!row) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
    const existing = readProduct(row);
    const product = cleanProduct({ ...existing, ...req.body }, existing.id);
    persistProduct(product);
    res.json({ product: readProduct(db.prepare(`${categoryJoin()} WHERE p.id=?`).get(product.id) as SqlRow) });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'INVALID_PRODUCT' }); }
});
app.delete('/api/admin/products/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  res.json({ ok: true });
});

function cleanCategory(input: Record<string, unknown>, previousId?: string) {
  const slug = String(input.slug || '').trim().toLowerCase();
  const nameAr = String(input.nameAr || '').trim();
  if (!nameAr || !/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error('INVALID_CATEGORY');
  const image = String(input.image || '');
  if (!image.startsWith('/images/') && !image.startsWith('/uploads/')) throw new Error('INVALID_CATEGORY_IMAGE');
  return { id: previousId || String(input.id || `cat-${randomUUID().slice(0,8)}`), slug, nameAr,
    nameEn: String(input.nameEn || '').trim(), fabric: String(input.fabric || '').trim(), image,
    note: String(input.note || '').trim(), tone: /^#[0-9a-f]{6}$/i.test(String(input.tone)) ? String(input.tone) : '#e7cbc7',
    description: String(input.description || input.note || '').trim(), enabled: input.enabled !== false, sortOrder: Math.max(0, Math.floor(Number(input.sortOrder) || 0)), };
}
function persistCategory(c: ReturnType<typeof cleanCategory>) {
  db.prepare(`INSERT INTO categories(id,slug,name_ar,name_en,fabric,image,note,tone,description,enabled,sort_order)
    VALUES(@id,@slug,@nameAr,@nameEn,@fabric,@image,@note,@tone,@description,@enabled,@sortOrder)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name_ar=excluded.name_ar,name_en=excluded.name_en,fabric=excluded.fabric,image=excluded.image,note=excluded.note,tone=excluded.tone,description=excluded.description,enabled=excluded.enabled,sort_order=excluded.sort_order`)
    .run({ ...c, enabled: Number(c.enabled) });
}
app.get('/api/admin/categories', (_req, res) => res.json({ categories: (db.prepare('SELECT * FROM categories ORDER BY sort_order,name_ar').all() as SqlRow[]).map(readCategory) }));
app.post('/api/admin/categories', (req, res) => {
  try { const category = cleanCategory(req.body || {}); persistCategory(category); res.status(201).json({ category: readCategory(db.prepare('SELECT * FROM categories WHERE id=?').get(category.id) as SqlRow) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'INVALID_CATEGORY' }); }
});
app.patch('/api/admin/categories/:id', (req, res) => {
  try { const row=db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id) as SqlRow|undefined; if(!row)return res.status(404).json({error:'CATEGORY_NOT_FOUND'}); const updated=cleanCategory({...readCategory(row),...req.body},String(row.id)); const tx=db.transaction(()=>{if(updated.slug!==String(row.slug))db.prepare('UPDATE products SET category=? WHERE category=?').run(updated.slug,String(row.slug)); persistCategory(updated);}); tx(); res.json({category:readCategory(db.prepare('SELECT * FROM categories WHERE id=?').get(updated.id) as SqlRow)}); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'INVALID_CATEGORY' }); }
});
app.delete('/api/admin/categories/:id', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id) as SqlRow|undefined;
  if (!category) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' });
  const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category=?').get(category.slug) as { count: number };
  if (count.count) return res.status(409).json({ error: 'CATEGORY_IN_USE', productCount: count.count, message: 'انقلي المنتجات إلى تصنيف آخر قبل حذف هذا التصنيف.' });
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/inventory', (req,res)=>{
  const threshold=Number(req.query.threshold)||Number(readSetting<{lowStockThreshold?:number}>('store',{lowStockThreshold:5}).lowStockThreshold||5);
  const rows=db.prepare(`${categoryJoin()} WHERE p.enabled=1 AND (p.stock<=? OR p.available=0) ORDER BY p.stock,p.name`).all(threshold) as SqlRow[];
  res.json({ threshold, products: rows.map(readProduct) });
});
app.patch('/api/admin/inventory/:id', (req,res)=>{
  const stock=Math.floor(Number(req.body?.stock));
  if(!Number.isInteger(stock)||stock<0||stock>100000) return res.status(400).json({error:'INVALID_STOCK'});
  const row=db.prepare('UPDATE products SET stock=?,available=CASE WHEN ?>0 THEN 1 ELSE 0 END WHERE id=?').run(stock,stock,req.params.id);
  if(!row.changes)return res.status(404).json({error:'PRODUCT_NOT_FOUND'});
  res.json({product:readProduct(db.prepare(`${categoryJoin()} WHERE p.id=?`).get(req.params.id) as SqlRow)});
});

app.get('/api/admin/customers', (req,res)=>{
  const q=String(req.query.q||'').toLowerCase();
  const rows=db.prepare(`SELECT c.*,u.display_name AS google_name,u.picture,
    COUNT(o.id) AS order_count,COALESCE(SUM(CASE WHEN o.status!='cancelled' THEN o.total ELSE 0 END),0) AS total_spent,
    MAX(o.created_at) AS last_order
    FROM customers c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN orders o ON o.customer_id=c.id
    GROUP BY c.id ORDER BY COALESCE(MAX(o.created_at),c.created_at) DESC`).all() as SqlRow[];
  const list=rows.map((r)=>({id:String(r.id),userId:r.user_id?String(r.user_id):null,name:String(r.name||r.google_name||''),googleName:String(r.google_name||''),email:String(r.email),phone:String(r.phone||''),picture:String(r.picture||''),createdAt:String(r.created_at),lastOrder:r.last_order?String(r.last_order):null,orders:Number(r.order_count),totalSpent:Number(r.total_spent)})).filter((c)=>!q||`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));
  res.json({customers:list});
});
app.get('/api/admin/customers/:id', (req,res)=>{
  const row=db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id) as SqlRow|undefined;
  if(!row)return res.status(404).json({error:'CUSTOMER_NOT_FOUND'});
  const orders=db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC').all(req.params.id) as SqlRow[];
  const user=row.user_id?db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id) as SqlRow|undefined:undefined;
  res.json({customer:{id:String(row.id),name:String(row.name||user?.display_name||''),email:String(row.email),phone:String(row.phone||''),createdAt:String(row.created_at),lastOrder:row.last_order_at?String(row.last_order_at):null,googleAccount:user?{id:String(user.id),displayName:String(user.display_name),picture:String(user.picture),role:String(user.role),lastLogin:String(user.last_login)}:null,orders:orders.map(readOrder)}});
});

function cleanCoupon(input: Record<string,unknown>, oldCode?: string) {
  const code=(oldCode||String(input.code||'')).trim().toUpperCase();
  const kind=String(input.kind||'percent'); const value=Number(input.value); const minimumOrder=Math.max(0,Number(input.minimumOrder)||0);
  if(!/^[A-Z0-9_-]{3,30}$/.test(code)||!['percent','fixed'].includes(kind)||!Number.isFinite(value)||value<=0||(kind==='percent'&&value>100))throw new Error('INVALID_COUPON');
  const usageLimit=input.usageLimit==null||input.usageLimit===''?null:Math.max(1,Math.floor(Number(input.usageLimit)));
  const expiresAt=input.expiresAt?new Date(String(input.expiresAt)).toISOString():null;
  return {code,kind,value,minimumOrder,expiresAt,usageLimit,active:input.active!==false};
}
app.get('/api/admin/coupons',(_req,res)=>res.json({coupons:db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()}));
app.post('/api/admin/coupons',(req,res)=>{try{const c=cleanCoupon(req.body||{});db.prepare('INSERT INTO coupons(code,kind,value,minimum_order,expires_at,usage_limit,active,created_at) VALUES(?,?,?,?,?,?,?,?)').run(c.code,c.kind,c.value,c.minimumOrder,c.expiresAt,c.usageLimit,Number(c.active),currentIso());res.status(201).json({coupon:db.prepare('SELECT * FROM coupons WHERE code=?').get(c.code)});}catch(error){res.status(400).json({error:error instanceof Error?error.message:'INVALID_COUPON'});}});
app.patch('/api/admin/coupons/:code',(req,res)=>{try{const row=db.prepare('SELECT * FROM coupons WHERE code=?').get(req.params.code) as SqlRow|undefined;if(!row)return res.status(404).json({error:'COUPON_NOT_FOUND'});const c=cleanCoupon({...row,kind:req.body?.kind??row.kind,value:req.body?.value??row.value,minimumOrder:req.body?.minimumOrder??row.minimum_order,expiresAt:req.body?.expiresAt??row.expires_at,usageLimit:req.body?.usageLimit??row.usage_limit,active:req.body?.active??Boolean(row.active)},String(row.code));db.prepare('UPDATE coupons SET kind=?,value=?,minimum_order=?,expires_at=?,usage_limit=?,active=? WHERE code=?').run(c.kind,c.value,c.minimumOrder,c.expiresAt,c.usageLimit,Number(c.active),c.code);res.json({coupon:db.prepare('SELECT * FROM coupons WHERE code=?').get(c.code)});}catch(error){res.status(400).json({error:error instanceof Error?error.message:'INVALID_COUPON'});}});
app.delete('/api/admin/coupons/:code',(req,res)=>{db.prepare('DELETE FROM coupons WHERE code=?').run(req.params.code);res.json({ok:true});});

app.get('/api/admin/homepage',(_req,res)=>res.json({homepage:readSetting('homepage',{})}));
app.put('/api/admin/homepage',(req,res)=>{
  const existing=readSetting<Record<string,unknown>>('homepage',{});
  const input=req.body||{};
  const allowed=['heroImage','heroKicker','heroTitle','heroTitleAccent','heroSubtitle','primaryButtonLabel','primaryButtonUrl','secondaryButtonLabel','secondaryButtonUrl','featuredProductIds','sectionOrder','promoVisible','promoTitle','promoText','promoImage'];
  const updated={...existing};
  for(const key of allowed) if(input[key]!==undefined) updated[key]=input[key];
  if(!Array.isArray(updated.featuredProductIds)||updated.featuredProductIds.some((id)=>typeof id!=='string'))return res.status(400).json({error:'INVALID_FEATURED_PRODUCTS'});
  for(const key of ['heroImage','promoImage'])if(updated[key]&&!String(updated[key]).startsWith('/images/')&&!String(updated[key]).startsWith('/uploads/'))return res.status(400).json({error:'INVALID_IMAGE_PATH'});
  writeSetting('homepage',updated);res.json({homepage:updated});
});

app.get('/api/admin/social-contact',(_req,res)=>res.json({siteInfo:readSetting('siteInfo',{})}));
app.put('/api/admin/social-contact',(req,res)=>{
  const old=readSetting<Record<string,unknown>>('siteInfo',{});const b=req.body||{};
  const next={...old};
  for(const key of ['name','tagline','email','phone','whatsapp','instagram','tiktok','address'])if(typeof b[key]==='string')next[key]=String(b[key]).trim();
  for(const key of ['instagram','tiktok'])if(next[key]&& !/^https:\/\//i.test(String(next[key])))return res.status(400).json({error:'SOCIAL_URL_MUST_USE_HTTPS'});
  next.whatsapp=String(next.whatsapp||'').replace(/[^0-9]/g,'');
  writeSetting('siteInfo',next);
  if(typeof b.name==='string'){
    const store=readSetting<Record<string,unknown>>('store',{});
    writeSetting('store',{...store,name:next.name});
  }
  res.json({siteInfo:next});
});

app.get('/api/admin/settings',(_req,res)=>res.json({store:readSetting('store',{}),shipping:readSetting('shipping',{}),siteInfo:readSetting('siteInfo',{})}));
app.put('/api/admin/settings',(req,res)=>{
  const body=req.body||{};
  if(body.store&&typeof body.store==='object'){
    const old=readSetting<Record<string,unknown>>('store',{});const incoming=body.store as Record<string,unknown>;
    const next={...old};
    for(const key of ['name','currency','lowStockThreshold','acceptingOrders'])if(incoming[key]!==undefined)next[key]=incoming[key];
    next.lowStockThreshold=Math.max(0,Math.floor(Number(next.lowStockThreshold)||0));next.acceptingOrders=Boolean(next.acceptingOrders);writeSetting('store',next);
    if(typeof next.name==='string'){
      const siteInfo=readSetting<Record<string,unknown>>('siteInfo',{});
      writeSetting('siteInfo',{...siteInfo,name:next.name});
    }
  }
  if(body.shipping&&typeof body.shipping==='object'){
    const old=readSetting<Record<string,unknown>>('shipping',{});const incoming=body.shipping as Record<string,unknown>;const next={...old};
    if(incoming.standardFee!==undefined)next.standardFee=Math.max(0,Number(incoming.standardFee)||0);
    if(incoming.freeThreshold!==undefined)next.freeThreshold=Math.max(0,Number(incoming.freeThreshold)||0);
    next.currency='EGP';writeSetting('shipping',next);
  }
  res.json({store:readSetting('store',{}),shipping:readSetting('shipping',{}),siteInfo:readSetting('siteInfo',{})});
});

app.get('/api/admin/admins',(_req,res)=>{
  const rows=db.prepare(`SELECT a.email,a.is_primary,a.is_active,a.added_by,a.created_at,u.display_name,u.last_login
    FROM admin_invites a LEFT JOIN users u ON u.email=a.email COLLATE NOCASE ORDER BY a.is_primary DESC,a.created_at`).all() as SqlRow[];
  res.json({admins:rows.map((r)=>({email:String(r.email),isPrimary:Boolean(r.is_primary),active:Boolean(r.is_active),addedBy:String(r.added_by),createdAt:String(r.created_at),name:String(r.display_name||''),lastLogin:r.last_login?String(r.last_login):null}))});
});
app.post('/api/admin/admins',(req:AuthRequest,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'INVALID_EMAIL'});
  try{db.prepare(`INSERT INTO admin_invites(email,is_primary,is_active,added_by,created_at) VALUES(?,0,1,?,?) ON CONFLICT(email) DO UPDATE SET is_active=1,added_by=excluded.added_by`).run(email,req.authUser!.email,currentIso());
    db.prepare("UPDATE users SET role='admin' WHERE email=? COLLATE NOCASE").run(email);
    res.status(201).json({admin:db.prepare('SELECT email,is_primary,is_active,added_by,created_at FROM admin_invites WHERE email=? COLLATE NOCASE').get(email)});
  }catch{res.status(409).json({error:'ADMIN_ALREADY_EXISTS'});}
});
app.delete('/api/admin/admins/:email',(req,res)=>{
  const email=decodeURIComponent(req.params.email).trim().toLowerCase();
  if(email===OWNER_ADMIN_EMAIL)return res.status(403).json({error:'PRIMARY_ADMIN_PROTECTED',message:'لا يمكن إلغاء صلاحية المالكة الأساسية.'});
  const result=db.prepare('UPDATE admin_invites SET is_active=0 WHERE email=? COLLATE NOCASE AND is_primary=0').run(email);
  if(!result.changes)return res.status(404).json({error:'ADMIN_NOT_FOUND'});
  db.prepare("UPDATE users SET role='customer' WHERE email=? COLLATE NOCASE").run(email);
  res.json({ok:true});
});

const storage=multer.diskStorage({destination:(_req,_file,cb)=>cb(null,uploadsDir),filename:(_req,file,cb)=>{
  const ext=path.extname(file.originalname).toLowerCase();cb(null,`${randomUUID()}${ext}`);
}});
const upload=multer({storage,limits:{fileSize:8*1024*1024,files:1},fileFilter:(_req,file,cb)=>{
  const allowed=new Set(['image/jpeg','image/png','image/webp','image/avif']);
  if (allowed.has(file.mimetype)) cb(null, true);
  else cb(new Error('ONLY_IMAGE_UPLOADS_ALLOWED'));
}});
function mediaUsage(assetPath:string){
  const usage:string[]=[];
  const products=(db.prepare('SELECT id,name,images FROM products').all() as SqlRow[]);
  for(const row of products)if(jsonFallback<string[]>(row.images,[]).includes(assetPath))usage.push(`Product: ${row.name}`);
  const categories=(db.prepare('SELECT name_ar,image FROM categories').all() as SqlRow[]);
  for(const row of categories)if(row.image===assetPath)usage.push(`Category: ${row.name_ar}`);
  const home=readSetting<Record<string,unknown>>('homepage',{});
  for(const [key,label] of [['heroImage','Homepage hero'],['promoImage','Homepage promotion']] as const)if(home[key]===assetPath)usage.push(label);
  return usage;
}
app.get('/api/admin/media',(_req,res)=>{
  const imageFiles=(dir:string,prefix:string)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).filter((d)=>d.isFile()&&/\.(jpe?g|png|webp|avif)$/i.test(d.name)).map((d)=>{
    const filePath=path.join(dir,d.name);const url=`${prefix}/${d.name}`;return {name:d.name,url,size:fs.statSync(filePath).size,usedBy:mediaUsage(url),deletable:prefix==='/uploads'};
  }):[];
  res.json({media:[...imageFiles(path.join(publicDir,'images'),'/images'),...imageFiles(uploadsDir,'/uploads')]});
});
app.post('/api/admin/media',upload.single('file'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'FILE_REQUIRED'});
  res.status(201).json({asset:{name:req.file.filename,url:`/uploads/${req.file.filename}`,size:req.file.size,usedBy:[],deletable:true}});
});
app.delete('/api/admin/media/:name',(req,res)=>{
  const name=path.basename(decodeURIComponent(req.params.name));const file=path.join(uploadsDir,name);
  if(!file.startsWith(uploadsDir+path.sep)||!fs.existsSync(file))return res.status(404).json({error:'MEDIA_NOT_FOUND'});
  const url=`/uploads/${name}`;const usedBy=mediaUsage(url);
  if(usedBy.length)return res.status(409).json({error:'MEDIA_IN_USE',usedBy});
  fs.unlinkSync(file);res.json({ok:true});
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const message=error instanceof Error?error.message:'SERVER_ERROR';
  const status=message==='ONLY_IMAGE_UPLOADS_ALLOWED'?400:message==='LIMIT_FILE_SIZE'?413:500;
  res.status(status).json({error:message});
});

if(fs.existsSync(distDir)){
  app.use(express.static(distDir,{index:false}));
  app.get(/.*/,(_req,res)=>res.sendFile(path.join(distDir,'index.html')));
}

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`Khoyout API listening on 0.0.0.0:${PORT}`);
  console.log(`SQLite database: ${path.resolve(process.env.DATABASE_PATH||'data/khoyout.sqlite')}`);
  console.log(`Google OAuth: ${oauthConfigured?'configured':'awaiting GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'}`);
});
