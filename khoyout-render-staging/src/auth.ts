export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
  picture?: string;
  role: 'customer' | 'admin';
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!response.ok) return null;
  const payload = await response.json() as { user?: AuthUser | null };
  return payload.user ?? null;
}

export function signInWithGoogle(returnTo = '/') {
  if (import.meta.env.VITE_PUBLIC_PREVIEW_MODE === 'true') {
    window.alert('تسجيل الدخول غير مفعّل في رابط المعاينة العامة.');
    return;
  }
  const safePath = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const authUrl = new URL(`/api/auth/google?returnTo=${encodeURIComponent(safePath)}`, window.location.href).toString();

  // OAuth providers reject embedded login pages. Keep the preview frame on our page if
  // its sandbox blocks popups; the user can open the public URL in a regular tab instead.
  if (window.top && window.top !== window) {
    const popup = window.open(authUrl, '_blank');
    if (popup) {
      try { popup.opener = null; } catch { /* The browser may not expose the opener handle. */ }
      return;
    }
    window.alert('تسجيل الدخول لا يعمل داخل إطار المعاينة. افتحي رابط المتجر العام في تبويب مستقل ثم أعيدي المحاولة.');
    return;
  }
  window.location.assign(authUrl);
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}
