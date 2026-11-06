FROM postgres:17-alpine
WORKDIR /migrations
COPY database/init/ /migrations/init/
COPY database/tenant-bootstrap/ /migrations/tenant-bootstrap/
COPY infrastructure/docker/migrate.sh /migrations/migrate.sh
RUN sed -i 's/\r$//' /migrations/migrate.sh /migrations/tenant-bootstrap/migrate-tenant.sh \
    && chmod +x /migrations/migrate.sh /migrations/tenant-bootstrap/migrate-tenant.sh
ENTRYPOINT ["/migrations/migrate.sh"]
