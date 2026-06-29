// services/api.ts
// Centralised Axios instance and typed API service functions.
// All components import from here — never construct URLs manually elsewhere.

import axios from 'axios';
import type {
  ApiResponse,
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  Device,
  AddDevicePayload,
  TelemetryRecord,
  AddTelemetryPayload,
  TelemetryInterval,
  CategoryBreakdown,
  Prediction,
  PredictionType,
  Alert,
  ExportFormat,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach JWT token to every request if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('volta_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expired or invalid — clear auth and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('volta_token');
      localStorage.removeItem('volta_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ─────────────────────────────────────────────────────────────
// Auth Services
// ─────────────────────────────────────────────────────────────

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  register: async (credentials: RegisterCredentials): Promise<ApiResponse<{ id: string; username: string; email: string }>> => {
    const { data } = await api.post('/auth/register', credentials);
    return data;
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const { data } = await api.get<ApiResponse<User>>('/auth/profile');
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// Device Services
// ─────────────────────────────────────────────────────────────

export const deviceService = {
  getDevices: async (): Promise<ApiResponse<Device[]>> => {
    const { data } = await api.get<ApiResponse<Device[]>>('/devices');
    return data;
  },

  addDevice: async (payload: AddDevicePayload): Promise<ApiResponse<Device>> => {
    const { data } = await api.post<ApiResponse<Device>>('/devices', payload);
    return data;
  },

  deleteDevice: async (id: string): Promise<ApiResponse<null>> => {
    const { data } = await api.delete<ApiResponse<null>>(`/devices/${id}`);
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// Telemetry Services
// ─────────────────────────────────────────────────────────────

export const telemetryService = {
  getTelemetry: async (interval?: TelemetryInterval): Promise<ApiResponse<TelemetryRecord[]>> => {
    const params = interval ? { interval } : {};
    const { data } = await api.get<ApiResponse<TelemetryRecord[]>>('/telemetry', { params });
    return data;
  },

  addTelemetry: async (payload: AddTelemetryPayload): Promise<ApiResponse<TelemetryRecord>> => {
    const { data } = await api.post<ApiResponse<TelemetryRecord>>('/telemetry', payload);
    return data;
  },

  getCategoryBreakdown: async (interval?: TelemetryInterval): Promise<ApiResponse<CategoryBreakdown[]>> => {
    const params = interval ? { interval } : {};
    const { data } = await api.get<ApiResponse<CategoryBreakdown[]>>('/telemetry/breakdown', { params });
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// Prediction Services
// ─────────────────────────────────────────────────────────────

export const predictionService = {
  getPredictions: async (type?: PredictionType): Promise<ApiResponse<Prediction[]>> => {
    const params = type ? { type } : {};
    const { data } = await api.get<ApiResponse<Prediction[]>>('/predictions', { params });
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// Alert Services
// ─────────────────────────────────────────────────────────────

export const alertService = {
  getAlerts: async (): Promise<ApiResponse<Alert[]>> => {
    const { data } = await api.get<ApiResponse<Alert[]>>('/alerts');
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// Export Services
// ─────────────────────────────────────────────────────────────

export const exportService = {
  exportTelemetry: async (
    format: ExportFormat,
    params?: { interval?: TelemetryInterval; from?: string; to?: string }
  ): Promise<void> => {
    const response = await api.get('/export/telemetry', {
      params: { format, ...params },
      responseType: format === 'json' ? 'json' : 'blob',
    });

    if (format === 'json') {
      // Trigger JSON download
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      triggerDownload(blob, `volta_telemetry_${today()}.json`);
    } else {
      triggerDownload(
        response.data as Blob,
        `volta_telemetry_${today()}.${format}`
      );
    }
  },

  exportPredictions: async (
    format: ExportFormat,
    params?: { type?: PredictionType; from?: string; to?: string }
  ): Promise<void> => {
    const response = await api.get('/export/predictions', {
      params: { format, ...params },
      responseType: format === 'json' ? 'json' : 'blob',
    });

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      triggerDownload(blob, `volta_predictions_${today()}.json`);
    } else {
      triggerDownload(
        response.data as Blob,
        `volta_predictions_${today()}.${format}`
      );
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}