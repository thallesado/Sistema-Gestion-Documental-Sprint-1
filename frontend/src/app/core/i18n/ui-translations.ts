import { LanguageCode } from './translations';
import { PAGE_TEXT, TEXT_PATTERNS } from './page-translations';

type LanguageLabels = Record<LanguageCode, Record<string, string>>;

/** Labels are keyed by their stable Spanish domain identifier, never by a rendered i18n key. */
export const NAVIGATION_LABELS: LanguageLabels = {
  es: {},
  en: {
    'Espacio de trabajo': 'Workspace', 'Procesos': 'Processes', 'Gestion': 'Management', 'Sistema': 'System', 'Administracion global': 'Global administration',
    'Inicio': 'Home', 'Resumen': 'Overview', 'Actividad reciente': 'Recent activity', 'Mis tareas': 'My tasks', 'Indicadores': 'Indicators',
    'Expedientes': 'Records', 'Todos los expedientes': 'All records', 'Crear expediente': 'Create record', 'Activos': 'Active', 'Cerrados': 'Closed', 'Archivados': 'Archived', 'Expediente clinico': 'Clinical record', 'Historia clinica': 'Clinical history', 'Notas medicas': 'Medical notes',
    'Modulo Clinico': 'Clinical module', 'Pacientes': 'Patients', 'Antecedentes': 'Medical history', 'Notas Medicas': 'Medical notes',
    'Documentos': 'Documents', 'Todos los documentos': 'All documents', 'Nuevo documento': 'New document', 'Subir archivo': 'Upload file', 'Mis documentos': 'My documents', 'Compartidos conmigo': 'Shared with me', 'Recientes': 'Recent', 'Pendientes': 'Pending', 'En revision': 'Under review', 'Aprobados': 'Approved', 'Papelera': 'Trash',
    'Digitalizacion': 'Digitization', 'Escanear documento': 'Scan document', 'Subir documento': 'Upload document', 'Procesamiento OCR': 'OCR processing', 'Validacion': 'Validation', 'Indexacion': 'Indexing', 'Correccion de metadatos': 'Metadata correction',
    'Workflows': 'Workflows', 'Todos los workflows': 'All workflows', 'Pendientes de revision': 'Pending review', 'Pendientes de aprobacion': 'Pending approval', 'Finalizados': 'Completed', 'Plantillas': 'Templates', 'Disenador': 'Designer',
    'Usuarios y equipos': 'Users and teams', 'Todos los usuarios': 'All users', 'Bloqueados': 'Blocked', 'Roles': 'Roles', 'Grupos de usuarios (perfiles)': 'User groups (profiles)', 'Privilegios por formulario': 'Form privileges', 'Permisos': 'Permissions', 'Areas': 'Areas', 'Grupos': 'Groups',
    'Auditoria': 'Audit', 'Registro general': 'General log', 'Accesos': 'Access', 'Creacion de documentos': 'Document creation', 'Modificaciones': 'Changes', 'Descargas': 'Downloads', 'Aprobaciones': 'Approvals', 'Eliminaciones': 'Deletions', 'Cambios de permisos': 'Permission changes',
    'Reportes': 'Reports', 'Usuarios': 'Users', 'Almacenamiento': 'Storage', 'Productividad': 'Productivity', 'Actividad por area': 'Activity by area',
    'Notificaciones': 'Notifications', 'Todas': 'All', 'No leidas': 'Unread', 'Tareas': 'Tasks', 'Menciones': 'Mentions',
    'Configuracion': 'Settings', 'General': 'General', 'Tipos documentales': 'Document types', 'Estados': 'Statuses', 'Metadatos': 'Metadata', 'Etiquetas': 'Tags', 'Retencion': 'Retention', 'Seguridad': 'Security', 'Apariencia': 'Appearance',
    'Tenants': 'Organizations', 'Todos los tenants': 'All organizations', 'Crear tenant': 'Create organization', 'Suspendidos': 'Suspended', 'Planes': 'Plans', 'Uso de almacenamiento': 'Storage usage', 'Branding': 'Branding'
  },
  fr: {
    'Espacio de trabajo': 'Espace de travail', 'Procesos': 'Processus', 'Gestion': 'Gestion', 'Sistema': 'Système', 'Administracion global': 'Administration globale',
    'Inicio': 'Accueil', 'Resumen': 'Résumé', 'Actividad reciente': 'Activité récente', 'Mis tareas': 'Mes tâches', 'Indicadores': 'Indicateurs',
    'Expedientes': 'Dossiers', 'Todos los expedientes': 'Tous les dossiers', 'Crear expediente': 'Créer un dossier', 'Activos': 'Actifs', 'Cerrados': 'Fermés', 'Archivados': 'Archivés', 'Expediente clinico': 'Dossier clinique', 'Historia clinica': 'Dossier médical', 'Notas medicas': 'Notes médicales',
    'Modulo Clinico': 'Module clinique', 'Pacientes': 'Patients', 'Antecedentes': 'Antécédents', 'Notas Medicas': 'Notes médicales',
    'Documentos': 'Documents', 'Todos los documentos': 'Tous les documents', 'Nuevo documento': 'Nouveau document', 'Subir archivo': 'Téléverser un fichier', 'Mis documentos': 'Mes documents', 'Compartidos conmigo': 'Partagés avec moi', 'Recientes': 'Récents', 'Pendientes': 'En attente', 'En revision': 'En révision', 'Aprobados': 'Approuvés', 'Papelera': 'Corbeille',
    'Digitalizacion': 'Numérisation', 'Escanear documento': 'Numériser un document', 'Subir documento': 'Téléverser un document', 'Procesamiento OCR': 'Traitement OCR', 'Validacion': 'Validation', 'Indexacion': 'Indexation', 'Correccion de metadatos': 'Correction des métadonnées',
    'Workflows': 'Workflows', 'Todos los workflows': 'Tous les workflows', 'Pendientes de revision': 'En attente de révision', 'Pendientes de aprobacion': 'En attente d’approbation', 'Finalizados': 'Terminés', 'Plantillas': 'Modèles', 'Disenador': 'Concepteur',
    'Usuarios y equipos': 'Utilisateurs et équipes', 'Todos los usuarios': 'Tous les utilisateurs', 'Bloqueados': 'Bloqués', 'Roles': 'Rôles', 'Grupos de usuarios (perfiles)': 'Groupes d’utilisateurs (profils)', 'Privilegios por formulario': 'Privilèges par formulaire', 'Permisos': 'Autorisations', 'Areas': 'Services', 'Grupos': 'Groupes',
    'Auditoria': 'Audit', 'Registro general': 'Journal général', 'Accesos': 'Accès', 'Creacion de documentos': 'Création de documents', 'Modificaciones': 'Modifications', 'Descargas': 'Téléchargements', 'Aprobaciones': 'Approbations', 'Eliminaciones': 'Suppressions', 'Cambios de permisos': 'Changements d’autorisations',
    'Reportes': 'Rapports', 'Usuarios': 'Utilisateurs', 'Almacenamiento': 'Stockage', 'Productividad': 'Productivité', 'Actividad por area': 'Activité par service',
    'Notificaciones': 'Notifications', 'Todas': 'Toutes', 'No leidas': 'Non lues', 'Tareas': 'Tâches', 'Menciones': 'Mentions',
    'Configuracion': 'Paramètres', 'General': 'Général', 'Tipos documentales': 'Types de documents', 'Estados': 'États', 'Metadatos': 'Métadonnées', 'Etiquetas': 'Étiquettes', 'Retencion': 'Conservation', 'Seguridad': 'Sécurité', 'Apariencia': 'Apparence',
    'Tenants': 'Organisations', 'Todos los tenants': 'Toutes les organisations', 'Crear tenant': 'Créer une organisation', 'Suspendidos': 'Suspendus', 'Planes': 'Forfaits', 'Uso de almacenamiento': 'Utilisation du stockage', 'Branding': 'Identité visuelle'
  },
  zh: {
    'Espacio de trabajo': '工作区', 'Procesos': '流程', 'Gestion': '管理', 'Sistema': '系统', 'Administracion global': '全局管理',
    'Inicio': '首页', 'Resumen': '概览', 'Actividad reciente': '最近活动', 'Mis tareas': '我的任务', 'Indicadores': '指标',
    'Expedientes': '档案', 'Todos los expedientes': '全部档案', 'Crear expediente': '新建档案', 'Activos': '进行中', 'Cerrados': '已关闭', 'Archivados': '已归档', 'Expediente clinico': '临床档案', 'Historia clinica': '病历', 'Notas medicas': '医疗记录',
    'Modulo Clinico': '临床模块', 'Pacientes': '患者', 'Antecedentes': '病史', 'Notas Medicas': '医疗记录',
    'Documentos': '文档', 'Todos los documentos': '全部文档', 'Nuevo documento': '新建文档', 'Subir archivo': '上传文件', 'Mis documentos': '我的文档', 'Compartidos conmigo': '与我共享', 'Recientes': '最近', 'Pendientes': '待处理', 'En revision': '审核中', 'Aprobados': '已批准', 'Papelera': '回收站',
    'Digitalizacion': '数字化', 'Escanear documento': '扫描文档', 'Subir documento': '上传文档', 'Procesamiento OCR': 'OCR 处理', 'Validacion': '验证', 'Indexacion': '索引', 'Correccion de metadatos': '元数据修正',
    'Workflows': '工作流', 'Todos los workflows': '全部工作流', 'Pendientes de revision': '待审核', 'Pendientes de aprobacion': '待批准', 'Finalizados': '已完成', 'Plantillas': '模板', 'Disenador': '设计器',
    'Usuarios y equipos': '用户和团队', 'Todos los usuarios': '全部用户', 'Bloqueados': '已锁定', 'Roles': '角色', 'Grupos de usuarios (perfiles)': '用户组（配置文件）', 'Privilegios por formulario': '表单权限', 'Permisos': '权限', 'Areas': '部门', 'Grupos': '分组',
    'Auditoria': '审计', 'Registro general': '通用日志', 'Accesos': '访问', 'Creacion de documentos': '创建文档', 'Modificaciones': '修改', 'Descargas': '下载', 'Aprobaciones': '审批', 'Eliminaciones': '删除', 'Cambios de permisos': '权限变更',
    'Reportes': '报表', 'Usuarios': '用户', 'Almacenamiento': '存储', 'Productividad': '生产力', 'Actividad por area': '按部门的活动',
    'Notificaciones': '通知', 'Todas': '全部', 'No leidas': '未读', 'Tareas': '任务', 'Menciones': '提及',
    'Configuracion': '设置', 'General': '常规', 'Tipos documentales': '文档类型', 'Estados': '状态', 'Metadatos': '元数据', 'Etiquetas': '标签', 'Retencion': '保留', 'Seguridad': '安全', 'Apariencia': '外观',
    'Tenants': '组织', 'Todos los tenants': '全部组织', 'Crear tenant': '新建组织', 'Suspendidos': '已暂停', 'Planes': '套餐', 'Uso de almacenamiento': '存储用量', 'Branding': '品牌'
  }
};

