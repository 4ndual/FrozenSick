# Guía de Contribución: Frozen Sick

Esta guía detalla las reglas e instrucciones para trabajar en el proyecto **Frozen Sick** (Rama `github`), basándose en el flujo de trabajo de Vibe Coder.

## 🚀 Cómo correr el proyecto localmente

1. **Dependencias**: Asegúrate de tener Node.js instalado. Instala las dependencias con:
   ```bash
   npm install
   ```
   *(En Windows, si PowerShell da problemas, usa `cmd /c npm install`)*

2. **Configuración (.env)**: Crea un archivo `.env` en la raíz con las siguientes llaves (solicita el PAT a Johan si no lo tienes):
   ```env
   GITHUB_CLIENT_ID=Ov23liFd70h8Ot1MmNzO
   GITHUB_CLIENT_SECRET=347306034dce06c3099c86ea51e216be3d98b0a5
   PUBLIC_GITHUB_OWNER=4ndual
   PUBLIC_GITHUB_REPO=FrozenSick
   PUBLIC_GITHUB_BRANCH=github
   GITHUB_TEST_PAT=tu_token_aqui
   ```

3. **Ejecución**: Corre el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Accede a la aplicación en: **`http://127.0.0.1:5173`** (Usa el navegador **Brave**).

## 🛠 Flujo para subir cambios (Reglas de Oro)

**⚠️ NUNCA hagas `push` directo a las ramas `main` o `github`.**

Sigue siempre este proceso:

1. **Asegúrate de estar en la rama correcta**:
   ```bash
   git checkout github
   git pull origin github
   ```

2. **Crea una nueva rama para tu tarea**:
   ```bash
   git checkout -b nombre-de-la-tarea
   ```

3. **Realiza tus cambios y testea**: Verifica los cambios visualmente en **Brave** antes de continuar.

4. **Sube los cambios a tu fork o rama**:
   ```bash
   git add .
   git commit -m "feat: descripción corta del cambio"
   git push origin nombre-de-la-tarea
   ```

5. **Crea un Pull Request (PR)**:
   - Dirígete a GitHub y abre un PR desde tu rama hacia la rama `github` del repositorio original.
   - Comparte el link del PR para revisión.

## 📝 Notas Adicionales
- El proyecto usa **SvelteKit** y **TypeScript**.
- Se recomienda tener activa la extensión de **Svelte for VS Code** con el plugin de TypeScript habilitado.
