### Digitalización y Reconocimiento Óptico (OCR)
El módulo de **Digitalización** de NexoDocs convierte documentos físicos (recetas, informes, formularios, facturas, contratos) escaneados o fotografiados en documentos digitales indexados. Sirve a cualquier rubro, no solo al clínico.

#### 1. ¿Cómo procesar un documento?
1. **Captura o carga**: En Digitalización > Escanear documento sube un PDF, JPEG, PNG o WebP, o captura el documento con la cámara del equipo.
2. **Reconocimiento con IA**: Un modelo de IA lee la imagen y extrae el texto y los campos que identifica. El resultado depende de la calidad de la imagen.
3. **Revisión humana**: En Digitalización > Procesamiento OCR el trabajo queda "Por validar". Corrige los campos y pulsa "Confirmar extracción", o "Rechazar resultado" si no sirve.
4. **Indexación**: En Indexación pulsa "Indexar Documento" para crear el documento en el repositorio con su versión 1. Después puedes ajustar sus metadatos en Corrección de metadatos mientras siga en borrador.

#### 2. Límites de páginas por mes
Cada página procesada (en un PDF, cada página cuenta) se descuenta de la cuota mensual de tu plan (*maxOcrPagesPerMonth*). Si se alcanza el límite, el sistema rechaza nuevos trabajos hasta el mes siguiente o hasta cambiar de plan.

#### 3. Consejos para mejorar la precisión
- **Iluminación**: evita reflejos y zonas oscuras al fotografiar.
- **Enfoque y resolución**: usa texto nítido; en escaneos se recomienda 300 DPI o más.
- **Encuadre**: el documento debe verse completo, derecho y sin recortes. El sistema no endereza ni corrige imágenes torcidas.
- El OCR solo transcribe texto; no interpreta imágenes médicas como radiografías.
