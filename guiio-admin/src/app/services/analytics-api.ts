import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface DailySale { date: string; total: number; count: number; }
export interface TopProduct { name: string; revenue: number; quantity: number; }
export interface TopCarted { name: string; count: number; }
export interface HourlySession { hour: number; count: number; }

export interface OverviewData {
  ordersToday: number;
  salesMonth: number;
  totalCustomers: number;
  pendingOrders: number;
  avgOrderValue: number;
  totalRevenue: number;
  adVisitsToday: number;
  addToCartToday: number;
  checkoutToday: number;
  dailySales: DailySale[];
  hourlySessions: HourlySession[];
  topProducts: TopProduct[];
  topCarted: TopCarted[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);

  getOverview(from?: string, to?: string) {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to)   params['to']   = to;
    return this.http.get<OverviewData>(`${API_URL}/analytics/overview`, { params });
  }
}
