import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SedesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(empresa = 'GUIIO') {
    return this.prisma.sede.findMany({ where: { empresa }, orderBy: { name: 'asc' } });
  }

  create(data: { name: string }, empresa = 'GUIIO') {
    return this.prisma.sede.create({ data: { ...data, empresa } });
  }

  update(id: string, data: { name?: string; active?: boolean; pin?: string | null }) {
    return this.prisma.sede.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.sede.delete({ where: { id } });
    return { deleted: true };
  }
}
