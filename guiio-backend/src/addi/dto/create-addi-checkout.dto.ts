export class AddiCartItemDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  topSize: string;
  bottomSize: string;
  color: string;
}

export class AddiCustomerDto {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  docNumber: string;
  reference?: string;
  notes?: string;
}

export class CreateAddiCheckoutDto {
  items: AddiCartItemDto[];
  shipping: number;
  discount: number;
  customer: AddiCustomerDto;
}
