.PHONY: up down build logs backend-test frontend-test mobile-test clean

up:
	docker compose -f infrastructure/docker-compose.yml up -d

down:
	docker compose -f infrastructure/docker-compose.yml down

build:
	docker compose -f infrastructure/docker-compose.yml build

logs:
	docker compose -f infrastructure/docker-compose.yml logs -f

backend-test:
	cd backend && ./mvnw clean test

frontend-test:
	cd frontend && pnpm test -- --watch=false

mobile-test:
	cd mobile && flutter test

clean:
	docker compose -f infrastructure/docker-compose.yml down -v
