import { Module } from '@nestjs/common';
import { HomeSectionsController } from './home-sections.controller';
import { HomeSectionsService } from './home-sections.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [HomeSectionsController],
  providers: [HomeSectionsService, PrismaService],
})
export class HomeSectionsModule {}
