package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NasaService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;
    private final CocktailService cocktailService;

    @Value("${nasa.api.key:DEMO_KEY}")
    private String nasaApiKey;

    public NasaService(ThreatRecordRepository threatRecordRepository, CocktailService cocktailService) {
        this.threatRecordRepository = threatRecordRepository;
        this.cocktailService = cocktailService;
        this.restClient = RestClient.create("https://api.nasa.gov");
    }

    public void fetchAndSaveAsteroids() {
        String today = LocalDate.now().toString();
        
        try {
            Map<String, Object> response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/neo/rest/v1/feed")
                            .queryParam("start_date", today)
                            .queryParam("end_date", today)
                            .queryParam("api_key", nasaApiKey)
                            .build())
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("near_earth_objects")) {
                Map<String, Object> neoMap = (Map<String, Object>) response.get("near_earth_objects");
                
                if (neoMap.containsKey(today)) {
                    List<Map<String, Object>> asteroids = (List<Map<String, Object>>) neoMap.get(today);
                    
                    for (Map<String, Object> asteroid : asteroids) {
                        String name = (String) asteroid.get("name");
                        Boolean isHazardous = (Boolean) asteroid.get("is_potentially_hazardous_asteroid");
                        
                        Map<String, Object> diamMap = (Map<String, Object>) asteroid.get("estimated_diameter");
                        Map<String, Object> metersMap = (Map<String, Object>) diamMap.get("meters");
                        Double maxDiameter = (Double) metersMap.get("estimated_diameter_max");

                        double severity = isHazardous ? 9.5 : Math.min(maxDiameter / 10.0, 5.0);
                        
                        // Prescribe cocktail dynamically
                        CocktailService.PrescribedDrink drink = cocktailService.prescribeDrink("ASTEROID", severity);
                        
                        // Construct structured JSON metadata
                        String jsonMetadata = String.format(
                            "{\"max_width_meters\": %.2f, \"is_hazardous\": %b, \"cocktail\": %s}",
                            maxDiameter, isHazardous, drink.metadataJson()
                        );

                        ThreatRecord record = new ThreatRecord(
                            "ASTEROID",
                            name,
                            severity,
                            "Hazardous: " + isHazardous + " | Max Width: " + maxDiameter + " meters",
                            drink.name(),
                            jsonMetadata,
                            LocalDateTime.now()
                        );
                        
                        threatRecordRepository.save(record);
                    }
                    System.out.println(">>> Successfully parsed and saved real asteroids for " + today);
                }
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch/parse NASA asteroid data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void fetchAndSaveSpaceWeather() {
        try {
            Map[] response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/DONKI/notifications")
                            .queryParam("startDate", LocalDate.now().minusDays(5).toString())
                            .queryParam("endDate", LocalDate.now().toString())
                            .queryParam("api_key", nasaApiKey)
                            .build())
                    .retrieve()
                    .body(Map[].class);

            if (response != null && response.length > 0) {
                for (Map<String, Object> event : response) {
                    String messageType = (String) event.get("messageType");
                    String messageBody = (String) event.get("messageBody");
                    String messageID = (String) event.get("messageID");

                    double severity = calculateSpaceWeatherSeverity(messageType, messageBody);
                    CocktailService.PrescribedDrink drink = cocktailService.prescribeDrink("SPACE_WEATHER", severity);

                    String shortBody = messageBody != null && messageBody.length() > 200 ? messageBody.substring(0, 200) + "..." : messageBody;
                    String jsonMetadata = String.format(
                        "{\"message_id\": \"%s\", \"cocktail\": %s}",
                        messageID, drink.metadataJson()
                    );

                    ThreatRecord record = new ThreatRecord(
                        "SPACE_WEATHER",
                        messageType + " Event",
                        severity,
                        shortBody,
                        drink.name(),
                        jsonMetadata,
                        LocalDateTime.now()
                    );
                    
                    threatRecordRepository.save(record);
                }
                System.out.println(">>> Successfully fetched and saved DONKI space weather events with dynamic severity & drinks!");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch DONKI space weather data: " + e.getMessage());
        }
    }

    private double calculateSpaceWeatherSeverity(String messageType, String messageBody) {
        if (messageBody == null) return 5.0;

        String bodyUpper = messageBody.toUpperCase();

        // 1. Solar Flare (FLR)
        if ("FLR".equalsIgnoreCase(messageType) || bodyUpper.contains("SOLAR FLARE")) {
            Matcher matcher = Pattern.compile("([XMC])([0-9]+(\\.[0-9]+)?)").matcher(bodyUpper);
            if (matcher.find()) {
                String flareClass = matcher.group(1);
                double intensity = Double.parseDouble(matcher.group(2));
                return switch (flareClass) {
                    case "X" -> Math.min(8.5 + (intensity * 0.3), 10.0);
                    case "M" -> Math.min(5.5 + (intensity * 0.3), 8.4);
                    case "C" -> Math.min(2.0 + (intensity * 0.3), 5.4);
                    default -> 5.0;
                };
            }
            return 7.0;
        }

        // 2. Geomagnetic Storm (GST)
        if ("GST".equalsIgnoreCase(messageType) || bodyUpper.contains("GEOMAGNETIC STORM")) {
            Matcher kpMatcher = Pattern.compile("KP\\s*=\\s*([0-9])").matcher(bodyUpper);
            if (kpMatcher.find()) {
                int kp = Integer.parseInt(kpMatcher.group(1));
                if (kp >= 8) return 9.5;
                if (kp >= 6) return 8.0;
                if (kp >= 5) return 6.0;
            }
            return 7.5;
        }

        // 3. Coronal Mass Ejection (CME)
        if ("CME".equalsIgnoreCase(messageType) || bodyUpper.contains("CORONAL MASS EJECTION")) {
            Matcher speedMatcher = Pattern.compile("SPEED\\s*=\\s*([0-9]+)").matcher(bodyUpper);
            if (speedMatcher.find()) {
                int speed = Integer.parseInt(speedMatcher.group(1));
                if (speed > 1500) return 9.0;
                if (speed > 1000) return 7.5;
                if (speed > 500) return 6.0;
            }
            return 6.5;
        }

        return 5.5;
    }
}