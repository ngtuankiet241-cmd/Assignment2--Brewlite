/**
 * Product Data Types for BrewLite
 * Designed for easy mapping to NestJS API DTOs/Entities in subsequent sprints.
 */

export type ProductCategory = 'traditional' | 'espresso' | 'tea' | 'specialty';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Price in VND
  imageUrl: string;
  category: ProductCategory;
  categoryName: string;
  isAvailable: boolean;
  stock?: number;
  badge?: string; // e.g. "Bán chạy nhất", "Signature", "Gen Z yêu thích"
  rating?: number; // e.g. 4.9
  prepTimeMinutes?: number; // Estimated prep time
  createdAt?: string;
  updatedAt?: string;
}

export type ProductFilterCategory = 'all' | ProductCategory;
