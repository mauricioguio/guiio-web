import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const guiio   = /^https:\/\/([a-z0-9-]+\.)?guiiouniformes\.com$/.test(origin ?? '');
      const local   = !origin || /^http:\/\/localhost:\d+$/.test(origin);
      const parseCsv = (env: string | undefined) =>
        (env ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const extra   = [...parseCsv(process.env.ADMIN_URL), ...parseCsv(process.env.SELLER_URL)];

      if (guiio || local || extra.includes(origin!)) {
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
