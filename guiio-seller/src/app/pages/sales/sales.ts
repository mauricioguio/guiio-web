import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellerApiService, Sale } from '../../services/seller-api';
import { AuthService } from '../../services/auth';
import { Navbar } from '../../components/navbar/navbar';
import html2canvas from 'html2canvas';

const PRESETS = [
  { key: 'all',        label: 'Todo' },
  { key: 'today',      label: 'Hoy' },
  { key: 'week',       label: 'Esta semana' },
  { key: 'month',      label: 'Este mes' },
  { key: 'last_month', label: 'Mes pasado' },
  { key: '3months',    label: 'Últimos 3 meses' },
  { key: '6months',    label: 'Últimos 6 meses' },
  { key: 'year',       label: 'Este año' },
];

@Component({
  selector: 'app-sales',
  imports: [RouterLink, Navbar],
  templateUrl: './sales.html',
})
export class Sales implements OnInit {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('saleReceiptEl') saleReceiptEl!: ElementRef<HTMLDivElement>;

  protected sales = signal<Sale[]>([]);
  protected loading = signal(true);
  protected selectedSale = signal<Sale | null>(null);

  protected filterType = signal<'all' | 'STOCK' | 'FABRICAR'>('all');
  protected filterPreset = signal('all');
  protected filterFrom = signal<Date | null>(null);
  protected filterTo = signal<Date | null>(null);
  protected showCustomRange = signal(false);
  protected customFrom = signal('');
  protected customTo = signal('');

  // Receipt
  protected receiptSale       = signal<Sale | null>(null);
  protected receiptImageUrl   = signal<string | null>(null);
  protected receiptWaUrl      = signal('');
  protected generatingReceipt = signal(false);
  private receiptBlob: Blob | null = null;

  readonly presets = PRESETS;

  protected filteredSales = computed(() => {
    let list = this.sales();
    const t = this.filterType();
    const from = this.filterFrom();
    const to = this.filterTo();
    if (t !== 'all') list = list.filter(s => s.type === t);
    if (from) list = list.filter(s => new Date(s.createdAt) >= from);
    if (to) list = list.filter(s => new Date(s.createdAt) <= to);
    return list;
  });

  protected stats = computed(() => {
    const s = this.filteredSales();
    const total = s.reduce((sum, x) => sum + x.total, 0);
    const count = s.length;
    const units = s.flatMap(x => x.items).reduce((sum, i) => sum + i.quantity, 0);
    const stockSales = s.filter(x => x.type === 'STOCK');
    const fabricarSales = s.filter(x => x.type === 'FABRICAR');
    const stockTotal = stockSales.reduce((sum, x) => sum + x.total, 0);
    const fabricarTotal = fabricarSales.reduce((sum, x) => sum + x.total, 0);
    return {
      total, count, units,
      avg: count ? Math.round(total / count) : 0,
      stockCount: stockSales.length, stockTotal,
      fabricarCount: fabricarSales.length, fabricarTotal,
      stockPct: total ? Math.round((stockTotal / total) * 100) : 0,
    };
  });

