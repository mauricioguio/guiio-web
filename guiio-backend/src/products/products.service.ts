import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}


  async findAll(onlyActive = true) {
    const list = await this.prisma.product.findMany({
      where: onlyActive ? ({ active: true } as any) : undefined,
      orderBy: { name: 'asc' },
    });
    return list.map(p => ({ ...p, type: p.type.toLowerCase() }));
  }

  async patchActive(id: string, active: boolean) {
    const p = await this.prisma.product.update({ where: { id }, data: { active } });
    return { ...p, type: p.type.toLowerCase() };
  }

  async patchCollection(id: string, collection: string) {
    const p = await this.prisma.product.update({ where: { id }, data: { collection } });
    return { ...p, type: p.type.toLowerCase() };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, ...({ active: true } as any) },
    });
    return p ? { ...p, type: p.type.toLowerCase() } : null;
  }

  async create(data: any) {
    const p = await this.prisma.product.create({
      data: { ...data, type: (data.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    const p = await this.prisma.product.update({
      where: { id },
      data: { ...rest, type: (rest.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  async getSizeAdvice(dto: {
    bust?: number; waist?: number; hip?: number;
    gender: string; type: string; productName: string;
    topSizes: string[]; bottomSizes: string[];
  }): Promise<{ advice: string }> {
    const measurements: string[] = [];
    if (dto.bust)  measurements.push(`Busto: ${dto.bust} cm`);
    if (dto.waist) measurements.push(`Cintura: ${dto.waist} cm`);
    if (dto.hip)   measurements.push(`Cadera: ${dto.hip} cm`);

    const womenChart = `XS: Busto 80-85 | Cintura 68-72 | Cadera 88-92
S:  Busto 86-90 | Cintura 73-78 | Cadera 93-97
M:  Busto 91-95 | Cintura 79-84 | Cadera 98-102
L:  Busto 96-100 | Cintura 85-91 | Cadera 103-108
XL: Busto 101-105 | Cintura 92-100 | Cadera 109-114
XXL: Busto 106-112 | Cintura 101-108 | Cadera 115+`;

    const menChart = `XS: Pecho ≤88 | Cadera ≤88
S:  Pecho 89-94 | Cadera 89-94
M:  Pecho 95-100 | Cadera 95-100
L:  Pecho 101-106 | Cadera 101-106
XL: Pecho 107-112 | Cadera 107-112
XXL: Pecho 113+ | Cadera 113+`;

    const chart = dto.gender === 'hombre' ? menChart : womenChart;
    const available: string[] = [];
    if (dto.topSizes.length)    available.push(`Blusa: ${dto.topSizes.join(', ')}`);
    if (dto.bottomSizes.length) available.push(`Pantalón: ${dto.bottomSizes.join(', ')}`);

    const prompt = `Eres una asistente de tallas para Guiio Uniformes, fabricantes de uniformes médicos en Colombia. Los uniformes son de material antifluido licrado que cede un poco con el uso.

Producto: ${dto.productName} (${dto.gender})
Tallas disponibles — ${available.join(' | ')}

Medidas del cliente:
${measurements.join('\n')}

Tabla de tallas (medidas reales del cuerpo en cm):
${chart}

Escribe una recomendación personalizada en español, máximo 3 oraciones cortas. Menciona qué talla corresponde a cada medida ingresada. Si las medidas caen en tallas distintas, explica cuál elegir según preferencia de ajuste y menciona que el material cede un poco. Tono amigable. Sin asteriscos ni markdown.`;

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 220 },
      }),
    });

    const json = await res.json() as any;
    const advice: string = json?.candidates?.[0]?.content?.parts?.[0]?.text
      ?? json?.error?.message
      ?? JSON.stringify(json).slice(0, 200);
    return { advice };
  }
}
