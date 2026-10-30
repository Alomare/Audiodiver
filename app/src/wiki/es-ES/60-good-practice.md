---
title: Buenas prácticas
group: Crear un mod
summary: Hábitos que hacen que un mod sea más fácil de probar, actualizar y compartir.
source: 81552970f352
---

- Mantén **una carpeta por mod**, con el fichero `.audi`, la carpeta `audio` y `build`. Una copia de la carpeta es una copia de seguridad completa. Si dos proyectos comparten una carpeta, la pestaña [Proyecto](app:project) muestra una advertencia con **Mover a una carpeta nueva**.
- **Nombra los ficheros en orden de reproducción**, como `01 …` y `02 …`. Los rellenados y los cortes siguen ese orden. Si vuelves a exportar un fichero modificado con el mismo nombre, la siguiente generación usa la versión nueva.
- **Trabaja por pasadas.** Esboza una zona, como la nave, el despliegue o una facción, y genérala. Reprodúcela y anota huecos, cortes bruscos y puntos silenciosos, luego corrígelos y vuelve a generar. Las pantallas de equipamiento y de ubicación de despliegue son las más rápidas de alcanzar en el juego.
- **Usa Reproducción continua** antes de generar. Detecta la mayoría de los problemas de traspaso sin iniciar el juego.
- **Revisa las transiciones** que la pestaña Audio marca con **!**. Una transición original entre dos piezas de música nueva es lo que más suena fuera de lugar.
- **Escucha en momentos tranquilos y durante un tiroteo.** Los problemas de sonoridad aparecen en ambas situaciones.
- **Conserva el ID y el nombre del mod** en [Proyecto](app:project) durante toda la vida del mod, para que el gestor de mods actualice el mod instalado cada vez. Usa **Crear un ID nuevo** solo cuando copies un proyecto para crear un mod distinto.
