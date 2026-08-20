package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

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
                // Call NASA NeoWs Feed API for today's date
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
                        java.util.List<Map<String, Object>> asteroids = (java.util.List<Map<String, Object>>) neoMap.get(today);
                        
                        for (Map<String, Object> asteroid : asteroids) {
                            String name = (String) asteroid.get("name");
                            Boolean isHazardous = (Boolean) asteroid.get("is_potentially_hazardous_asteroid");
                            
                            // Extract diameter safely
                            Map<String, Object> diamMap = (Map<String, Object>) asteroid.get("estimated_diameter");
                            Map<String, Object> metersMap = (Map<String, Object>) diamMap.get("meters");
                            Double maxDiameter = (Double) metersMap.get("estimated_diameter_max");

                            // Calculate a custom severity score based on size and hazard status
                            double severity = isHazardous ? 9.5 : Math.min(maxDiameter / 10.0, 5.0);
                            String drink = isHazardous ? "Panic Button Martini" : "Calm Down Chamomile";

                            ThreatRecord record = new ThreatRecord(
                                "ASTEROID: " + name,
                                severity,
                                "Hazardous: " + isHazardous + " | Max Width: " + maxDiameter + " meters",
                                drink,
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
}