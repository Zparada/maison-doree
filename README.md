# Maison Dorée — control de caja del salón

App web (celular y computador). Los datos viven **solo en tu Google Sheets**; el código es público pero no contiene datos.

## Instalación (una sola vez, ~15 min)

### 1. Tu base de datos en Drive
1. Entra a sheets.google.com con tu Gmail y crea una hoja en blanco. Nómbrala `Maison Dorée - Datos`.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya, pega todo el contenido de `Code.gs` y guarda (icono de disquete).
4. Arriba, en el selector de funciones, elige **setup** y pulsa **Ejecutar**. Google pedirá permisos: acepta (es tu propia cuenta; "Configuración avanzada → Ir a proyecto").
5. Abajo, en **Registro de ejecución**, aparecen las claves temporales de cada persona. **Anótalas.** Cada una deberá cambiarla al entrar.

### 2. Publicar el servidor
1. Arriba a la derecha: **Implementar → Nueva implementación → tipo "Aplicación web"**.
2. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier persona**.
   (Es necesario para que tus empleadas entren sin cuenta Google. Sin usuario y contraseña, el servidor no entrega ningún dato.)
3. Implementar y **copia la URL** que termina en `/exec`.
4. Abre `config.js` y pega esa URL en `api`. Opcional: pega el enlace de tu hoja en `sheetUrl`.

### 3. Publicar la app en GitHub Pages
1. Crea cuenta en github.com (activa verificación en dos pasos) y un repositorio nuevo, por ejemplo `maison-doree`.
2. Sube `index.html`, `config.js`, `Code.gs` y este README (botón **Add file → Upload files**).
3. **Settings → Pages → Branch: main / root → Save**.
4. En un par de minutos tendrás el enlace `https://TU-USUARIO.github.io/maison-doree/`. Compártelo con tu equipo.

## Seguridad
- Activa la **verificación en dos pasos** en tu cuenta de Google y en GitHub.
- El servidor limita a 5 intentos fallidos por usuario y cierra la sesión a los 15 min sin uso.
- Los permisos (empleada solo ve lo suyo, Admin 2 solo lee) los aplica el servidor.
- No compartas la hoja de Drive con nadie que no deba ver todo.
- Si olvidas tu clave: en Apps Script ejecuta `resetOwnerPassword` y mira el registro.
- Si cambias `Code.gs`: **Implementar → Administrar implementaciones → Editar → Nueva versión** (la URL no cambia).