export const ROLE_LABELS: LanguageLabels = {
  es: {},
  en: { 'Superadministrador': 'Super administrator', 'Administrador de tenant': 'Organization administrator', 'Supervisor': 'Supervisor', 'Usuario basico': 'Basic user' },
  fr: { 'Superadministrador': 'Superadministrateur', 'Administrador de tenant': 'Administrateur de l’organisation', 'Supervisor': 'Superviseur', 'Usuario basico': 'Utilisateur standard' },
  zh: { 'Superadministrador': '超级管理员', 'Administrador de tenant': '组织管理员', 'Supervisor': '主管', 'Usuario basico': '普通用户' }
};

/** Shared labels used by the main feature views. The source Spanish phrase is stable and preserves dynamic data. */
export const FEATURE_TEXT: LanguageLabels = {
  es: {},
  en: {
    'EXPEDIENTES · GESTIÓN CLÍNICA Y CONSULTAS MÉDICAS': 'RECORDS · CLINICAL MANAGEMENT AND MEDICAL CONSULTATIONS', 'Historia Clínica y Consultas Realizadas': 'Clinical History and Completed Consultations', 'Búsqueda de paciente, consulta de antecedentes oficiales y registro inmutable de consultas médicas.': 'Search patients, review official history and keep an immutable record of medical consultations.',
    'Buscar Paciente (Nombre, Apellido o C.I.)': 'SEARCH PATIENT (FIRST NAME, LAST NAME OR ID)', 'Escribe para buscar: Ej. Silvia, Yesenia, Condori, 93868...': 'Type to search: e.g. Silvia, Yesenia, Condori, 93868...', 'Filtra en tiempo real. Al escribir, los pacientes coincidentes se remarcarán en color azul.': 'Filter in real time. Matching patients are highlighted in blue.', 'Total pacientes en sistema:': 'Total patients in the system:', 'Lista de Pacientes': 'Patient list', 'Paciente no encontrado': 'Patient not found', 'No hay pacientes que coincidan con la búsqueda.': 'No patients match the search.', 'Selecciona un paciente': 'Select a patient', 'Haz clic en cualquier paciente de la lista izquierda para cargar sus antecedentes clínicos o revisar sus consultas médicas.': 'Click a patient in the list on the left to load their clinical history or review medical consultations.',
    'Historial': 'History', 'Consultas': 'Consultations', 'Documentos': 'Documents', 'Revisiones': 'Revisions', 'Ver Hoja Oficial': 'View official form', 'Dar de Baja': 'Deactivate', '+ Nueva Consulta': '+ New consultation', '+ Vincular Documento': '+ Link document', 'Guardar Cambios de Historial': 'Save history changes', 'Crear Historia Clínica': 'Create clinical history', 'Cargando consultas del paciente...': 'Loading patient consultations...', 'Sin consultas previas': 'No previous consultations', '+ Registrar Consulta': '+ Register consultation', 'Signos Vitales': 'Vital signs', 'Motivo de la Consulta': 'Reason for consultation',
    'Expedientes': 'Records', 'Crear expediente': 'Create record', 'Repositorio de expedientes': 'Records repository', 'Buscar por nombre, código o área...': 'Search by name, code or area...', 'No se encontraron expedientes. Prueba con otros filtros.': 'No records found. Try other filters.', 'Usuarios y organizaciones': 'Users and organizations', 'Administración': 'Administration', 'Actividad reciente': 'Recent activity', 'Mis tareas': 'My tasks', 'Resumen': 'Overview', 'Notas médicas': 'Medical notes', 'Directorio y Registro de Pacientes': 'Patient directory and registration', 'Pacientes Registrados': 'Registered patients', 'Alta de Paciente': 'Register patient', 'Nuevo Registro de Paciente': 'New patient record', 'Buscar por nombre, apellidos o número de documento...': 'Search by first name, last name or document number...'
  },
  fr: {
    'EXPEDIENTES · GESTIÓN CLÍNICA Y CONSULTAS MÉDICAS': 'DOSSIERS · GESTION CLINIQUE ET CONSULTATIONS MÉDICALES', 'Historia Clínica y Consultas Realizadas': 'Dossier médical et consultations réalisées', 'Búsqueda de paciente, consulta de antecedentes oficiales y registro inmutable de consultas médicas.': 'Recherchez un patient, consultez les antécédents officiels et conservez un registre immuable des consultations médicales.',
    'Buscar Paciente (Nombre, Apellido o C.I.)': 'RECHERCHER UN PATIENT (PRÉNOM, NOM OU PIÈCE D’IDENTITÉ)', 'Escribe para buscar: Ej. Silvia, Yesenia, Condori, 93868...': 'Saisissez pour rechercher : ex. Silvia, Yesenia, Condori, 93868...', 'Filtra en tiempo real. Al escribir, los pacientes coincidentes se remarcarán en color azul.': 'Filtrez en temps réel. Les patients correspondants sont mis en évidence en bleu.', 'Total pacientes en sistema:': 'Total des patients dans le système :', 'Lista de Pacientes': 'Liste des patients', 'Paciente no encontrado': 'Patient introuvable', 'No hay pacientes que coincidan con la búsqueda.': 'Aucun patient ne correspond à la recherche.', 'Selecciona un paciente': 'Sélectionnez un patient', 'Haz clic en cualquier paciente de la lista izquierda para cargar sus antecedentes clínicos o revisar sus consultas médicas.': 'Cliquez sur un patient de la liste de gauche pour charger ses antécédents ou consulter ses rendez-vous médicaux.',
    'Historial': 'Historique', 'Consultas': 'Consultations', 'Documentos': 'Documents', 'Revisiones': 'Révisions', 'Ver Hoja Oficial': 'Voir la fiche officielle', 'Dar de Baja': 'Désactiver', '+ Nueva Consulta': '+ Nouvelle consultation', '+ Vincular Documento': '+ Lier un document', 'Guardar Cambios de Historial': 'Enregistrer les modifications', 'Crear Historia Clínica': 'Créer un dossier médical', 'Cargando consultas del paciente...': 'Chargement des consultations du patient...', 'Sin consultas previas': 'Aucune consultation précédente', '+ Registrar Consulta': '+ Enregistrer une consultation', 'Signos Vitales': 'Signes vitaux', 'Motivo de la Consulta': 'Motif de consultation',
    'Expedientes': 'Dossiers', 'Crear expediente': 'Créer un dossier', 'Repositorio de expedientes': 'Répertoire des dossiers', 'Buscar por nombre, código o área...': 'Rechercher par nom, code ou service...', 'No se encontraron expedientes. Prueba con otros filtros.': 'Aucun dossier trouvé. Essayez d’autres filtres.', 'Usuarios y organizaciones': 'Utilisateurs et organisations', 'Administración': 'Administration', 'Actividad reciente': 'Activité récente', 'Mis tareas': 'Mes tâches', 'Resumen': 'Résumé', 'Notas médicas': 'Notes médicales', 'Directorio y Registro de Pacientes': 'Répertoire et enregistrement des patients', 'Pacientes Registrados': 'Patients enregistrés', 'Alta de Paciente': 'Enregistrer un patient', 'Nuevo Registro de Paciente': 'Nouveau dossier patient', 'Buscar por nombre, apellidos o número de documento...': 'Rechercher par prénom, nom ou numéro de document...'
  },
  zh: {
    'EXPEDIENTES · GESTIÓN CLÍNICA Y CONSULTAS MÉDICAS': '档案 · 临床管理和医疗咨询', 'Historia Clínica y Consultas Realizadas': '病历和已完成的咨询', 'Búsqueda de paciente, consulta de antecedentes oficiales y registro inmutable de consultas médicas.': '搜索患者、查阅正式病史，并保留不可更改的医疗咨询记录。',
    'Buscar Paciente (Nombre, Apellido o C.I.)': '搜索患者（名字、姓氏或身份证件）', 'Escribe para buscar: Ej. Silvia, Yesenia, Condori, 93868...': '输入以搜索：例如 Silvia、Yesenia、Condori、93868...', 'Filtra en tiempo real. Al escribir, los pacientes coincidentes se remarcarán en color azul.': '实时筛选。匹配的患者会以蓝色突出显示。', 'Total pacientes en sistema:': '系统中的患者总数：', 'Lista de Pacientes': '患者列表', 'Paciente no encontrado': '未找到患者', 'No hay pacientes que coincidan con la búsqueda.': '没有与搜索匹配的患者。', 'Selecciona un paciente': '选择一位患者', 'Haz clic en cualquier paciente de la lista izquierda para cargar sus antecedentes clínicos o revisar sus consultas médicas.': '点击左侧列表中的任一患者以加载其病史或查看医疗咨询。',
    'Historial': '病史', 'Consultas': '咨询', 'Documentos': '文档', 'Revisiones': '修订', 'Ver Hoja Oficial': '查看正式表格', 'Dar de Baja': '停用', '+ Nueva Consulta': '+ 新建咨询', '+ Vincular Documento': '+ 关联文档', 'Guardar Cambios de Historial': '保存病史更改', 'Crear Historia Clínica': '创建病历', 'Cargando consultas del paciente...': '正在加载患者咨询...', 'Sin consultas previas': '没有既往咨询', '+ Registrar Consulta': '+ 登记咨询', 'Signos Vitales': '生命体征', 'Motivo de la Consulta': '咨询原因',
    'Expedientes': '档案', 'Crear expediente': '新建档案', 'Repositorio de expedientes': '档案库', 'Buscar por nombre, código o área...': '按名称、代码或部门搜索...', 'No se encontraron expedientes. Prueba con otros filtros.': '未找到档案。请尝试其他筛选条件。', 'Usuarios y organizaciones': '用户和组织', 'Administración': '管理', 'Actividad reciente': '最近活动', 'Mis tareas': '我的任务', 'Resumen': '概览', 'Notas médicas': '医疗记录', 'Directorio y Registro de Pacientes': '患者目录和登记', 'Pacientes Registrados': '已登记患者', 'Alta de Paciente': '登记患者', 'Nuevo Registro de Paciente': '新建患者档案', 'Buscar por nombre, apellidos o número de documento...': '按名字、姓氏或证件号码搜索...'
  }
};

