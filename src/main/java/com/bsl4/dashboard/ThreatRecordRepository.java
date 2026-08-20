package com.bsl4.dashboard.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ThreatRecordRepository extends JpaRepository<ThreatRecord, Long> {
}