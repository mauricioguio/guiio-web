import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as geoip from 'geoip-lite';
import { PrismaService } from '../prisma/prisma.service';

const COUNTRY_NAMES: Record<string, string> = {
  CO: 'Colombia', US: 'Estados Unidos', MX: 'México', ES: 'España',
  AR: 'Argentina', CL: 'Chile', PE: 'Perú', EC: 'Ecuador',
  VE: 'Venezuela', PA: 'Panamá', CR: 'Costa Rica', GT: 'Guatemala',
  HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', DO: 'Rep. Dominicana',
  CU: 'Cuba', PR: 'Puerto Rico', BO: 'Bolivia', PY: 'Paraguay',
  UY: 'Uruguay', BR: 'Brasil', CA: 'Canadá', GB: 'Reino Unido',
  FR: 'Francia', DE: 'Alemania', IT: 'Italia', PT: 'Portugal',
};

function resolveGeo(req: Request): { country: string | null; city: string | null } {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ?? req.socket?.remoteAddress;

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: null, city: null };
  }

  const geo = geoip.lookup(ip);
  if (!geo) return { country: null, city: null };

  return {
    country: COUNTRY_NAMES[geo.country] ?? geo.country ?? null,
    city: geo.city || null,
  };
}

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  track(path: string, source?: string, req?: Request) {
    const { country, city } = req ? resolveGeo(req) : { country: null, city: null };
    return this.prisma.pageView.create({ data: { path, source: source ?? null, country, city } });
  }

  trackCart(data: {
    event: string;
    productId?: string;
    productName?: string;
    price?: number;
    quantity?: number;
  }) {
    return this.prisma.funnelEvent.create({ data });
  }
}
