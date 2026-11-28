# Estándar de «Siente la música»

Reglas de oro, sin fallas. Toda animación nueva o cambiada se revisa contra esta lista antes de publicarse.

## Objetivo

Videos verticales para TikTok (@sientelamusicaco) que atrapen en los primeros segundos y se vean completos:
obras dignas de admirar, que **sientan la música** y que **hipnoticen**.

**Lo que dicen los datos:** los clásicos en español y latinos traen más likes, comentarios y seguidores; los primeros
segundos deciden la retención (la animación arranca encendida, con color y música desde el primer cuadro); funcionan las
escenas que despiertan curiosidad (preguntaron si Ruta era un videojuego). Sin frase gancho. Navidad basta para diciembre.

## Preferencias del usuario (no se cambian sin preguntar)

- **Letra**: como siempre la ha tenido (posición, estilo, colores, su propio reloj).
- **Neones**: la primera versión de cristal elegante, no «cápsulas».
- **Cortina**: cuentas de cristal con destellos, mística, en penumbra.
- **Ciudad**: casas de 1-2 pisos con tejado y edificios planos con detalles (balcones, tanques); torre del reloj sin techo en
  punta; sin farolillos; de noche, ventanas muy sensibles a la música.
- **Luz**: el faro asentado en la roca, el haz a la vista y con la música; inspiración Zelda.
- **Silueta**: suave, sin contorno marcado; la letra sobre la cabeza, sin tocarla.
- **Vitral** (rosetón) y **Bloques** (el vitral de antes, mejorado): se quedan los dos.
- **Programación TikTok**: estructura de 12:00, 16:00 y 20:00; un mes de anticipación; máximo 30 programadas.

## 1. La música primero

- Todo se mueve **por el sonido**, nunca con un reloj propio. En silencio: quieto y apagado (sin color).
- Sigue **toda la canción**: bombo, bajo, notas (piano, sinte, guitarra), voz y platillos; no solo el bombo.
- Se distingue la **estrofa del coro**: lo suave pasea, lo fuerte vuela.
- Cada golpe se **ve** en el instante en que suena (sin retraso), con un empujón que se reparte en ~0,2 s.
- **Medido, no supuesto** (herramientas del taller):
  - ritmo (canción a 128 BPM): pico/valle **≥ ×1,8** (escenas de viaje como Ruta o Autopista: ≥ ×1,3);
  - bombo solo: **≥ ×1,4**;
  - nota sola (piano o voz sin percusión): **≥ ×1,2**.

## 2. Hipnotizante

Que el ojo no se quiera ir. Una animación es hipnotizante cuando:

- **Nunca se detiene** mientras suena: el flujo es continuo (corre, gira, fluye, respira) y cada golpe lo **empuja**, no lo reinicia.
- Tiene **un centro** que atrae la mirada (un rosetón, un perfil, un túnel, un polo) y el movimiento va hacia él o sale de él.
- Mueve **varias capas a distintas velocidades** (lo lejano lento, lo cercano rápido; lo grande lento, lo fino rápido).
- **Se repite con variación**: patrones que vuelven (simetrías, ondas, espirales suaves de flujo), pero nunca idénticos.
- El movimiento va **al tempo** de la canción: una vuelta, una ola o una franja por tiempo o por compás.
- La luz **corre** por las formas (por hilos, tubos, vetas o líneas de campo), no solo se prende y se apaga.

## 3. Movimiento elegante y natural

- Con inercia y resortes: sin saltos, tirones, frenazos ni «arranca y para».
- Sin acercamientos ni zoom de entrada; sin parpadeo ni grano.

## 4. Estética de vanguardia (nivel Apple / Ghibli)

- Colores de la portada (saturados, nunca grises); de noche, sombras hondas **de color**, nunca negras planas.
- Sin bordes duros, **sin aros ni filos blancos**, sin espirales gráficas.
- Nada infantil: sin caras de caricatura, sin figuras primitivas, sin aspecto de PowerPoint, sin «cápsulas».
- Escenas como Ruta, Navidad o Ciudad: detalle real, que no parezcan hechas por IA.
- Los objetos se apoyan en el suelo (nada flota sin razón) y con proporciones creíbles.

## 5. Hecho para el video publicado

- Vertical primero: zonas seguras de TikTok; la composición llena la pantalla.
- La letra fija desde el primer cuadro, en su sitio pensado para cada animación; nunca cruza la marca de agua.
- Grabación fluida y nítida; liviana en el PC (las escenas pesadas van en la lista de ajuste al grabar).
- Llamativa en un teléfono: se entiende en un segundo.

## 6. Errores que no se repiten

- **Reloj propio**: nada en un shader se mueve con el tiempo real; se usa el reloj musical (`time`, que solo corre con música y sigue la intensidad) o una fase que empuja el golpe.
- **Golpe tardío**: resortes blandos u ondas lentas reparten el golpe por todo el compás. El golpe debe verse en el primer cuarto del tiempo.
- **Escalones al grabar**: los bordes duros (`step`) se ven en escalones cuando la escena se amplía; usar bordes suaves (`smoothstep` con `fwidth`).
- **Comentarios que se tragan código**: nunca un `//` en medio de una línea con más instrucciones (revisa `check.sh`).
- **Formas de juego de los 2000**: nada de ruido fino en formas grandes (árboles como papel arrugado, montañas rugosas). Formas lisas, luz en masas pintadas.
- **La esencia**: al mejorar una animación, se conserva lo que la hacía especial (Cortina: cuentas de cristal con destellos); se pule, no se reemplaza.
- **Medición con patrones que se repiten** (túneles, carreteras): la diferencia entre cuadros se satura; se juzga con video real.

- **Optimizar la medición en contra del estándar**: la prueba de ritmo premia moverse mucho en el golpe y poco entre
  golpes; perseguir ese número lleva al «arranca y para» (prohibido). El movimiento es continuo; el golpe es un acento.
  La medición es una guía, nunca la meta; se juzga viendo el video.
- **Quitar la portada de fondo**: toda animación deja ver el fondo vivo con la portada (salvo escenas completas como
  Ciudad, Ruta, Lago o Luz).
- **Reemplazar lo que funcionaba**: si una versión anterior gustaba, se mejora sobre ella; no se sustituye por otra idea.
- **Ignorar las notas cuando suena la batería**: antes, piano, guitarra, arpa o voz solo movían la escena si no había
  bombo en 1,5 s, y 42 efectos de golpe descartaban las notas. Ahora cada nota da un golpe suave (peso 0,2 con batería,
  0,4 sin ella; el bombo pesa 1) y lo agudo cuenta aunque suene más débil. `pulse.on` es solo el golpe (bombo o percusión, y la nota cuando no hay batería): lo que va al ritmo lo usa. Para que una nota también
  se sienta se usa `pulse.hit` con su peso `pulse.w` (nunca acelerar el ritmo de una escena con las notas: Cuencos se volvió frenético).
- **Cambios globales** (relojes, curvas compartidas): afectan a todas las escenas; se revisan todas antes de publicar.

## 7. Proceso

- Auditorías medidas con cuadros y video reales, en vertical y horizontal, en modo oscuro y claro.
- Comparar con las referencias del usuario. Mejorar antes de quitar. No repetir errores.
- Verificar antes de publicar; informar con honestidad lo que falta.
- Subir la versión en cada publicación (`sw.js` y «Versión N»).
