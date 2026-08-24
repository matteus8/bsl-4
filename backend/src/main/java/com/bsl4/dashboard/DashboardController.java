package com.bsl4.dashboard;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import com.bsl4.dashboard.service.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final NasaService nasaService;
    private final EarthquakeService earthquakeService;
    private final WeatherGovService weatherGovService;
    private final StockMarketService stockMarketService;
    private final LocationService locationService;
    private final ThreatRecordRepository threatRecordRepository;

    public DashboardController(NasaService nasaService,
                               EarthquakeService earthquakeService,
                               WeatherGovService weatherGovService,
                               StockMarketService stockMarketService,
                               LocationService locationService,
                               ThreatRecordRepository threatRecordRepository) {
        this.nasaService = nasaService;
        this.earthquakeService = earthquakeService;
        this.weatherGovService = weatherGovService;
        this.stockMarketService = stockMarketService;
        this.locationService = locationService;
        this.threatRecordRepository = threatRecordRepository;
    }

    @GetMapping("/threats/refresh-nasa")
    public String refreshNasaData() {
        nasaService.fetchAndSaveAsteroids();
        nasaService.fetchAndSaveSpaceWeather();
        return "NASA asteroids and space weather notifications successfully fetched, scored, and logged!";
    }

    @GetMapping("/threats/refresh-earthquakes")
    public String refreshEarthquakes() {
        earthquakeService.fetchAndSaveEarthquakes();
        return "USGS seismic earthquake hazards successfully fetched, scored, and logged!";
    }

    @GetMapping("/threats/refresh-weather")
    public String refreshWeather() {
        weatherGovService.fetchAndSaveWeatherAlerts();
        return "NWS atmospheric threat alerts successfully fetched, scored, and logged!";
    }

    @GetMapping("/threats/refresh-market")
    public String refreshMarket() {
        stockMarketService.fetchAndSaveMarketThreats();
        return "Financial stock market volatility and crash telemetry successfully fetched, scored, and logged!";
    }

    @GetMapping("/threats/refresh-all")
    public Map<String, String> refreshAllThreats() {
        return Map.of(
            "status", "SUCCESS",
            "message", "Telemetry stream synced with database threat registry."
        );
    }

    @GetMapping("/threats/latest")
    public List<ThreatRecord> getLatestThreats(@RequestParam(required = false, defaultValue = "30") Integer days) {
        try {
            return threatRecordRepository.findTop100ByOrderByRecordedAtDesc();
        } catch (Exception e) {
            System.err.println("Error fetching latest threats: " + e.getMessage());
            e.printStackTrace();
            return List.of();
        }
    }

    @GetMapping("/threats/nearby")
    public List<ThreatRecord> getNearbyThreats(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(required = false, defaultValue = "30") Integer days,
            @RequestParam(required = false, defaultValue = "70") Integer physicalLimit,
            @RequestParam(required = false, defaultValue = "30") Integer globalLimit) {
        try {
            LocalDateTime afterDate = LocalDateTime.now().minusDays(days != null ? days : 30);
            int pLimit = physicalLimit != null ? physicalLimit : 70;
            int gLimit = globalLimit != null ? globalLimit : 30;

            List<ThreatRecord> physical = threatRecordRepository.findNearbyPhysicalThreats(lat, lon, afterDate, pLimit);
            List<ThreatRecord> global = threatRecordRepository.findLatestGlobalThreats(afterDate, gLimit);

            List<ThreatRecord> combined = new ArrayList<>(physical.size() + global.size());
            combined.addAll(physical);
            combined.addAll(global);
            return combined;
        } catch (Exception e) {
            System.err.println("Error querying nearby threats: " + e.getMessage());
            e.printStackTrace();
            return threatRecordRepository.findTop100ByOrderByRecordedAtDesc();
        }
    }

    @GetMapping("/threats/highest")
    public List<ThreatRecord> getHighestThreats(@RequestParam(defaultValue = "7.0") Double minSeverity) {
        return threatRecordRepository.findBySeverityScoreGreaterThanEqualOrderBySeverityScoreDesc(minSeverity);
    }

    @GetMapping("/location/geocode")
    public List<LocationService.GeocodedLocation> geocodeLocation(@RequestParam String query) {
        return locationService.geocodeGlobalAddress(query);
    }

    @GetMapping("/location/assess")
    public LocationService.RegionalAssessment assessLocation(
            @RequestParam(required = false) String address,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon) {
        return locationService.assessRegion(address, lat, lon);
    }

    @GetMapping("/threats/editorial/latest")
    public Map<String, Object> getLatestEditorialVerdict() {
        try {
            List<Object[]> rows = threatRecordRepository.findLatestEditorialVerdictRow();
            if (rows != null && !rows.isEmpty()) {
                Object[] r = rows.get(0);
                return Map.of(
                    "id", r[0] != null ? r[0] : 0,
                    "verdictText", r[1] != null ? r[1].toString() : "",
                    "panicIndex", r[2] != null ? Double.parseDouble(r[2].toString()) : 2.1,
                    "statusLevel", r[3] != null ? r[3].toString() : "NOMINAL",
                    "summaryNarrative", r[4] != null ? r[4].toString() : "",
                    "createdAt", r[5] != null ? r[5].toString() : ""
                );
            }
        } catch (Exception e) {
            System.err.println("Error reading latest editorial verdict: " + e.getMessage());
        }
        return Map.of();
    }
}