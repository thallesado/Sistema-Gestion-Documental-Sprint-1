package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.WorkflowRequests.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class WorkflowGraphValidatorTest {
    private Node node(String key,String type){return new Node(key,key,type,null,null,1,Map.of());}
    private Edge edge(String a,String b,String outcome){return new Edge(a,b,outcome,"");}
    private Template template(List<Node> nodes,List<Edge> edges){return new Template("Flujo","","Legal","ANY",true,nodes,edges);}
    @Test void acceptsSequentialReviewAndApproval(){assertDoesNotThrow(()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","REVIEW"),node("c","APPROVAL"),node("d","END")),List.of(edge("a","b","DEFAULT"),edge("b","c","DEFAULT"),edge("c","d","DEFAULT")))));}
    @Test void rejectsCycles(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","TASK"),node("c","REVIEW"),node("d","END")),List.of(edge("a","b","DEFAULT"),edge("b","c","DEFAULT"),edge("c","b","DEFAULT")))));}
    @Test void rejectsOrphanNode(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","TASK"),node("c","END")),List.of(edge("a","c","DEFAULT")))));}
    @Test void rejectsMultipleStarts(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","START"),node("c","END")),List.of(edge("a","c","DEFAULT"),edge("b","c","DEFAULT")))));}
    @Test void rejectsAmbiguousEdges(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","TASK"),node("c","END")),List.of(edge("a","b","DEFAULT"),edge("b","c","DEFAULT"),edge("b","c","DEFAULT")))));}
    @Test void acceptsDecisionWithTwoBranches(){assertDoesNotThrow(()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","DECISION"),node("c","END"),node("d","END")),List.of(edge("a","b","DEFAULT"),edge("b","c","YES"),edge("b","d","NO")))));}
    @Test void rejectsEndWithOutgoingEdge(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","END")),List.of(edge("a","b","DEFAULT"),edge("b","a","DEFAULT")))));}
    @Test void rejectsBranchThatCannotReachAnEnd(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","DECISION"),node("c","END"),node("d","TASK")),List.of(edge("a","b","DEFAULT"),edge("b","c","YES"),edge("b","d","NO"),edge("d","b","DEFAULT")))));}
    @Test void rejectsNodeWithoutDefaultTransition(){assertThrows(IllegalArgumentException.class,()->WorkflowGraphValidator.validate(template(List.of(node("a","START"),node("b","TASK"),node("c","END")),List.of(edge("a","b","DEFAULT")))));}
}