const COMMON_FEATURE_TEXT: LanguageLabels = {
  es: {},
  en: {
    'Buenos días,': 'Good morning,', 'Aquí tienes un resumen de lo que está ocurriendo en tu organización.': 'Here is a summary of what is happening in your organization.', 'Crear documento': 'Create document', 'Ver todos': 'View all', 'Cargando...': 'Loading...', 'Buscar': 'Search', 'Limpiar filtros': 'Clear filters', 'Cancelar': 'Cancel', 'Guardar': 'Save', 'Continuar': 'Continue', 'Atrás': 'Back', 'Cerrar': 'Close', 'Editar': 'Edit', 'Eliminar': 'Delete', 'Acciones': 'Actions', 'Estado': 'Status', 'Fecha': 'Date', 'Nombre': 'Name', 'Descripción': 'Description', 'Código': 'Code', 'Área': 'Area', 'Responsable': 'Owner', 'Sin resultados': 'No results', 'No hay datos disponibles.': 'No data available.', 'Cargando expedientes del tenant autenticado...': 'Loading records for the authenticated organization...', 'Notas médicas': 'Medical notes', 'MÓDULO CLÍNICO · NOTAS MÉDICAS': 'CLINICAL MODULE · MEDICAL NOTES', 'Formulario de Notas Médicas y Buscador de Pacientes': 'Medical notes form and patient search', 'Buscador de Pacientes en Tiempo Real': 'Real-time patient search', 'Pacientes en Directorio': 'Patients in directory', 'Paciente': 'Patient', 'Fecha de Nacimiento': 'Date of birth', 'Género': 'Gender', 'Contacto': 'Contact', 'No registrado': 'Not registered', 'Sin especificar': 'Not specified', 'Nueva Nota': 'New note', 'Antecedentes': 'Medical history', 'Total registrados': 'Total registered', 'En todos los estados': 'Across all statuses', 'Seguimiento activo': 'Active follow-up', 'Archivo histórico': 'Historical archive'
  },
  fr: {
    'Buenos días,': 'Bonjour,', 'Aquí tienes un resumen de lo que está ocurriendo en tu organización.': 'Voici un résumé de ce qui se passe dans votre organisation.', 'Crear documento': 'Créer un document', 'Ver todos': 'Tout voir', 'Cargando...': 'Chargement...', 'Buscar': 'Rechercher', 'Limpiar filtros': 'Effacer les filtres', 'Cancelar': 'Annuler', 'Guardar': 'Enregistrer', 'Continuar': 'Continuer', 'Atrás': 'Retour', 'Cerrar': 'Fermer', 'Editar': 'Modifier', 'Eliminar': 'Supprimer', 'Acciones': 'Actions', 'Estado': 'État', 'Fecha': 'Date', 'Nombre': 'Nom', 'Descripción': 'Description', 'Código': 'Code', 'Área': 'Service', 'Responsable': 'Responsable', 'Sin resultados': 'Aucun résultat', 'No hay datos disponibles.': 'Aucune donnée disponible.', 'Cargando expedientes del tenant autenticado...': 'Chargement des dossiers de l’organisation authentifiée...', 'Notas médicas': 'Notes médicales', 'MÓDULO CLÍNICO · NOTAS MÉDICAS': 'MODULE CLINIQUE · NOTES MÉDICALES', 'Formulario de Notas Médicas y Buscador de Pacientes': 'Formulaire de notes médicales et recherche de patients', 'Buscador de Pacientes en Tiempo Real': 'Recherche de patients en temps réel', 'Pacientes en Directorio': 'Patients du répertoire', 'Paciente': 'Patient', 'Fecha de Nacimiento': 'Date de naissance', 'Género': 'Genre', 'Contacto': 'Contact', 'No registrado': 'Non renseigné', 'Sin especificar': 'Non précisé', 'Nueva Nota': 'Nouvelle note', 'Antecedentes': 'Antécédents', 'Total registrados': 'Total enregistrés', 'En todos los estados': 'Dans tous les états', 'Seguimiento activo': 'Suivi actif', 'Archivo histórico': 'Archives historiques'
  },
  zh: {
    'Buenos días,': '早上好，', 'Aquí tienes un resumen de lo que está ocurriendo en tu organización.': '以下是您所在组织的最新摘要。', 'Crear documento': '新建文档', 'Ver todos': '查看全部', 'Cargando...': '正在加载...', 'Buscar': '搜索', 'Limpiar filtros': '清除筛选条件', 'Cancelar': '取消', 'Guardar': '保存', 'Continuar': '继续', 'Atrás': '返回', 'Cerrar': '关闭', 'Editar': '编辑', 'Eliminar': '删除', 'Acciones': '操作', 'Estado': '状态', 'Fecha': '日期', 'Nombre': '名称', 'Descripción': '描述', 'Código': '代码', 'Área': '部门', 'Responsable': '负责人', 'Sin resultados': '没有结果', 'No hay datos disponibles.': '没有可用数据。', 'Cargando expedientes del tenant autenticado...': '正在加载当前组织的档案...', 'Notas médicas': '医疗记录', 'MÓDULO CLÍNICO · NOTAS MÉDICAS': '临床模块 · 医疗记录', 'Formulario de Notas Médicas y Buscador de Pacientes': '医疗记录表和患者搜索', 'Buscador de Pacientes en Tiempo Real': '实时患者搜索', 'Pacientes en Directorio': '目录中的患者', 'Paciente': '患者', 'Fecha de Nacimiento': '出生日期', 'Género': '性别', 'Contacto': '联系方式', 'No registrado': '未登记', 'Sin especificar': '未说明', 'Nueva Nota': '新建记录', 'Antecedentes': '病史', 'Total registrados': '已登记总数', 'En todos los estados': '所有状态', 'Seguimiento activo': '进行中跟进', 'Archivo histórico': '历史档案'
  }
};

