.PHONY: set-up dirty-up down logs migrate seed studio

set-up:
	docker compose build
	docker compose up -d postgres redis
	@echo "Waiting for postgres/redis to be healthy..."
	docker compose up -d backend pgadmin queue-worker user-frontend admin-frontend

dirty-up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	cd ../gym-backend && npm run prisma:deploy

seed:
	cd ../gym-backend && npm run prisma:seed

studio:
	cd ../gym-backend && npm run prisma:studio
