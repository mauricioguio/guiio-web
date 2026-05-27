import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const parseCsv = (env: string | undefined, fallback: string) =>
        (env ?? fallback).split(',').map(s => s.trim()).filter(Boolean);

      const allowed = [
        ...parseCsv(process.env.FRONTEND_URL, 'http://localhost:4200'),
        ...parseCsv(process.env.ADMIN_URL,    'http://localhost:4201'),
        ...parseCsv(process.env.SELLER_URL,   'http://localhost:4202'),
      ];

      if (!origin || allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix('api');

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/ping', (_req: any, res: any) => res.send('ok'));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Backend corriendo en http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