for (const language of Object.keys(COMMON_FEATURE_TEXT) as LanguageCode[]) {
  Object.assign(FEATURE_TEXT[language], COMMON_FEATURE_TEXT[language]);
}

/** Workflow catalogue, designer canvas and property editor. */
const WORKFLOW_TEXT: LanguageLabels = {
  es: {},
  en: {
    'Resumen': 'Overview', 'Workflows': 'Workflows', 'Diseñador': 'Designer', 'DISEÑADOR': 'DESIGNER', 'Migas de pan': 'Breadcrumbs', 'WORKFLOWS': 'WORKFLOWS', 'Diseñador de workflows': 'Workflow designer', 'Crea, configura y visualiza el flujo de trabajo de tus documentos y expedientes.': 'Create, configure and visualize the workflow for your documents and records.',
    'Información': 'Information', 'Guardar como plantilla': 'Save as template', 'Vista previa': 'Preview', 'Editar': 'Edit', 'Guardar workflow': 'Save workflow', 'Componentes': 'Components', 'Arrastra un componente al lienzo o pulsa para añadirlo.': 'Drag a component onto the canvas or click to add it.', 'Para conectar, selecciona origen y destino en Propiedades.': 'To connect, select source and target in Properties.',
    'Inicio': 'Start', 'Punto de inicio del flujo': 'Workflow starting point', 'Tarea': 'Task', 'Actividad a realizar': 'Activity to complete', 'Revisión': 'Review', 'Revisión de documentos': 'Document review', 'Aprobación': 'Approval', 'Aprobación formal': 'Formal approval', 'Decisión': 'Decision', 'Rama condicional del flujo': 'Conditional workflow branch', 'Notificación': 'Notification', 'Envío de notificaciones': 'Send notifications', 'Archivo': 'Archive', 'Archivar documento': 'Archive document', 'Fin': 'End', 'Punto de finalización': 'End point',
    'Ajustar vista': 'Fit view', 'Sí': 'Yes', 'No': 'No', 'Revisión de documento': 'Document review', 'Revisar contenido y anexos': 'Review content and attachments', '¿Aprobado?': 'Approved?', 'Define la siguiente etapa': 'Define the next stage', 'Corrección': 'Correction', 'Realizar los ajustes solicitados.': 'Make the requested changes.', 'Revisión de corrección': 'Correction review', 'Aprobación final': 'Final approval', 'Aprobación por responsable': 'Approval by owner', 'Notificar resultado': 'Notify result', 'Avisar al solicitante': 'Notify the requester', 'Configura esta etapa': 'Configure this stage',
    'Propiedades': 'Properties', 'General': 'General', 'Asignación': 'Assignment', 'Avanzado': 'Advanced', 'Nombre': 'Name', 'Descripción': 'Description', 'Plazo (días)': 'Due date (days)', 'Destino': 'Target', 'Seleccionar nodo': 'Select node', 'Condición': 'Condition', 'Por defecto': 'Default', 'Conectar': 'Connect', 'Elegir al iniciar': 'Choose when starting', 'Usuario': 'User', 'Rol': 'Role', 'Referencia': 'Reference', 'Selecciona': 'Select', 'Área': 'Area', 'Checklist (un punto por línea)': 'Checklist (one item per line)', 'Comentario obligatorio': 'Comment required', 'Prioridad predeterminada': 'Default priority', 'Heredar del workflow': 'Inherit from workflow', 'Urgente': 'Urgent', 'Alta': 'High', 'Media': 'Medium', 'Baja': 'Low', 'Permitir devolución': 'Allow return', 'Mínimo de aprobaciones': 'Minimum approvals', 'Permitir rechazo': 'Allow rejection', 'Permitir ajuste': 'Allow adjustment', 'Evento': 'Event', 'Al ingresar a la etapa': 'On entering the stage', 'Al avanzar el workflow': 'When the workflow advances', 'Plantilla del mensaje': 'Message template', 'Eliminar nodo': 'Delete node', 'Selecciona un nodo para editarlo.': 'Select a node to edit it.',
    'Información general': 'General information', 'Pasos': 'Steps', 'Asignaciones': 'Assignments', 'Reglas': 'Rules', 'Notificaciones': 'Notifications', 'Anterior': 'Previous', 'Siguiente': 'Next', 'Paso': 'Step', 'Volver al lienzo': 'Back to canvas', 'Categoría': 'Category', 'Origen': 'Origin', 'Cualquier origen': 'Any origin', 'Documento': 'Document', 'Expediente': 'Record', 'Proceso independiente': 'Independent process', 'Publicación': 'Publication', 'Borrador · solo visible en el catálogo': 'Draft · visible only in the catalog', 'Activa · disponible para iniciar': 'Active · available to start', 'Inactiva · no disponible para iniciar': 'Inactive · unavailable to start', 'Estados documentales automáticos': 'Automatic document statuses', 'No cambiar': 'Do not change', 'Nuevo workflow': 'New workflow', 'Flujo de revisión y aprobación de documentos.': 'Document review and approval workflow.'
  },
  fr: {
    'Resumen': 'Résumé', 'Workflows': 'Workflows', 'Diseñador': 'Concepteur', 'DISEÑADOR': 'CONCEPTEUR', 'Migas de pan': 'Fil d’Ariane', 'WORKFLOWS': 'WORKFLOWS', 'Diseñador de workflows': 'Concepteur de workflows', 'Crea, configura y visualiza el flujo de trabajo de tus documentos y expedientes.': 'Créez, configurez et visualisez le flux de travail de vos documents et dossiers.',
    'Información': 'Informations', 'Guardar como plantilla': 'Enregistrer comme modèle', 'Vista previa': 'Aperçu', 'Editar': 'Modifier', 'Guardar workflow': 'Enregistrer le workflow', 'Componentes': 'Composants', 'Arrastra un componente al lienzo o pulsa para añadirlo.': 'Glissez un composant sur le canevas ou cliquez pour l’ajouter.', 'Para conectar, selecciona origen y destino en Propiedades.': 'Pour connecter, sélectionnez la source et la destination dans Propriétés.',
    'Inicio': 'Début', 'Punto de inicio del flujo': 'Point de départ du flux', 'Tarea': 'Tâche', 'Actividad a realizar': 'Activité à réaliser', 'Revisión': 'Révision', 'Revisión de documentos': 'Révision de documents', 'Aprobación': 'Approbation', 'Aprobación formal': 'Approbation formelle', 'Decisión': 'Décision', 'Rama condicional del flujo': 'Branche conditionnelle du flux', 'Notificación': 'Notification', 'Envío de notificaciones': 'Envoi de notifications', 'Archivo': 'Archivage', 'Archivar documento': 'Archiver le document', 'Fin': 'Fin', 'Punto de finalización': 'Point de fin',
    'Ajustar vista': 'Ajuster la vue', 'Sí': 'Oui', 'No': 'Non', 'Revisión de documento': 'Révision du document', 'Revisar contenido y anexos': 'Réviser le contenu et les pièces jointes', '¿Aprobado?': 'Approuvé ?', 'Define la siguiente etapa': 'Définir l’étape suivante', 'Corrección': 'Correction', 'Realizar los ajustes solicitados.': 'Effectuer les ajustements demandés.', 'Revisión de corrección': 'Révision de correction', 'Aprobación final': 'Approbation finale', 'Aprobación por responsable': 'Approbation par le responsable', 'Notificar resultado': 'Notifier le résultat', 'Avisar al solicitante': 'Informer le demandeur', 'Configura esta etapa': 'Configurer cette étape',
    'Propiedades': 'Propriétés', 'General': 'Général', 'Asignación': 'Affectation', 'Avanzado': 'Avancé', 'Nombre': 'Nom', 'Descripción': 'Description', 'Plazo (días)': 'Délai (jours)', 'Destino': 'Destination', 'Seleccionar nodo': 'Sélectionner un nœud', 'Condición': 'Condition', 'Por defecto': 'Par défaut', 'Conectar': 'Connecter', 'Elegir al iniciar': 'Choisir au démarrage', 'Usuario': 'Utilisateur', 'Rol': 'Rôle', 'Referencia': 'Référence', 'Selecciona': 'Sélectionner', 'Área': 'Service', 'Checklist (un punto por línea)': 'Liste de contrôle (un élément par ligne)', 'Comentario obligatorio': 'Commentaire obligatoire', 'Prioridad predeterminada': 'Priorité par défaut', 'Heredar del workflow': 'Hériter du workflow', 'Urgente': 'Urgente', 'Alta': 'Haute', 'Media': 'Moyenne', 'Baja': 'Basse', 'Permitir devolución': 'Autoriser le retour', 'Mínimo de aprobaciones': 'Nombre minimal d’approbations', 'Permitir rechazo': 'Autoriser le rejet', 'Permitir ajuste': 'Autoriser l’ajustement', 'Evento': 'Événement', 'Al ingresar a la etapa': 'À l’entrée dans l’étape', 'Al avanzar el workflow': 'À l’avancement du workflow', 'Plantilla del mensaje': 'Modèle de message', 'Eliminar nodo': 'Supprimer le nœud', 'Selecciona un nodo para editarlo.': 'Sélectionnez un nœud à modifier.',
    'Información general': 'Informations générales', 'Pasos': 'Étapes', 'Asignaciones': 'Affectations', 'Reglas': 'Règles', 'Notificaciones': 'Notifications', 'Anterior': 'Précédent', 'Siguiente': 'Suivant', 'Paso': 'Étape', 'Volver al lienzo': 'Retour au canevas', 'Categoría': 'Catégorie', 'Origen': 'Origine', 'Cualquier origen': 'Toute origine', 'Documento': 'Document', 'Expediente': 'Dossier', 'Proceso independiente': 'Processus indépendant', 'Publicación': 'Publication', 'Borrador · solo visible en el catálogo': 'Brouillon · visible uniquement dans le catalogue', 'Activa · disponible para iniciar': 'Active · disponible au démarrage', 'Inactiva · no disponible para iniciar': 'Inactive · indisponible au démarrage', 'Estados documentales automáticos': 'États documentaires automatiques', 'No cambiar': 'Ne pas modifier', 'Nuevo workflow': 'Nouveau workflow', 'Flujo de revisión y aprobación de documentos.': 'Flux de révision et d’approbation de documents.'
  },
  zh: {
    'Resumen': '概览', 'Workflows': '工作流', 'Diseñador': '设计器', 'DISEÑADOR': '设计器', 'Migas de pan': '面包屑导航', 'WORKFLOWS': '工作流', 'Diseñador de workflows': '工作流设计器', 'Crea, configura y visualiza el flujo de trabajo de tus documentos y expedientes.': '创建、配置并查看文档和档案的工作流。',
    'Información': '信息', 'Guardar como plantilla': '保存为模板', 'Vista previa': '预览', 'Editar': '编辑', 'Guardar workflow': '保存工作流', 'Componentes': '组件', 'Arrastra un componente al lienzo o pulsa para añadirlo.': '将组件拖到画布上，或点击以添加。', 'Para conectar, selecciona origen y destino en Propiedades.': '要连接，请在属性中选择源节点和目标节点。',
    'Inicio': '开始', 'Punto de inicio del flujo': '工作流起点', 'Tarea': '任务', 'Actividad a realizar': '要执行的活动', 'Revisión': '审核', 'Revisión de documentos': '文档审核', 'Aprobación': '审批', 'Aprobación formal': '正式审批', 'Decisión': '决策', 'Rama condicional del flujo': '工作流条件分支', 'Notificación': '通知', 'Envío de notificaciones': '发送通知', 'Archivo': '归档', 'Archivar documento': '归档文档', 'Fin': '结束', 'Punto de finalización': '结束点',
    'Ajustar vista': '适应视图', 'Sí': '是', 'No': '否', 'Revisión de documento': '文档审核', 'Revisar contenido y anexos': '审核内容和附件', '¿Aprobado?': '已批准？', 'Define la siguiente etapa': '定义下一阶段', 'Corrección': '修正', 'Realizar los ajustes solicitados.': '执行要求的调整。', 'Revisión de corrección': '修正审核', 'Aprobación final': '最终审批', 'Aprobación por responsable': '负责人审批', 'Notificar resultado': '通知结果', 'Avisar al solicitante': '通知申请人', 'Configura esta etapa': '配置此阶段',
    'Propiedades': '属性', 'General': '常规', 'Asignación': '分配', 'Avanzado': '高级', 'Nombre': '名称', 'Descripción': '描述', 'Plazo (días)': '期限（天）', 'Destino': '目标', 'Seleccionar nodo': '选择节点', 'Condición': '条件', 'Por defecto': '默认', 'Conectar': '连接', 'Elegir al iniciar': '开始时选择', 'Usuario': '用户', 'Rol': '角色', 'Referencia': '引用', 'Selecciona': '选择', 'Área': '部门', 'Checklist (un punto por línea)': '检查清单（每行一项）', 'Comentario obligatorio': '必须评论', 'Prioridad predeterminada': '默认优先级', 'Heredar del workflow': '继承工作流设置', 'Urgente': '紧急', 'Alta': '高', 'Media': '中', 'Baja': '低', 'Permitir devolución': '允许退回', 'Mínimo de aprobaciones': '最少审批数', 'Permitir rechazo': '允许拒绝', 'Permitir ajuste': '允许调整', 'Evento': '事件', 'Al ingresar a la etapa': '进入阶段时', 'Al avanzar el workflow': '工作流推进时', 'Plantilla del mensaje': '消息模板', 'Eliminar nodo': '删除节点', 'Selecciona un nodo para editarlo.': '选择一个节点进行编辑。',
    'Información general': '常规信息', 'Pasos': '步骤', 'Asignaciones': '分配', 'Reglas': '规则', 'Notificaciones': '通知', 'Anterior': '上一步', 'Siguiente': '下一步', 'Paso': '步骤', 'Volver al lienzo': '返回画布', 'Categoría': '类别', 'Origen': '来源', 'Cualquier origen': '任何来源', 'Documento': '文档', 'Expediente': '档案', 'Proceso independiente': '独立流程', 'Publicación': '发布', 'Borrador · solo visible en el catálogo': '草稿 · 仅在目录中可见', 'Activa · disponible para iniciar': '已启用 · 可开始', 'Inactiva · no disponible para iniciar': '未启用 · 不可开始', 'Estados documentales automáticos': '自动文档状态', 'No cambiar': '不更改', 'Nuevo workflow': '新建工作流', 'Flujo de revisión y aprobación de documentos.': '文档审核和审批工作流。'
  }
};

