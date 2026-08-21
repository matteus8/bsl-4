export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Simple US Zip code prefix approximation table
const ZIP_REGIONS: Record<string, { name: string; lat: number; lon: number }> = {
  '0': { name: 'Northeast Region (MA/RI/NH/ME/VT/NJ)', lat: 42.3601, lon: -71.0589 },
  '1': { name: 'New York Region (NY/PA)', lat: 40.7128, lon: -74.0060 },
  '2': { name: 'Mid-Atlantic Region (MD/VA/NC/SC/DC)', lat: 38.9072, lon: -77.0369 },
  '3': { name: 'Southeast Region (FL/GA/AL/TN/MS)', lat: 28.5383, lon: -81.3792 },
  '4': { name: 'Great Lakes Region (OH/IN/MI/KY)', lat: 41.4993, lon: -81.6944 },
  '5': { name: 'North Central Region (IA/WI/MN/SD/ND/MT)', lat: 44.9778, lon: -93.2650 },
  '6': { name: 'Central Region (IL/MO/KS/NE)', lat: 41.8781, lon: -87.6298 },
  '7': { name: 'South Central Region (TX/LA/AR/OK)', lat: 31.9686, lon: -99.9018 },
  '8': { name: 'Mountain West Region (CO/WY/ID/UT/AZ/NM/NV)', lat: 39.7392, lon: -104.9903 },
  '9': { name: 'Pacific West Region (CA/WA/OR/HI/AK)', lat: 34.0522, lon: -118.2437 },
};

export function lookupZipCode(zip: string): { name: string; lat: number; lon: number } {
  const cleanZip = zip.trim().replace(/[^0-9]/g, '');
  if (!cleanZip) {
    return { name: 'United States', lat: 37.0902, lon: -95.7129 };
  }
  const prefix = cleanZip.charAt(0);
  const region = ZIP_REGIONS[prefix];
  if (region) {
    return {
      name: `Zip ${cleanZip} (${region.name.split(' (')[0]})`,
      lat: region.lat,
      lon: region.lon,
    };
  }
  return { name: `Zip ${cleanZip}`, lat: 37.0902, lon: -95.7129 };
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(distanceKm: number): string {
  return `${distanceKm.toLocaleString()} km away`;
}
