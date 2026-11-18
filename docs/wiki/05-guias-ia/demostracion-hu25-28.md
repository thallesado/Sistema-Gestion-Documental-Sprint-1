# Guia para demostrar HU-25, HU-26, HU-27 y HU-28

> Revisión documental: 2026-11-18. Fuente: checkout `4d7c663` mas cambios locales. Cuentas y acceso verificados por HTTP en localhost:4201. Los pasos se contrastaron con la interfaz y la auditoria local; esta guia no implica que se haya repetido manualmente cada recorrido al escribirla.

## 1. Donde entrar y con que cuentas

**Usar http://localhost:4201.** El puerto 4200 conserva imagenes y esquema anteriores. Seleccionar la organizacion **FinoCode**. Si acabas de actualizar la interfaz, recargar con Ctrl + F5.

Las siguientes son contrasenas publicas de demostracion para cuentas sinteticas, no credenciales privadas. Se verificaron ambos inicios de sesion al preparar esta guia; no se modificaron usuarios ni contrasenas. Estas cuentas no se crean en EC2 por publicar este Markdown.

| Uso en la demostracion | Correo de acceso | Usuario alternativo | Contrasena DEMO |
|---|---|---|---|
| Laura: administracion, entregas, archivo fisico, solicitar traducciones y buzon | `laura@acme.com` | `laura.martinez` | `DemoPass123!` |
| Otra persona: revisar y publicar traducciones | `revisor.hu27@example.com` | `revisor.hu27` | `DemoTraduccion27!` |

Tenant FinoCode verificado: `20000000-0000-0000-0000-000000000001`.

Para no cambiar de sesion continuamente, usar Laura en la ventana normal y el revisor en una ventana de incognito. El destinatario externo de HU-25 abre el enlace de su correo en otra ventana y no necesita cuenta NexoDocs.

No se incluyen en esta guia la contrasena del Gmail, su contrasena de aplicacion, claves SMTP/Gemini, enlaces privados ni codigos OTP. El Gmail receptor es la cuenta que ya configuraste en el perfil **Buzon Gmail FinoCode**; el destinatario de la entrega debe ser una cuenta tuya a la que puedas acceder y que el proveedor SMTP permita.

## 2. Preparar la exposicion

1. Tener levantados `nexodocs-pruebas-frontend-1`, `nexodocs-pruebas-backend-1` y `nexodocs-pruebas-postgres-1`.
2. Entrar como Laura y comprobar que aparecen las cuatro rutas:
   - Entregas externas: http://localhost:4201/deliveries.
   - Archivo fisico: http://localhost:4201/physical-archive.
   - Traducciones: http://localhost:4201/translations.
   - Buzon documental: http://localhost:4201/mail-intake.
3. Abrir el correo del destinatario para HU-25 y el Gmail receptor para HU-28.
4. Preparar un PDF pequeno con texto y datos ficticios; para el buzon, preferir menos de 1 MB.
5. Elegir un sufijo nuevo para cada demostracion, por ejemplo `DEMO-1811-A`. Asi no se repiten codigos al ensayar.

Se comprobaron documentos aprobados `DEMO-DOC-001`, `DEMO-DOC-002` y `DEMO-DOC-003`, 20 opciones de version para entregas y una ubicacion fisica disponible. Estos son datos del entorno local en la fecha indicada; si otra persona los cambia, elegir opciones vigentes del selector.

## 3. HU-25: entrega documental a una persona externa

**Que demuestra:** compartir una version aprobada, verificar el correo del destinatario y revocar el acceso.

**Cuenta:** Laura. **Menu:** Documentos → Entregas externas.

### Crear y enviar

1. Abrir `/deliveries` y pulsar **Nueva entrega**.
2. Seleccionar un documento y su version aprobada, por ejemplo una opcion de `DEMO-DOC-001` si esta disponible.
3. Completar nombre del destinatario: `Destinatario DEMO-1811-A`.
4. Poner un correo que controles. Si se usa el sandbox de Mailgun, debe estar autorizado por ese proveedor.
5. Indicar vigencia, por ejemplo **1 hora**, y activar **Permitir descarga**.
6. Escribir motivo: `Demostracion de entrega externa autorizada`.
7. Pulsar **Confirmar y enviar**.
8. Mostrar la fila creada y su **Historial**. Si sigue pendiente, esperar al worker; no crear otra entrega igual por impaciencia.

