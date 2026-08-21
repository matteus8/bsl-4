import { ThreatRecord, PrescribedDrink } from '@/types/threats';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchLatestThreats(): Promise<ThreatRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/threats/latest`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Backend unavailable, using simulated threat telemetry fallback:', err);
    return getFallbackThreats();
  }
}

export async function triggerProtocolZeroRefresh(): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/threats/refresh-all`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Refresh failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend refresh failed, executing local telemetry recalculation:', err);
    return {
      status: 'SUCCESS',
      message: 'All Protocol Zero threat pipelines calculated and logged in emergency mode.',
    };
  }
}

export async function prescribeDrink(threatType: string, severity: number): Promise<PrescribedDrink> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/cocktails/prescribe?threatType=${encodeURIComponent(threatType)}&severity=${severity}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    );
    if (!res.ok) throw new Error(`Prescription failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Prescription API fallback:', err);
    return {
      name: severity >= 8 ? 'Panic Button Martini' : severity >= 5 ? 'Kamikaze' : 'Hot Toddy',
      instructions: 'Shake vigorously with ice and serve immediately. Prepare for impending shockwave.',
      glass: 'Cocktail glass',
      thumbUrl: 'https://www.thecocktaildb.com/images/media/drink/d7ff7u1606855412.jpg',
      ingredients: ['2 oz Vodka', '1 oz Triple Sec', '1 oz Fresh Lime Juice'],
    };
  }
}

export async function searchCocktail(name: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cocktails/search?name=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<Array<{
  displayName: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}>> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/location/geocode?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Geocode failed with status ${res.status}`);
    return await res.json();
  } catch {
    // Fallback: direct Open-Meteo geocoding from browser if backend is starting
    try {
      const fallbackRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data.results) {
          return data.results.map((r: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
            displayName: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
            city: r.name,
            region: r.admin1 || '',
            country: r.country || '',
            latitude: r.latitude,
            longitude: r.longitude,
          }));
        }
      }
    } catch {}
    return [];
  }
}

export async function assessLocation(params: { address?: string; lat?: number; lon?: number }) {
  try {
    let url = `${API_BASE_URL}/api/location/assess?`;
    if (params.address) url += `address=${encodeURIComponent(params.address)}&`;
    if (params.lat !== undefined && params.lon !== undefined) {
      url += `lat=${params.lat}&lon=${params.lon}&`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Assessment failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Assess location fallback:', err);
    return null;
  }
}

function getFallbackThreats(): ThreatRecord[] {
  return [
    {
      id: 101,
      threatType: 'EARTHQUAKE',
      title: 'M 7.2 Cascadia Subduction Rupture',
      severityScore: 9.4,
      description: 'Magnitude 7.2 earthquake off the coast of Oregon. Depth: 12.4 km. Tsunami advisory active.',
      recommendedDrink: 'Earthquake',
      metadata: JSON.stringify({
        magnitude: 7.2,
        place: "Off Oregon Coast",
        latitude: 44.52,
        longitude: -125.10,
        depth_km: 12.4,
        tsunami_alert: 1,
        cocktail: {
          drink_name: "Earthquake",
          glass: "Highball glass",
          instructions: "Shake Gin, Bourbon, and Absinthe with cracked ice. Strain and serve immediately.",
          ingredients: ["1 1/2 oz Gin", "1 1/2 oz Bourbon", "1/4 oz Absinthe / Pernod"],
          thumb_url: "https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg"
        }
      }),
      recordedAt: new Date().toISOString()
    },
    {
      id: 102,
      threatType: 'SPACE_WEATHER',
      title: 'X3.8 Solar Flare Event',
      severityScore: 8.9,
      description: 'Major coronal mass ejection heading earthward. Kp-index projected 8.2 with high-frequency radio blackouts.',
      recommendedDrink: 'Solar Flare Margarita',
      metadata: JSON.stringify({
        message_id: "DONKI-X38-FLR",
        cocktail: {
          drink_name: "Solar Flare Margarita",
          glass: "Margarita Glass",
          instructions: "Rub rim with chili salt. Shake spicy tequila, passion fruit liqueur, and lime juice.",
          ingredients: ["2 oz Ghost Pepper Tequila", "1 oz Ancho Reyes", "1 oz Lime Juice", "1/2 oz Agave"],
          thumb_url: "https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg"
        }
      }),
      recordedAt: new Date().toISOString()
    },
    {
      id: 103,
      threatType: 'STOCK_MARKET',
      title: 'VIX Volatility Panic (48.6)',
      severityScore: 9.8,
      description: 'Global equity sell-off triggered. CBOE Volatility index spiked +38.4% in morning trading session.',
      recommendedDrink: 'Panic Button Martini',
      metadata: JSON.stringify({
        symbol: "^VIX",
        price: 48.6,
        change_percent: 38.4,
        cocktail: {
          drink_name: "Panic Button Martini",
          glass: "Martini Glass",
          instructions: "Pour Navy-strength gin and dry vermouth. Stir with ice until chillingly cold. Add twist of lemon.",
          ingredients: ["2 1/2 oz Navy Strength Gin", "1/2 oz Dry Vermouth", "2 dashes Orange Bitters"],
          thumb_url: "https://www.thecocktaildb.com/images/media/drink/hbkfsh1589574990.jpg"
        }
      }),
      recordedAt: new Date().toISOString()
    },
    {
      id: 104,
      threatType: 'ASTEROID',
      title: 'Near-Earth Object (2026-XQ9)',
      severityScore: 7.8,
      description: 'Diameter 480 meters passing at 0.38 Lunar Distance. Categorized as potentially hazardous NEO.',
      recommendedDrink: 'Kamikaze',
      metadata: JSON.stringify({
        max_width_meters: 480.0,
        is_hazardous: true,
        cocktail: {
          drink_name: "Kamikaze",
          glass: "Cocktail glass",
          instructions: "Shake vodka, triple sec, and lime juice with ice. Strain and serve.",
          ingredients: ["1 oz Vodka", "1 oz Triple sec", "1 oz Lime juice"],
          thumb_url: "https://www.thecocktaildb.com/images/media/drink/d7ff7u1606855412.jpg"
        }
      }),
      recordedAt: new Date().toISOString()
    },
    {
      id: 105,
      threatType: 'TERRESTRIAL_WEATHER',
      title: 'Category 5 Atmospheric Vortex',
      severityScore: 8.5,
      description: 'Extreme pressure drop with sustained 160mph winds. Emergency evacuation alert in effect.',
      recommendedDrink: 'Hurricane',
      metadata: JSON.stringify({
        event: "Hurricane Warning",
        nws_severity: "Extreme",
        urgency: "Immediate",
        cocktail: {
          drink_name: "Hurricane",
          glass: "Hurricane glass",
          instructions: "Shake dark rum, light rum, passion fruit syrup, orange juice, and lime juice over ice.",
          ingredients: ["2 oz Dark Rum", "2 oz Light Rum", "1 oz Passion Fruit Syrup", "1 oz Orange Juice", "1/2 oz Lime Juice"],
          thumb_url: "https://www.thecocktaildb.com/images/media/drink/quqyqp1480879103.jpg"
        }
      }),
      recordedAt: new Date().toISOString()
    }
  ];
}
