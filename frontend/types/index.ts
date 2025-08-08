export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    plan: 'free' | 'pro' | 'premium';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: string;
  };
}

export interface CarAlert {
  id: string;
  name: string;
  isActive: boolean;
  filters: CarFilters;
  notifications: NotificationSettings;
  stats: AlertStats;
  createdAt: string;
  updatedAt: string;
}

export interface CarFilters {
  make?: string;
  model?: string;
  category?: VehicleCategory;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  powerMin?: number;
  fuel?: FuelType;
  transmission?: TransmissionType;
  features?: string[];
  location?: {
    zipcode: string;
    radius: number;
  };
  excludeDamage?: boolean;
  onlyWithImages?: boolean;
  excludeExport?: boolean;
  dealerOnly?: boolean;
}

export interface NotificationSettings {
  email: boolean;
  voice: boolean;
  phoneNumber?: string;
}

export interface AlertStats {
  totalMatches: number;
  newToday: number;
  lastMatch?: string;
}

export interface CarMatch {
  id: string;
  alertId: string;
  title: string;
  description: string;
  price: number;
  year: number;
  mileage: number;
  fuel: FuelType;
  transmission: TransmissionType;
  location: string;
  images: string[];
  dealer: boolean;
  mobileDeUrl: string;
  matchedAt: string;
  notificationSent: boolean;
}

export type VehicleCategory = 
  | 'Limousine'
  | 'Kleinwagen'
  | 'Kombi'
  | 'Cabrio'
  | 'Coupe'
  | 'SUV'
  | 'Sportwagen'
  | 'Van'
  | 'Pickup';

export type FuelType =
  | 'PETROL'
  | 'DIESEL'
  | 'ELECTRIC'
  | 'HYBRID'
  | 'HYBRID_DIESEL'
  | 'LPG'
  | 'CNG'
  | 'HYDROGEN';

export type TransmissionType =
  | 'MANUAL_GEAR'
  | 'AUTOMATIC_GEAR'
  | 'SEMIAUTOMATIC_GEAR';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VoiceCallLog {
  id: string;
  alertId: string;
  phoneNumber: string;
  duration: number;
  status: 'completed' | 'failed' | 'no-answer' | 'busy';
  transcript?: string;
  timestamp: string;
}