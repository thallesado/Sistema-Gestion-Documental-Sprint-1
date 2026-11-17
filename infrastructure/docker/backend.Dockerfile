# Build stage
FROM maven:3.9.8-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend /app
RUN --mount=type=cache,target=/root/.m2 mvn --batch-mode --no-transfer-progress clean package

# Run stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache postgresql17-client
COPY --from=build /app/bootstrap/target/*.jar app.jar
COPY database/init/ /app/migrations/init/
COPY database/tenant-bootstrap/ /app/migrations/tenant-bootstrap/
RUN sed -i 's/\r$//' /app/migrations/tenant-bootstrap/migrate-tenant.sh \
    && chmod +x /app/migrations/tenant-bootstrap/migrate-tenant.sh
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
