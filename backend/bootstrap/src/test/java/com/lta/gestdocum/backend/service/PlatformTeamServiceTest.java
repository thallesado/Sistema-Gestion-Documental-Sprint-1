package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformTeamDtos.*;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformTeamServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final PlatformMfaService mfa = mock(PlatformMfaService.class);
    private final AuthSessionService sessions = mock(AuthSessionService.class);
    private final UUID me = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private PlatformTeamService team;

    @BeforeEach
    void setUp() {
        when(audit.requirePlatformAccount()).thenReturn(new AuthenticatedUser(me, null, "root", Set.of("platform:tenant:manage", "platform:team:manage")));
        team = new PlatformTeamService(jdbc, audit, mock(PasswordEncoder.class), mfa, sessions);
    }

    private void member(UUID id, String role, String status) {
        when(jdbc.queryForList(contains("for update of u"), eq(id))).thenReturn(List.of(new HashMap<>(Map.of("id", id, "status", status, "role_code", role))));
    }

    @Test
    void nobodyChangesTheirOwnRoleOrDeactivatesThemselves() {
        assertThrows(IllegalStateException.class, () -> team.changeRole(me, new RoleChange("SUPPORT", "Reorganización del equipo")));
        assertThrows(IllegalStateException.class, () -> team.changeStatus(me, new StatusChange("INACTIVE", "Baja voluntaria")));
    }

    @Test
    void theLastActiveSuperadminCannotBeDemotedOrDeactivated() {
        member(other, "SUPERADMIN", "ACTIVE");
        when(jdbc.queryForObject(contains("role_code = 'SUPERADMIN'"), eq(Long.class), eq(other))).thenReturn(0L);
        assertThrows(IllegalStateException.class, () -> team.changeRole(other, new RoleChange("SUPPORT", "Reorganización del equipo")));
        assertThrows(IllegalStateException.class, () -> team.changeStatus(other, new StatusChange("INACTIVE", "Baja del equipo")));
        verify(audit, never()).record(anyString(), any(), anyString(), any(), any());
    }

    @Test
    void roleChangeClosesSessionsAndIsAudited() {
        member(other, "SUPPORT", "ACTIVE");
        team.changeRole(other, new RoleChange("FINANCE", "Pasa a Finanzas"));
        verify(sessions).revokeAll(other);
        verify(audit).record(eq("PLATFORM_USER_ROLE_CHANGED"), isNull(), eq("Pasa a Finanzas"), anyMap(), anyMap());
    }

    @Test
    void mfaResetRemovesTheSecretAndIsAudited() {
        member(other, "SUPPORT", "ACTIVE");
        team.resetMfa(other, "Teléfono perdido");
        verify(mfa).reset(other);
        verify(sessions).revokeAll(other);
        verify(audit).record(eq("PLATFORM_USER_MFA_RESET"), isNull(), eq("Teléfono perdido"), isNull(), anyMap());
    }

    @Test
    void financeApprovalThresholdComparesTheEquivalentPercent() {
        assertEquals(new BigDecimal("20"), PlatformDiscountService.effectivePercent(new BigDecimal("20"), null, new BigDecimal("49")));
        assertEquals(new BigDecimal("40.82"), PlatformDiscountService.effectivePercent(null, new BigDecimal("20"), new BigDecimal("49")));
        assertFalse(PlatformDiscountService.needsFinanceApproval(new BigDecimal("20"), new BigDecimal("20")));
        assertTrue(PlatformDiscountService.needsFinanceApproval(new BigDecimal("20.01"), new BigDecimal("20")));
    }
}
