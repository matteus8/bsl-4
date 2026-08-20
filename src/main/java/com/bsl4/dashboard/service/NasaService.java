package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;

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
                        String drink = isHazardous ? "Panic Button Martini" : "Calm Down Chamomile";
                        
                        // Construct structured JSON metadata
                        String jsonMetadata = String.format("{\"max_width_meters\": %.2f, \"is_hazardous\": %b}", maxDiameter, isHazardous);

                        ThreatRecord record = new ThreatRecord(
                            "ASTEROID",
                            name,
                            severity,
                            "Hazardous: " + isHazardous + " | Max Width: " + maxDiameter + " meters",
                            drink,
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

                    String shortBody = messageBody != null && messageBody.length() > 200 ? messageBody.substring(0, 200) + "..." : messageBody;
                    String jsonMetadata = String.format("{\"message_id\": \"%s\"}", messageID);

                    ThreatRecord record = new ThreatRecord(
                        "SPACE_WEATHER",
                        messageType,
                        7.5,
                        shortBody,
                        "Solar Flare Margarita",
                        jsonMetadata,
                        LocalDateTime.now()
                    );
                    
                    threatRecordRepository.save(record);
                }
                System.out.println(">>> Successfully fetched and saved DONKI space weather events!");
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch DONKI space weather data: " + e.getMessage());
        }
    }
}