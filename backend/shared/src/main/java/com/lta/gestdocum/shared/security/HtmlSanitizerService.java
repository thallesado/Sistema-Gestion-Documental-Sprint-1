package com.lta.gestdocum.backend.security;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;

@Service
public class HtmlSanitizerService {

    private static final Safelist CLINICAL_NOTE_SAFELIST = Safelist.none()
            .addTags("p", "br", "strong", "b", "em", "i", "u", "s", "strike",
                    "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "hr")
            .addAttributes("code", "class");

    /**
     * Sanitiza contenido HTML eliminando cualquier etiqueta o atributo malicioso (XSS, scripts, event handlers).
     */
    public String sanitize(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        return Jsoup.clean(html, CLINICAL_NOTE_SAFELIST);
    }
}
