# Digitalización y Reconocimiento OCR Clínico

El módulo de **Digitalización y OCR Clínico** de NexoDocs permite transformar documentos físicos, recetas médicas, informes de laboratorio e historias clínicas escaneadas o fotografiadas en registros digitales indexados y procesables.

---

## 1. ¿Cómo funciona el procesamiento OCR?

1. **Captura o Carga**: Puedes subir documentos en formatos PDF, TIFF, PNG o JPEG, o utilizar la cámara web integrada para capturar recetas y hojas clínicas en tiempo real.
2. **Preprocesamiento Óptico**: El motor realiza corrección de perspectiva, eliminación de sombras, binarización y normalización del contraste para optimizar la legibilidad.
3. **Reconocimiento Inteligente**: Los modelos de IA analizan la imagen para extraer texto y campos clínicos estructurados (identificación del paciente, diagnóstico CIE-10, médico tratante, fecha de atención, posología y observaciones).
4. **Revisión y Validación Humana**: El personal médico o administrativo revisa el texto extraído en una pantalla comparativa de dos paneles antes de confirmar la indexación final.

---

## 2. Límites y Consumo del Plan

- Cada página procesada se contabiliza contra el límite mensual de tu suscripción (`maxOcrPagesPerMonth`).
- Si tu organización alcanza el límite mensual, el sistema mostrará una advertencia informativa con opción de solicitar una ampliación de cuota o actualizar de plan.
- Puedes consultar el consumo actual en cualquier momento desde **Configuración > Apariencia y Uso** o en el resumen del dashboard.

---

## 3. Consejos para Mejorar la Precisión del OCR

- **Iluminación**: Evita reflejos y sombras directas sobre el documento al tomar fotografías con la cámara.
- **Enfoque y Resolución**: Asegúrate de que el texto manuscrito o impreso sea nítido. Se recomienda una resolución mínima de 300 DPI en escaneos.
- **Alineación**: Centra el papel dentro del visor guía para que los bordes del documento coincidan con el marco sugerido.
