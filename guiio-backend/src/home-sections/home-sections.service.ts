import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  async update(data: { storyText?: string | null; storyImage?: string | null; galleryImages?: any[] }) {
    return this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
  }
}