  protected monthlySummary = computed(() => {
    const typeFilter = this.filterType();
    const src = typeFilter === 'all' ? this.sales() : this.sales().filter(s => s.type === typeFilter);
    const byMonth = new Map<string, { stock: number; fabricar: number; count: number }>();
    for (const sale of src) {
      const key = sale.createdAt.slice(0, 7);
      const m = byMonth.get(key) ?? { stock: 0, fabricar: 0, count: 0 };
      if (sale.type === 'STOCK') m.stock += sale.total; else m.fabricar += sale.total;
      m.count++;
      byMonth.set(key, m);
    }
    const arr = Array.from(byMonth.entries())
      .map(([month, d]) => ({ month, total: d.stock + d.fabricar, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    const maxTotal = Math.max(...arr.map(m => m.total), 1);
    return arr.map(m => ({ ...m, pct: Math.round((m.total / maxTotal) * 100) }));
  });

  protected topProducts = computed(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of this.filteredSales()) {
      for (const item of sale.items) {
        const p = map.get(item.productName) ?? { name: item.productName, qty: 0, revenue: 0 };
        p.qty += item.quantity; p.revenue += item.price * item.quantity;
        map.set(item.productName, p);
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const maxRev = Math.max(...arr.map(p => p.revenue), 1);
    return arr.map(p => ({ ...p, pct: Math.round((p.revenue / maxRev) * 100) }));
  });

  ngOnInit() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.api.getSales().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setPreset(key: string) {
    this.filterPreset.set(key);
    this.showCustomRange.set(false);
    const now = new Date();
    const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (key) {
      case 'today':
        this.filterFrom.set(sod(now)); this.filterTo.set(null); break;
      case 'week': {
        const f = sod(now); f.setDate(f.getDate() - 6);
        this.filterFrom.set(f); this.filterTo.set(null); break;
      }
      case 'month':
        this.filterFrom.set(new Date(now.getFullYear(), now.getMonth(), 1));
        this.filterTo.set(null); break;
      case 'last_month':
        this.filterFrom.set(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        this.filterTo.set(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)); break;
      case '3months': {
        const f = new Date(now); f.setMonth(f.getMonth() - 3);
        this.filterFrom.set(f); this.filterTo.set(null); break;
      }
      case '6months': {
        const f = new Date(now); f.setMonth(f.getMonth() - 6);
        this.filterFrom.set(f); this.filterTo.set(null); break;
      }
      case 'year':
        this.filterFrom.set(new Date(now.getFullYear(), 0, 1));
        this.filterTo.set(null); break;
      default:
        this.filterFrom.set(null); this.filterTo.set(null);
    }
  }

  applyCustomRange() {
    const from = this.customFrom();
    const to = this.customTo();
    if (!from && !to) return;
    this.filterPreset.set('custom');
    this.filterFrom.set(from ? new Date(from + 'T00:00:00') : null);
    this.filterTo.set(to ? new Date(to + 'T23:59:59') : null);
  }

  toggleChartMonth(month: string) {
    if (this.filterPreset() === month) {
      this.setPreset('all');
    } else {
      const [y, mo] = month.split('-').map(Number);
      this.filterPreset.set(month);
      this.filterFrom.set(new Date(y, mo - 1, 1));
      this.filterTo.set(new Date(y, mo, 0, 23, 59, 59));
    }
  }

  isChartBarActive(month: string) {
    return this.filterPreset() === month;
  }

  pct(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  formatMonth(m: string): string {
    const [y, mo] = m.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${names[parseInt(mo) - 1]} ${y.slice(2)}`;
  }

  formatMonthLong(m: string): string {
    const [y, mo] = m.split('-');
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${names[parseInt(mo) - 1]} ${y}`;
  }

  activePresetLabel(): string {
    const p = this.filterPreset();
    if (p === 'custom') {
      const from = this.customFrom();
      const to = this.customTo();
      if (from && to) return `${from} → ${to}`;
      if (from) return `Desde ${from}`;
      if (to) return `Hasta ${to}`;
    }
    if (p.match(/^\d{4}-\d{2}$/)) return this.formatMonthLong(p);
    return '';
  }

  statusLabel(s: string) {
    const map: Record<string, string> = {
      COMPLETED: 'Completada', PENDING: 'Pendiente', PRODUCING: 'En producción',
      READY: 'Lista', DELIVERED: 'Entregada', CANCELLED: 'Cancelada',
    };
    return map[s] ?? s;
  }

  statusClass(s: string) {
    if (s === 'COMPLETED' || s === 'DELIVERED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }

  // ── Comprobante ─────────────────────────────────────────────────────────────

  async generateReceiptForSale(sale: Sale, event: Event) {
    event.stopPropagation();
    this.receiptSale.set(sale);
    this.generatingReceipt.set(true);

    await new Promise<void>(r => requestAnimationFrame(() => r()));
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    const el = this.saleReceiptEl?.nativeElement;
    if (!el) { this.generatingReceipt.set(false); return; }

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'position:absolute;left:0;top:0;width:360px;font-family:sans-serif;z-index:-1;';
    document.body.appendChild(clone);
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    try {
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        this.receiptBlob = blob;
        const phone = sale.customerPhone?.replace(/\D/g, '') ?? '';
        if (phone.length >= 10) {
          const wa = `57${phone}`;
          const name = sale.customerName?.split(' ')[0] ?? '';
          const text = `Hola ${name}, aquí está tu comprobante de Guiio 🛍️`;
          this.receiptWaUrl.set(`https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(text)}`);
        }
        this.receiptImageUrl.set(URL.createObjectURL(blob));
      }
    } catch {
      // ignore
    } finally {
      document.body.removeChild(clone);
      this.generatingReceipt.set(false);
    }
  }

  async copyAndOpenWhatsApp() {
    const blob = this.receiptBlob;
    const waUrl = this.receiptWaUrl();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'comprobante-guiio.png'; a.click();
      URL.revokeObjectURL(url);
    }
    if (waUrl) window.open(waUrl, '_blank');
    this.closeReceiptOverlay();
  }

  downloadReceipt() {
    const blob = this.receiptBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `comprobante-factura-${String(this.receiptSale()?.orderNumber ?? '').padStart(4,'0')}.png`;
    a.click();
    URL.revokeObjectURL(url);
    this.closeReceiptOverlay();
  }

  closeReceiptOverlay() {
    if (this.receiptImageUrl()) URL.revokeObjectURL(this.receiptImageUrl()!);
    this.receiptImageUrl.set(null);
    this.receiptWaUrl.set('');
    this.receiptBlob = null;
    this.receiptSale.set(null);
  }
}
