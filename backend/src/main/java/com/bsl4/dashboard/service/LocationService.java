package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

@Service
public class LocationService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;
    private final CocktailService cocktailService;

    public LocationService(ThreatRecordRepository threatRecordRepository, CocktailService cocktailService) {
        this.threatRecordRepository = threatRecordRepository;
        this.cocktailService = cocktailService;
        this.restClient = RestClient.builder()
                .defaultHeader("User-Agent", "BSL4-Telemetry/1.0")
                .build();
    }

    public record GeocodedLocation(
            String displayName,
            String city,
            String region,
            String country,
            double latitude,
            double longitude
    ) {}

    public record RegionalWeather(
            double temperatureF,
            double apparentTemperatureF,
            double windSpeedMph,
            int humidityPercent,
            double precipitationInches,
            String conditionText
    ) {}

    public record NearbySeismic(
            double nearestDistanceKm,
            double magnitude,
            String place,
            String title
    ) {}

    public record RegionalAssessment(
            String query,
            String locationName,
            String city,
            String country,
            double latitude,
            double longitude,
            RegionalWeather weather,
            NearbySeismic nearbySeismic,
            double localSeverityScore,
            String recommendedDrink,
            String situationSummary,
            Map<String, Object> cocktail
    ) {}

    public List<GeocodedLocation> geocodeGlobalAddress(String query) {
        List<GeocodedLocation> results = new ArrayList<>();
        if (query == null || query.trim().isEmpty()) {
            return results;
        }

        try {
            // Open-Meteo geocoding for fast global lookup
            String url = "https://geocoding-api.open-meteo.com/v1/search?name=" 
                    + java.net.URLEncoder.encode(query.trim(), java.nio.charset.StandardCharsets.UTF_8)
                    + "&count=5&language=en&format=json";

            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("results")) {
                List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("results");
                for (Map<String, Object> item : items) {
                    String name = (String) item.get("name");
                    String country = (String) item.getOrDefault("country", "");
                    String admin1 = (String) item.getOrDefault("admin1", "");
                    double lat = ((Number) item.get("latitude")).doubleValue();
                    double lon = ((Number) item.get("longitude")).doubleValue();

                    String display = name;
                    if (!admin1.isEmpty()) display += ", " + admin1;
                    if (!country.isEmpty()) display += ", " + country;

                    results.add(new GeocodedLocation(display, name, admin1, country, lat, lon));
                }
            }
        } catch (Exception e) {
            // Ignored
        }

        // Fallback to Nominatim for ultra-granular street addresses
        if (results.isEmpty()) {
            try {
                String nominatimUrl = "https://nominatim.openstreetmap.org/search?q="
                        + java.net.URLEncoder.encode(query.trim(), java.nio.charset.StandardCharsets.UTF_8)
                        + "&format=json&addressdetails=1&limit=5";

                List<Map<String, Object>> nomResults = restClient.get()
                        .uri(nominatimUrl)
                        .retrieve()
                        .body(List.class);

                if (nomResults != null) {
                    for (Map<String, Object> item : nomResults) {
                        String displayName = (String) item.get("display_name");
                        double lat = Double.parseDouble((String) item.get("lat"));
                        double lon = Double.parseDouble((String) item.get("lon"));
                        Map<String, Object> address = (Map<String, Object>) item.get("address");

                        String city = address != null ? (String) address.getOrDefault("city", (String) address.getOrDefault("town", (String) address.getOrDefault("village", query))) : query;
                        String country = address != null ? (String) address.getOrDefault("country", "") : "";
                        String state = address != null ? (String) address.getOrDefault("state", "") : "";

                        results.add(new GeocodedLocation(displayName, city, state, country, lat, lon));
                    }
                }
            } catch (Exception e) {
                // Handled
            }
        }

        return results;
    }

    public RegionalAssessment assessRegion(String query, Double overrideLat, Double overrideLon) {
        String locationName = query != null ? query : "Selected Region";
        String city = "Local Area";
        String country = "Global";
        double lat = 34.0522;
        double lon = -118.2437;

        if (overrideLat != null && overrideLon != null) {
          lat = overrideLat;
          lon = overrideLon;
        } else if (query != null && !query.trim().isEmpty()) {
            List<GeocodedLocation> geocoded = geocodeGlobalAddress(query);
            if (!geocoded.isEmpty()) {
                GeocodedLocation top = geocoded.get(0);
                lat = top.latitude();
                lon = top.longitude();
                locationName = top.displayName();
                city = top.city();
                country = top.country();
            }
        }

        // Fetch localized weather from Open-Meteo
        RegionalWeather weather = fetchLocalWeather(lat, lon);

        // Calculate nearest seismic event from recent database records
        NearbySeismic seismic = findNearestSeismic(lat, lon);

        // Compute localized severity and cocktail recommendation
        double severity = 2.0;
        if (weather != null) {
            if (weather.temperatureF() > 95.0 || weather.temperatureF() < 20.0) severity += 2.5;
            if (weather.windSpeedMph() > 35.0) severity += 2.0;
            if (weather.precipitationInches() > 0.5) severity += 1.5;
        }
        if (seismic != null && seismic.nearestDistanceKm() < 200.0) {
            severity += Math.max(0.5, (seismic.magnitude() - 3.0) * 1.2);
        }
        severity = Math.min(10.0, Math.max(1.0, severity));

        // Tailored drink selection
        CocktailService.PrescribedDrink prescription = pickLocalDrink(weather, seismic, severity);
        Map<String, Object> cocktailDetails = cocktailService.fetchCocktailFromApi(prescription.name());

        String summary = generateSituationSummary(locationName, weather, seismic, prescription.name());

        return new RegionalAssessment(
                query,
                locationName,
                city,
                country,
                lat,
                lon,
                weather,
                seismic,
                severity,
                prescription.name(),
                summary,
                cocktailDetails
        );
    }

    private RegionalWeather fetchLocalWeather(double lat, double lon) {
        try {
            String url = String.format(Locale.US,
                    "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph",
                    lat, lon);

            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("current")) {
                Map<String, Object> current = (Map<String, Object>) response.get("current");
                double temp = ((Number) current.getOrDefault("temperature_2m", 70.0)).doubleValue();
                double apparent = ((Number) current.getOrDefault("apparent_temperature", temp)).doubleValue();
                double wind = ((Number) current.getOrDefault("wind_speed_10m", 5.0)).doubleValue();
                int humidity = ((Number) current.getOrDefault("relative_humidity_2m", 50)).intValue();
                double precip = ((Number) current.getOrDefault("precipitation", 0.0)).doubleValue();
                int code = ((Number) current.getOrDefault("weather_code", 0)).intValue();

                String condition = translateWeatherCode(code);
                return new RegionalWeather(temp, apparent, wind, humidity, precip, condition);
            }
        } catch (Exception e) {
            // Default
        }
        return new RegionalWeather(72.0, 72.0, 6.0, 45, 0.0, "Clear Sky");
    }

    private NearbySeismic findNearestSeismic(double lat, double lon) {
        List<ThreatRecord> quakes = threatRecordRepository.findByThreatTypeOrderByRecordedAtDesc("EARTHQUAKE");
        ThreatRecord nearest = null;
        double minDistance = Double.MAX_VALUE;

        for (ThreatRecord t : quakes) {
            if (t.getMetadata() != null) {
                try {
                    String meta = t.getMetadata();
                    int latIdx = meta.indexOf("\"latitude\":");
                    int lonIdx = meta.indexOf("\"longitude\":");
                    if (latIdx != -1 && lonIdx != -1) {
                        double qLat = Double.parseDouble(meta.substring(latIdx + 11, meta.indexOf(",", latIdx)));
                        double qLon = Double.parseDouble(meta.substring(lonIdx + 12, meta.indexOf("}", lonIdx)).replace(",", ""));
                        double dist = haversineKm(lat, lon, qLat, qLon);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearest = t;
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        if (nearest != null && minDistance < 5000.0) {
            double mag = nearest.getSeverityScore();
            return new NearbySeismic(minDistance, mag, nearest.getTitle(), nearest.getTitle());
        }
        return new NearbySeismic(999.0, 0.0, "No nearby active seismic zones", "None");
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private String translateWeatherCode(int code) {
        return switch (code) {
            case 0 -> "Clear Sky";
            case 1, 2, 3 -> "Partly Cloudy";
            case 45, 48 -> "Fog & Overcast";
            case 51, 53, 55 -> "Light Drizzle";
            case 61, 63, 65 -> "Rain Showers";
            case 71, 73, 75 -> "Snowfall";
            case 80, 81, 82 -> "Heavy Rain";
            case 95, 96, 99 -> "Thunderstorm";
            default -> "Fair Conditions";
        };
    }

    private CocktailService.PrescribedDrink pickLocalDrink(RegionalWeather weather, NearbySeismic seismic, double severity) {
        String drinkName = "Old Fashioned";
        if (seismic != null && seismic.nearestDistanceKm() < 150.0 && seismic.magnitude() >= 4.5) {
            drinkName = "Earthquake";
        } else if (weather != null) {
            if (weather.temperatureF() > 88.0) {
                drinkName = "Mojito";
            } else if (weather.temperatureF() < 35.0) {
                drinkName = "Hot Toddy";
            } else if (weather.conditionText().contains("Thunderstorm") || weather.conditionText().contains("Heavy Rain")) {
                drinkName = "Dark 'n' Stormy";
            }
        } else if (severity >= 6.0) {
            drinkName = "Manhattan";
        }

        Map<String, Object> recipe = cocktailService.fetchCocktailFromApi(drinkName);
        if (recipe != null) {
            String name = (String) recipe.get("strDrink");
            String instructions = (String) recipe.get("strInstructions");
            String glass = (String) recipe.get("strGlass");
            String thumb = (String) recipe.get("strDrinkThumb");
            List<String> ingredients = List.of("Spirit of choice", "Fresh Citrus / Sweetener", "Ice");
            return new CocktailService.PrescribedDrink(name, instructions, glass, thumb, ingredients, "{}");
        }

        return new CocktailService.PrescribedDrink(drinkName, "Pour over ice and serve immediately.", "Cocktail glass", null, List.of("Spirit", "Ice"), "{}");
    }

    private String generateSituationSummary(String location, RegionalWeather weather, NearbySeismic seismic, String drink) {
        StringBuilder sb = new StringBuilder();
        if (weather != null) {
            sb.append(String.format(Locale.US, "Currently %.0f°F with %s in %s. ", weather.temperatureF(), weather.conditionText().toLowerCase(), location));
        }
        if (seismic != null && seismic.nearestDistanceKm() < 500.0) {
            sb.append(String.format(Locale.US, "Nearest seismic tremor is %.0f km away (M%.1f). ", seismic.nearestDistanceKm(), seismic.magnitude()));
        } else {
            sb.append("Seismic activity is calm. ");
        }
        sb.append(String.format("Curated pairing: %s.", drink));
        return sb.toString();
    }
}
