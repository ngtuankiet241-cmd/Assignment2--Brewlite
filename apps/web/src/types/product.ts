/**
 * Product Data Types for BrewLite
 * Designed for easy mapping to NestJS API DTOs/Entities in subsequent sprints.
 */

export type ProductCategory =
  | 'traditional'
  | 'espresso'
  | 'milk-tea'
  | 'tea'
  | 'blended'
  | 'specialty';

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
  createdAt?: string;
  updatedAt?: string;
}

export type ProductFilterCategory = 'all' | ProductCategory;
