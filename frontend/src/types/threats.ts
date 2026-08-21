export type ThreatCategory = 
  | 'ALL'
  | 'SPACE_WEATHER'
  | 'ASTEROID'
  | 'EARTHQUAKE'
  | 'TERRESTRIAL_WEATHER'
  | 'STOCK_MARKET';

export interface CocktailMetadata {
  drink_name?: string;
  glass?: string;
  instructions?: string;
  thumb_url?: string;
  ingredients?: string[];
  fallback?: boolean;
  recipe?: string;
}

export interface ThreatRecord {
  id?: number;
  threatType: string;
  title: string;
  severityScore: number;
  description: string;
  recommendedDrink: string;
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

export interface PrescribedDrink {
  name: string;
  instructions: string;
  glass: string;
  thumbUrl?: string;
  ingredients: string[];
  metadataJson?: string;
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
  recommendedDrink: string;
  situationSummary: string;
  cocktail?: Record<string, unknown>;
}

