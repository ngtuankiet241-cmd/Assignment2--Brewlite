export const PRODUCT_IMAGE_FALLBACK = '/images/products/placeholder.svg';

// Verified production catalog IDs, not display names. This affects presentation
// only; database imageUrl values are managed separately by the catalog owner.
const catalogImages = [
  { id: 'cmwfaunf10000jxr9zoh6x322', file: 'ca-phe-sua.svg', photo: 'photo-1461023058943-07fcbe16d735' },
  { id: 'cmwfaunj30001jxr9elvss1oc', file: 'tra-sua.svg', photo: 'photo-1558857563-c0c6b8b7a1d9' },
  { id: 'cmwfaunli0002jxr9pjwdtmvp', file: 'matcha.svg', photo: 'photo-1536256268855-8f64b7c2b9e7' },
  { id: 'cmwfaunob0003jxr95mxw1k05', file: 'tra-dao.svg', photo: 'photo-1556679343-c7306c1976bc' },
  { id: 'cmwfaunxu0004jxr9gawwxuh7', file: 'hong-tra.svg', photo: 'photo-1576092768241-dec231879fc3' },
  { id: 'cmwfauo0q0005jxr9tygbwyjn', file: 'oreo-da-xay.svg', photo: 'photo-1579954115545-a955e57f8c1f' },
];

// No fetches here: legacy URL keys also cover old carts and environments whose
// IDs differ. Query strings cannot accidentally restore a broken Unsplash URL.
const imagesById = new Map(catalogImages.map(({ id, file }) => [id, `/images/products/${file}`]));
const imagesByLegacyUrl = new Map(catalogImages.map(({ photo, file }) => [
  `https://images.unsplash.com/${photo}`, `/images/products/${file}`,
]));

export function resolveProductImage(source: string, productId?: string | number): string {
  const catalogImage = productId === undefined ? undefined : imagesById.get(String(productId));
  if (catalogImage) return catalogImage;

  const value = source.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    const localImage = imagesByLegacyUrl.get(`${url.origin}${url.pathname}`);
    if (localImage) return localImage;
    if (url.protocol === 'https:' || url.protocol === 'http:') return value;
  } catch {
    // Empty and malformed values use the same local fallback as load errors.
  }
  return PRODUCT_IMAGE_FALLBACK;
}
