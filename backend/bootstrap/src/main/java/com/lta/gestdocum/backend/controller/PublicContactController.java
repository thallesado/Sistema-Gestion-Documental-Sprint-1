package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PublicContactRequest;
import com.lta.gestdocum.backend.dto.PublicContactResponse;
import com.lta.gestdocum.backend.service.PublicContactService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public")
public class PublicContactController {
    private final PublicContactService contact;

    public PublicContactController(PublicContactService contact) { this.contact = contact; }

    @PostMapping("/contact")
    public PublicContactResponse send(@Valid @RequestBody PublicContactRequest request) {
        return contact.send(request);
    }
}
