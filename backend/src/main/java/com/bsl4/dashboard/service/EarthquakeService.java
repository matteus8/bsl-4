package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class EarthquakeService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;
    private final CocktailService cocktailService;

    public EarthquakeService(ThreatRecordRepository threatRecordRepository, CocktailService cocktailService) {
        this.threatRecordRepository = threatRecordRepository;
        this.cocktailService = cocktailService;
        this.restClient = RestClient.create("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary");
    }

    public void fetchAndSaveEarthquakes() {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/4.5_month.geojson")
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("features")) {
                List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");

                for (Map<String, Object> feature : features) {
                    Map<String, Object> properties = (Map<String, Object>) feature.get("properties");
                    Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");

                    String title = (String) properties.get("title");
                    String place = (String) properties.get("place");
                    Number magNum = (Number) properties.get("mag");
                    double mag = magNum != null ? magNum.doubleValue() : 0.0;
                    Number tsunamiNum = (Number) properties.get("tsunami");
                    int tsunami = tsunamiNum != null ? tsunamiNum.intValue() : 0;
                    Long timeEpoch = (Long) properties.get("time");

                    List<Number> coordinates = geometry != null ? (List<Number>) geometry.get("coordinates") : List.of();
                    double longitude = coordinates.size() > 0 ? coordinates.get(0).doubleValue() : 0.0;
                    double latitude = coordinates.size() > 1 ? coordinates.get(1).doubleValue() : 0.0;
                    double depth = coordinates.size() > 2 ? coordinates.get(2).doubleValue() : 0.0;

                    double severity = calculateEarthquakeSeverity(mag, tsunami);
                    CocktailService.PrescribedDrink drink = cocktailService.prescribeDrink("EARTHQUAKE", severity);

                    String metadataJson = String.format(
                        "{\"magnitude\": %.2f, \"place\": \"%s\", \"longitude\": %.4f, \"latitude\": %.4f, \"depth_km\": %.2f, \"tsunami_alert\": %d, \"cocktail\": %s}",
                        mag, escapeJson(place), longitude, latitude, depth, tsunami, drink.metadataJson()
                    );

                    LocalDateTime recordedAt = timeEpoch != null 
                        ? LocalDateTime.ofInstant(Instant.ofEpochMilli(timeEpoch), ZoneId.systemDefault()) 
                        : LocalDateTime.now();

                    ThreatRecord record = new ThreatRecord(
                        "EARTHQUAKE",
                        title != null ? title : "M " + mag + " Earthquake",
                        severity,
                        String.format("Magnitude %.1f earthquake at %s (Depth: %.1f km, Tsunami: %d)", mag, place, depth, tsunami),
                        drink.name(),
                        metadataJson,
                        recordedAt
                    );

                    threatRecordRepository.save(record);
                }
                System.out.println(">>> Successfully fetched and saved USGS earthquake threats!");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch USGS earthquake data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private double calculateEarthquakeSeverity(double mag, int tsunami) {
        double score = 0.0;
        if (mag >= 8.0) score = 10.0;
        else if (mag >= 7.0) score = 9.0 + (mag - 7.0);
        else if (mag >= 6.0) score = 7.5 + ((mag - 6.0) * 1.4);
        else if (mag >= 5.0) score = 5.5 + ((mag - 5.0) * 1.9);
        else score = Math.max(1.0, mag);

        if (tsunami == 1) {
            score = Math.min(score + 1.5, 10.0);
        }

        return Math.min(score, 10.0);
    }

    private String escapeJson(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
