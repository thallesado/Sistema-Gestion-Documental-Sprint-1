import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(frontend, file), 'utf8');
const [page, html, css, tasksCss, activeCss, finishedCss, templatesCss, start, api, designer, documentPage, engine] = await Promise.all([
  read('src/app/features/workflows/workflows-page.ts'),
  read('src/app/features/workflows/workflows-page.html'),
  read('src/app/features/workflows/workflows-page.css'),
  read('src/app/features/workflows/workflows-tasks.css'),
  read('src/app/features/workflows/workflows-active.css'),
  read('src/app/features/workflows/workflows-finished.css'),
  read('src/app/features/workflows/workflows-templates.css'),
  read('src/app/features/workflows/components/workflow-start.ts'),
  read('src/app/features/workflows/workflow-api.service.ts'),
  read('src/app/features/workflows/components/workflow-designer.ts'),
  read('src/app/features/documentos/pages/documentos-page.ts'),
  read('../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java'),
]);

test('workflow lists use API pagination and keep page/filter state in the URL', () => {
  assert.match(page, /api\.page\(resource,this\.params\(\)\)/);
  assert.match(page, /page:this\.page-1,size:this\.size/);
  assert.match(page, /restoreFiltersFromUrl/);
  assert.match(page, /queryParamsHandling:'merge'/);
  assert.match(page, /changePage\(page:number\):void\{this\.page=page;this\.syncFiltersToUrl\(\)/);
});

test('search is debounced in the list and origin/template lookups', () => {
  assert.match(page, /searchInput\.pipe\(debounceTime\(300\)/);
  assert.match(start, /originSearchInput\.pipe\(debounceTime\(300\)/);
  assert.match(start, /templateSearchInput\.pipe\(debounceTime\(300\)/);
});

test('loading, empty, error and confirmation states are accessible in-app UI', () => {
  assert.match(html, /wf-skeleton/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /No tienes tareas en esta selección/);
  assert.doesNotMatch(page + '\n' + html + '\n' + start, /\b(?:alert|prompt|confirm)\s*\(/);
});

test('actions remain permission-aware and history can be exported using shared PDF support', () => {
  assert.match(html, /can_approve/);
  assert.match(html, /workflow:reject/);
  assert.match(html, /Exportar historial PDF/);
  assert.match(page, /exportToPrintView/);
});

test('workflow screen retains responsive layouts and reduced-motion support', () => {
  assert.match(css, /@media/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /wf-kanban/);
  assert.match(css, /data-label/);
});

test('workflow detail exposes real participants, comments, and immutable timeline data', () => {
  assert.match(html, /Participantes/);
  assert.match(html, /flowTab==='Comentarios'/);
  assert.match(html, /flowTab==='Historial'/);
  assert.match(engine, /flow\.put\("participants"/);
  assert.match(engine, /flow\.put\("comments"/);
});

test('my tasks uses a real-data two-pane workbench and automatically selects a task', () => {
  assert.match(html, /wf-my-tasks/);
  assert.match(html, /wf-my-task-preview/);
  assert.match(html, /wf-my-task-info/);
  assert.match(html, /wf-my-task-comments/);
  assert.match(page, /p\.content\.find\(\(task:any\)=>task\.id===requested\)\|\|p\.content\[0\]/);
  assert.match(tasksCss, /grid-template-areas:"crumb crumb" "heading heading" "tools detail" "list detail"/);
  assert.match(tasksCss, /@media\(max-width:600px\)/);
});

test('pending review reuses the real task API and exposes preview, metadata, checklist, comments, history, and review actions', () => {
  assert.match(html, /wf-review-hero/);
  assert.match(html, /class\.wf-my-tasks\]="mode==='tasks'\|\|mode==='review'/);
  assert.match(page, /mode==='review'\?\['Vista previa','Datos del documento','Checklist','Comentarios','Historial'\]/);
  assert.match(html, /app-workflow-preview \[documentId\]="task\.document_id"/);
  assert.match(html, /\(ngModelChange\)="saveChecklist\(\)"/);
  assert.match(html, /\(click\)="addComment\(\)"/);
  assert.match(html, /ngTemplateOutlet\]="taskActions"/);
  assert.match(page, /\['tasks','review','approval'\]\.includes\(this\.mode\)/);
  assert.match(page, /checklistProgress\(\):string/);
});

test('pending approval uses a three-pane workbench with real task metadata and keeps server authorization checks', () => {
  assert.match(html, /wf-approval-hero/);
  assert.match(html, /wf-approval-metrics/);
  assert.match(html, /wf-approval-evidence/);
  assert.match(html, /task\.approvals\?\.length/);
  assert.match(html, /task\.requester_name/);
  assert.match(html, /wf-approval-panel/);
  assert.match(html, /selected\(\)\.can_approve/);
  assert.match(html, /selected\(\)\.stage_type==='APPROVAL'.*selected\(\)\.can_approve/);
  assert.match(page, /\['REJECT','RETURN','ESCALATE','CANCEL'\]\.includes\(action\)/);
  assert.match(page, /\['tasks','review','approval'\]\.includes\(this\.mode\)/);
  assert.match(page, /approvalHighPriorityCount\(\):number/);
});

test('active workflows has the reference hero, working filters and status lanes using real progress and assignees', () => {
  assert.match(html, /wf-active-hero/);
  assert.match(html, /wf-active-toolbar/);
  assert.match(html, /\[\(ngModel\)\]="filters\['responsibleId'\]"/);
  assert.match(html, /\[\(ngModel\)\]="filters\['priority'\]"/);
  assert.match(html, /laneItems\(laneDef\.key\)/);
  assert.match(html, /item\.responsible_name\|\|'Sin responsable'/);
  assert.match(html, /progress\(item\)/);
  assert.match(page, /if\(item\.status==='DRAFT'\)return'preparation'/);
  assert.match(page, /key:'active',label:'En curso'/);
  assert.match(activeCss, /wf-active-kanban/);
  assert.match(activeCss, /@media\(max-width:760px\)/);
});

test('completed workflows uses a real-data table and persistent detail pane with functional tabs and date filtering', () => {
  assert.match(html, /wf-finished-hero/);
  assert.match(html, /wf-finished-detail/);
  assert.match(html, /flowTab==='Historial'/);
  assert.match(html, /flowTab==='Comentarios'/);
  assert.match(html, /app-workflow-preview \[documentId\]="f\.document_id"/);
  assert.match(html, /item\.final_approver_name/);
  assert.match(html, /item\.duration_hours/);
  assert.match(page, /if\(this\.mode==='completed'&&\(!this\.flow\(\)/);
  assert.match(page, /setCompletedPeriod\(period:string/);
  assert.match(page, /completedFrom/);
  assert.match(html, /Iniciado desde/);
  assert.match(html, /Iniciado hasta/);
  assert.match(html, /Finalizado desde/);
  assert.match(html, /Finalizado hasta/);
  assert.match(page, /elapsedDuration\(flow:any\)/);
  assert.match(engine, /key\.startsWith\("completed"\)\?"w\.completed_at"/);
  assert.match(finishedCss, /grid-template-areas:"heading detail"/);
  assert.match(finishedCss, /@media\(max-width:760px\)/);
});

test('workflow templates match the catalog reference while keeping real counts, permissions and template actions', () => {
  assert.match(html, /wf-template-hero/);
  assert.match(html, /wf-template-banner-art/);
  assert.match(html, /Nueva plantilla/);
  assert.match(html, /wf-template-categories/);
  assert.match(html, /item\.steps\|\|0/);
  assert.match(html, /item\.roles\|\|0/);
  assert.match(html, /item\.estimated_days\|\|0/);
  assert.match(html, /start\(item\.id\)/);
  assert.match(html, /queryParams\]="\{template:item\.id\}"/);
  assert.match(html, /queryParams\]="\{template:item\.id,clone:true\}"/);
  assert.match(html, /history\(item\)/);
  assert.match(templatesCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(templatesCss, /@media\(max-width:760px\)/);
  assert.match(engine, /case "title"->"t\.name";case "updated_at"->"t\.updated_at";default->"t\.created_at"/);
});

test('template publication and correction versions are enforced in the workflow UI', () => {
  assert.match(designer, /publicationStatus/);
  assert.match(designer, /DRAFT/);
  assert.match(html, /cargar la versión corregida/);
  assert.match(documentPage, /getById\(linkedDocumentId\)/);
});

test('workflow designer provides a visual graph, editable properties, preview, and real save/start actions', () => {
  assert.match(designer, /wf-designer-header/);
  assert.match(designer, /wf-palette-icon/);
  assert.match(designer, /edgePath\(edge\)/);
  assert.match(designer, /createStarterGraph/);
  assert.match(designer, /togglePreview/);
  assert.match(designer, /saveAndStart/);
  assert.match(designer, /startWorkflow\.emit\(t\.id\)/);
  assert.match(html, /\(startWorkflow\)="start\(\$event\)"/);
});

test('workflow API exposes typed domain contracts and preserves the shared API client', () => {
  for (const name of ['Workflow', 'WorkflowTask', 'WorkflowStep', 'WorkflowTransition', 'WorkflowTemplate', 'WorkflowTemplateNode', 'WorkflowApproval', 'WorkflowComment']) {
    assert.match(api, new RegExp('interface ' + name + '\\b|type ' + name + '\\s*='));
  }
  assert.match(api, /providedIn:\s*'root'/);
});
