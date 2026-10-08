export type CheckoutDetails = {
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  code: string;
  price: number;
  quantity: number;
  colorName?: string;
  colorAr?: string;
};

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export type OrderDraft = {
  customer: CheckoutDetails;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: 'cash_on_delivery';
  couponCode?: string;
};

export type OrderRecord = {
  id: string;
  userId?: string | null;
  customer: CheckoutDetails;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paymentMethod: 'cash_on_delivery';
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string } & T;
  if (!response.ok) throw new Error(payload.message || payload.error || 'تعذر إتمام الطلب.');
  return payload;
}

export async function createOrder(draft: OrderDraft): Promise<OrderRecord> {
  const payload = await readJson<{ order: OrderRecord }>(await fetch('/api/store/orders', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  }));
  try { localStorage.setItem('khoyout-last-order-v1', JSON.stringify(payload.order)); } catch { /* Confirmation still works through router state. */ }
  return payload.order;
}

export async function validateCoupon(code: string, subtotal: number): Promise<{ code: string; discount: number; message: string }> {
  return readJson(await fetch('/api/store/coupons/validate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  }));
}

export function getLastOrder(): OrderRecord | null {
  try {
    const raw = localStorage.getItem('khoyout-last-order-v1');
    return raw ? (JSON.parse(raw) as OrderRecord) : null;
  } catch {
    return null;
  }
}
