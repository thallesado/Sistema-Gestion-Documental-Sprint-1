package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.WorkflowRequests.*;
import com.lta.gestdocum.backend.service.WorkflowEngineService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.*;

@RestController
@RequestMapping("/api/v1/workflows")
@PreAuthorize("isAuthenticated()")
public class WorkflowController {
    private final WorkflowEngineService service;
    public WorkflowController(WorkflowEngineService service){this.service=service;}
    @GetMapping public Map<String,Object> list(@RequestParam Map<String,String> filters){return service.list(filters);}
    @GetMapping("/options") public Map<String,Object> options(){return service.options();}
    @GetMapping("/summary") public Map<String,Object> summary(@RequestParam Map<String,String> filters){return service.summary(filters);}
    @GetMapping("/templates") public Map<String,Object> templates(@RequestParam Map<String,String> filters){return service.templates(filters);}
    @GetMapping("/templates/{id}") public Map<String,Object> template(@PathVariable UUID id){return service.template(id);}
    @PostMapping("/templates/seed") public Map<String,Object> seedTemplates(){return service.seedStarterTemplates();}
    @PostMapping("/templates/validate") public Map<String,Object> validate(@Valid @RequestBody Template request){return service.validateTemplate(request);}
    @PostMapping("/templates") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> createTemplate(@Valid @RequestBody Template request){return service.saveTemplate(null,request);}
    @PutMapping("/templates/{id}") public Map<String,Object> editTemplate(@PathVariable UUID id,@Valid @RequestBody Template request){return service.saveTemplate(id,request);}
    @DeleteMapping("/templates/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deactivate(@PathVariable UUID id){service.deactivate(id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> start(@Valid @RequestBody Start request){return service.start(request);}
    @PostMapping("/templates/{id}/instantiate") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> instantiate(@PathVariable UUID id,@Valid @RequestBody TemplateStart request){return service.instantiate(id,request);}
    @GetMapping("/tasks") public Map<String,Object> tasks(@RequestParam Map<String,String> filters){return service.tasks(filters);}
    @GetMapping("/tasks/my") public Map<String,Object> myTasks(@RequestParam Map<String,String> filters){return service.tasks(filters);}
    @GetMapping("/approvals/my") public Map<String,Object> myApprovals(@RequestParam Map<String,String> filters){return service.myApprovals(filters);}
    @GetMapping("/tasks/{id}") public Map<String,Object> task(@PathVariable UUID id){return service.task(id);}
    @PostMapping("/tasks/{id}/actions") public Map<String,Object> action(@PathVariable UUID id,@Valid @RequestBody Action request){return service.action(id,request);}
    @PostMapping("/tasks/{id}/comments") @ResponseStatus(HttpStatus.CREATED)
    public void comment(@PathVariable UUID id,@Valid @RequestBody Comment request){service.comment(id,request);}
    @PutMapping("/tasks/{id}/checklist") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void checklist(@PathVariable UUID id,@RequestBody Map<String,Boolean> results){service.checklist(id,results);}
    @GetMapping("/notifications") public Map<String,Object> notifications(@RequestParam Map<String,String> filters){return service.notifications(filters);}
    @PatchMapping("/notifications/{id}/read") @ResponseStatus(HttpStatus.NO_CONTENT) public void read(@PathVariable UUID id){service.readNotification(id);}
    @PatchMapping("/roles/{id}/hierarchy") @ResponseStatus(HttpStatus.NO_CONTENT) public void hierarchy(@PathVariable long id,@Valid @RequestBody Hierarchy request){service.hierarchy(id,request);}
    @GetMapping("/{id}") public Map<String,Object> detail(@PathVariable UUID id){return service.detail(id);}
    @GetMapping("/{id}/history") public Map<String,Object> history(@PathVariable UUID id){return service.history(id);}
    @GetMapping("/{id}/tasks") public Map<String,Object> workflowTasks(@PathVariable UUID id,@RequestParam Map<String,String> filters){return service.workflowTasks(id,filters);}
    @PutMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void edit(@PathVariable UUID id,@Valid @RequestBody Edit request){service.edit(id,request);}
    @PostMapping("/{id}/actions") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lifecycle(@PathVariable UUID id,@Valid @RequestBody Lifecycle request){service.lifecycle(id,request);}
}
