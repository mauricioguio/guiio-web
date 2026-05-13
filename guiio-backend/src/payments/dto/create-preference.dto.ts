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

export class CustomerDto {
  name: string;
  email: string;
  phone: string;
  address: string;
  reference?: string;
  city: string;
  notes?: string;
}

export class CreatePreferenceDto {
  items: CartItemDto[];
  shipping: number;
  discount: number;
  customer: CustomerDto;
}
