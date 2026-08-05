import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface DailyPoint  { date: string; revenue: number; cost: number; profit: number; }
export interface ChannelStat { channel: string; revenue: number; cost: number; profit: number; margin: number; count: number; }
export interface TopProduct  { name: string; revenue: number; cost: number; profit: number; margin: number; units: number; }
export interface ExpenseTemplate { id: string; name: string; amount: number; active: boolean; order: number; }
export interface FixedExpense    { id: string; name: string; amount: number; month: string; }

export interface ProfitsData {
  totalRevenue: number; totalCost: number; grossProfit: number; grossMarginPct: number;
  totalUnits: number;
  templates: ExpenseTemplate[]; recurringPerMonth: number; totalRecurring: number;
  extras: FixedExpense[]; totalExtras: number;
  totalFixedExpenses: number; netProfit: number; netMarginPct: number;
  monthsInRange: string[];
  daily: DailyPoint[]; channels: ChannelStat[]; topProducts: TopProduct[];
}

@Injectable({ providedIn: 'root' })
export class ProfitsApiService {
  private readonly http = inject(HttpClient);

  get(from?: string, to?: string) {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to)   params['to']   = to;
    return this.http.get<ProfitsData>(`${API_URL}/analytics/profits`, { params });
  }

  // ── Plantillas recurrentes ────────────────────────────────────────────────
  getTemplates() {
    return this.http.get<ExpenseTemplate[]>(`${API_URL}/analytics/expense-templates`);
  }
  createTemplate(name: string, amount: number) {
    return this.http.post<ExpenseTemplate>(`${API_URL}/analytics/expense-templates`, { name, amount });
  }
  updateTemplate(id: string, data: { name?: string; amount?: number; active?: boolean }) {
    return this.http.patch<ExpenseTemplate>(`${API_URL}/analytics/expense-templates/${id}`, data);
  }
  deleteTemplate(id: string) {
    return this.http.delete(`${API_URL}/analytics/expense-templates/${id}`);
  }

  // ── Gastos adicionales por mes ────────────────────────────────────────────
  getExtras(month: string) {
    return this.http.get<FixedExpense[]>(`${API_URL}/analytics/fixed-expenses`, { params: { month } });
  }
  createExtra(name: string, amount: number, month: string) {
    return this.http.post<FixedExpense>(`${API_URL}/analytics/fixed-expenses`, { name, amount, month });
  }
  updateExtra(id: string, data: { name?: string; amount?: number }) {
    return this.http.patch<FixedExpense>(`${API_URL}/analytics/fixed-expenses/${id}`, data);
  }
  deleteExtra(id: string) {
    return this.http.delete(`${API_URL}/analytics/fixed-expenses/${id}`);
  }
}
