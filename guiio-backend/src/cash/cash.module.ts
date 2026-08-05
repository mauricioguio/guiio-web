import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CashController],
  providers: [CashService, PrismaService],
  exports: [CashService],
})
export class CashModule {}
