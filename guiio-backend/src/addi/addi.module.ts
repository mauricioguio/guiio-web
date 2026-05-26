import { Module } from '@nestjs/common';
import { AddiController } from './addi.controller';
import { AddiService } from './addi.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AddiController],
  providers: [AddiService, PrismaService],
})
export class AddiModule {}
