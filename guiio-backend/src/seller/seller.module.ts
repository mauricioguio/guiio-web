import { Module } from '@nestjs/common';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CashModule } from '../cash/cash.module';

@Module({
  imports: [AuthModule, CashModule],
  controllers: [SellerController],
  providers: [SellerService, PrismaService],
})
export class SellerModule {}
