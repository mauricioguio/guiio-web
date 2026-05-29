import { Module } from '@nestjs/common';
import { HomeSectionsController } from './home-sections.controller';
import { HomeSectionsService } from './home-sections.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HomeSectionsController],
  providers: [HomeSectionsService, PrismaService],
})
export class HomeSectionsModule {}
