# Olimpyc Fit · Frontend

Prototipo React/Vite responsive para las tres experiencias del MVP. La copia del prototipo HTML/CSS/JS anterior está en `../frontend-original-prototype/`.

## Desarrollo local

```sh
npm install
npm run dev
```

La demo usa datos ficticios locales por defecto. Las acciones locales están marcadas en la interfaz y no se presentan como guardadas en el servidor.

La capa de servicios reconoce las rutas documentadas bajo `/api/v1`. El modo API está desactivado de forma predeterminada; requiere `VITE_API_MODE=live` y `VITE_API_BASE_URL`, además de la integración de autenticación y confirmación del montaje compartido.

No se implementa backend ni se cambian contratos compartidos en este frontend.
