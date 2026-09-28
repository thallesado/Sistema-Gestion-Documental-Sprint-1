package com.lta.gestdocum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.lta.gestdocum")
@EntityScan(basePackages = "com.lta.gestdocum")
@EnableJpaRepositories(basePackages = "com.lta.gestdocum")
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