for (const language of Object.keys(WORKFLOW_TEXT) as LanguageCode[]) {
  Object.assign(FEATURE_TEXT[language], WORKFLOW_TEXT[language]);
}

/** Remaining workflow list, task and dialog labels. The designer dictionary above
 * deliberately owns its graph vocabulary; this catalogue covers every route that
 * shares the workflows content host. */
const WORKFLOW_PAGE_TEXT: LanguageLabels = {
  es: {},
  en: {
    'Todos los workflows': 'All workflows', 'Gestiona y supervisa los flujos de trabajo de documentos y expedientes.': 'Manage and monitor document and record workflows.', 'Iniciar workflow': 'Start workflow',
    'Workflows activos': 'Active workflows', 'Visualiza y gestiona los workflows que se encuentran en curso.': 'View and manage workflows currently in progress.',
    'Workflows finalizados': 'Completed workflows', 'Consulta los flujos de trabajo que ya terminaron.': 'Review workflows that have already finished.',
    'Plantillas de workflows': 'Workflow templates', 'Crea y administra plantillas reutilizables para tus procesos.': 'Create and manage reusable templates for your processes.', 'Nueva plantilla': 'New template',
    'Mis tareas': 'My tasks', 'Pendientes de revisión': 'Pending review', 'Pendientes de aprobación': 'Pending approval', 'No hay workflows con esos filtros.': 'There are no workflows with these filters.',
    'No hay workflows finalizados con esos filtros.': 'There are no completed workflows with these filters.', 'Buscar workflows...': 'Search workflows...', 'Filtrar': 'Filter',
    'Nombre': 'Name', 'Tipo': 'Type', 'Progreso': 'Progress', 'Etapa actual': 'Current stage', 'Responsable': 'Owner', 'Vencimiento': 'Due date', 'Estado': 'Status', 'Acciones': 'Actions',
    'Ver workflow e historial': 'View workflow and history', 'Ver documento': 'View document', 'Ver expediente': 'View record', 'Pausar': 'Pause', 'Reanudar': 'Resume', 'Cancelar': 'Cancel',
    'Detalle': 'Details', 'Participantes': 'Participants', 'Comentarios': 'Comments', 'Historial': 'History', 'Cerrar': 'Close', 'Guardar': 'Save',
    'Cambios sin guardar': 'Unsaved changes', 'Hay cambios sin guardar': 'There are unsaved changes', 'Guarda la plantilla antes de salir o descarta estos cambios.': 'Save the template before leaving or discard these changes.',
    'Continuar editando': 'Continue editing', 'Descartar y salir': 'Discard and leave', 'Observaciones': 'Notes', 'Confirmar': 'Confirm', 'Procesando…': 'Processing…'
  },
  fr: {
    'Todos los workflows': 'Tous les workflows', 'Gestiona y supervisa los flujos de trabajo de documentos y expedientes.': 'Gérez et suivez les flux de travail des documents et dossiers.', 'Iniciar workflow': 'Démarrer un workflow',
    'Workflows activos': 'Workflows actifs', 'Visualiza y gestiona los workflows que se encuentran en curso.': 'Visualisez et gérez les workflows en cours.',
    'Workflows finalizados': 'Workflows terminés', 'Consulta los flujos de trabajo que ya terminaron.': 'Consultez les workflows déjà terminés.',
    'Plantillas de workflows': 'Modèles de workflows', 'Crea y administra plantillas reutilizables para tus procesos.': 'Créez et gérez des modèles réutilisables pour vos processus.', 'Nueva plantilla': 'Nouveau modèle',
    'Mis tareas': 'Mes tâches', 'Pendientes de revisión': 'En attente de révision', 'Pendientes de aprobación': 'En attente d’approbation', 'No hay workflows con esos filtros.': 'Aucun workflow ne correspond à ces filtres.',
    'No hay workflows finalizados con esos filtros.': 'Aucun workflow terminé ne correspond à ces filtres.', 'Buscar workflows...': 'Rechercher des workflows...', 'Filtrar': 'Filtrer',
    'Nombre': 'Nom', 'Tipo': 'Type', 'Progreso': 'Progression', 'Etapa actual': 'Étape actuelle', 'Responsable': 'Responsable', 'Vencimiento': 'Échéance', 'Estado': 'État', 'Acciones': 'Actions',
    'Ver workflow e historial': 'Voir le workflow et l’historique', 'Ver documento': 'Voir le document', 'Ver expediente': 'Voir le dossier', 'Pausar': 'Suspendre', 'Reanudar': 'Reprendre', 'Cancelar': 'Annuler',
    'Detalle': 'Détail', 'Participantes': 'Participants', 'Comentarios': 'Commentaires', 'Historial': 'Historique', 'Cerrar': 'Fermer', 'Guardar': 'Enregistrer',
    'Cambios sin guardar': 'Modifications non enregistrées', 'Hay cambios sin guardar': 'Des modifications ne sont pas enregistrées', 'Guarda la plantilla antes de salir o descarta estos cambios.': 'Enregistrez le modèle avant de quitter ou abandonnez ces modifications.',
    'Continuar editando': 'Continuer la modification', 'Descartar y salir': 'Abandonner et quitter', 'Observaciones': 'Observations', 'Confirmar': 'Confirmer', 'Procesando…': 'Traitement…'
  },
  zh: {
    'Todos los workflows': '全部工作流', 'Gestiona y supervisa los flujos de trabajo de documentos y expedientes.': '管理和监督文档及档案的工作流。', 'Iniciar workflow': '启动工作流',
    'Workflows activos': '进行中的工作流', 'Visualiza y gestiona los workflows que se encuentran en curso.': '查看和管理正在进行的工作流。',
    'Workflows finalizados': '已完成的工作流', 'Consulta los flujos de trabajo que ya terminaron.': '查看已经完成的工作流。',
    'Plantillas de workflows': '工作流模板', 'Crea y administra plantillas reutilizables para tus procesos.': '为您的流程创建和管理可复用模板。', 'Nueva plantilla': '新建模板',
    'Mis tareas': '我的任务', 'Pendientes de revisión': '待审核', 'Pendientes de aprobación': '待批准', 'No hay workflows con esos filtros.': '没有符合这些筛选条件的工作流。',
    'No hay workflows finalizados con esos filtros.': '没有符合这些筛选条件的已完成工作流。', 'Buscar workflows...': '搜索工作流...', 'Filtrar': '筛选',
    'Nombre': '名称', 'Tipo': '类型', 'Progreso': '进度', 'Etapa actual': '当前阶段', 'Responsable': '负责人', 'Vencimiento': '截止日期', 'Estado': '状态', 'Acciones': '操作',
    'Ver workflow e historial': '查看工作流和历史记录', 'Ver documento': '查看文档', 'Ver expediente': '查看档案', 'Pausar': '暂停', 'Reanudar': '恢复', 'Cancelar': '取消',
    'Detalle': '详情', 'Participantes': '参与者', 'Comentarios': '评论', 'Historial': '历史记录', 'Cerrar': '关闭', 'Guardar': '保存',
    'Cambios sin guardar': '未保存的更改', 'Hay cambios sin guardar': '存在未保存的更改', 'Guarda la plantilla antes de salir o descarta estos cambios.': '离开前请保存模板或放弃这些更改。',
    'Continuar editando': '继续编辑', 'Descartar y salir': '放弃并离开', 'Observaciones': '备注', 'Confirmar': '确认', 'Procesando…': '处理中…'
  }
};

