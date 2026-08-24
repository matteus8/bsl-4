package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@Service
public class WeatherGovService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;

    public WeatherGovService(ThreatRecordRepository threatRecordRepository,
                             @Value("${weathergov.useragent:BSL4ProtocolZero/1.0 (contact@bsl4.com)}") String userAgent) {
        this.threatRecordRepository = threatRecordRepository;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.weather.gov")
                .defaultHeader("User-Agent", userAgent)
                .defaultHeader("Accept", "application/geo+json")
                .build();
    }

    public void fetchAndSaveWeatherAlerts() {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/alerts/active?status=actual&message_type=alert")
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("features")) {
                List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");

                // Purge previous active weather alerts to keep only the latest snapshot
                threatRecordRepository.deleteByThreatType("TERRESTRIAL_WEATHER");

                int count = 0;
                for (Map<String, Object> feature : features) {
                    Map<String, Object> properties = (Map<String, Object>) feature.get("properties");
                    if (properties == null) continue;

                    String severityStr = (String) properties.get("severity");
                    
                    // Filter for meaningful weather alerts (Moderate, Severe, Extreme)
                    if ("Minor".equalsIgnoreCase(severityStr) || "Unknown".equalsIgnoreCase(severityStr)) {
                        continue;
                    }

                    String headline = (String) properties.get("headline");
                    String event = (String) properties.get("event");
                    String areaDesc = (String) properties.get("areaDesc");
                    String description = (String) properties.get("description");
                    String urgency = (String) properties.get("urgency");
                    String sentTime = (String) properties.get("sent");

                    double severity = calculateWeatherSeverity(severityStr, urgency, event);

                    String truncatedDesc = description != null && description.length() > 250 
                            ? description.substring(0, 250) + "..." 
                            : description;

                    String metadataJson = String.format(
                        "{\"event\":\"%s\", \"nws_severity\":\"%s\", \"urgency\":\"%s\", \"area\":\"%s\"}",
                        escapeJson(event), escapeJson(severityStr), escapeJson(urgency), escapeJson(areaDesc)
                    );

                    LocalDateTime recordedAt = sentTime != null 
                            ? ZonedDateTime.parse(sentTime).toLocalDateTime() 
                            : LocalDateTime.now();

                    ThreatRecord record = new ThreatRecord(
                        "TERRESTRIAL_WEATHER",
                        event != null ? event : "Atmospheric Threat",
                        severity,
                        headline != null ? headline : truncatedDesc,
                        metadataJson,
                        recordedAt
                    );

                    threatRecordRepository.save(record);
                    count++;
                    
                    // Cap at 15 most critical active alerts to prevent table bloating
                    if (count >= 15) break;
                }
                System.out.println(">>> Successfully fetched and saved " + count + " NWS severe weather alerts!");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch weather.gov alert data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private double calculateWeatherSeverity(String severityStr, String urgency, String event) {
        double score = 5.0;

        if ("Extreme".equalsIgnoreCase(severityStr)) score = 9.5;
        else if ("Severe".equalsIgnoreCase(severityStr)) score = 7.8;
        else if ("Moderate".equalsIgnoreCase(severityStr)) score = 5.5;

        if ("Immediate".equalsIgnoreCase(urgency)) {
            score = Math.min(score + 0.5, 10.0);
        }

        if (event != null) {
            String evtUpper = event.toUpperCase();
            if (evtUpper.contains("TORNADO") || evtUpper.contains("HURRICANE") || evtUpper.contains("TYPHOON")) {
                score = Math.min(score + 1.0, 10.0);
            }
        }

        return score;
    }

    private String escapeJson(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
