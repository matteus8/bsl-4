package com.bsl4.dashboard.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ThreatRecordRepository extends JpaRepository<ThreatRecord, Long> {
    List<ThreatRecord> findTop500ByOrderByRecordedAtDesc();
    List<ThreatRecord> findTop100ByOrderByRecordedAtDesc();
    List<ThreatRecord> findTop20ByOrderByRecordedAtDesc();
    List<ThreatRecord> findByRecordedAtAfterOrderByRecordedAtDesc(LocalDateTime after);
    List<ThreatRecord> findBySeverityScoreGreaterThanEqualOrderBySeverityScoreDesc(Double minSeverity);
    List<ThreatRecord> findByThreatTypeOrderByRecordedAtDesc(String threatType);

    @Query(value = """
        SELECT id, threat_type, title, severity_score, description, recommended_drink, metadata, recorded_at
        FROM threat_records
        WHERE threat_type IN ('EARTHQUAKE', 'TERRESTRIAL_WEATHER')
          AND recorded_at >= :afterDate
          AND (metadata LIKE '%latitude%' OR metadata LIKE '%lat%')
        ORDER BY (
          6371.0 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(:userLat)) * cos(radians(COALESCE(NULLIF(metadata::jsonb->>'latitude', '')::float, NULLIF(metadata::jsonb->>'lat', '')::float, 0.0))) *
              cos(radians(COALESCE(NULLIF(metadata::jsonb->>'longitude', '')::float, NULLIF(metadata::jsonb->>'lon', '')::float, 0.0)) - radians(:userLon)) +
              sin(radians(:userLat)) * sin(radians(COALESCE(NULLIF(metadata::jsonb->>'latitude', '')::float, NULLIF(metadata::jsonb->>'lat', '')::float, 0.0)))
            ))
          )
        ) ASC
        LIMIT :limit
        """, nativeQuery = true)
    List<ThreatRecord> findNearbyPhysicalThreats(
        @Param("userLat") double userLat,
        @Param("userLon") double userLon,
        @Param("afterDate") LocalDateTime afterDate,
        @Param("limit") int limit
    );

    @Query(value = """
        SELECT id, threat_type, title, severity_score, description, recommended_drink, metadata, recorded_at
        FROM threat_records
        WHERE threat_type IN ('SPACE_WEATHER', 'ASTEROID', 'STOCK_MARKET')
          AND recorded_at >= :afterDate
        ORDER BY recorded_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<ThreatRecord> findLatestGlobalThreats(
        @Param("afterDate") LocalDateTime afterDate,
        @Param("limit") int limit
    );
}