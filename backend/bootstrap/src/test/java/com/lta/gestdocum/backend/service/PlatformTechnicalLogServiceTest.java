package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class PlatformTechnicalLogServiceTest {
    @Test
    void listRunsUnderTheActorIdentityOnASingleTransactionalConnection() throws Exception {
        UUID actor = UUID.fromString("40000000-0000-0000-0000-000000000099");
        List<String> statements = new ArrayList<>();
        Connection connection = mock(Connection.class);
        when(connection.getAutoCommit()).thenReturn(true);
        DatabaseMetaData databaseMetaData = mock(DatabaseMetaData.class);
        when(databaseMetaData.getDriverName()).thenReturn("PostgreSQL JDBC Driver");
        when(connection.getMetaData()).thenReturn(databaseMetaData);
        when(connection.prepareStatement(anyString())).thenAnswer(invocation -> {
            statements.add(invocation.getArgument(0));
            PreparedStatement statement = mock(PreparedStatement.class);
            ResultSet rows = mock(ResultSet.class);
            ResultSetMetaData metadata = mock(ResultSetMetaData.class);
            when(metadata.getColumnCount()).thenReturn(1);
            when(metadata.getColumnLabel(1)).thenReturn("c");
            when(rows.getMetaData()).thenReturn(metadata);
            when(rows.next()).thenReturn(true, false);
            when(statement.getConnection()).thenReturn(connection);
            when(statement.executeQuery()).thenReturn(rows);
            when(statement.execute()).thenReturn(true);
            when(statement.getResultSet()).thenReturn(rows);
            return statement;
        });
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);
        @SuppressWarnings("unchecked")
        ObjectProvider<DataSource> control = mock(ObjectProvider.class);
        when(control.getIfAvailable(any())).thenReturn(dataSource);

        new PlatformTechnicalLogService(control, dataSource).list(actor, null, null, 0, 25);

        assertTrue(statements.get(0).contains("set_config('app.user_id'"),
                "the platform actor must be set before app.list_platform_technical_logs runs: " + statements);
        assertTrue(statements.stream().skip(1).allMatch(sql -> sql.contains("list_platform_technical_logs")));
        verify(connection, times(1)).getAutoCommit();
        verify(connection).commit();
        verify(connection, atLeastOnce()).setAutoCommit(true);
    }

    @Test
    void requestPathDropsQueriesAndRedactsIdentifiers() {
        assertEquals("/api/v1/patients/:id/notes/:id", PlatformTechnicalLogService.sanitizePath(
                "/api/v1/patients/70000000-0000-0000-0000-000000000001/notes/42?name=private#fragment"));
    }

    @Test
    void requestPathKeepsStaticRoutesAndBoundsLength() {
        assertEquals("/api/v1/documents", PlatformTechnicalLogService.sanitizePath("/api/v1/documents"));
        assertEquals(200, PlatformTechnicalLogService.sanitizePath("/" + "x".repeat(240)).length());
        assertNull(PlatformTechnicalLogService.sanitizePath(null));
    }
}
