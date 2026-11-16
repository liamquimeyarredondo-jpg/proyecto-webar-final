# WebAR — Dos afiches, dos experiencias, un solo enlace

Este proyecto reúne dos experiencias de realidad aumentada en una sola página. La cámara reconoce cuál de los dos afiches está delante y activa el contenido correspondiente. No hay que abrir una URL distinta para cada afiche.

## Correspondencia de los afiches

| Orden al compilar | Índice MindAR | Archivo de referencia | Contenido |
|---|---:|---|---|
| 1 | `0` | `targets/source-posters/01-afiche-villa-hortensia.png` | Cinco ilustraciones y textos existentes, más una sexta pantalla con enlace web |
| 2 | `1` | `targets/source-posters/02-afiche-escalera-fantasma.png` | Video del fantasma con transparencia, duración prevista de 8 segundos |

Las dos imágenes que enviaste están incluidas en el proyecto, sin recortarlas ni cambiarles la proporción. La aplicación usa un único archivo combinado `targets/poster.mind`.

## 1. IMPORTANTE: generar el archivo poster.mind una sola vez

MindAR no reconoce directamente un PNG: primero debe analizarlo y compilar sus puntos de referencia en un archivo `.mind`. Por eso se incluyeron los dos afiches originales y una herramienta de compilación dentro del proyecto. El archivo `.mind` antiguo se conserva como respaldo, pero pertenecía al afiche anterior y **no se usa** para esta nueva versión.

### Cómo generar el nuevo archivo desde la herramienta incluida

1. Subí el contenido completo de esta carpeta a tu repositorio GitHub y activá GitHub Pages como ya venías haciendo. Dejá `index.html` en la raíz del repositorio.
2. Abrí desde una computadora la dirección `https://TU-USUARIO.github.io/TU-REPOSITORIO/tools/compilar-afiches.html` (reemplazá usuario y repositorio por los tuyos).
3. La página muestra los dos afiches. Comprobá el orden: Villa Hortensia primero, escalera/fantasma segundo.
4. Pulsá **Compilar los dos afiches**. La herramienta carga los archivos de `targets/source-posters/` y usa el compilador oficial de MindAR desde CDN. Necesitás conexión a internet. La compilación se ejecuta en tu navegador; puede tardar varios minutos, por eso conviene usar una computadora y no cerrar la pestaña.
5. Cuando aparezca **Descargar poster.mind**, descargalo.
6. En GitHub, abrí la carpeta `targets/` y subí el archivo descargado con el nombre exacto `poster.mind`.
7. Confirmá los cambios y esperá que Pages actualice el sitio. Después abrí la URL principal desde el celular.

**No cambies el orden de las imágenes al compilar.** El código espera índice `0` para Villa Hortensia e índice `1` para el fantasma. Si se invierte el orden, cada afiche activará la experiencia equivocada.

### Por qué no viene ya generado el `.mind`

El archivo `.mind` es un resultado binario que produce el compilador de MindAR a partir de los afiches. En este entorno no pude ejecutar el compilador oficial sobre tus imágenes. Para no entregarte un `.mind` viejo que reconocería el diseño anterior (y que no detectaría estos dos afiches), dejé incorporados los PNG originales y una herramienta del propio proyecto que genera el archivo combinado en el orden correcto. Es un paso único.

## 2. Experiencia 1 — Villa Hortensia

El afiche con la casa completa y el recorte de diario activa la experiencia existente. Se conservaron las cinco ilustraciones, los textos, tamaños, posiciones, fondo negro semitransparente del texto, transiciones y animaciones.

Al tocar el afiche se avanza por las cinco escenas. Después aparece la **sexta pantalla** con el texto:

> Visita la página web para conocer más sobre el barrio y sus historias

Debajo aparece el botón naranja **Haz clic para ir a la página**. El botón abre la URL en una pestaña nueva para no cerrar la experiencia WebAR.

