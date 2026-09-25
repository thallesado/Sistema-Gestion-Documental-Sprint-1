FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline
COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home nexodocs
WORKDIR /app
COPY --from=build /workspace/target/backend-*.jar app.jar
RUN mkdir -p /data/storage && chown -R nexodocs:nogroup /app /data
USER nexodocs
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
