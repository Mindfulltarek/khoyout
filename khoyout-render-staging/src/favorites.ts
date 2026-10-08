export async function loadUserFavorites(_userId: string): Promise<string[]> {
  const response = await fetch('/api/account/favorites', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('FAVORITES_LOAD_FAILED');
  const payload = await response.json() as { favorites?: string[] };
  return Array.isArray(payload.favorites) ? payload.favorites : [];
}

export async function saveUserFavorites(_userId: string, productIds: string[]) {
  const response = await fetch('/api/account/favorites', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites: productIds }),
  });
  if (!response.ok) throw new Error('FAVORITES_SAVE_FAILED');
}

export function isFavoritesRepositoryConfigured() {
  return typeof window !== 'undefined';
}
