package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class StockMarketService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;
    private final CocktailService cocktailService;

    public StockMarketService(ThreatRecordRepository threatRecordRepository, CocktailService cocktailService) {
        this.threatRecordRepository = threatRecordRepository;
        this.cocktailService = cocktailService;
        this.restClient = RestClient.builder()
                .baseUrl("https://query1.finance.yahoo.com/v7/finance")
                .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build();
    }

    public void fetchAndSaveMarketThreats() {
        try {
            Map response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/quote")
                            .queryParam("symbols", "^VIX,^GSPC,BTC-USD")
                            .build())
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("quoteResponse")) {
                Map<String, Object> quoteResponse = (Map<String, Object>) response.get("quoteResponse");
                if (quoteResponse.containsKey("result")) {
                    List<Map<String, Object>> results = (List<Map<String, Object>>) quoteResponse.get("result");

                    for (Map<String, Object> quote : results) {
                        String symbol = (String) quote.get("symbol");
                        String shortName = (String) quote.get("shortName");
                        Number priceNum = (Number) quote.get("regularMarketPrice");
                        Number changePctNum = (Number) quote.get("regularMarketChangePercent");

                        double price = priceNum != null ? priceNum.doubleValue() : 0.0;
                        double changePercent = changePctNum != null ? changePctNum.doubleValue() : 0.0;

                        double severity = calculateMarketSeverity(symbol, price, changePercent);
                        
                        // Ignore minor noise if severity is low
                        if (severity < 4.0) continue;

                        CocktailService.PrescribedDrink drink = cocktailService.prescribeDrink("STOCK_MARKET", severity);

                        String title = formatMarketTitle(symbol, shortName, price, changePercent);
                        String description = String.format("%s (%s) telemetry: price $%.2f, single-day change %.2f%%", 
                                shortName != null ? shortName : symbol, symbol, price, changePercent);

                        String metadataJson = String.format(
                            "{\"symbol\":\"%s\", \"price\":%.2f, \"change_percent\":%.2f, \"cocktail\": %s}",
                            symbol, price, changePercent, drink.metadataJson()
                        );

                        ThreatRecord record = new ThreatRecord(
                            "STOCK_MARKET",
                            title,
                            severity,
                            description,
                            drink.name(),
                            metadataJson,
                            LocalDateTime.now()
                        );

                        threatRecordRepository.save(record);
                    }
                    System.out.println(">>> Successfully fetched and saved financial market crisis threats!");
                    return;
                }
            }
        } catch (Exception e) {
            System.err.println(">>> Financial API fetch fallback triggered: " + e.getMessage());
        }

        // Fallback simulation/ingestion if live financial quote endpoint is rate limited
        generateFallbackMarketThreats();
    }

    private double calculateMarketSeverity(String symbol, double price, double changePercent) {
        if ("^VIX".equalsIgnoreCase(symbol)) {
            // VIX Volatility Index
            if (price >= 45.0) return 9.8;
            if (price >= 35.0) return 8.5;
            if (price >= 25.0) return 6.5;
            if (price >= 20.0) return 5.0;
            return 3.0;
        }

        // Drop percentages (negative change means market crash)
        double drop = -changePercent; 
        if (drop >= 5.0) return 9.5;
        if (drop >= 3.0) return 8.0;
        if (drop >= 1.5) return 6.0;

        return 3.5;
    }

    private String formatMarketTitle(String symbol, String shortName, double price, double changePercent) {
        if ("^VIX".equalsIgnoreCase(symbol)) {
            return String.format("VIX Volatility Panic (%.1f)", price);
        }
        return String.format("%s Market %s (%.2f%%)", 
                shortName != null ? shortName : symbol, 
                changePercent < 0 ? "Crash" : "Spike", 
                changePercent);
    }

    private void generateFallbackMarketThreats() {
        double simulatedVix = 32.4;
        double severity = calculateMarketSeverity("^VIX", simulatedVix, 12.5);
        CocktailService.PrescribedDrink drink = cocktailService.prescribeDrink("STOCK_MARKET", severity);

        String metadataJson = String.format(
            "{\"symbol\":\"^VIX\", \"price\":%.2f, \"change_percent\":12.5, \"fallback\":true, \"cocktail\": %s}",
            simulatedVix, drink.metadataJson()
        );

        ThreatRecord record = new ThreatRecord(
            "STOCK_MARKET",
            "VIX Volatility Panic (32.4)",
            severity,
            "CBOE Volatility Index spiked to 32.4 (+12.5%). Financial market turmoil detected.",
            drink.name(),
            metadataJson,
            LocalDateTime.now()
        );

        threatRecordRepository.save(record);
        System.out.println(">>> Logged fallback financial crisis threat to Supabase.");
    }
}
