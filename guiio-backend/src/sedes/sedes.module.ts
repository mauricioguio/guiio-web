import { Module } from '@nestjs/common';
import { SedesController } from './sedes.controller';
import { SedesService } from './sedes.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SedesController],
  providers: [SedesService, PrismaService],
})
export class SedesModule {}
