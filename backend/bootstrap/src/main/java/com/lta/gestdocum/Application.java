package com.lta.gestdocum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.WebApplicationType;
import com.lta.gestdocum.worker.TenantLifecycleWorkerConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;
import java.util.Arrays;

@SpringBootApplication(scanBasePackages = "com.lta.gestdocum")
@EntityScan(basePackages = "com.lta.gestdocum")
@EnableJpaRepositories(basePackages = "com.lta.gestdocum")
@EnableScheduling
public class Application {

    public static void main(String[] args) {
        if (Arrays.asList(args).contains("--tenant-worker")) {
            String[] workerArgs = Arrays.stream(args).filter(arg -> !"--tenant-worker".equals(arg)).toArray(String[]::new);
            SpringApplication worker = new SpringApplication(TenantLifecycleWorkerConfiguration.class);
            worker.setWebApplicationType(WebApplicationType.NONE);
            worker.setAdditionalProfiles("tenant-worker");
            worker.run(workerArgs);
            return;
        }
        SpringApplication.run(Application.class, args);
    }
}
