import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  login(username: string, password: string): { token: string; role: string; username: string; empresa: string } {
    // GUIIO admin
    const adminUser = this.config.get<string>('ADMIN_USERNAME') ?? 'admin';
    const adminPass = this.config.get<string>('ADMIN_PASSWORD');
    if (!adminPass) throw new UnauthorizedException('Server not configured');

    if (username === adminUser && password === adminPass) {
      const token = this.jwt.sign({ sub: username, role: 'admin', empresa: 'GUIIO' });
      return { token, role: 'admin', username, empresa: 'GUIIO' };
    }

    // DIMAG admin
    const dimagAdminUser = this.config.get<string>('DIMAG_ADMIN_USERNAME');
    const dimagAdminPass = this.config.get<string>('DIMAG_ADMIN_PASSWORD');
    if (dimagAdminUser && dimagAdminPass && username === dimagAdminUser && password === dimagAdminPass) {
      const token = this.jwt.sign({ sub: username, role: 'admin', empresa: 'DIMAG' });
      return { token, role: 'admin', username, empresa: 'DIMAG' };
    }

    // GUIIO vendor: VENDOR_<USERNAME>=<password>
    const vendorPass = this.config.get<string>(`VENDOR_${username.toUpperCase()}`);
    if (vendorPass && password === vendorPass) {
      const token = this.jwt.sign({ sub: username, role: 'vendedor', empresa: 'GUIIO' });
      return { token, role: 'vendedor', username, empresa: 'GUIIO' };
    }

    // DIMAG vendor: DIMAG_VENDOR_<USERNAME>=<password>
    const dimagVendorPass = this.config.get<string>(`DIMAG_VENDOR_${username.toUpperCase()}`);
    if (dimagVendorPass && password === dimagVendorPass) {
      const token = this.jwt.sign({ sub: username, role: 'vendedor', empresa: 'DIMAG' });
      return { token, role: 'vendedor', username, empresa: 'DIMAG' };
    }

    throw new UnauthorizedException('Credenciales incorrectas');
  }
}
