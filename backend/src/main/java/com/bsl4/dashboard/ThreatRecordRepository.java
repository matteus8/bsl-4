package com.bsl4.dashboard.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ThreatRecordRepository extends JpaRepository<ThreatRecord, Long> {
    List<ThreatRecord> findTop100ByOrderByRecordedAtDesc();
    List<ThreatRecord> findTop20ByOrderByRecordedAtDesc();
    List<ThreatRecord> findBySeverityScoreGreaterThanEqualOrderBySeverityScoreDesc(Double minSeverity);
    List<ThreatRecord> findByThreatTypeOrderByRecordedAtDesc(String threatType);
}