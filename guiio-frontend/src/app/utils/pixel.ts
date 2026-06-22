const PIXEL_ID = '702278049401194';

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fbqSetUser(email: string, phone: string, name: string) {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const fn = parts[0] ?? '';
  const ln = parts.slice(1).join(' ') || fn;

  const [em, ph, fnH, lnH] = await Promise.all([
    sha256(email.toLowerCase().trim()),
    sha256('57' + phone.replace(/\D/g, '')),
    sha256(fn),
    sha256(ln),
  ]);

  (window as any).fbq?.('init', PIXEL_ID, { em, ph, fn: fnH, ln: lnH });
}
