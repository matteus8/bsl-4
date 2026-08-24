package com.bsl4.dashboard.service;

import com.bsl4.dashboard.model.ThreatRecord;
import com.bsl4.dashboard.model.ThreatRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class StockMarketService {

    private final RestClient restClient;
    private final ThreatRecordRepository threatRecordRepository;

    private static final List<MarketConfig> GLOBAL_MARKETS = List.of(
        new MarketConfig("^VIX", "CBOE Volatility Index (Fear Index)", "Americas", true),
        new MarketConfig("^GSPC", "S&P 500 Index", "Americas", false),
        new MarketConfig("^FTSE", "FTSE 100 London", "Europe", false),
        new MarketConfig("^N225", "Nikkei 225 Tokyo", "Asia-Pacific", false),
        new MarketConfig("^HSI", "Hang Seng Hong Kong", "Asia-Pacific", false),
        new MarketConfig("GC=F", "Gold Futures (Safe Haven)", "Global Commodities", false),
        new MarketConfig("BTC-USD", "Bitcoin (24/7 Digital Liquidity)", "Global Crypto", false)
    );

    public record MarketConfig(String symbol, String name, String region, boolean isVix) {}

    public StockMarketService(ThreatRecordRepository threatRecordRepository) {
        this.threatRecordRepository = threatRecordRepository;
        this.restClient = RestClient.builder()
                .baseUrl("https://query1.finance.yahoo.com/v8/finance/chart")
                .defaultHeader("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .defaultHeader("Accept", "application/json")
                .build();
    }

    public void fetchAndSaveMarketThreats() {
        List<ThreatRecord> records = new ArrayList<>();

        for (MarketConfig cfg : GLOBAL_MARKETS) {
            try {
                Map response = restClient.get()
                        .uri("/{symbol}?interval=1d&range=1d", cfg.symbol())
                        .retrieve()
                        .body(Map.class);

                if (response != null && response.containsKey("chart")) {
                    Map<String, Object> chart = (Map<String, Object>) response.get("chart");
                    List<Map<String, Object>> resultList = (List<Map<String, Object>>) chart.get("result");
                    if (resultList != null && !resultList.isEmpty()) {
                        Map<String, Object> meta = (Map<String, Object>) resultList.get(0).get("meta");

                        Number priceNum = (Number) meta.get("regularMarketPrice");
                        Number prevCloseNum = (Number) (meta.get("chartPreviousClose") != null 
                                ? meta.get("chartPreviousClose") 
                                : meta.get("previousClose"));
                        Number dayHighNum = (Number) meta.get("regularMarketDayHigh");
                        Number dayLowNum = (Number) meta.get("regularMarketDayLow");
                        String currency = (String) meta.getOrDefault("currency", "USD");

                        double price = priceNum != null ? priceNum.doubleValue() : 0.0;
                        double prevClose = prevCloseNum != null ? prevCloseNum.doubleValue() : price;
                        double changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100.0 : 0.0;
                        double dayHigh = dayHighNum != null ? dayHighNum.doubleValue() : price;
                        double dayLow = dayLowNum != null ? dayLowNum.doubleValue() : price;

                        double severity = calculateMarketSeverity(cfg.symbol(), price, changePercent, cfg.isVix());
                        String title = formatMarketTitle(cfg.symbol(), cfg.name(), price, changePercent, cfg.isVix());
                        String description = String.format("%s (%s) [%s]: Price %s %.2f, 24h change %+.2f%% (Range: %.2f - %.2f)",
                                cfg.name(), cfg.symbol(), cfg.region(), currency, price, changePercent, dayLow, dayHigh);

                        String metadataJson = String.format(
                            "{\"symbol\":\"%s\",\"name\":\"%s\",\"region\":\"%s\",\"price\":%.2f,\"change_percent\":%.2f,\"day_high\":%.2f,\"day_low\":%.2f,\"currency\":\"%s\"}",
                            cfg.symbol(), cfg.name(), cfg.region(), price, changePercent, dayHigh, dayLow, currency
                        );

                        records.add(new ThreatRecord(
                            "STOCK_MARKET",
                            title,
                            severity,
                            description,
                            metadataJson,
                            LocalDateTime.now()
                        ));
                    }
                }
            } catch (Exception e) {
                System.err.println(">>> Notice fetching ticker " + cfg.symbol() + ": " + e.getMessage());
            }
        }

        if (!records.isEmpty()) {
            threatRecordRepository.deleteByThreatType("STOCK_MARKET");
            threatRecordRepository.saveAll(records);
            System.out.println(">>> Successfully fetched and saved " + records.size() + " international financial market threats!");
        } else {
            generateFallbackMarketThreats();
        }
    }

    private double calculateMarketSeverity(String symbol, double price, double changePercent, boolean isVix) {
        if (isVix) {
            if (price >= 40.0) return 9.8;
            if (price >= 30.0) return 8.5;
            if (price >= 20.0) return 6.5;
            if (price >= 15.0) return 4.5;
            return 3.0;
        }

        if ("BTC-USD".equalsIgnoreCase(symbol)) {
            if (changePercent <= -8.0) return 9.2;
            if (changePercent <= -4.0) return 7.5;
            if (changePercent <= -2.0) return 5.5;
            return 4.0;
        }

        if ("GC=F".equalsIgnoreCase(symbol)) {
            if (changePercent >= 3.0) return 7.8; // Flight to safety spike
            return 4.0;
        }

        // Equity indices drops
        double drop = -changePercent;
        if (drop >= 5.0) return 9.5;
        if (drop >= 3.0) return 8.0;
        if (drop >= 1.5) return 6.0;

        return 4.0;
    }

    private String formatMarketTitle(String symbol, String name, double price, double changePercent, boolean isVix) {
        if (isVix) {
            return String.format("VIX Volatility Panic (%.1f)", price);
        }
        return String.format("%s (%s %+.2f%%)", name, symbol, changePercent);
    }

    private void generateFallbackMarketThreats() {
        double simulatedVix = 28.5;
        double severity = calculateMarketSeverity("^VIX", simulatedVix, 8.4, true);

        String metadataJson = String.format(
            "{\"symbol\":\"^VIX\",\"name\":\"CBOE Volatility Index\",\"region\":\"Americas\",\"price\":%.2f,\"change_percent\":8.40,\"fallback\":true}",
            simulatedVix
        );

        ThreatRecord record = new ThreatRecord(
            "STOCK_MARKET",
            "VIX Volatility Panic (28.5)",
            severity,
            "CBOE Volatility Index tracking elevated market anxiety and defensive hedging across global liquidity pools.",
            metadataJson,
            LocalDateTime.now()
        );

        threatRecordRepository.deleteByThreatType("STOCK_MARKET");
        threatRecordRepository.save(record);
        System.out.println(">>> Logged fallback financial crisis threat to Supabase.");
    }
}
