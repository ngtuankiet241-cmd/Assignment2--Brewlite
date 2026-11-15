'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { PRODUCT_IMAGE_FALLBACK, resolveProductImage } from '@/lib/productImage';

type ProductImageProps = Omit<ImageProps, 'src' | 'onError'> & { src: string; productId?: string };

// A self-contained final fallback also works if a deployment is missing the
// public placeholder file. It cannot trigger another network request.
const inlineFallback = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="32" fill="#FBF7F0"/><path d="M125 150h140v90a50 50 0 0 1-50 50h-40a50 50 0 0 1-50-50z" fill="#AF7C54"/><path d="M265 165h15a30 30 0 0 1 0 60h-15" fill="none" stroke="#6F472B" stroke-width="12"/><path d="M160 120q-20-20 0-40m40 40q-20-20 0-40m40 40q-20-20 0-40" fill="none" stroke="#DEC1A7" stroke-width="8" stroke-linecap="round"/></svg>',
)}`;

function ImageWithFallback({ src, alt, ...props }: ProductImageProps) {
  const [attempt, setAttempt] = useState(0);
  const sources = src === PRODUCT_IMAGE_FALLBACK
    ? [PRODUCT_IMAGE_FALLBACK, inlineFallback]
    : [src, PRODUCT_IMAGE_FALLBACK, inlineFallback];
  const imageSrc = sources[attempt];

  return (
    <Image
      {...props}
      alt={alt}
      src={imageSrc}
      onError={attempt === sources.length - 1 ? undefined : () => setAttempt(attempt + 1)}
    />
  );
}

export default function ProductImage({ src, productId, ...props }: ProductImageProps) {
  const source = resolveProductImage(src, productId);
  // A different product/source gets a fresh error state, including in the modal.
  return <ImageWithFallback key={source} {...props} src={source} />;
}
