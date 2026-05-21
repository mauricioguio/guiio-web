import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  update(data: { storyText?: string | null; storyImage?: string | null; galleryImages?: string[] }) {
    return this.prisma.homeSections.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
  }
}
