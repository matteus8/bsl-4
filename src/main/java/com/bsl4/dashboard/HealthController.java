package com.bsl4.dashboard;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/api/status")
    public String getStatus() {
        return "Doomsday Dashboard API is online and waiting for disasters.";
    }
}