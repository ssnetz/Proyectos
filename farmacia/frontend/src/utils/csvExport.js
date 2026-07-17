// Exporta un array de objetos "planos" (todas las filas con las mismas
// claves) a un archivo .csv, usando las claves de la primera fila como
// encabezado. Simple a propósito: los reportes ya vienen aplanados desde el
// backend, no hace falta nada más sofisticado.
export function exportToCSV(rows, filename) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(',');
  const lines = rows.map((row) =>
    headers
      .map((h) => {
        const value = row[h] ?? '';
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csv = [headerLine, ...lines].join('\n');
  // BOM (﻿) para que Excel detecte UTF-8 y no rompa los acentos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
