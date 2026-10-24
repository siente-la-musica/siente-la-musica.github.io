# Activar «¿Qué suena?»

El botón graba 8 segundos del audio que está sonando y se los manda a un servicio que reconoce canciones, igual que Shazam. Muestra el título, el artista, la portada y un enlace para escucharla.

Se usan dos servicios:

- **AudD**: el que reconoce la canción. Da algunas consultas de prueba gratis y después cobra por consulta. Consulta los precios actuales en https://audd.io.
- **Cloudflare Workers**: un pequeño intermediario gratuito que guarda tu clave de AudD en secreto. Sin él, la clave quedaría a la vista en la página y cualquiera podría gastarla.

## 1. Consigue la clave de AudD

1. Regístrate en https://dashboard.audd.io.
2. Copia tu **API token**.

## 2. Crea el intermediario en Cloudflare

1. Crea una cuenta gratuita en https://dash.cloudflare.com.
2. Ve a **Workers & Pages → Create → Create Worker**, ponle un nombre (por ejemplo `pulso-reconocer`) y pulsa **Deploy**.
3. Pulsa **Edit code**, borra lo que haya, pega el contenido de [`servidor/reconocer.js`](servidor/reconocer.js) y pulsa **Deploy**.
4. En el Worker, ve a **Settings → Variables and Secrets** y añade:
   - `AUDD_TOKEN`, de tipo **Secret**, con tu clave de AudD.
   - `ORIGEN`, de tipo **Text**, con `https://juanmanuelpinto2014-star.github.io`. Así solo tu página puede usarlo.
5. Copia la dirección del Worker. Tiene esta forma: `https://pulso-reconocer.TU-CUENTA.workers.dev`.

## 3. Conéctalo a la página

En `index.html`, busca esta línea:

```js
const RECOGNIZE_URL = '';
```

y pon la dirección del Worker entre las comillas:

```js
const RECOGNIZE_URL = 'https://pulso-reconocer.TU-CUENTA.workers.dev';
```

Guarda el cambio en GitHub. En uno o dos minutos el botón funcionará para cualquiera que abra la página.

## Cuánto se gasta

Cada pulsación del botón es **una consulta** a AudD. El reconocimiento no es automático, así que solo se gasta cuando alguien lo pide.
