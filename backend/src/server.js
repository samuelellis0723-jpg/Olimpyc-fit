import express from 'express';
import { montarPlanificacionApi } from './http/montarPlanificacionApi.js';

const app = express();
const port = Number(process.env.PORT || 3000);

montarPlanificacionApi(app);

app.listen(port, () => {
  console.log(`Servidor backend escuchando en http://localhost:${port}`);
});