export type ThreatCategory = 
  | 'ALL'
  | 'SPACE_WEATHER'
  | 'ASTEROID'
  | 'EARTHQUAKE'
  | 'TERRESTRIAL_WEATHER'
  | 'STOCK_MARKET';

export type DateRangePreset = '24H' | '7D' | '30D' | 'ALL' | 'CUSTOM';

export interface ThreatRecord {
  id?: number;
  threatType: string;
  title: string;
  severityScore: number;
  description: string;
  metadata?: string;
  recordedAt: string;
  // Computed client-side fields
  parsedMetadata?: Record<string, unknown>;
  distanceKm?: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  cityName?: string;
  isAutoDetected: boolean;
}

export interface GeocodedLocation {
  displayName: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface RegionalWeather {
  temperatureF: number;
  apparentTemperatureF: number;
  windSpeedMph: number;
  humidityPercent: number;
  precipitationInches: number;
  conditionText: string;
}

export interface NearbySeismic {
  nearestDistanceKm: number;
  magnitude: number;
  place: string;
  title: string;
}

export interface RegionalAssessment {
  query?: string;
  locationName: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  weather?: RegionalWeather;
  nearbySeismic?: NearbySeismic;
  localSeverityScore: number;
  situationSummary: string;
}

export interface SocialHysteriaItem {
  id: string;
  platform: 'TikTok' | 'Twitter/X' | 'YouTube' | 'Reddit' | 'Instagram';
  author: string;
  handle: string;
  claim: string;
  realityCheck: string;
  hysteriaLevel: number; // 1-10
  reach: string;
  timeAgo: string;
  verifiedDebunk: boolean;
  categoryTag: 'VOLCANO' | 'COSMIC' | 'ECONOMIC' | 'WEATHER' | 'CONSPIRACY';
}

