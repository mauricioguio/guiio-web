import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CollectionsModule } from './collections/collections.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PaymentsModule,
    OrdersModule,
    ProductsModule,
    CollectionsModule,
  ],
})
export class AppModule {}
