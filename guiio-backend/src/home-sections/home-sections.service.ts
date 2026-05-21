import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private clean(row: any) {
    return {
      ...row,
      galleryImages: (row.galleryImages as any[]).filter(Boolean),
    };
  }

  async get() {
    const row = await this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
    return this.clean(row);
  }

  async update(data: { storyText?: string | null; storyImage?: string | null; galleryImages?: string[] }) {
    if (data.galleryImages) {
      data.galleryImages = data.galleryImages.filter(Boolean);
    }
    const row = await this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
    return this.clean(row);
  }
}
