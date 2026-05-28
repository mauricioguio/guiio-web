import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HeroService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.heroSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        badge: 'Uniformes médicos premium',
        title: 'Así como tú cuidas de ellos, nosotros cuidamos de ti',
        subtitle: 'Más de 18 años confeccionando uniformes de alta calidad para profesionales de la salud.',
        buttons: [
          { label: 'Colección Mujer', link: '/coleccion/mujer', variant: 'primary' },
          { label: 'Colección Hombre', link: '/coleccion/hombre', variant: 'outline' },
        ],
      },
      update: {},
    });
  }

  update(data: {
    backgroundImage?: string | null;
    backgroundImageMobile?: string | null;
    imagePosition?: string | null;
    badge?: string | null;
    title?: string | null;
    subtitle?: string | null;
    buttons?: Array<{ label: string; link: string; variant: string }>;
  }) {
    return this.prisma.heroSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
  }
}
