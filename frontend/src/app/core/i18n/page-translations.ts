import { LanguageCode } from './translations';
import { PAGE_TEXT_ROWS } from './page-text-rows';
import { MODULE_TEXT_PATTERNS, MODULE_TEXT_ROWS } from './module-text-rows';

type LanguageLabels = Record<LanguageCode, Record<string, string>>;
export type TextPattern = { re: RegExp; t: Record<LanguageCode, string> };

/**
 * Frases con datos variables. `{n}` es el grupo capturado n, que a su vez se
 * traduce si coincide con alguna etiqueta conocida.
 */
export const TEXT_PATTERNS: TextPattern[] = [
  ...MODULE_TEXT_PATTERNS,
  { re: /^Buenos días, (.+)$/, t: { es: 'Buenos días, {1}', en: 'Good morning, {1}', fr: 'Bonjour, {1}', zh: '早上好，{1}' } },
  { re: /^Página (\d+) de (\d+) \(Total: (\d+)\)$/, t: { es: '', en: 'Page {1} of {2} (Total: {3})', fr: 'Page {1} sur {2} (Total : {3})', zh: '第 {1} 页，共 {2} 页（总计：{3}）' } },
  { re: /^Página (\d+) de (\d+)$/, t: { es: '', en: 'Page {1} of {2}', fr: 'Page {1} sur {2}', zh: '第 {1} 页，共 {2} 页' } },
  { re: /^(\d+)-(\d+) de (\d+) resultados$/, t: { es: '', en: '{1}-{2} of {3} results', fr: '{1}-{2} sur {3} résultats', zh: '第 {1}-{2} 条，共 {3} 条结果' } },
  { re: /^(\d+) resultados?(?:\(s\))?$/, t: { es: '', en: '{1} result(s)', fr: '{1} résultat(s)', zh: '{1} 条结果' } },
  { re: /^(\d+) eventos encontrados$/, t: { es: '', en: '{1} events found', fr: '{1} événements trouvés', zh: '找到 {1} 个事件' } },
  { re: /^(\d+) registros?$/, t: { es: '', en: '{1} records', fr: '{1} enregistrements', zh: '{1} 条记录' } },
  { re: /^(\d+) documentos?$/, t: { es: '', en: '{1} documents', fr: '{1} documents', zh: '{1} 份文档' } },
  { re: /^(\d+) usuarios?$/, t: { es: '', en: '{1} users', fr: '{1} utilisateurs', zh: '{1} 名用户' } },
  { re: /^(\d+) pacientes?$/, t: { es: '', en: '{1} patients', fr: '{1} patients', zh: '{1} 名患者' } },
  { re: /^(\d+) de (\d+) expedientes$/, t: { es: '', en: '{1} of {2} records', fr: '{1} sur {2} dossiers', zh: '{1} / {2} 个档案' } },
  { re: /^(\d+) de alta prioridad$/, t: { es: '', en: '{1} high priority', fr: '{1} haute priorité', zh: '{1} 个高优先级' } },
  { re: /^Paso (\d+) de (\d+)$/, t: { es: '', en: 'Step {1} of {2}', fr: 'Étape {1} sur {2}', zh: '第 {1} 步，共 {2} 步' } },
  { re: /^Etapa (\d+) de (\d+)$/, t: { es: '', en: 'Stage {1} of {2}', fr: 'Étape {1} sur {2}', zh: '第 {1} 阶段，共 {2} 阶段' } },
  { re: /^Hace (\d+) min$/, t: { es: '', en: '{1} min ago', fr: 'Il y a {1} min', zh: '{1} 分钟前' } },
  { re: /^Hace (\d+) horas?$/, t: { es: '', en: '{1} hour(s) ago', fr: 'Il y a {1} heure(s)', zh: '{1} 小时前' } },
  { re: /^Hace (\d+) días?$/, t: { es: '', en: '{1} day(s) ago', fr: 'Il y a {1} jour(s)', zh: '{1} 天前' } },
  { re: /^Tiempo prom\. (\d+) min$/, t: { es: '', en: 'Avg. time {1} min', fr: 'Temps moy. {1} min', zh: '平均用时 {1} 分钟' } },
  { re: /^Versiones \(v(\d+)\)$/, t: { es: '', en: 'Versions (v{1})', fr: 'Versions (v{1})', zh: '版本（v{1}）' } },
  { re: /^Subir v(\d+)$/, t: { es: '', en: 'Upload v{1}', fr: 'Téléverser v{1}', zh: '上传 v{1}' } },
  { re: /^Crear y subir versión v(\d+)$/, t: { es: '', en: 'Create and upload version v{1}', fr: 'Créer et téléverser la version v{1}', zh: '创建并上传版本 v{1}' } },
  { re: /^Versión (\d+)$/, t: { es: '', en: 'Version {1}', fr: 'Version {1}', zh: '版本 {1}' } },
  { re: /^Vence: (.+)$/, t: { es: '', en: 'Due: {1}', fr: 'Échéance : {1}', zh: '到期：{1}' } },
  { re: /^Fecha límite: (.+)$/, t: { es: '', en: 'Deadline: {1}', fr: 'Date limite : {1}', zh: '截止日期：{1}' } },
  { re: /^No se encontraron pacientes que coincidan con "(.*)"$/, t: { es: '', en: 'No patients match "{1}"', fr: 'Aucun patient ne correspond à « {1} »', zh: '没有与“{1}”匹配的患者' } },
  { re: /^(Create|Read|Update|Delete) en (.+)$/, t: { es: '', en: '{1} in {2}', fr: '{1} dans {2}', zh: '{2}：{1}' } },
  { re: /^Plantillas: (create|read|update|delete)$/, t: { es: '', en: 'Templates: {1}', fr: 'Modèles : {1}', zh: '模板：{1}' } },
  { re: /^Módulo (.+)$/, t: { es: '', en: '{1} module', fr: 'Module {1}', zh: '{1}模块' } },
  { re: /^Rol: (.+)$/, t: { es: '', en: 'Role: {1}', fr: 'Rôle : {1}', zh: '角色：{1}' } },
  { re: /^Vencido hace (\d+) días?$/, t: { es: '', en: 'Overdue by {1} day(s)', fr: 'En retard de {1} jour(s)', zh: '已逾期 {1} 天' } },
  { re: /^Vence en (\d+) días?$/, t: { es: '', en: 'Due in {1} day(s)', fr: 'Échéance dans {1} jour(s)', zh: '{1} 天后到期' } },
  { re: /^Mostrando (\d+) de (\d+) (.+)$/, t: { es: '', en: 'Showing {1} of {2} {3}', fr: 'Affichage de {1} sur {2} {3}', zh: '显示 {1} / {2} 个{3}' } },
  { re: /^Documentos pendientes \((\d+)\)$/, t: { es: '', en: 'Pending documents ({1})', fr: 'Documents en attente ({1})', zh: '待处理文档（{1}）' } },
  { re: /^Ayer, (.+)$/, t: { es: '', en: 'Yesterday, {1}', fr: 'Hier, {1}', zh: '昨天 {1}' } },
  { re: /^Hoy, (.+)$/, t: { es: '', en: 'Today, {1}', fr: 'Aujourd’hui, {1}', zh: '今天 {1}' } },
  { re: /^Abrir workflow (.+)$/, t: { es: '', en: 'Open workflow {1}', fr: 'Ouvrir le workflow {1}', zh: '打开工作流 {1}' } },
  { re: /^Tarea #(\d+) vence mañana a las (.+)$/, t: { es: '', en: 'Task #{1} is due tomorrow at {2}', fr: 'La tâche n°{1} arrive à échéance demain à {2}', zh: '任务 #{1} 将于明天 {2} 到期' } },
  { re: /^Lote (\S+) procesado con ([\d.,]+)% de confianza$/, t: { es: '', en: 'Batch {1} processed with {2}% confidence', fr: 'Lot {1} traité avec {2} % de confiance', zh: '批次 {1} 已处理，置信度 {2}%' } },
  { re: /^(\d+) páginas indexadas$/, t: { es: '', en: '{1} pages indexed', fr: '{1} pages indexées', zh: '已索引 {1} 页' } },
  { re: /^Te mencionaron en el expediente (.+)$/, t: { es: '', en: 'You were mentioned in record {1}', fr: 'Vous avez été mentionné dans le dossier {1}', zh: '有人在档案 {1} 中提到了您' } },
  { re: /^Vencimiento próximo: (.+)$/, t: { es: '', en: 'Due soon: {1}', fr: 'Échéance proche : {1}', zh: '即将到期：{1}' } },
  { re: /^Tarea completada: (.+)$/, t: { es: '', en: 'Task completed: {1}', fr: 'Tâche terminée : {1}', zh: '任务已完成：{1}' } },
  { re: /^Aprobación final: (.+)$/, t: { es: '', en: 'Final approval: {1}', fr: 'Approbation finale : {1}', zh: '最终审批：{1}' } },
  { re: /^Aprobación de contrato marco #(\d+)$/, t: { es: '', en: 'Framework contract approval #{1}', fr: 'Approbation du contrat-cadre n°{1}', zh: '框架合同审批 #{1}' } },
  { re: /^Solicitud de firma digital para orden de compra #(\d+)$/, t: { es: '', en: 'Digital signature request for purchase order #{1}', fr: 'Demande de signature numérique pour le bon de commande n°{1}', zh: '采购订单 #{1} 的数字签名请求' } },
  { re: /^Asignado por (.+)$/, t: { es: '', en: 'Assigned by {1}', fr: 'Attribué par {1}', zh: '由 {1} 分配' } },
  { re: /^([A-Z_]+) por (.+)$/, t: { es: '', en: '{1} by {2}', fr: '{1} par {2}', zh: '{2} 执行的 {1}' } },
  { re: /^(.+) recientes$/, t: { es: '', en: 'Recent {1}', fr: '{1} récents', zh: '最近的{1}' } },
];

/** Textos de las páginas, indexados por la frase original en castellano. */
export const PAGE_TEXT: LanguageLabels = { es: {}, en: {}, fr: {}, zh: {} };
for (const [es, en, fr, zh] of [...PAGE_TEXT_ROWS, ...MODULE_TEXT_ROWS]) {
  PAGE_TEXT.en[es] = en;
  PAGE_TEXT.fr[es] = fr;
  PAGE_TEXT.zh[es] = zh;
}