### Dónde colocar el enlace de la página

1. Abrí `editor.html` en tu computadora.
2. Pulsá **Abrir config.json** y elegí el archivo de configuración principal.
3. En el selector de experiencia, elegí **Villa Hortensia**.
4. En el selector de escenas, elegí el número **6**.
5. Editá el título, el texto del botón y el campo **Dirección de la página web**.
6. Escribí la URL completa, incluyendo `https://` (por ejemplo `https://ejemplo.com`).
7. Pulsá **Descargar config.json** y reemplazá el `config.json` del proyecto por el descargado.

Si la URL está vacía, el botón se verá pero al tocarlo avisará que falta configurar el enlace. Esto evita abrir una dirección inventada.

## 3. Experiencia 2 — Video del fantasma

El afiche de la escalera activa automáticamente un video. El video se coloca como una superficie delante del afiche, con transparencia real, de modo que se vea el fantasma y se vea la cámara a través de las zonas transparentes.

El reproductor está preparado para:

- Iniciar al reconocer el segundo afiche.
- Reproducirse una vez (sin bucle por defecto).
- Usar el punto inicial y velocidad definidos en la configuración.
- Detenerse y volver al inicio cuando se pierde el afiche.
- Volver a reproducirse cuando se vuelve a apuntar al afiche; también se puede tocar el afiche cuando el video ya terminó.
- Ajustar posición X/Y/Z, ancho, alto y velocidad desde el editor.

La duración prevista es de 8 segundos. El código no fuerza un recorte a 8 segundos: si el archivo dura más o menos, se reproduce su duración real. Exportalo a 8 segundos para que coincida con lo previsto.

## 4. Cómo preparar el video transparente (muy importante)

No alcanza con exportar un MP4 normal. El archivo necesita guardar un **canal alfa**, que contiene la transparencia de cada píxel. Un MP4 H.264 común no tiene transparencia real. Tampoco basta con que el fondo sea negro o verde: ese fondo debe eliminarse en el programa de edición o composición y exportarse con alfa.

### Formatos que necesita el proyecto

Para que se vea correctamente en Android y iPhone se prepararon dos rutas:

| Dispositivo / navegador | Formato | Nombre de archivo |
|---|---|---|
| Chrome / Android, Chrome / escritorio, Firefox y Edge | WebM con códec VP9 y canal alfa | `fantasma-alpha.webm` |
| Safari / iPhone / iPad y Safari en Mac | MOV con códec HEVC y canal alfa | `fantasma-alpha.mov` |

MDN indica que VP8/VP9 pueden transportar alfa, pero Safari no muestra la transparencia de VP8/VP9. Apple documenta el soporte de HEVC con alfa en Safari desde iOS 13 y macOS Catalina. Por eso se usan dos archivos: WebM para navegadores Chromium/Firefox y MOV HEVC con alfa para Safari. 

### Flujo de exportación recomendado

1. Prepará el fantasma en tu editor de video. Si parte de un fondo verde o negro, quitá ese fondo primero usando chroma key, máscara/rotoscopia o una herramienta de eliminación de fondo. No dejes el fondo pintado de negro: debe quedar transparente en la previsualización del editor.
2. Exportá un máster de alta calidad que conserve alfa. Una opción de intercambio habitual es QuickTime ProRes 4444 con canal alfa. Si el programa ofrece **RGB + Alpha**, activalo; no exportes solo RGB.
3. A partir del máster generá `fantasma-alpha.webm` en VP9 con alfa. Si usás FFmpeg y tu compilación tiene `libvpx-vp9`, un punto de partida es:

```bash
ffmpeg -i fantasma-master.mov -an -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 30 fantasma-alpha.webm
```

