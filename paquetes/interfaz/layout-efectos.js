/** Enlace de Ajustes; persistencia y aplicación se inyectan desde layout/app.
 * @param {any} select @param {any} opciones */
export function instalarAjusteEfectos(select, { leer, escribir, cambiar }) {
  const normalizar = v => ['auto', 'alto', 'medio', 'bajo', 'no'].includes(v) ? v : 'auto';
  select.value = normalizar(leer('efectos', 'auto'));
  select.addEventListener('change', () => {
    const valor = normalizar(select.value);
    escribir('efectos', valor);
    cambiar(valor);
  });
}
