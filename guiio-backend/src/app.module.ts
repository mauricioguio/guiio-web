import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CollectionsModule } from './collections/collections.module';
import { SedesModule } from './sedes/sedes.module';
import { InventoryModule } from './inventory/inventory.module';
import { SellerModule } from './seller/seller.module';
import { HeroModule } from './hero/hero.module';
import { HomeSectionsModule } from './home-sections/home-sections.module';
import { AddiModule } from './addi/addi.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule } from './tracking/tracking.module';
import { AbandonedCartsModule } from './abandoned-carts/abandoned-carts.module';
import { OrderEditRequestsModule } from './order-edit-requests/order-edit-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PaymentsModule,
    AddiModule,
    AbandonedCartsModule,
    OrdersModule,
    OrderEditRequestsModule,
    ProductsModule,
    CollectionsModule,
    SedesModule,
    InventoryModule,
    SellerModule,
    HeroModule,
    HomeSectionsModule,
    AnalyticsModule,
    TrackingModule,
  ],
})
export class AppModule {}
