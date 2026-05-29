import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartItemDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
  color: string;
  topSize: string;
  bottomSize: string;
}

export interface SaveCartDto {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city?: string;
  items: CartItemDto[];
  total: number;
}

@Injectable()
export class AbandonedCartsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(dto: SaveCartDto) {
    await this.prisma.abandonedCart.upsert({
      where:  { reference: dto.reference },
      update: {},
      create: {
        reference:     dto.reference,
        customerName:  dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        city:          dto.city,
        items:         dto.items as any,
        total:         dto.total,
      },
    });
    return { saved: true };
  }

  async markConverted(reference: string) {
    await this.prisma.abandonedCart.updateMany({
      where: { reference, convertedAt: null },
      data:  { convertedAt: new Date() },
    });
  }

  findAll() {
    return this.prisma.abandonedCart.findMany({
      where:   { convertedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
