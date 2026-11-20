export interface Product {
  id?: string | number;
  name: string;
  category: string;
  size: string;
  price: number;
  imageUrl: string;
  available?: boolean;
}