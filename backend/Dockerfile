###
# Stage 1: Build the application using Maven and Java 21
###
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app

# Copy the Maven wrapper and project descriptor first (optimizes layer caching)
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY src src

# Run package to build the executable jar file
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

###
# Stage 2: Run the application with AWS Lambda Web Adapter
###
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install AWS Lambda Web Adapter (enables Spring Boot to run natively in Lambda)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Copy the compiled jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Configure port for Lambda Adapter
ENV PORT=8080
ENV AWS_LWA_READINESS_CHECK_PATH=/api/threats/latest
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]