param([string]$BaseUrl='http://localhost:4200')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
function Request-Api($Client,[string]$Method,[string]$Path,$Body=$null,[int]$Expected=200) {
    $request=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method),$BaseUrl+'/api/v1/'+$Path)
    if($null -ne $Body){$request.Content=[System.Net.Http.StringContent]::new(($Body|ConvertTo-Json -Depth 30 -Compress),[System.Text.Encoding]::UTF8,'application/json')}
    $reply=$Client.SendAsync($request).GetAwaiter().GetResult()
    $text=$reply.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if([int]$reply.StatusCode -ne $Expected){throw "$Method $Path expected $Expected, got $([int]$reply.StatusCode): $text"}
    Write-Host "PASS $Method $Path HTTP $Expected"
    if($text){return ($text|ConvertFrom-Json)}
}
function Session([string]$Email,[string]$Tenant) {
    $client=[System.Net.Http.HttpClient]::new()
    $auth=Request-Api $client POST 'auth/login' @{tenantId=$Tenant;usernameOrEmail=$Email;password='DemoPass123!'}
    $client.DefaultRequestHeaders.Authorization=[System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$auth.token)
    return $client
}
function Upload-Version($Client,[string]$DocumentId,[byte[]]$PdfBytes) {
    $form=[System.Net.Http.MultipartFormDataContent]::new()
    $file=[System.Net.Http.ByteArrayContent]::new($PdfBytes)
    $file.Headers.ContentType=[System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/pdf')
    $form.Add($file,'file','workflow-test.pdf');$form.Add([System.Net.Http.StringContent]::new('Version de prueba'),'changeReason')
    $reply=$Client.PostAsync($BaseUrl+"/api/v1/documents/$DocumentId/versions",$form).GetAwaiter().GetResult()
    if([int]$reply.StatusCode -ne 201){throw $reply.Content.ReadAsStringAsync().GetAwaiter().GetResult()}
    return ($reply.Content.ReadAsStringAsync().GetAwaiter().GetResult()|ConvertFrom-Json)
}
$tenant='20000000-0000-0000-0000-000000000001'
$owner=Session 'andres.superadmin@acme.example.invalid' $tenant
$admin=Session 'laura@acme.com' $tenant
$operator=Session 'ana@acme.com' $tenant
$other=Session 'sofia.torres@clinicacentral.test' '20000000-0000-0000-0000-000000000002'
$clinicAdmin=Session 'maria@clinicacentral.test' '20000000-0000-0000-0000-000000000002'
$options=Request-Api $owner GET 'workflows/options'
$seeded=Request-Api $owner POST 'workflows/templates/seed' @{}
$seedRepeat=Request-Api $owner POST 'workflows/templates/seed' @{}
if($seeded.count -gt 5 -or $seedRepeat.count -ne 0){throw 'Starter template seeding is not idempotent or tenant scoped'}
$clinicalModel=@{name="Flujo clinico $([guid]::NewGuid().ToString().Substring(0,8))";description='Debe requerir origen clinico';category=('Cl'+[char]0x00ed+'nico');originType='ANY';active=$true;nodes=@(
    @{key='start';name='Inicio';type='START';rules=@{}},@{key='review';name='Revisión clínica';type='REVIEW';rules=@{}},@{key='end';name='Fin';type='END';rules=@{}}
);edges=@(@{from='start';to='review';outcome='DEFAULT'},@{from='review';to='end';outcome='DEFAULT'})}
$null=Request-Api $owner POST 'workflows/templates' $clinicalModel 403
$clinicalTemplate=Request-Api $clinicAdmin POST 'workflows/templates' $clinicalModel 201
$null=Request-Api $clinicAdmin POST 'workflows' @{templateId=$clinicalTemplate.id;title='Origen clínico obligatorio';priority=3} 400
$ownerUser=$options.users|Where-Object owner|Select-Object -First 1
$laura=$options.users|Where-Object name -Match 'Laura'|Select-Object -First 1
$ownerIdentity=Request-Api $owner GET 'auth/me'
$ownerId=$ownerIdentity.id
$suffix=[guid]::NewGuid().ToString().Substring(0,8)
$model=@{name="Prueba motor $suffix";description='Prueba integrada del motor';category='Pruebas';originType='INDEPENDENT';active=$true;nodes=@(
    @{key='start';name='Inicio';type='START';rules=@{}},
    @{key='review';name='Revision';type='REVIEW';dueDays=2;rules=@{checklist=@('Datos completos')}},
    @{key='approve';name='Aprobacion';type='APPROVAL';dueDays=2;rules=@{}},
    @{key='end';name='Fin';type='END';rules=@{}}
);edges=@(@{from='start';to='review';outcome='DEFAULT'},@{from='review';to='approve';outcome='DEFAULT'},@{from='approve';to='end';outcome='DEFAULT'});documentStatusRules=@{ON_START='UNCHANGED';ON_REVIEW='IN_REVIEW';ON_APPROVE='APPROVED';ON_REJECT='REJECTED';ON_RETURN='DRAFT';ON_ARCHIVE='ARCHIVED'}}
$draftModel=$model.Clone();$draftModel.name="Borrador $suffix";$draftModel.active=$false;$draftModel.publicationStatus='DRAFT'
$draftTemplate=Request-Api $owner POST 'workflows/templates' $draftModel 201
if($draftTemplate.publication_status -ne 'DRAFT' -or $draftTemplate.is_active){throw 'A draft template must not be available for workflow starts'}
$null=Request-Api $admin POST 'workflows' @{templateId=$draftTemplate.id;title="Intento borrador $suffix";priority=3} 404
$draftModel.publicationStatus='ACTIVE';$draftModel.active=$true
$publishedDraft=Request-Api $owner PUT "workflows/templates/$($draftTemplate.id)" $draftModel 200
if($publishedDraft.publication_status -ne 'ACTIVE' -or -not $publishedDraft.is_active){throw 'Draft publishing did not activate a new template version'}
$template=Request-Api $owner POST 'workflows/templates' $model 201
$templatePage=Request-Api $owner GET 'workflows/templates'
$templateHistory=Request-Api $owner GET "workflows/templates?familyId=$($template.family_id)&size=10"
$templateCard=$templatePage.content|Where-Object id -EQ $template.id|Select-Object -First 1
if($null -eq $templateCard.steps -or $null -eq $templateCard.roles -or $null -eq $templateCard.estimated_days){throw 'Template card metrics are incomplete'}
if(-not $templatePage.PSObject.Properties['first'] -or -not $templatePage.PSObject.Properties['last']){throw 'Page navigation flags are missing'}
$null=Request-Api $admin GET 'workflows/summary'
$adminIdentity=Request-Api $admin GET 'auth/me'
$null=Request-Api $admin GET 'workflows'
$flow=Request-Api $admin POST 'workflows' @{templateId=$template.id;title="Circuito revisión $suffix";priority=3;assignments=@{review=$laura.id;approve=$ownerId}} 201
if($flow.code -notmatch '^WF-\d{4}-\d{6,}$'){throw 'Workflow display code is not tenant-readable and unique-format'}
$flowHistory=Request-Api $admin GET "workflows/$($flow.id)/history"
$nestedTasks=Request-Api $admin GET "workflows/$($flow.id)/tasks?size=10"
$myTasks=Request-Api $admin GET 'workflows/tasks/my?size=10'
if(-not $flowHistory.content.Count -or -not $nestedTasks.content.Count){throw 'Nested workflow history/task endpoints did not return data'}
if($flow.code -notmatch '^WF-\d{4}-\d{6,}$'){throw "Workflow display code is not readable: $($flow.code)"}
$review=$flow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$reviewDetail=Request-Api $admin GET "workflows/tasks/$($review.id)"
if(-not $reviewDetail.checklist_items -or $reviewDetail.checklist_items[0].label -ne 'Datos completos'){throw 'Normalized checklist item was not created'}
$null=Request-Api $admin POST "workflows/tasks/$($review.id)/actions" @{action='REVIEW';checklist=@{}} 400
$null=Request-Api $admin PUT "workflows/tasks/$($review.id)/checklist" @{'Datos completos'=$true} 204
$reviewDetail=Request-Api $admin GET "workflows/tasks/$($review.id)"
if(-not $reviewDetail.checklist_items[0].completed -or $reviewDetail.checklist_items[0].completed_by -ne $adminIdentity.id){throw 'Checklist completion actor was not persisted'}
$null=Request-Api $admin POST "workflows/tasks/$($review.id)/comments" @{comment='Verificado con datos reales'} 201
$flowDetail=Request-Api $admin GET "workflows/$($flow.id)"
if($flowDetail.comments.Count -lt 1 -or $flowDetail.participants.Count -lt 2){throw 'Workflow detail omitted its comments or participants'}
$null=Request-Api $admin POST "workflows/tasks/$($review.id)/actions" @{action='REVIEW';checklist=@{'Datos completos'=$true}}
$updated=Request-Api $owner GET "workflows/$($flow.id)"
$approval=$updated.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $operator POST "workflows/tasks/$($approval.id)/actions" @{action='APPROVE'} 403
$crossTenant=Request-Api $other GET "workflows/$($flow.id)" $null 404
if($crossTenant.code -ne 'WORKFLOW_NOT_FOUND'){throw 'Cross-tenant workflow access did not return the stable not-found code'}
$null=Request-Api $owner POST "workflows/tasks/$($approval.id)/actions" @{action='RETURN';comment='Corregir';targetUserId=$laura.id}
$returned=Request-Api $admin GET "workflows/$($flow.id)"
$correction=$returned.tasks|Where-Object {$_.status -EQ 'PENDING' -and $_.correction}|Select-Object -First 1
$null=Request-Api $admin POST "workflows/tasks/$($correction.id)/actions" @{action='COMPLETE';comment='Corregido'}
$updated=Request-Api $owner GET "workflows/$($flow.id)"
$approval=$updated.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $owner POST "workflows/tasks/$($approval.id)/actions" @{action='APPROVE';comment='Conforme'}
$duplicateDecision=Request-Api $owner POST "workflows/tasks/$($approval.id)/actions" @{action='APPROVE'} 409
if($duplicateDecision.code -ne 'TASK_ALREADY_COMPLETED'){throw 'Duplicate approval did not return TASK_ALREADY_COMPLETED'}
$finished=Request-Api $owner GET "workflows/$($flow.id)"
$ownerApprovalHistory=Request-Api $owner GET 'workflows/approvals/my?size=10'
if($finished.status -ne 'COMPLETED'){throw 'Workflow did not finish'}
if(-not $finished.stepInstances -or ($finished.stepInstances|Where-Object status -EQ 'ACTIVE')){throw 'Workflow step instances were not finalized'}
$approvedDecisions=@($finished.approvals|Where-Object {$_.decision -eq 'APPROVED'})
$startedSteps=@($finished.events|Where-Object {$_.event_type -eq 'STEP_STARTED'})
$completedSteps=@($finished.events|Where-Object {$_.event_type -eq 'STEP_COMPLETED'})
if($approvedDecisions.Count -ne 1){throw 'Approval decision was not persisted'}
if($startedSteps.Count -lt 1 -or $completedSteps.Count -lt 1){throw 'Workflow step audit events are incomplete'}
$completedPage=Request-Api $owner GET 'workflows?bucket=completed&size=10&sort=completed_at&direction=desc'
$completedRow=$completedPage.content|Where-Object id -EQ $flow.id|Select-Object -First 1
if(-not $completedRow -or $null -eq $completedRow.duration_hours -or -not $completedRow.final_approver_name){throw 'Completed workflow projection is incomplete'}
$expectedHours=([DateTimeOffset]::Parse($finished.completed_at)-[DateTimeOffset]::Parse($finished.started_at)).TotalHours
if([Math]::Abs([double]$completedRow.duration_hours-$expectedHours) -gt 0.11){throw 'Stored workflow duration does not match its actual start and completion timestamps'}
$startedDate=([DateTimeOffset]::Parse($finished.started_at)).ToString('yyyy-MM-dd')
$completedDate=([DateTimeOffset]::Parse($finished.completed_at)).ToString('yyyy-MM-dd')
$dateRange="startedFrom=$startedDate&startedTo=$startedDate&completedFrom=$completedDate&completedTo=$completedDate"
$dateFilteredPage=Request-Api $owner GET "workflows?bucket=completed&size=100&$dateRange"
if(-not ($dateFilteredPage.content|Where-Object id -EQ $flow.id)){throw 'Completed workflow did not match its start/completion date range'}
$dateFilteredSummary=Request-Api $owner GET "workflows/summary?$dateRange"
if($null -eq $dateFilteredSummary.completed.average_hours){throw 'Date-filtered workflow duration metric is missing'}
$emptyDateRange=Request-Api $owner GET 'workflows?bucket=completed&startedFrom=2100-01-01&startedTo=2100-12-31&completedFrom=2100-01-01&completedTo=2100-12-31'
if($emptyDateRange.totalElements -ne 0){throw 'Completed workflow date filters returned records outside the range'}
$operationalPage=Request-Api $owner GET 'workflows?bucket=operational&size=10'
if($operationalPage.content|Where-Object {$_.status -in @('COMPLETED','CANCELED')}){throw 'Operational Kanban contains terminal workflows'}
$workflowSummary=Request-Api $owner GET 'workflows/summary'
if($null -eq $workflowSummary.completed.this_month -or $null -eq $workflowSummary.completed.average_hours -or $null -eq $workflowSummary.completed.approved_without_changes){throw 'Completed indicators are incomplete'}
$null=Request-Api $owner GET 'workflows/notifications'
$null=Request-Api $owner POST 'workflows' @{templateId=$template.id;title='Autoaprobación prohibida';priority=3;assignments=@{review=$laura.id;approve=$laura.id}} 400
$secondVersion=Request-Api $owner PUT "workflows/templates/$($template.id)" $model
if($secondVersion.version -ne 2){throw 'Template version was not incremented'}
$old=Request-Api $owner GET "workflows/$($flow.id)"
if($old.workflow_template_id -ne $template.id){throw 'Existing workflow template changed'}
$template=$secondVersion
$ownFlow=Request-Api $owner POST "workflows/templates/$($secondVersion.id)/instantiate" @{title="Excepcion del propietario $suffix";priority=2;assignments=@{review=$ownerId;approve=$ownerId}} 201
$ownReview=$ownFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $owner POST "workflows/tasks/$($ownReview.id)/actions" @{action='ESCALATE';comment='Delegar revision';targetUserId=$laura.id}
$null=Request-Api $owner POST "workflows/$($ownFlow.id)/actions" @{action='PAUSE'} 204
$null=Request-Api $admin POST "workflows/tasks/$($ownReview.id)/actions" @{action='REVIEW';checklist=@{'Datos completos'=$true}} 409
$null=Request-Api $owner POST "workflows/$($ownFlow.id)/actions" @{action='RESUME'} 204
$null=Request-Api $admin POST "workflows/tasks/$($ownReview.id)/actions" @{action='REVIEW';checklist=@{'Datos completos'=$true}}
$ownFlow=Request-Api $owner GET "workflows/$($ownFlow.id)"
$ownApproval=$ownFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $owner POST "workflows/tasks/$($ownApproval.id)/actions" @{action='APPROVE'}
$rejectFlow=Request-Api $admin POST 'workflows' @{templateId=$template.id;title="Rechazo justificado $suffix";priority=1;assignments=@{review=$laura.id;approve=$ownerId}} 201
$rejectTask=$rejectFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $admin POST "workflows/tasks/$($rejectTask.id)/actions" @{action='REJECT'} 400
$null=Request-Api $admin POST "workflows/tasks/$($rejectTask.id)/actions" @{action='REJECT';comment='No cumple requisitos'}
$rejected=Request-Api $admin GET "workflows/$($rejectFlow.id)"
if($rejected.status -ne 'CANCELED' -or $rejected.tasks[0].status -ne 'REJECTED'){throw 'Rejection did not preserve separate statuses'}
foreach($size in @(5,10,25,50,100)){
    $page=Request-Api $owner GET "workflows?size=$size&page=0&sort=progress&direction=asc"
    if($page.size -ne $size -or $page.content.Count -gt $size){throw 'Pagination is incorrect'}
}
$types=Request-Api $admin GET 'document-types?size=5'
$doc=Request-Api $admin POST 'documents' @{documentTypeId=$types.content[0].id;code="WF-TEST-$suffix";name="Documento workflow $suffix";metadata=@{}} 201
$pdfBase64=node -e "const {jsPDF}=require('./frontend/node_modules/jspdf');const p=new jsPDF();p.text('Workflow verification',10,10);process.stdout.write(Buffer.from(p.output('arraybuffer')).toString('base64'));"
$pdf=[Convert]::FromBase64String($pdfBase64)
$version=Upload-Version $admin $doc.id $pdf
$documentModel=$model.Clone();$documentModel.name="Documento prueba $suffix";$documentModel.originType='DOCUMENT';$documentModel.documentStatusRules=@{ON_START='UNCHANGED';ON_REVIEW='CURRENT';ON_APPROVE='APPROVED';ON_REJECT='REJECTED';ON_RETURN='DRAFT';ON_ARCHIVE='ARCHIVED';ON_COMPLETE='CURRENT'}
$documentTemplate=Request-Api $owner POST 'workflows/templates' $documentModel 201
$documentFlow=Request-Api $admin POST 'workflows' @{templateId=$documentTemplate.id;title="Workflow documental $suffix";documentId=$doc.id;priority=2;assignments=@{review=$laura.id;approve=$ownerId}} 201
$null=Request-Api $admin POST 'workflows' @{templateId=$documentTemplate.id;title="Duplicado documental $suffix";documentId=$doc.id;priority=2;assignments=@{review=$laura.id;approve=$ownerId}} 409
$null=Request-Api $admin POST 'workflows' @{templateId=$documentTemplate.id;title="Origen documental faltante $suffix";priority=2} 400
$expedientModel=$model.Clone();$expedientModel.name="Origen expediente $suffix";$expedientModel.originType='EXPEDIENT'
$expedientTemplate=Request-Api $owner POST 'workflows/templates' $expedientModel 201
$null=Request-Api $admin POST 'workflows' @{templateId=$expedientTemplate.id;title="Expediente requerido $suffix";priority=2} 400
$documentAfterStart=Request-Api $admin GET "documents/$($doc.id)"
if($documentAfterStart.status -ne 'CURRENT'){throw 'Configured review status rule was not applied to the linked document'}
$null=Request-Api $admin PATCH "documents/$($doc.id)/status" @{status='APPROVED'} 409
$documentTask=$documentFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $admin POST "workflows/tasks/$($documentTask.id)/actions" @{action='REVIEW';checklist=@{'Datos completos'=$true}}
$documentFlow=Request-Api $owner GET "workflows/$($documentFlow.id)"
$documentTask=$documentFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$version=Upload-Version $admin $doc.id $pdf
$correctionVersions=Request-Api $admin GET "documents/$($doc.id)/versions"
$correctionVersion=($correctionVersions|Sort-Object versionNumber -Descending|Select-Object -First 1).versionNumber
$null=Request-Api $owner POST "workflows/tasks/$($documentTask.id)/actions" @{action='APPROVE'} 409
$null=Request-Api $owner POST "workflows/tasks/$($documentTask.id)/actions" @{action='RETURN';comment='Revisar nueva version';targetUserId=$laura.id}
$documentFlow=Request-Api $admin GET "workflows/$($documentFlow.id)"
$documentTask=$documentFlow.tasks|Where-Object {$_.status -EQ 'PENDING' -and $_.correction}|Select-Object -First 1
$null=Request-Api $admin POST "workflows/tasks/$($documentTask.id)/actions" @{action='COMPLETE'} 409
$version=Upload-Version $admin $doc.id $pdf
$correctedVersions=Request-Api $admin GET "documents/$($doc.id)/versions"
$correctedVersion=($correctedVersions|Sort-Object versionNumber -Descending|Select-Object -First 1).versionNumber
$null=Request-Api $admin POST "workflows/tasks/$($documentTask.id)/actions" @{action='COMPLETE'} 200
$documentFlow=Request-Api $owner GET "workflows/$($documentFlow.id)"
$documentTask=$documentFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $owner POST "workflows/tasks/$($documentTask.id)/actions" @{action='APPROVE'}
$documentFlow=Request-Api $owner GET "workflows/$($documentFlow.id)"
$documentApproval=$documentFlow.approvals|Where-Object decision -EQ 'APPROVED'|Select-Object -Last 1
if([int]$documentApproval.document_version -ne [int]$correctedVersion){throw "Approval did not persist the exact approved document version (expected $correctedVersion, got $($documentApproval.document_version))"}
$approvedDocument=Request-Api $owner GET "documents/$($doc.id)"
if($approvedDocument.status -ne 'CURRENT'){throw 'Configured completion status rule was not applied to the linked document'}
$restricted=$model|ConvertTo-Json -Depth 20|ConvertFrom-Json
$restricted.name="Reglas restringidas $suffix"
$restrictedReview=$restricted.nodes|Where-Object type -EQ 'REVIEW'|Select-Object -First 1
$restrictedReview.rules|Add-Member -NotePropertyName allowReturn -NotePropertyValue $false -Force
$restrictedReview.rules|Add-Member -NotePropertyName allowReject -NotePropertyValue $false -Force
$restrictedTemplate=Request-Api $owner POST 'workflows/templates' $restricted 201
$restrictedFlow=Request-Api $admin POST 'workflows' @{templateId=$restrictedTemplate.id;title="Reglas protegidas $suffix";priority=3;assignments=@{review=$laura.id;approve=$ownerId}} 201
$restrictedTask=$restrictedFlow.tasks|Where-Object status -EQ 'PENDING'|Select-Object -First 1
$null=Request-Api $admin POST "workflows/tasks/$($restrictedTask.id)/actions" @{action='RETURN';comment='Intento no permitido';targetUserId=$laura.id} 400
$null=Request-Api $admin POST "workflows/tasks/$($restrictedTask.id)/actions" @{action='REJECT';comment='Intento no permitido'} 400
Write-Host 'PASS complete circuit, step instances, template metrics and rules, Kanban projection, completed indicators, correction, checklist, RBAC, tenant isolation, duplicate decision and template versioning'