**Resultado esperado:** se registra una entrega de una version fija y el envio pasa a aceptado por SMTP. Ese estado por si solo no acredita llegada al correo: comprobar la bandeja y spam del destinatario.

### Abrir como destinatario

9. En el correo recibido, abrir el enlace completo en una ventana independiente. No copiar tokens a diapositivas o capturas publicas.
10. En el portal pulsar **Enviar codigo al correo registrado**.
11. Consultar el segundo correo, introducir el codigo de seis digitos y pulsar **Verificar y continuar**.
12. Pulsar **Visualizar version** o **Descargar copia**.

**Resultado esperado:** el destinatario ve solo el archivo de esa entrega, sin iniciar sesion interna ni acceder a documentos de la organizacion.

### Revocar y comprobar

13. Volver a Laura, abrir `/deliveries` y pulsar **Revocar** sobre esa entrega.
14. Indicar un motivo, por ejemplo `Fin de la demostracion`.
15. Volver al portal y solicitar nuevamente el contenido.

**Resultado esperado:** el acceso nuevo queda bloqueado. La revocacion no borra una copia que ya fue descargada.

**Frase para exponer:** «La organizacion entrega una version concreta; el destinatario verifica su correo y el acceso puede revocarse».

**Capturar:** fila con estado de envio, portal verificado sin codigo visible e historial de revocacion.

## 4. HU-26: archivo fisico y prestamos

**Que demuestra:** localizar un original, registrar su prestamo y confirmar su devolucion con historial.

**Cuenta para el recorrido basico:** Laura, que tiene permisos de administracion y de todas las transiciones fisicas. **Menu:** Expedientes → Archivo fisico.

Este recorrido con Laura demuestra el ciclo funcional. Para exponer separacion de responsabilidades, usar cuentas adicionales con los permisos indicados en la [guia de roles de HU-26](../04-dominio-y-negocio/archivo-fisico-y-prestamos.md); no asumir que cualquier usuario existente ya tiene permisos de solicitante o custodio.

### Registrar una unidad fisica

1. Abrir `/physical-archive`.
2. Usar una ubicacion activa existente o crear otra en **Ubicaciones**, por ejemplo `Estante DEMO-1811-A`, con **Crear ubicacion**.
3. Pulsar **Registrar original**.
4. Completar:

   | Campo | Ejemplo |
   |---|---|
   | Codigo | `FIS-DEMO-1811-A` |
   | Nombre | `Carpeta de contratos ficticios` |
   | Ubicacion | La ubicacion preparada |
   | Custodio | Laura Martinez, para este recorrido basico |
   | Condicion | `Carpeta completa y sin deterioro visible` |
   | Documento/expediente digital | Opcional; puede dejarse sin vinculo |

5. Pulsar **Guardar ficha** y abrir su detalle.

**Resultado esperado:** original disponible, con ubicacion, condicion y custodio. No hace falta subir un PDF para representar papel.

### Solicitar, reservar y entregar

6. Solicitar el prestamo con motivo `Consulta para demostracion` y fecha de devolucion futura, por ejemplo manana.
7. Mostrar la solicitud registrada. Todavia no equivale a una entrega.
8. Pulsar **Reservar**, indicar el motivo y confirmar el movimiento.
9. Mostrar el original reservado.
10. Pulsar **Confirmar entrega fisica**, indicar condicion/motivo y marcar la confirmacion de que la entrega ocurrio.
11. Confirmar el movimiento.

**Resultado esperado:** original prestado y solicitud entregada. La confirmacion debe representar una entrega real de la carpeta de demostracion; el sistema no mueve papel por si mismo.

### Recibir la devolucion

12. Pulsar **Recibir devolucion**.
13. Seleccionar la ubicacion de retorno, describir la condicion y confirmar la recepcion fisica.
14. Completar la devolucion.
15. Mostrar la disponibilidad recuperada y el historial de solicitud, reserva, entrega y devolucion.

**Resultado esperado:** vuelve a disponible si se devuelve completo. Para una segunda demostracion, marcar incidencia: queda en incidencia hasta registrar la comprobacion y resolverla.

