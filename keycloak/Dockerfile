FROM docker.io/library/maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn --batch-mode --no-transfer-progress package

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=build /build/target/bitnp-default-avatar.jar /opt/keycloak/providers/bitnp-default-avatar.jar
