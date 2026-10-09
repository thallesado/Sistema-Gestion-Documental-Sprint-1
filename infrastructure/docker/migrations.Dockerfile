FROM postgres:17-alpine
WORKDIR /migrations
COPY database/init/ /migrations/init/
COPY infrastructure/docker/migrate.sh /migrations/migrate.sh
RUN chmod +x /migrations/migrate.sh
ENTRYPOINT ["/migrations/migrate.sh"]
