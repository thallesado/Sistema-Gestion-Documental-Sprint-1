### Respaldos y restauración
Los respaldos guardan una copia de los datos y archivos de tu organización para poder recuperarla. Están en Respaldos > Respaldos y restauración (`/settings/backups`) y requieren el permiso `backup:read` para verse.

#### 1. Crear un respaldo
1. Entra a Respaldos > Respaldos y restauración.
2. Pulsa "Crear respaldo" (requiere `backup:create`).
3. Espera a que el estado sea Completado; el sistema calcula una huella SHA-256 para comprobar su integridad.

#### 2. Respaldo automático y retención
- En "Configuración" (requiere `backup:configure`) defines la hora diaria, la zona horaria y los días de retención (de 1 a 365).
- Cada día se genera una copia automática a esa hora. Si el servidor estaba apagado, hace la copia del día al volver, sin inventar las de días anteriores.
- La retención elimina los respaldos ordinarios vencidos. Los respaldos de seguridad y la evidencia de restauraciones no se eliminan.

#### 3. Descargar un respaldo
- Abre el Detalle del respaldo y pulsa "Descargar ZIP" (requiere `backup:download`). El sistema verifica el paquete antes de habilitar la descarga.
- El ZIP contiene datos de tu organización sin cifrar: guárdalo en un lugar seguro. Los respaldos viven en el mismo servidor que el sistema, por lo que conviene guardar también una copia externa.

#### 4. Restaurar un respaldo
1. Abre el respaldo y pulsa "Restaurar" (requiere `backup:restore`).
2. El sistema verifica que el paquete sea válido y compatible.
3. Escribe exactamente el nombre de la organización para confirmar y pulsa "Restaurar respaldo".
4. Antes de restaurar se crea automáticamente un respaldo de seguridad protegido, y las modificaciones de tu organización se suspenden temporalmente. Las demás organizaciones no se ven afectadas.
5. Los cambios hechos después del respaldo dejan de estar vigentes. La auditoría original se conserva, y el estado anterior queda disponible en el respaldo de seguridad (Consultar evidencia).

Si cambió la estructura del sistema después de crear un respaldo, ese respaldo puede ser incompatible y no podrá restaurarse; crea uno nuevo.
