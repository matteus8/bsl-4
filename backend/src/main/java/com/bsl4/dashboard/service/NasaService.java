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

    @Value("${nasa.api.key:DEMO_KEY}")
    private String nasaApiKey;

    public NasaService(ThreatRecordRepository threatRecordRepository) {
        this.threatRecordRepository = threatRecordRepository;
        this.restClient = RestClient.create("https://api.nasa.gov");
    }

    public void fetchAndSaveAsteroids() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(7); // Max 7 days per feed query
        
        try {
            Map<String, Object> response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/neo/rest/v1/feed")
                            .queryParam("start_date", start.toString())
                            .queryParam("end_date", end.toString())
                            .queryParam("api_key", nasaApiKey)
                            .build())
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("near_earth_objects")) {
                Map<String, Object> neoMap = (Map<String, Object>) response.get("near_earth_objects");
                
                // Purge previous asteroid records to keep only the latest snapshot
                threatRecordRepository.deleteByThreatType("ASTEROID");

                for (String dateKey : neoMap.keySet()) {
                    List<Map<String, Object>> asteroids = (List<Map<String, Object>>) neoMap.get(dateKey);
                    if (asteroids == null) continue;
                    
                    for (Map<String, Object> asteroid : asteroids) {
                        String name = (String) asteroid.get("name");
                        Boolean isHazardous = (Boolean) asteroid.get("is_potentially_hazardous_asteroid");
                        
                        Map<String, Object> diamMap = (Map<String, Object>) asteroid.get("estimated_diameter");
                        Double maxDiameter = 50.0;
                        if (diamMap != null && diamMap.containsKey("meters")) {
                            Map<String, Object> metersMap = (Map<String, Object>) diamMap.get("meters");
                            maxDiameter = (Double) metersMap.get("estimated_diameter_max");
                        }
                        if (maxDiameter == null) maxDiameter = 50.0;

                        double missKm = 4200000.0;
                        double velocityKph = 45000.0;
                        List<Map<String, Object>> cad = (List<Map<String, Object>>) asteroid.get("close_approach_data");
                        if (cad != null && !cad.isEmpty()) {
                            try {
                                Map<String, Object> firstCad = cad.get(0);
                                Map<String, Object> missMap = (Map<String, Object>) firstCad.get("miss_distance");
                                if (missMap != null && missMap.containsKey("kilometers")) {
                                    missKm = Double.parseDouble(missMap.get("kilometers").toString());
                                }
                                Map<String, Object> velMap = (Map<String, Object>) firstCad.get("relative_velocity");
                                if (velMap != null && velMap.containsKey("kilometers_per_hour")) {
                                    velocityKph = Double.parseDouble(velMap.get("kilometers_per_hour").toString());
                                }
                            } catch (Exception ignored) {}
                        }

                        double lunarDist = (missKm > 0) ? (missKm / 384400.0) : 999.0;
                        double baseSev = 1.0;
                        if (lunarDist <= 0.5) baseSev = 9.0;
                        else if (lunarDist <= 1.0) baseSev = 7.5;
                        else if (lunarDist <= 3.0) baseSev = 5.5;
                        else if (lunarDist <= 5.0) baseSev = 4.0;
                        else if (lunarDist <= 10.0) baseSev = 2.5;
                        else if (lunarDist <= 20.0) baseSev = 1.8;

                        double sizeBoost = 0.0;
                        if (maxDiameter >= 500.0) sizeBoost = (lunarDist <= 10.0) ? 1.0 : 0.4;
                        else if (maxDiameter >= 140.0) sizeBoost = (lunarDist <= 10.0) ? 0.5 : 0.2;

                        double severity = Math.min(10.0, Math.round((baseSev + sizeBoost) * 10.0) / 10.0);
                        String phaLabel = Boolean.TRUE.equals(isHazardous) ? "PHA (Potentially Hazardous Orbit)" : "Nominal NEO";
                        String trajectoryStatus = (lunarDist <= 1.0) ? "Ultra-Close Approach" : ((lunarDist <= 5.0) ? "Close Flyby" : ((lunarDist <= 20.0) ? "Regional Pass" : "Deep Space Safe Pass"));

                        String jsonMetadata = String.format(
                            "{\"max_width_meters\": %.1f, \"is_hazardous\": %b, \"miss_distance_km\": %.1f, \"lunar_distance\": %.1f, \"velocity_kph\": %.1f, \"trajectory_status\": \"%s\"}",
                            maxDiameter, Boolean.TRUE.equals(isHazardous), missKm, lunarDist, velocityKph, trajectoryStatus
                        );

                        ThreatRecord record = new ThreatRecord(
                            "ASTEROID",
                            name,
                            severity,
                            String.format("%s | Max Diameter: %.1fm | Flyby: %.2fM km (%.1fx Lunar Distance) | %s", phaLabel, maxDiameter, missKm / 1e6, lunarDist, trajectoryStatus),
                            jsonMetadata,
                            LocalDate.parse(dateKey).atStartOfDay()
                        );
                        
                        threatRecordRepository.save(record);
                    }
                }
                System.out.println(">>> Successfully parsed and saved real asteroids for 30-day feed.");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch/parse NASA asteroid data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void fetchAndSaveSpaceWeather() {
        try {
            LocalDate end = LocalDate.now();
            LocalDate start = end.minusDays(30);
            Map[] response = null;

            // Tier 1: Direct NASA CCMC DONKI endpoint (GSFC)
            try {
                RestClient ccmcClient = RestClient.create("https://kauai.ccmc.gsfc.nasa.gov");
                response = ccmcClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path("/DONKI/WS/get/notifications")
                                .queryParam("startDate", start.toString())
                                .queryParam("endDate", end.toString())
                                .build())
                        .retrieve()
                        .body(Map[].class);
            } catch (Exception ex) {
                System.err.println(">>> Direct CCMC DONKI endpoint failed, falling back to api.nasa.gov: " + ex.getMessage());
            }

            // Tier 2: api.nasa.gov gateway
            if (response == null || response.length == 0) {
                try {
                    response = restClient.get()
                            .uri(uriBuilder -> uriBuilder
                                    .path("/DONKI/notifications")
                                    .queryParam("startDate", start.toString())
                                    .queryParam("endDate", end.toString())
                                    .queryParam("api_key", nasaApiKey)
                                    .build())
                            .retrieve()
                            .body(Map[].class);
                } catch (Exception ex) {
                    System.err.println(">>> api.nasa.gov DONKI endpoint failed: " + ex.getMessage());
                }
            }

            if (response != null && response.length > 0) {
                // Purge previous space weather records to keep only the latest snapshot
                threatRecordRepository.deleteByThreatType("SPACE_WEATHER");

                for (Map<String, Object> event : response) {
                    String messageType = (String) event.get("messageType");
                    String messageBody = (String) event.get("messageBody");
                    String messageID = (String) event.get("messageID");
                    String messageIssueTime = (String) event.get("messageIssueTime");
                    String messageURL = (String) event.get("messageURL");

                    double severity = calculateSpaceWeatherSeverity(messageType, messageBody);
                    String title = formatSpaceWeatherTitle(messageType, messageBody);

                    String shortBody = messageBody != null && messageBody.length() > 240 ? messageBody.substring(0, 240) + "..." : (messageBody != null ? messageBody : "");
                    String jsonMetadata = String.format(
                        "{\"message_id\": \"%s\", \"message_type\": \"%s\", \"message_url\": \"%s\"}",
                        messageID != null ? messageID : "",
                        messageType != null ? messageType : "",
                        messageURL != null ? messageURL : ""
                    );

                    LocalDateTime recordedAt = LocalDateTime.now();
                    if (messageIssueTime != null) {
                        try {
                            recordedAt = LocalDateTime.parse(messageIssueTime.replace("Z", ""));
                        } catch (Exception ignored) {
                            recordedAt = LocalDateTime.now();
                        }
                    }

                    ThreatRecord record = new ThreatRecord(
                        "SPACE_WEATHER",
                        title,
                        severity,
                        shortBody,
                        jsonMetadata,
                        recordedAt
                    );
                    
                    threatRecordRepository.save(record);
                }
                System.out.println(">>> Successfully fetched and saved " + response.length + " DONKI space weather events!");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch DONKI space weather data: " + e.getMessage());
        }
    }

    private String formatSpaceWeatherTitle(String messageType, String messageBody) {
        if (messageType == null) return "Space Weather Alert";
        String bodyUpper = messageBody != null ? messageBody.toUpperCase() : "";

        if ("FLR".equalsIgnoreCase(messageType) || bodyUpper.contains("SOLAR FLARE")) {
            Matcher matcher = Pattern.compile("([XMC])([0-9]+(\\.[0-9]+)?)").matcher(bodyUpper);
            if (matcher.find()) {
                String flareClass = matcher.group(1);
                String intensity = matcher.group(2);
                return flareClass + intensity + " Solar Flare (" + flareClass + "-Class)";
            }
            return "Solar Flare Alert (FLR)";
        }
        if ("GST".equalsIgnoreCase(messageType) || bodyUpper.contains("GEOMAGNETIC STORM")) {
            Matcher kpMatcher = Pattern.compile("KP\\s*[:=]?\\s*([0-9])").matcher(bodyUpper);
            if (kpMatcher.find()) {
                return "Geomagnetic Storm (Kp " + kpMatcher.group(1) + ")";
            }
            return "Geomagnetic Storm Alert (GST)";
        }
        if ("CME".equalsIgnoreCase(messageType) || bodyUpper.contains("CORONAL MASS EJECTION")) {
            Matcher speedMatcher = Pattern.compile("SPEED\\s*[:=]?\\s*~?([0-9]+)").matcher(bodyUpper);
            if (speedMatcher.find()) {
                return "Coronal Mass Ejection (~" + speedMatcher.group(1) + " km/s)";
            }
            return "Coronal Mass Ejection (CME)";
        }
        if ("SEP".equalsIgnoreCase(messageType) || bodyUpper.contains("SOLAR ENERGETIC PARTICLE")) {
            return "Solar Energetic Particle Event (SEP)";
        }
        if ("RBE".equalsIgnoreCase(messageType) || bodyUpper.contains("RADIATION BELT")) {
            return "Radiation Belt Enhancement (RBE)";
        }
        if ("HSS".equalsIgnoreCase(messageType) || bodyUpper.contains("HIGH SPEED STREAM")) {
            return "High Speed Solar Wind Stream (HSS)";
        }
        if ("IPS".equalsIgnoreCase(messageType) || bodyUpper.contains("INTERPLANETARY SHOCK")) {
            return "Interplanetary Shock Wave (IPS)";
        }
        return messageType + " Space Weather Alert";
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
            Matcher kpMatcher = Pattern.compile("KP\\s*[:=]?\\s*([0-9])").matcher(bodyUpper);
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
            Matcher speedMatcher = Pattern.compile("SPEED\\s*[:=]?\\s*~?([0-9]+)").matcher(bodyUpper);
            if (speedMatcher.find()) {
                int speed = Integer.parseInt(speedMatcher.group(1));
                if (speed > 1500) return 9.0;
                if (speed > 1000) return 7.5;
                if (speed > 500) return 6.0;
            }
            return 6.5;
        }

        if ("SEP".equalsIgnoreCase(messageType)) return 6.0;
        if ("RBE".equalsIgnoreCase(messageType)) return 5.0;
        if ("HSS".equalsIgnoreCase(messageType)) return 5.2;
        if ("IPS".equalsIgnoreCase(messageType)) return 5.8;

        return 5.5;
    }
}