package com.lta.gestdocum.backend.service;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class DocumentRetentionTest {
    final LocalDate today=LocalDate.of(2026,11,6);
    Map<String,Object> document(){return new HashMap<>(Map.of("is_active",true,"disposition_action","TRANSFER","retention_months",12,"status","CURRENT","workflow_active",false,"archive_level","MANAGEMENT","eligible_on",java.sql.Date.valueOf(today)));}
    @Test void exactDueDateAllowsTransfer(){assertDoesNotThrow(()->DocumentRetentionService.eligible(document(),"CENTRAL",today));}
    @Test void futureDueDateBlocksTransfer(){var d=document();d.put("eligible_on",today.plusDays(1));assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void inactivePolicyBlocksTransfer(){var d=document();d.put("is_active",false);assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void keepPolicyCannotTransfer(){var d=document();d.put("disposition_action","KEEP");assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void missingPolicyBlocksTransfer(){var d=document();d.remove("retention_months");assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void activeWorkflowBlocksTransfer(){var d=document();d.put("workflow_active",true);assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void draftsCannotTransfer(){var d=document();d.put("status","DRAFT");assertThrows(IllegalStateException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void cannotSkipCentral(){assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.eligible(document(),"HISTORICAL",today));}
    @Test void centralCanMoveOnlyToHistorical(){var d=document();d.put("archive_level","CENTRAL");assertDoesNotThrow(()->DocumentRetentionService.eligible(d,"HISTORICAL",today));assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.eligible(d,"MANAGEMENT",today));}
    @Test void historicalIsTerminalLevel(){var d=document();d.put("archive_level","HISTORICAL");assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.eligible(d,"CENTRAL",today));}
    @Test void transferPolicyCannotDelete(){assertThrows(IllegalStateException.class,()->DocumentRetentionService.disposable(document(),today));}
    @Test void disposalRequiresElapsedPeriod(){var d=document();d.put("disposition_action","DELETE");d.put("eligible_on",today.plusDays(1));assertThrows(IllegalStateException.class,()->DocumentRetentionService.disposable(d,today));}
    @Test void elapsedDeletePolicyAllowsLogicalDisposal(){var d=document();d.put("disposition_action","DELETE");assertDoesNotThrow(()->DocumentRetentionService.disposable(d,today));}
    @Test void indefiniteConservationIsPreserved(){assertDoesNotThrow(()->DocumentRetentionService.validatePolicy("Custodia",null,"KEEP",true));}
    @Test void missingPeriodWithoutIndefiniteFlagIsInvalid(){assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.validatePolicy("Custodia",null,"KEEP",false));}
    @Test void indefiniteConservationCannotTransfer(){assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.validatePolicy("Custodia",null,"TRANSFER",true));}
    @Test void excessivePeriodIsInvalid(){assertThrows(IllegalArgumentException.class,()->DocumentRetentionService.validatePolicy("Custodia",1201,"KEEP",false));}
}
