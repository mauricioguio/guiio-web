export class CartItemDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  topSize: string;
  bottomSize: string;
  color: string;
}

export class CreatePreferenceDto {
  items: CartItemDto[];
  shipping: number;
  discount: number;
  buyerEmail?: string;
}
