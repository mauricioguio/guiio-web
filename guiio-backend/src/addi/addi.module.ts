import { Module } from '@nestjs/common';
import { AddiController } from './addi.controller';
import { AddiService } from './addi.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [AddiController],
  providers: [AddiService, PrismaService],
})
export class AddiModule {}
