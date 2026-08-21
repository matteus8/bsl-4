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
RUN ./mvnw clean package -DskipTests

###
# Stage 2: Run the application in a lightweight container
###
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy only the compiled jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Expose the Spring Boot port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]