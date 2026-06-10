import { Module } from '@nestjs/common';
import { OrderEditRequestsController } from './order-edit-requests.controller';
import { OrderEditRequestsService } from './order-edit-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OrderEditRequestsController],
  providers: [OrderEditRequestsService, PrismaService],
})
export class OrderEditRequestsModule {}
