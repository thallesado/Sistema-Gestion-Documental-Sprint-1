package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.WorkflowRequests.*;
import java.util.*;

public final class WorkflowGraphValidator {
    private WorkflowGraphValidator() {}
    public static void validate(Template template) {
        Set<String> types=Set.of("START","TASK","REVIEW","APPROVAL","DECISION","NOTIFICATION","ARCHIVE","END");
        Map<String,Node> nodes=new LinkedHashMap<>();
        for(Node node:template.nodes()) {
            if(!types.contains(node.type()) || nodes.put(node.key(),node)!=null)
                throw new IllegalArgumentException("Tipo o clave de nodo inválidos");
            if(node.rules()!=null && node.rules().get("minApprovals")!=null
                    && Integer.parseInt(node.rules().get("minApprovals").toString())!=1)
                throw new IllegalArgumentException("Esta versión admite un aprobador por etapa");
        }
        List<Node> starts=nodes.values().stream().filter(n->n.type().equals("START")).toList();
        if(starts.size()!=1 || nodes.values().stream().noneMatch(n->n.type().equals("END")))
            throw new IllegalArgumentException("Se requiere exactamente un Inicio y al menos un Fin");
        Map<String,List<String>> paths=new HashMap<>();
        Set<String> signatures=new HashSet<>();
        for(Edge edge:template.edges()) {
            Node from=nodes.get(edge.from()), to=nodes.get(edge.to());
            if(from==null || to==null || from.type().equals("END") || to.type().equals("START") || edge.from().equals(edge.to()))
                throw new IllegalArgumentException("Conexión inválida");
            String outcome=edge.outcome()==null?"DEFAULT":edge.outcome();
            if(!Set.of("DEFAULT","APPROVED","REJECTED","YES","NO","COMPLETED","CHANGES_REQUESTED").contains(outcome)
                    || !signatures.add(edge.from()+":"+outcome))
                throw new IllegalArgumentException("Salida duplicada o condición inválida");
            paths.computeIfAbsent(edge.from(),k->new ArrayList<>()).add(edge.to());
        }
        Set<String> visited=new HashSet<>(), stack=new HashSet<>();
        visit(starts.get(0).key(),paths,visited,stack);
        if(visited.size()!=nodes.size()) throw new IllegalArgumentException("Hay nodos desconectados");
        Set<String> reachesEnd=new HashSet<>();
        for(Node node:nodes.values())if(node.type().equals("END"))reachesEnd.add(node.key());
        boolean changed;
        do {
            changed=false;
            for(Node node:nodes.values())if(!reachesEnd.contains(node.key())
                    && paths.getOrDefault(node.key(),List.of()).stream().anyMatch(reachesEnd::contains))
                changed|=reachesEnd.add(node.key());
        } while(changed);
        if(!reachesEnd.contains(starts.get(0).key()))
            throw new IllegalArgumentException("Todos los caminos desde Inicio deben llegar a Fin");
        for(Node node:nodes.values()) {
            if(!node.type().equals("END") && !paths.containsKey(node.key()))
                throw new IllegalArgumentException("Todos los caminos deben llegar a Fin");
            if(node.type().equals("DECISION") && !(signatures.contains(node.key()+":YES") && signatures.contains(node.key()+":NO")))
                throw new IllegalArgumentException("Una decisión necesita salidas Sí y No");
            if(!node.type().equals("DECISION") && !node.type().equals("END") && !signatures.contains(node.key()+":DEFAULT"))
                throw new IllegalArgumentException("Cada etapa necesita una salida por defecto");
        }
    }
    private static void visit(String node,Map<String,List<String>> paths,Set<String> visited,Set<String> stack) {
        if(stack.contains(node)) throw new IllegalArgumentException("Los ciclos no están permitidos; usa la acción de devolución");
        if(visited.contains(node)) return;
        stack.add(node);
        for(String next:paths.getOrDefault(node,List.of())) visit(next,paths,visited,stack);
        stack.remove(node); visited.add(node);
    }
}
