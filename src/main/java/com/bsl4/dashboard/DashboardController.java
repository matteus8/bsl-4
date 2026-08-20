package com.bsl4.dashboard;

import com.bsl4.dashboard.service.NasaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/threats")
public class DashboardController {

    private final NasaService nasaService;

    public DashboardController(NasaService nasaService) {
        this.nasaService = nasaService;
    }

    @GetMapping("/refresh-nasa")
    public String refreshNasaData() {
        nasaService.fetchAndSaveAsteroids();
        return "NASA asteroid data fetch triggered and logged to Supabase!";
    }

    @GetMapping("/refresh-donki")
    public String refreshDonkiData() {
        nasaService.fetchAndSaveSpaceWeather();
        return "DONKI space weather notifications fetched and logged to Supabase!";
    }
}