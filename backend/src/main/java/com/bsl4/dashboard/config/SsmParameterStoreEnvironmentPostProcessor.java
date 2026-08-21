package com.bsl4.dashboard.config;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.boot.SpringApplication;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;

import java.util.HashMap;
import java.util.Map;

public class SsmParameterStoreEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String SSM_PATH = "/bsl4/prod";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String regionStr = environment.getProperty("AWS_REGION", "us-east-1");
        
        try (SsmClient ssmClient = SsmClient.builder()
                .region(Region.of(regionStr))
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build()) {

            GetParametersByPathRequest request = GetParametersByPathRequest.builder()
                    .path(SSM_PATH)
                    .withDecryption(true)
                    .recursive(true)
                    .build();

            GetParametersByPathResponse response = ssmClient.getParametersByPath(request);
            Map<String, Object> ssmProperties = new HashMap<>();

            for (Parameter param : response.parameters()) {
                String paramName = param.name().replace(SSM_PATH + "/", "");
                String value = param.value();

                switch (paramName) {
                    case "SPRING_DATASOURCE_URL" -> ssmProperties.put("spring.datasource.url", value);
                    case "SPRING_DATASOURCE_USERNAME" -> ssmProperties.put("spring.datasource.username", value);
                    case "SPRING_DATASOURCE_PASSWORD" -> ssmProperties.put("spring.datasource.password", value);
                    case "NASA_API_KEY" -> ssmProperties.put("nasa.api.key", value);
                    case "WEATHERGOV_USERAGENT" -> ssmProperties.put("weathergov.useragent", value);
                    default -> ssmProperties.put(paramName.toLowerCase().replace('_', '.'), value);
                }
            }

            if (!ssmProperties.isEmpty()) {
                environment.getPropertySources().addFirst(new MapPropertySource("awsSsmParameterStoreProperties", ssmProperties));
                System.out.println(">>> [AWS SSM] Successfully loaded " + ssmProperties.size() + " decrypted secrets from Parameter Store path: " + SSM_PATH);
            }
        } catch (Exception e) {
            System.out.println(">>> [AWS SSM] Notice: Could not load parameters from SSM (" + e.getMessage() + "). Falling back to local environment.");
        }
    }
}