for (const language of Object.keys(WORKFLOW_PAGE_TEXT) as LanguageCode[]) {
  Object.assign(FEATURE_TEXT[language], WORKFLOW_PAGE_TEXT[language]);
}

export function navigationLabel(language: LanguageCode, label: string): string {
  const key = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return NAVIGATION_LABELS[language][key] ?? label;
}

export function roleLabel(language: LanguageCode, role: string): string {
  return ROLE_LABELS[language][role] ?? role;
}

export function featureText(language: LanguageCode, source: string): string {
  if (language === 'es') return source;
  const cache = resolvedText[language];
  let value = cache.get(source);
  if (value === undefined) {
    value = resolveText(language, source, 0) ?? source;
    cache.set(source, value);
  }
  return value;
}

/*
 * Resolución tolerante: además de la coincidencia exacta, acepta diferencias de
 * mayúsculas/tildes, símbolos decorativos ("+ ", " →", ":", "*"), textos
 * compuestos con " · " y frases con datos variables (TEXT_PATTERNS).
 */
const resolvedText: Record<LanguageCode, Map<string, string>> = { es: new Map(), en: new Map(), fr: new Map(), zh: new Map() };
const normalizedIndexes: Partial<Record<LanguageCode, Map<string, string>>> = {};
const DECORATION = /^([+＋←✕⚡•●✓·⏸▽▦☷▷▣↓]\s*)?(.*?)(\s*(?:→|\*|:|\.\.\.|…))?$/su;

