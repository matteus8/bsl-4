package com.bsl4.dashboard;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import com.bsl4.dashboard.service.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final NasaService nasaService;
    private final EarthquakeService earthquakeService;
    private final WeatherGovService weatherGovService;
    private final StockMarketService stockMarketService;
    private final CocktailService cocktailService;
    private final LocationService locationService;
    private final ThreatRecordRepository threatRecordRepository;

    public DashboardController(NasaService nasaService,
                               EarthquakeService earthquakeService,
                               WeatherGovService weatherGovService,
                               StockMarketService stockMarketService,
                               CocktailService cocktailService,
                               LocationService locationService,
                               ThreatRecordRepository threatRecordRepository) {
        this.nasaService = nasaService;
        this.earthquakeService = earthquakeService;
        this.weatherGovService = weatherGovService;
        this.stockMarketService = stockMarketService;
        this.cocktailService = cocktailService;
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
        nasaService.fetchAndSaveAsteroids();
        nasaService.fetchAndSaveSpaceWeather();
        earthquakeService.fetchAndSaveEarthquakes();
        weatherGovService.fetchAndSaveWeatherAlerts();
        stockMarketService.fetchAndSaveMarketThreats();

        return Map.of(
            "status", "SUCCESS",
            "message", "All Protocol Zero threat detection pipelines (NASA, DONKI, USGS, NWS Weather, Stock Market) successfully executed and logged."
        );
    }

    @GetMapping("/threats/latest")
    public List<ThreatRecord> getLatestThreats(@RequestParam(required = false, defaultValue = "30") Integer days) {
        if (days != null && days > 0) {
            return threatRecordRepository.findByRecordedAtAfterOrderByRecordedAtDesc(java.time.LocalDateTime.now().minusDays(days));
        }
        return threatRecordRepository.findTop500ByOrderByRecordedAtDesc();
    }

    @GetMapping("/threats/highest")
    public List<ThreatRecord> getHighestThreats(@RequestParam(defaultValue = "7.0") Double minSeverity) {
        return threatRecordRepository.findBySeverityScoreGreaterThanEqualOrderBySeverityScoreDesc(minSeverity);
    }

    @GetMapping("/cocktails/search")
    public Map<String, Object> searchCocktail(@RequestParam String name) {
        return cocktailService.fetchCocktailFromApi(name);
    }

    @GetMapping("/cocktails/prescribe")
    public CocktailService.PrescribedDrink prescribeCocktail(@RequestParam(defaultValue = "GENERAL") String threatType,
                                                             @RequestParam(defaultValue = "7.5") double severity) {
        return cocktailService.prescribeDrink(threatType, severity);
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
}