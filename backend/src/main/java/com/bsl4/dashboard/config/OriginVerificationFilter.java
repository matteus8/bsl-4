package com.bsl4.dashboard.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(1)
public class OriginVerificationFilter implements Filter {

    @Value("${origin.verify.secret:${ORIGIN_VERIFY_SECRET:}}")
    private String originVerifySecret;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Allow localhost / loopback calls (for internal AWS Lambda Web Adapter readiness check)
        String remoteAddr = httpRequest.getRemoteAddr();
        if ("127.0.0.1".equals(remoteAddr) || "0:0:0:0:0:0:0:1".equals(remoteAddr) || "localhost".equals(httpRequest.getServerName())) {
            chain.doFilter(request, response);
            return;
        }

        // If a secret is configured, enforce that incoming requests must match X-Origin-Verify header
        if (originVerifySecret != null && !originVerifySecret.trim().isEmpty()) {
            String incomingSecret = httpRequest.getHeader("X-Origin-Verify");
            if (incomingSecret == null || !originVerifySecret.equals(incomingSecret)) {
                httpResponse.setStatus(HttpServletResponse.SC_FORBIDDEN);
                httpResponse.setContentType("application/json");
                httpResponse.getWriter().write("{\"error\":\"Forbidden: Missing or invalid origin verification header\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