**Frase para exponer:** «Una reserva no es una entrega; una fecha vencida no es una devolucion. Cada movimiento conserva quien lo confirmo».

**Capturar:** detalle disponible, original prestado e historial tras devolver. No retirar definitivamente la ficha solo para limpiar la demostracion.

## 5. HU-27: traduccion y publicacion de una copia

**Que demuestra:** traducir un PDF sin modificar el original, exigir otra persona para revisarlo y crear una copia derivada.

**Cuentas:** Laura solicita; `revisor.hu27` revisa y publica. **Menu:** Documentos → Traducciones.

### Opcion rapida: usar la solicitud preparada

Existe una solicitud preparada sobre `DEMO-DOC-003`, espanol a ingles, verificada en `REVIEW_PENDING` al escribir esta guia:

`1bfa8384-f51e-46f6-945e-9a4718605858`.

Se puede abrir desde el listado de `/translations` y continuar directamente con la revision. Usarla una sola vez: despues de publicarla ya no sera una solicitud pendiente.

### Crear una traduccion nueva

1. Con Laura abrir `/translations` y pulsar **Nueva traduccion**.
2. Elegir un PDF con texto verificable y su version. Limites del MVP: 10 paginas y 20.000 caracteres; no usar un PDF escaneado sin texto ni DOCX.
3. Elegir idiomas diferentes y un destino sin otra solicitud activa para esa misma version. Por ejemplo espanol a frances si los datos actuales lo permiten.
4. Leer y aceptar expresamente el envio del texto a Google; usar datos ficticios.
5. Pulsar **Iniciar traduccion** y esperar la respuesta del proveedor.
6. Abrir la solicitud como Laura y mostrar que no puede revisarse/publicarse a si misma.

**Resultado esperado:** solicitud pendiente de revision, con texto de origen y traduccion. Si el proveedor falla, se muestra un fallo y no se publica contenido inventado.

### Revisar con otra persona y publicar

7. En incognito iniciar sesion en FinoCode con `revisor.hu27@example.com` y `DemoTraduccion27!`.
8. Abrir `/translations` y la solicitud creada o preparada.
9. Comparar original y traduccion. Si corresponde, corregir el texto y usar **Guardar edicion**; para aceptarlo, usar **Aceptar segmento**.
10. Pulsar **Publicar copia derivada** y completar el titulo que solicite el formulario.
11. Abrir el documento derivado y descargar su PDF.
12. Volver al original y comprobar que conserva su version y archivo.

**Resultado esperado:** solicitud publicada y otro documento con PDF propio. La copia es una traduccion no certificada y queda como borrador documental; la revision editorial no es aprobacion institucional.

**Frase para exponer:** «La IA propone la traduccion; otra persona la revisa y se publica una copia separada, conservando el original».

**Capturar:** original/traduccion, revision desde la otra cuenta, copia publicada y original conservado. No afirmar calidad medica o certificacion legal.

## 6. HU-28: recepcion automatica de adjuntos por correo

**Que demuestra:** recibir un adjunto por IMAP, mostrar el avance de descarga y permitir descargarlo desde el buzon.

**Cuenta:** Laura. **Menu:** Digitalizacion → Buzon documental. **Alcance acordado:** sin antivirus, sin revision humana y sin incorporacion al archivo general.

1. Abrir `/mail-intake` y localizar la conexion **Gmail FinoCode**.
2. Si esta desconectada, pulsar **Probar conexion**. Debe quedar conectada y habilitada.
3. Verificar en **Editar reglas** que **Asunto contiene** y **Remitente exacto** esten vacios si se quiere aceptar cualquier asunto/remitente.
4. Desde otra cuenta, enviar un mensaje nuevo al Gmail configurado. Ejemplo de asunto: `Factura ficticia DEMO-1811-A`. **No es obligatorio escribir HU28**.
5. Adjuntar un PDF real y pequeno, por ejemplo de 52 KB. Un enlace a Drive no es un archivo adjunto para este recorrido.
6. Comprobar que llego a Recibidos del Gmail y dejar habilitada la sincronizacion automatica. Para una demostracion mas inmediata, pulsar **Sincronizar** una sola vez.
7. Mostrar el panel **Recepcion de documentos**: cola, consulta de correos, descarga con nombre/bytes cuando se detecta el adjunto, y resultado final. No volver a sincronizar mientras esta ocupado.
8. Esperar la actualizacion automatica y localizar el archivo en la tabla central.
9. Pulsar **Ver recepcion** para mostrar remitente, asunto, fecha, tamano y estado.
10. Pulsar **Descargar adjunto** y abrir la copia descargada con el visor local que uses para la demostracion.
11. Sincronizar nuevamente: el mismo adjunto del mismo mensaje no debe duplicarse.

