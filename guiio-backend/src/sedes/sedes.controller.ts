import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, UseGuards, Request,
} from '@nestjs/common';
import { SedesService } from './sedes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: any) {
    return this.sedesService.findAll(req.user?.empresa ?? 'GUIIO');
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { name: string }, @Request() req: any) {
    return this.sedesService.create(body, req.user?.empresa ?? 'GUIIO');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: { name?: string; active?: boolean; pin?: string | null }) {
    return this.sedesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.sedesService.remove(id);
  }
}
