import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.collection.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(data: any) {
    return this.prisma.collection.create({ data });
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    return this.prisma.collection.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.prisma.collection.delete({ where: { id } });
    return { deleted: true };
  }
}