function normalizeKey(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizedIndex(language: LanguageCode): Map<string, string> {
  let index = normalizedIndexes[language];
  if (!index) {
    index = new Map();
    for (const table of [NAVIGATION_LABELS, ROLE_LABELS, FEATURE_TEXT]) {
      for (const [key, value] of Object.entries(table[language])) index.set(normalizeKey(key), value);
    }
    normalizedIndexes[language] = index;
  }
  return index;
}

function matchCase(source: string, value: string): string {
  const isUpper = source === source.toUpperCase() && source !== source.toLowerCase() && source.length > 1;
  return isUpper ? value.toUpperCase() : value;
}

function resolveText(language: LanguageCode, text: string, depth: number): string | undefined {
  if (depth > 4 || !text.trim()) return undefined;
  const exact = FEATURE_TEXT[language][text];
  if (exact !== undefined) return exact;
  const normalized = normalizedIndex(language).get(normalizeKey(text));
  if (normalized !== undefined) return matchCase(text, normalized);

  for (const pattern of TEXT_PATTERNS) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    return pattern.t[language].replace(/\{(\d)\}/g, (_, index: string) => {
      const part = match[Number(index)] ?? '';
      return resolveText(language, part, depth + 1) ?? part;
    });
  }

  // Separadores conservados: "Inicio · Actividad", "DEFAULT → ¿Aprobado?".
  const segments = text.split(/( · | → )/);
  if (segments.length > 1) {
    let changed = false;
    const translated = segments.map((segment, index) => {
      if (index % 2 === 1) return segment;
      const value = resolveText(language, segment, depth + 1);
      if (value !== undefined) changed = true;
      return value ?? segment;
    });
    if (changed) return translated.join('');
  }

  const decorated = DECORATION.exec(text);
  if (decorated && (decorated[1] || decorated[3]) && decorated[2]) {
    const core = resolveText(language, decorated[2], depth + 1);
    if (core !== undefined) return `${decorated[1] ?? ''}${core}${decorated[3] ?? ''}`;
  }
  return undefined;
}

Object.assign(NAVIGATION_LABELS.en, { 'Facturacion e ingresos': 'Billing and revenue' });
Object.assign(NAVIGATION_LABELS.fr, { 'Facturacion e ingresos': 'Facturation et revenus' });
Object.assign(NAVIGATION_LABELS.zh, { 'Facturacion e ingresos': '账单与收入' });

