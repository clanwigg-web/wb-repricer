import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(email: string, password: string) {
    const { data } = await this.client.post('/auth/register', { email, password });
    return data;
  }

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async me() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // SKUs
  async getSKUs(params?: { active?: boolean; page?: number; limit?: number }) {
    const { data } = await this.client.get('/skus', { params });
    return data;
  }

  async getSKU(id: string) {
    const { data } = await this.client.get(`/skus/${id}`);
    return data;
  }

  async createSKU(sku: any) {
    const { data } = await this.client.post('/skus', sku);
    return data;
  }

  async updateSKU(id: string, updates: any) {
    const { data } = await this.client.patch(`/skus/${id}`, updates);
    return data;
  }

  async deleteSKU(id: string) {
    const { data } = await this.client.delete(`/skus/${id}`);
    return data;
  }

  async triggerReprice(id: string) {
    const { data } = await this.client.post(`/skus/${id}/reprice`);
    return data;
  }

  // Strategies
  async getStrategies() {
    const { data } = await this.client.get('/strategies');
    return data;
  }

  async getStrategy(id: string) {
    const { data } = await this.client.get(`/strategies/${id}`);
    return data;
  }

  async getStrategyTemplates() {
    const { data } = await this.client.get('/strategies/templates');
    return data;
  }

  async createStrategy(strategy: any) {
    const { data } = await this.client.post('/strategies', strategy);
    return data;
  }

  async updateStrategy(id: string, updates: any) {
    const { data } = await this.client.patch(`/strategies/${id}`, updates);
    return data;
  }

  async deleteStrategy(id: string) {
    const { data } = await this.client.delete(`/strategies/${id}`);
    return data;
  }

  async attachStrategy(strategyId: string, skuId: string) {
    const { data } = await this.client.post(`/strategies/${strategyId}/attach`, { skuId });
    return data;
  }

  async activateStrategy(strategyId: string, skuId: string) {
    const { data } = await this.client.post(`/strategies/${strategyId}/activate`, { skuId });
    return data;
  }

  // Analytics
  async getOverview() {
    const { data } = await this.client.get('/analytics/overview');
    return data;
  }

  async getPriceAutopsy(skuId: string) {
    const { data } = await this.client.get(`/analytics/autopsy/${skuId}`);
    return data;
  }

  async getStrategyHealth(strategyId: string) {
    const { data } = await this.client.get(`/analytics/strategy-health/${strategyId}`);
    return data;
  }
}

export const api = new ApiClient();
