import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_URL = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface DailySale {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  quantity: number;
}

export interface TopCarted {
  name: string;
  count: number;
}

export interface HourlySession {
  hour: number;
  count: number;
}

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
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  getOverview() {
    return this.http.get<OverviewData>(`${API_URL}/analytics/overview`, { headers: this.headers });
  }
}