/** Shell profile and accessibility copy translated through i18nContent. */
const SHELL_TEXT: LanguageLabels = {
  es: {},
  en: {
    'Abrir mi perfil': 'Open my profile', 'Opciones de usuario': 'User options', 'Mi Perfil': 'My profile', 'Configuración': 'Settings', 'Cerrar sesión': 'Sign out', 'Abrir menú': 'Open menu', 'Buscar en NexoDocs': 'Search NexoDocs', 'Notificaciones': 'Notifications', 'Ayuda': 'Help', 'Centro de ayuda': 'Help center', 'Foto de perfil': 'Profile photo', 'MI CUENTA': 'MY ACCOUNT', 'Mi perfil': 'My profile', 'Gestiona tu información personal.': 'Manage your personal information.', 'Cerrar': 'Close', 'Cambiar foto': 'Change photo', 'Organización': 'Organization', 'Usuario': 'User', 'JPG, PNG o WEBP · máximo 2 MB': 'JPG, PNG or WEBP · maximum 2 MB', 'Secciones del perfil': 'Profile sections', 'Perfil': 'Profile', 'Seguridad': 'Security', 'Accesos': 'Access', 'Nombre(s) *': 'First name(s) *', 'Apellidos *': 'Last name *', 'Correo electrónico *': 'Email *', 'Teléfono': 'Phone', 'Cargo / rol': 'Position / role', 'Biografía / descripción': 'Biography / description', 'Cuéntanos brevemente sobre tu función.': 'Tell us briefly about your role.', 'Cancelar': 'Cancel', 'Guardando…': 'Saving…', 'Guardar cambios': 'Save changes', 'Seguridad de la cuenta': 'Account security', 'Actualiza tu contraseña. La sesión actual se mantiene protegida.': 'Update your password. Your current session remains protected.', 'Contraseña actual *': 'Current password *', 'Nueva contraseña *': 'New password *', 'Confirmar nueva contraseña *': 'Confirm new password *', 'Al menos 8 caracteres.': 'At least 8 characters.', 'Actualizando…': 'Updating…', 'Actualizar contraseña': 'Update password', 'Preferencias de notificación': 'Notification preferences', 'Elige cómo deseas recibir las novedades de tu organización.': 'Choose how you want to receive organization updates.', 'Notificaciones por correo': 'Email notifications', 'Recibe avisos de documentos, expedientes y tareas en tu correo.': 'Receive document, record and task alerts by email.', 'Notificaciones en la aplicación': 'In-app notifications', 'Muestra alertas dentro de NexoDocs mientras tengas la sesión activa.': 'Show alerts in NexoDocs while your session is active.', 'Guardar preferencias': 'Save preferences', 'Listo': 'Done'
  },
  fr: {
    'Abrir mi perfil': 'Ouvrir mon profil', 'Opciones de usuario': 'Options utilisateur', 'Mi Perfil': 'Mon profil', 'Configuración': 'Paramètres', 'Cerrar sesión': 'Se déconnecter', 'Abrir menú': 'Ouvrir le menu', 'Buscar en NexoDocs': 'Rechercher dans NexoDocs', 'Notificaciones': 'Notifications', 'Ayuda': 'Aide', 'Centro de ayuda': 'Centre d’aide', 'Foto de perfil': 'Photo de profil', 'MI CUENTA': 'MON COMPTE', 'Mi perfil': 'Mon profil', 'Gestiona tu información personal.': 'Gérez vos informations personnelles.', 'Cerrar': 'Fermer', 'Cambiar foto': 'Changer la photo', 'Organización': 'Organisation', 'Usuario': 'Utilisateur', 'JPG, PNG o WEBP · máximo 2 MB': 'JPG, PNG ou WEBP · 2 Mo maximum', 'Secciones del perfil': 'Sections du profil', 'Perfil': 'Profil', 'Seguridad': 'Sécurité', 'Accesos': 'Accès', 'Nombre(s) *': 'Prénom(s) *', 'Apellidos *': 'Nom *', 'Correo electrónico *': 'E-mail *', 'Teléfono': 'Téléphone', 'Cargo / rol': 'Poste / rôle', 'Biografía / descripción': 'Biographie / description', 'Cuéntanos brevemente sobre tu función.': 'Décrivez brièvement votre fonction.', 'Cancelar': 'Annuler', 'Guardando…': 'Enregistrement…', 'Guardar cambios': 'Enregistrer les modifications', 'Seguridad de la cuenta': 'Sécurité du compte', 'Actualiza tu contraseña. La sesión actual se mantiene protegida.': 'Mettez à jour votre mot de passe. Votre session reste protégée.', 'Contraseña actual *': 'Mot de passe actuel *', 'Nueva contraseña *': 'Nouveau mot de passe *', 'Confirmar nueva contraseña *': 'Confirmer le nouveau mot de passe *', 'Al menos 8 caracteres.': 'Au moins 8 caractères.', 'Actualizando…': 'Mise à jour…', 'Actualizar contraseña': 'Mettre à jour le mot de passe', 'Preferencias de notificación': 'Préférences de notification', 'Elige cómo deseas recibir las novedades de tu organización.': 'Choisissez comment recevoir les actualités de votre organisation.', 'Notificaciones por correo': 'Notifications par e-mail', 'Recibe avisos de documentos, expedientes y tareas en tu correo.': 'Recevez les alertes de documents, dossiers et tâches par e-mail.', 'Notificaciones en la aplicación': 'Notifications dans l’application', 'Muestra alertas dentro de NexoDocs mientras tengas la sesión activa.': 'Affichez les alertes dans NexoDocs pendant votre session.', 'Guardar preferencias': 'Enregistrer les préférences', 'Listo': 'Terminé'
  },
  zh: {
    'Abrir mi perfil': '打开我的个人资料', 'Opciones de usuario': '用户选项', 'Mi Perfil': '我的个人资料', 'Configuración': '设置', 'Cerrar sesión': '退出登录', 'Abrir menú': '打开菜单', 'Buscar en NexoDocs': '搜索 NexoDocs', 'Notificaciones': '通知', 'Ayuda': '帮助', 'Centro de ayuda': '帮助中心', 'Foto de perfil': '个人资料照片', 'MI CUENTA': '我的账户', 'Mi perfil': '我的个人资料', 'Gestiona tu información personal.': '管理您的个人信息。', 'Cerrar': '关闭', 'Cambiar foto': '更换照片', 'Organización': '组织', 'Usuario': '用户', 'JPG, PNG o WEBP · máximo 2 MB': 'JPG、PNG 或 WEBP · 最大 2 MB', 'Secciones del perfil': '个人资料部分', 'Perfil': '个人资料', 'Seguridad': '安全', 'Accesos': '访问权限', 'Nombre(s) *': '名字 *', 'Apellidos *': '姓氏 *', 'Correo electrónico *': '电子邮箱 *', 'Teléfono': '电话', 'Cargo / rol': '职位 / 角色', 'Biografía / descripción': '个人简介 / 描述', 'Cuéntanos brevemente sobre tu función.': '简要介绍您的职责。', 'Cancelar': '取消', 'Guardando…': '正在保存…', 'Guardar cambios': '保存更改', 'Seguridad de la cuenta': '账户安全', 'Actualiza tu contraseña. La sesión actual se mantiene protegida.': '更新您的密码。当前会话仍受保护。', 'Contraseña actual *': '当前密码 *', 'Nueva contraseña *': '新密码 *', 'Confirmar nueva contraseña *': '确认新密码 *', 'Al menos 8 caracteres.': '至少 8 个字符。', 'Actualizando…': '正在更新…', 'Actualizar contraseña': '更新密码', 'Preferencias de notificación': '通知偏好', 'Elige cómo deseas recibir las novedades de tu organización.': '选择接收组织动态的方式。', 'Notificaciones por correo': '电子邮件通知', 'Recibe avisos de documentos, expedientes y tareas en tu correo.': '通过电子邮件接收文档、档案和任务提醒。', 'Notificaciones en la aplicación': '应用内通知', 'Muestra alertas dentro de NexoDocs mientras tengas la sesión activa.': '会话处于活动状态时在 NexoDocs 中显示提醒。', 'Guardar preferencias': '保存偏好', 'Listo': '完成'
  }
};
for (const language of Object.keys(SHELL_TEXT) as LanguageCode[]) Object.assign(FEATURE_TEXT[language], SHELL_TEXT[language]);

const SHELL_PROFILE_ACTIVITY_TEXT: LanguageLabels = {
  es: {},
  en: { 'Mi actividad de workflows': 'My workflow activity', 'Tareas asignadas': 'Assigned tasks', 'No tienes tareas pendientes.': 'You have no pending tasks.', 'Workflows activos': 'Active workflows', 'No tienes workflows activos asignados.': 'You have no assigned active workflows.', 'Historial de aprobaciones': 'Approval history', 'Aún no hay decisiones registradas.': 'There are no recorded decisions yet.', 'Accesos asignados': 'Assigned access', 'Estos datos provienen de tu cuenta autenticada y no pueden modificarse desde el perfil.': 'This information comes from your authenticated account and cannot be changed from the profile.', 'Roles': 'Roles', 'Estado': 'Status' },
  fr: { 'Mi actividad de workflows': 'Mon activité de workflows', 'Tareas asignadas': 'Tâches attribuées', 'No tienes tareas pendientes.': 'Vous n’avez aucune tâche en attente.', 'Workflows activos': 'Workflows actifs', 'No tienes workflows activos asignados.': 'Vous n’avez aucun workflow actif attribué.', 'Historial de aprobaciones': 'Historique des approbations', 'Aún no hay decisiones registradas.': 'Aucune décision n’est encore enregistrée.', 'Accesos asignados': 'Accès attribués', 'Estos datos provienen de tu cuenta autenticada y no pueden modificarse desde el perfil.': 'Ces informations proviennent de votre compte authentifié et ne peuvent pas être modifiées depuis le profil.', 'Roles': 'Rôles', 'Estado': 'État' },
  zh: { 'Mi actividad de workflows': '我的工作流活动', 'Tareas asignadas': '已分配任务', 'No tienes tareas pendientes.': '您没有待处理任务。', 'Workflows activos': '活动工作流', 'No tienes workflows activos asignados.': '您没有被分配的活动工作流。', 'Historial de aprobaciones': '审批历史', 'Aún no hay decisiones registradas.': '尚未记录任何决定。', 'Accesos asignados': '已分配访问权限', 'Estos datos provienen de tu cuenta autenticada y no pueden modificarse desde el perfil.': '这些数据来自您的已验证账户，无法在个人资料中修改。', 'Roles': '角色', 'Estado': '状态' }
};
for (const language of Object.keys(SHELL_PROFILE_ACTIVITY_TEXT) as LanguageCode[]) Object.assign(FEATURE_TEXT[language], SHELL_PROFILE_ACTIVITY_TEXT[language]);

for (const language of Object.keys(PAGE_TEXT) as LanguageCode[]) {
  for (const [key, value] of Object.entries(PAGE_TEXT[language])) FEATURE_TEXT[language][key] ??= value;
}
