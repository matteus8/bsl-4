package com.bsl4.dashboard.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "threat_records")
public class ThreatRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String threatType; // e.g., "ASTEROID", "EARTHQUAKE", "SPACE_WEATHER"
    private Double severityScore;
    private String description;
    private String recommendedDrink;
    private LocalDateTime recordedAt;

    // Constructors
    public ThreatRecord() {}

    public ThreatRecord(String threatType, Double severityScore, String description, String recommendedDrink, LocalDateTime recordedAt) {
        this.threatType = threatType;
        this.severityScore = severityScore;
        this.description = description;
        this.recommendedDrink = recommendedDrink;
        this.recordedAt = recordedAt;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getThreatType() { return threatType; }
    public void setThreatType(String threatType) { this.threatType = threatType; }

    public Double getSeverityScore() { return severityScore; }
    public void setSeverityScore(Double severityScore) { this.severityScore = severityScore; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getRecommendedDrink() { return recommendedDrink; }
    public void setRecommendedDrink(String recommendedDrink) { this.recommendedDrink = recommendedDrink; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }
}