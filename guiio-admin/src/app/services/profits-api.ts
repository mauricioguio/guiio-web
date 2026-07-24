import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface DailyPoint  { date: string; revenue: number; cost: number; profit: number; }
export interface ChannelStat { channel: string; revenue: number; cost: number; profit: number; margin: number; count: number; }
export interface TopProduct  { name: string; revenue: number; cost: number; profit: number; margin: number; units: number; }
export interface FixedExpense { id: string; name: string; amount: number; month: string; }

export interface ProfitsData {
  totalRevenue: number; totalCost: number; grossProfit: number; grossMarginPct: number;
  fixedExpenses: FixedExpense[]; totalFixedExpenses: number; netProfit: number; netMarginPct: number;
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

  getFixedExpenses(month?: string) {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    return this.http.get<FixedExpense[]>(`${API_URL}/analytics/fixed-expenses`, { params });
  }

  createFixedExpense(name: string, amount: number, month: string) {
    return this.http.post<FixedExpense>(`${API_URL}/analytics/fixed-expenses`, { name, amount, month });
  }

  updateFixedExpense(id: string, data: { name?: string; amount?: number; month?: string }) {
    return this.http.patch<FixedExpense>(`${API_URL}/analytics/fixed-expenses/${id}`, data);
  }

  deleteFixedExpense(id: string) {
    return this.http.delete(`${API_URL}/analytics/fixed-expenses/${id}`);
  }
}
