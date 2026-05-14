import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const list = await this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return list.map(p => ({ ...p, type: p.type.toLowerCase() }));
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    return p ? { ...p, type: p.type.toLowerCase() } : null;
  }

  async create(data: any) {
    const p = await this.prisma.product.create({
      data: { ...data, type: (data.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    const p = await this.prisma.product.update({
      where: { id },
      data: { ...rest, type: (rest.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
