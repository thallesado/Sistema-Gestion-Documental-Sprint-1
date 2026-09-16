package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.TagResponse;
import com.lta.gestdocum.backend.service.TagService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CatalogControllerMockMvcTest {

    @Mock
    private TagService tagService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TagController(tagService))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    @Test
    void listsTagsWithFilterAndPageable() throws Exception {
        when(tagService.find(eq("legal"), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(
                        List.of(TagResponse.builder().name("Legal").build()),
                        PageRequest.of(1, 5),
                        1));

        mockMvc.perform(get("/api/v1/tags")
                        .param("filter", "legal")
                        .param("page", "1")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].name").value("Legal"));

        verify(tagService).find(eq("legal"), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void exposesConfigurationReadPermissionOnTagList() throws NoSuchMethodException {
        PreAuthorize annotation = TagController.class
                .getDeclaredMethod("find", String.class, Pageable.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('configuration:read')", annotation.value());
    }
}
