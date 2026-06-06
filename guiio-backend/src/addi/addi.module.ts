import { Module } from '@nestjs/common';
import { AddiController } from './addi.controller';
import { AddiService } from './addi.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';
import { AbandonedCartsModule } from '../abandoned-carts/abandoned-carts.module';

@Module({
  imports: [EmailModule, AbandonedCartsModule],
  controllers: [AddiController],
  providers: [AddiService, PrismaService],
})
export class AddiModule {}