4. Para iPhone/iPad, generá además un MOV **HEVC Video with Alpha** usando Compressor, Final Cut/AVFoundation u otra herramienta que explícitamente exporte HEVC con canal alfa. No basta con elegir HEVC normal: debe decir **with Alpha / con alfa**. Apple describe este formato en su sesión técnica y en su documentación de AVFoundation.
5. Comprobá los archivos sobre un fondo de color en un reproductor o editor que respete alfa. Si el fondo aparece negro, blanco o verde, el archivo no contiene alfa utilizable y hay que repetir la exportación.
6. Copiá ambos archivos finales en `assets/video/` con los nombres indicados. No subas el máster ProRes si no lo necesitás: puede ser muy pesado.

**Nota sobre Safari:** WebM VP9 con alfa puede reproducirse en Safari, pero Safari no conserva el canal alfa de ese formato. Por eso el código selecciona el MOV HEVC con alfa en dispositivos Apple. En Android/Chrome selecciona el WebM. Probá el resultado en el celular real antes de presentar.

### Si solo tenés un archivo de video

Si el fantasma está sobre un fondo sólido y no tenés una secuencia transparente, primero hay que eliminar ese fondo. Puedo ayudarte a elegir los ajustes de exportación cuando me envíes el video y me digas con qué programa lo editaste. El fondo no se elimina automáticamente desde el código de la experiencia.

## 5. Editar tamaño, posición y velocidad del video

1. Abrí `editor.html`.
2. Cargá el `config.json`.
3. Elegí **Video del fantasma · afiche 2**.
4. En **Archivo WebM VP9** y **Archivo MOV HEVC**, escribí las rutas de los archivos. Los nombres por defecto ya están preparados.
5. Modificá:
   - **X:** izquierda/derecha.
   - **Y:** arriba/abajo.
   - **Z:** distancia respecto del afiche; un valor mayor coloca el video más adelante.
   - **Ancho:** tamaño horizontal.
   - **Alto:** si queda vacío, se calcula según la proporción original del video.
   - **Velocidad:** `1` es velocidad normal; `0.5` es mitad de velocidad; `2` es el doble.
   - **Segundo inicial:** punto en el que comienza el video.
   - **Repetir en bucle:** desactivado por defecto.
6. Pulsá **Descargar config.json**, reemplazá el original y subí también los archivos de video a `assets/video/`.

El editor muestra un marco de referencia para ubicar el video. Como todavía no se incluyó tu video final, la vista previa no puede mostrar el fantasma real.

## 6. Cómo editar las cinco ilustraciones y textos existentes

En `editor.html`, elegí **Villa Hortensia** y las escenas 1 a 5. Podés editar la ruta de cada PNG, su posición, tamaño, opacidad y animación; también el texto, tipografía, tamaño, color, alineación y posición. La vista previa permite arrastrar ilustración y texto.

Las cinco imágenes originales siguen en:

```text
assets/images/scene-01.png
assets/images/scene-02.png
assets/images/scene-03.png
assets/images/scene-04.png
assets/images/scene-05.png
```

No cambies sus rutas si no es necesario. Para las fuentes personalizadas, colocá archivos `.woff2` o `.woff` en `assets/fonts/` y registrá sus rutas en `config.project.fonts`.

## 7. Estructura de carpetas

```text
proyecto-webar-dos-experiencias/
├── index.html
├── app.js
├── styles.css
├── config.json
├── editor.html
├── README.md
├── tools/
│   └── compilar-afiches.html
├── targets/
│   ├── poster.mind                         (se genera después de compilar)
│   ├── poster-villa-hortensia-anterior-un-solo-afiche.mind (respaldo)
│   └── source-posters/
│       ├── 01-afiche-villa-hortensia.png
│       └── 02-afiche-escalera-fantasma.png
└── assets/
    ├── images/                              (5 PNG actuales)
    ├── video/                               (colocar los dos formatos transparentes aquí)
    └── fonts/
```

## 8. Subirlo a GitHub: ¿editar el repositorio anterior o empezar de cero?