**Resultado esperado:** archivo recibido y descargable. En este modo no se muestran acciones de Revisar, antivirus ni Incorporar. No se crea un documento en el archivo general. Los adjuntos rechazados por formato/tamano/estructura conservan su estado y no se ofrecen para descarga.

**Frase para exponer:** «Este buzon centraliza automaticamente los archivos que llegan al correo y muestra su recepcion; no exige aprobacion ni ejecuta un antivirus en el alcance actual».

**Capturar:** conexion conectada, panel de descarga, fila Recibido y detalle. Evitar mostrar contrasenas o datos privados de correo.

## 7. Orden sugerido y tiempos de espera

Orden practico: iniciar HU-25 y revisar el correo; recorrer HU-26; mostrar HU-27 con la solicitud preparada; terminar con HU-28 enviando el PDF pequeno. Si se crea una traduccion nueva, solicitarla antes de empezar otro recorrido para aprovechar la espera.

No prometer segundos exactos: el worker, el tamano del archivo y los proveedores externos afectan los tiempos. No presentar «en cola» como «correo entregado» ni «adjunto recibido» antes de que la descarga termine.

## 8. Problemas frecuentes durante la exposicion

| Sintoma | Que comprobar |
|---|---|
| Credenciales invalidas | Puerto 4201, organizacion FinoCode y cuenta de la tabla. No usar 4200 por costumbre. |
| Una accion no aparece | Cuenta correcta, permiso efectivo y estado del registro; para traducir, el solicitante no puede ser revisor. |
| HU-25 no tiene documentos elegibles | Elegir una version actual aprobada, con archivo, y visible para Laura. |
| No llega el correo externo | Pendiente/fallo en historial, autorizacion del destinatario en el sandbox, bandeja/spam y configuracion SMTP. |
| No abre el portal desde otro equipo | Un enlace con localhost apunta a ese otro equipo. Para exponer fuera de la PC se necesita la URL publica HTTPS correctamente configurada. |
| HU-26 no permite reservar | Original disponible, fecha futura y rol/custodia correctos. No hay dos prestamos activos del mismo original. |
| HU-27 avisa traduccion activa | Abrir la solicitud existente o elegir otra version/destino; no crear duplicados del mismo trabajo. |
| HU-28 conectado pero sin archivos | Correo en INBOX, adjunto real, enviado despues de activar la conexion y filtros correctos; mirar el progreso. Cambiar filtros no relee automaticamente mensajes omitidos por el cursor. |
| HU-28 muestra cuarentena | Fallo tecnico de formato/estructura/tamano. Probar un PDF ficticio valido y pequeno; no presentarlo como deteccion de virus. |

## 9. Que se puede afirmar al terminar

«Se demostraron las cuatro funciones en el entorno local: entrega externa controlada, custodia fisica, traduccion revisada y recepcion automatica de adjuntos. El buzon tiene el alcance reducido acordado y la traduccion corresponde al MVP PDF. El despliegue en EC2 requiere su propia configuracion y verificacion».

Para pasar a main/EC2: [correspondencia de contenedores y preparacion](../06-operacion/preparacion-main-ec2-hu25-28.md). Para las pruebas ya ejecutadas: [auditoria de las cuatro HU](../04-dominio-y-negocio/auditoria-hu25-28.md). Para permisos de revision: [cuenta de HU-27](../04-dominio-y-negocio/traduccion-pruebas-locales.md).

Las credenciales de demostracion anteriores no son una garantia de que esas mismas cuentas existan en EC2. No publicar credenciales privadas ni usar las contrasenas DEMO para usuarios con datos reales.
