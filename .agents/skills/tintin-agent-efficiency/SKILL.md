---
name: tintin-agent-efficiency
description: "Use for efficient cloud agent work in Tintín: reduce token use, context noise, redundant searches and unnecessary test runs without skipping evidence."
---

# Eficiencia real del agente en Tintín
1. Leer el pedido, AGENTS.md y solo documentación vinculada a los módulos tocados.
2. Localizar los archivos canónicos con una búsqueda dirigida; no recorrer todo el repo sin necesidad.
3. No recargar archivos sin cambios; reutilizar resultados y rutas verificadas.
4. Elegir el cambio completo más pequeño y los tests existentes más cercanos. Ampliar pruebas solo ante riesgos observados.
5. Comunicar hallazgos y estado de pruebas con evidencia. Nunca llamar PASS a una prueba no ejecutada.
6. No comprimir/eliminar información necesaria para seguridad, negocio ni trazabilidad.
7. Coordinar cambios por rama/PR, documentar blockers verificables, evitar subagentes repetidos.
8. El ahorro de tokens proviene de lectura selectiva y especialización de Skills, no de activar todos a la vez.