**Recomendación: conservá el mismo repositorio para mantener el mismo enlace de GitHub Pages, pero reemplazá el contenido completo por esta nueva carpeta.** La estructura anterior tenía tres experiencias vacías/anteriores y un `.mind` de otro afiche; dejar esos archivos mezclados puede confundir rutas y targets.

La forma más segura para reemplazar muchas carpetas a la vez es GitHub Desktop:

1. Instalá GitHub Desktop desde https://desktop.github.com/ e iniciá sesión.
2. Cloná el repositorio actual (File → Clone repository) en tu computadora.
3. Cerrá GitHub Desktop y abrí la carpeta local del repositorio.
4. Hacé una copia de seguridad del repositorio local por si querés volver atrás.
5. Borrá el contenido viejo de esa carpeta (sin borrar la carpeta `.git`, que está oculta) y copiá dentro todo el contenido de esta carpeta nueva, incluyendo `index.html` directamente en la raíz.
6. Abrí GitHub Desktop: mostrará los archivos eliminados, modificados y agregados.
7. En Summary escribí `Reemplazar proyecto por versión de dos afiches` y pulsá **Commit to main**.
8. Pulsá **Push origin** para enviar los cambios a GitHub.
9. Conservá la configuración de GitHub Pages existente (Settings → Pages, Branch `main`, folder `/ (root)`).
10. Abrí la página `tools/compilar-afiches.html`, generá `poster.mind`, y subilo a `targets/` con GitHub Desktop (o desde la web de GitHub). Luego hacé Commit y Push nuevamente.

Si preferís crear un repositorio nuevo, también se puede, pero la dirección `github.io` va a cambiar. Para mantener el enlace que ya compartiste, es mejor reemplazar el contenido del repositorio actual.

## 9. Cámara y fondo transparente

El renderer A-Frame está configurado con `alpha: true`, el canal alfa del renderer se fuerza a cero y los fondos de `html`, `body`, `#ar-app` y `a-scene` son transparentes. El video de la cámara de MindAR se posiciona debajo del canvas 3D; las ilustraciones, textos y fantasma se renderizan por encima. La cámara necesita HTTPS y permiso del usuario. GitHub Pages ya proporciona HTTPS.

## 10. Comprobaciones y límites de esta entrega

- Se conservaron las cinco ilustraciones, textos y parámetros actuales de Villa Hortensia.
- Se añadió la sexta pantalla con texto, botón naranja, URL editable y opción de volver al inicio.
- Se preparó el segundo afiche como video automático de 8 segundos esperado, con controles editables de tamaño y velocidad.
- Se añadieron los dos afiches fuente en el orden correcto y la herramienta que genera el `.mind` combinado.
- El video final todavía no está incluido: debés colocarlo en `assets/video/` después de exportarlo con alfa real.
- El `.mind` final todavía debe generarse una vez con la herramienta incluida y subirse a `targets/`. El archivo de respaldo anterior no reconoce los dos afiches nuevos.
- La sintaxis de los archivos se revisó localmente, pero la cámara, el seguimiento de ambos targets y los formatos de video deben probarse en un teléfono real después de publicar.

## Referencias técnicas

- MindAR — compilar imágenes objetivo: https://hiukim.github.io/mind-ar-js-doc/quick-start/compile/
- MindAR — página WebAR y `targetIndex`: https://hiukim.github.io/mind-ar-js-doc/quick-start/webpage/
- MindAR — compilador de múltiples imágenes: https://github.com/hiukim/mind-ar-js-doc/blob/master/docs/tools/compile.mdx
- MDN — compatibilidad de códecs y alfa VP8/VP9: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs
- Apple — HEVC Video with Alpha (WWDC19): https://developer.apple.com/videos/play/wwdc2019/506/
- Apple — Using HEVC video with alpha: https://developer.apple.com/documentation/avfoundation/using-hevc-video-with-alpha
