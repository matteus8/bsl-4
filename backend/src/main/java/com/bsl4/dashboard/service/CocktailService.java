package com.bsl4.dashboard.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

@Service
public class CocktailService {

    private final RestClient restClient;

    public CocktailService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://www.thecocktaildb.com/api/json/v1/1")
                .defaultHeader("User-Agent", "BSL4ProtocolZero/1.0")
                .build();
    }

    /**
     * Prescribes a drink based on threat type and severity score (0.0 to 10.0 scale),
     * querying TheCocktailDB API for authentic recipes.
     */
    public PrescribedDrink prescribeDrink(String threatType, double severityScore) {
        String drinkQuery = selectDrinkQuery(threatType, severityScore);
        Map<String, Object> recipe = fetchCocktailFromApi(drinkQuery);

        if (recipe != null) {
            String name = (String) recipe.get("strDrink");
            String instructions = (String) recipe.get("strInstructions");
            String glass = (String) recipe.get("strGlass");
            String thumb = (String) recipe.get("strDrinkThumb");

            List<String> ingredients = extractIngredients(recipe);

            return new PrescribedDrink(name, instructions, glass, thumb, ingredients, formatMetadataJson(name, instructions, glass, thumb, ingredients));
        }

        // Fallback prescription if API fails
        String fallbackName = getFallbackDrinkName(threatType, severityScore);
        return new PrescribedDrink(
                fallbackName,
                "Pour generously into glass and brace for impact.",
                "Highball glass",
                null,
                List.of("Spirit of choice", "Ice", "Splash of tonic"),
                String.format("{\"drink_name\":\"%s\", \"recipe\":\"Pour over ice\", \"fallback\":true}", fallbackName)
        );
    }

    /**
     * Fetches detailed cocktail information by name from TheCocktailDB API.
     */
    public Map<String, Object> fetchCocktailFromApi(String drinkName) {
        try {
            Map response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search.php")
                            .queryParam("s", drinkName)
                            .build())
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("drinks") && response.get("drinks") != null) {
                List<Map<String, Object>> drinks = (List<Map<String, Object>>) response.get("drinks");
                if (!drinks.isEmpty()) {
                    return drinks.get(0);
                }
            }
        } catch (Exception e) {
            System.err.println(">>> Failed to fetch cocktail from TheCocktailDB: " + e.getMessage());
        }
        return null;
    }

    private String selectDrinkQuery(String threatType, double severityScore) {
        String type = threatType != null ? threatType.toUpperCase() : "GENERAL";

        if (severityScore >= 8.5) {
            return switch (type) {
                case "SPACE_WEATHER" -> "Zombie";
                case "ASTEROID" -> "Earthquake";
                case "EARTHQUAKE" -> "Earthquake";
                case "TERRESTRIAL_WEATHER" -> "Hurricane";
                default -> "Zombie";
            };
        } else if (severityScore >= 6.0) {
            return switch (type) {
                case "SPACE_WEATHER" -> "Tequila Sunrise";
                case "ASTEROID" -> "Kamikaze";
                case "EARTHQUAKE" -> "Manhattan";
                case "TERRESTRIAL_WEATHER" -> "Dark and Stormy";
                default -> "Margarita";
            };
        } else if (severityScore >= 4.0) {
            return switch (type) {
                case "SPACE_WEATHER" -> "Margarita";
                case "ASTEROID" -> "Whiskey Sour";
                case "EARTHQUAKE" -> "Negroni";
                case "TERRESTRIAL_WEATHER" -> "Bloody Mary";
                default -> "Gin Tonic";
            };
        } else {
            return "Hot Toddy";
        }
    }

    private String getFallbackDrinkName(String threatType, double severityScore) {
        if (severityScore >= 8.0) {
            return "Panic Button Martini";
        } else if (severityScore >= 5.0) {
            return "Solar Flare Margarita";
        } else {
            return "Calm Down Chamomile";
        }
    }

    private List<String> extractIngredients(Map<String, Object> recipe) {
        List<String> ingredients = new ArrayList<>();
        for (int i = 1; i <= 15; i++) {
            String ingredient = (String) recipe.get("strIngredient" + i);
            String measure = (String) recipe.get("strMeasure" + i);
            if (ingredient != null && !ingredient.isBlank()) {
                String entry = measure != null ? measure.trim() + " " + ingredient.trim() : ingredient.trim();
                ingredients.add(entry);
            }
        }
        return ingredients;
    }

    private String formatMetadataJson(String name, String instructions, String glass, String thumb, List<String> ingredients) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"drink_name\":\"").append(escapeJson(name)).append("\",");
        json.append("\"glass\":\"").append(escapeJson(glass != null ? glass : "")).append("\",");
        json.append("\"instructions\":\"").append(escapeJson(instructions != null ? instructions : "")).append("\",");
        json.append("\"thumb_url\":\"").append(escapeJson(thumb != null ? thumb : "")).append("\",");
        json.append("\"ingredients\":[");
        for (int i = 0; i < ingredients.size(); i++) {
            json.append("\"").append(escapeJson(ingredients.get(i))).append("\"");
            if (i < ingredients.size() - 1) json.append(",");
        }
        json.append("]}");
        return json.toString();
    }

    private String escapeJson(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ");
    }

    public record PrescribedDrink(
            String name,
            String instructions,
            String glass,
            String thumbUrl,
            List<String> ingredients,
            String metadataJson
    ) {}
}
