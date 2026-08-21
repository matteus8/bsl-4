package com.bsl4.dashboard.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity
@Table(name = "threat_records")
public class ThreatRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String threatType;
    private String title;
    private Double severityScore;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    private String recommendedDrink;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;

    private LocalDateTime recordedAt;

    // Constructors
    public ThreatRecord() {}

    public ThreatRecord(String threatType, String title, Double severityScore, String description, String recommendedDrink, String metadata, LocalDateTime recordedAt) {
        this.threatType = threatType;
        this.title = title;
        this.severityScore = severityScore;
        this.description = description;
        this.recommendedDrink = recommendedDrink;
        this.metadata = metadata;
        this.recordedAt = recordedAt;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getThreatType() { return threatType; }
    public void setThreatType(String threatType) { this.threatType = threatType; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Double getSeverityScore() { return severityScore; }
    public void setSeverityScore(Double severityScore) { this.severityScore = severityScore; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getRecommendedDrink() { return recommendedDrink; }
    public void setRecommendedDrink(String recommendedDrink) { this.recommendedDrink = recommendedDrink; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }
}