import { jsPDF } from 'jspdf';
import autoTablePlugin from 'jspdf-autotable';

// jspdf-autotable es un paquete CJS: según cómo el bundler interprete su
// default export, `autoTablePlugin` puede llegar como la función directa o
// como un objeto con la función anidada en `.default`. Cubrimos ambos casos.
const autoTable = typeof autoTablePlugin === 'function' ? autoTablePlugin : autoTablePlugin.default;

// Paleta institucional (misma que --primary/--gray-* de index.css) para que
// el PDF se vea consistente con el resto de la app.
const PRIMARY       = [37, 99, 235];   // #2563eb
const PRIMARY_DARK   = [29, 78, 216];   // #1d4ed8
const PRIMARY_LIGHT = [239, 246, 255]; // #eff6ff
const GRAY_800      = [31, 41, 55];
const GRAY_600      = [75, 85, 99];
const GRAY_500      = [107, 114, 128];
const GRAY_400      = [156, 163, 175];
const GRAY_200      = [229, 231, 235];
const DANGER        = [220, 38, 38];
const WARNING       = [180, 120, 6];
const MARGIN        = 14;
const PAGE_W        = 210;
const CONTENT_W     = PAGE_W - MARGIN * 2;

const prioridadLabel = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const prioridadColor = { alta: DANGER, media: WARNING, baja: GRAY_500 };
const estadoLabel = { pendiente: 'Pendiente', confirmado: 'Confirmado', atendido: 'Atendido', cancelado: 'Cancelado' };
const estadoColor = { pendiente: WARNING, confirmado: PRIMARY_DARK, atendido: [22, 163, 74], cancelado: DANGER };

// SVG del isologo (mismo diseño que el login de Farmacia Hospital Cima:
// cuadrado azul redondeado con una cruz blanca) redibujado con primitivas
// de jsPDF — sin depender de ningún archivo de imagen.
function drawLogo(doc, x, y, size) {
  const s = size / 64;
  doc.setFillColor(...PRIMARY_DARK);
  doc.roundedRect(x, y, size, size, 12 * s, 12 * s, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 26 * s, y + 8 * s, 12 * s, 48 * s, 4 * s, 4 * s, 'F');
  doc.roundedRect(x + 8 * s, y + 26 * s, 48 * s, 12 * s, 4 * s, 4 * s, 'F');
}

function formatFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatFechaHoraActual() {
  return new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function addHeader(doc, { titulo = 'Reporte de turnos prioritarios', subtitulo, desde, hasta, generadoPor }) {
  drawLogo(doc, MARGIN, 12, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY_800);
  doc.text('Municipalidad de Cosquín', MARGIN + 25, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_500);
  doc.text('HOSPITAL CIMA', MARGIN + 25, 24);

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_400);
  doc.text(`Generado el ${formatFechaHoraActual()}${generadoPor ? ` por ${generadoPor}` : ''}`, MARGIN + 25, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY_DARK);
  doc.text(titulo, PAGE_W - MARGIN, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY_600);
  doc.text(subtitulo, PAGE_W - MARGIN, 24, { align: 'right' });

  if (desde || hasta) {
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY_500);
    doc.text(`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`, PAGE_W - MARGIN, 29.5, { align: 'right' });
  }

  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 35, PAGE_W - MARGIN, 35);

  return 42;
}

function addFooters(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_400);
    doc.text('Hospital Cima · Turnos Prioritarios', MARGIN, 290);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, 290, { align: 'right' });
  }
}

function ensureSpace(doc, y, needed, headerParams, headeredPages) {
  if (y + needed > 278) {
    doc.addPage();
    headeredPages.add(doc.internal.getCurrentPageInfo().pageNumber);
    return addHeader(doc, headerParams);
  }
  return y;
}

function drawSectionTitle(doc, y, titulo, subtitulo, cantidad, unidad = 'turno', unidadPlural = 'turnos') {
  doc.setFillColor(...PRIMARY_LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PRIMARY_DARK);
  doc.text(titulo, MARGIN + 3, y + 6.2);

  if (subtitulo) {
    const tituloWidth = doc.getTextWidth(titulo);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_600);
    doc.text(`— ${subtitulo}`, MARGIN + 5 + tituloWidth, y + 6.2);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY_DARK);
  doc.text(`${cantidad} ${cantidad === 1 ? unidad : unidadPlural}`, PAGE_W - MARGIN - 3, y + 6.2, { align: 'right' });

  return y + 9 + 3;
}

function agruparTurnos(turnos, agruparPor) {
  const grupos = new Map();
  for (const t of turnos) {
    const key = agruparPor === 'especialidad'
      ? (t.profesional_especialidad || 'Sin especialidad')
      : `${t.profesional_id}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        titulo: agruparPor === 'especialidad'
          ? (t.profesional_especialidad || 'Sin especialidad')
          : `${t.profesional_apellidos}, ${t.profesional_nombres}`,
        subtitulo: agruparPor === 'especialidad' ? null : (t.profesional_especialidad || ''),
        items: [],
      });
    }
    grupos.get(key).items.push(t);
  }
  return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
}

export function generarReportePDF({ turnos, agruparPor, desde, hasta, estadoDescripcion, generadoPor }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const grupos = agruparTurnos(turnos, agruparPor);

  const subtitulo = `${estadoDescripcion} · Agrupado por ${agruparPor === 'especialidad' ? 'especialidad' : 'profesional'}`;
  const headerParams = { subtitulo, desde, hasta, generadoPor };
  let y = addHeader(doc, headerParams);
  const headeredPages = new Set([1]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_600);
  doc.text(
    `Total: ${turnos.length} turno${turnos.length === 1 ? '' : 's'} en ${grupos.length} ${agruparPor === 'especialidad' ? 'especialidad(es)' : 'profesional(es)'}`,
    MARGIN, y
  );
  y += 6;

  if (grupos.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...GRAY_500);
    doc.text('No hay turnos que coincidan con los filtros seleccionados.', MARGIN, y + 4);
  }

  const incluyeProfesionalCol = agruparPor === 'especialidad';

  for (const grupo of grupos) {
    y = ensureSpace(doc, y, 22, headerParams, headeredPages);
    y = drawSectionTitle(doc, y, grupo.titulo, grupo.subtitulo, grupo.items.length);

    const columns = [
      { header: 'Fecha', key: 'fecha' },
      { header: 'Hora', key: 'hora' },
      ...(incluyeProfesionalCol ? [{ header: 'Profesional', key: 'profesional' }] : []),
      { header: 'Paciente', key: 'paciente' },
      { header: 'DNI', key: 'dni' },
      { header: 'Institución', key: 'institucion' },
      { header: 'Prioridad', key: 'prioridad' },
      { header: 'Estado', key: 'estado' },
      { header: 'Motivo', key: 'motivo' },
    ];

    const body = grupo.items.map((t) => ({
      fecha: formatFecha(t.fecha),
      hora: (t.hora || '').slice(0, 5),
      profesional: `${t.profesional_apellidos}, ${t.profesional_nombres}`,
      paciente: t.persona_apellidos ? `${t.persona_apellidos}, ${t.persona_nombres}` : '—',
      dni: t.persona_documento || '—',
      institucion: t.institucion_nombre || '',
      prioridad: prioridadLabel[t.prioridad] || t.prioridad,
      estado: estadoLabel[t.estado] || t.estado,
      motivo: t.motivo || '',
      _raw: t,
    }));

    autoTable(doc, {
      startY: y,
      margin: { top: 42, left: MARGIN, right: MARGIN, bottom: 22 },
      theme: 'striped',
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.3, cellPadding: 2, textColor: GRAY_800, lineColor: GRAY_200, lineWidth: 0.1 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        fecha: { cellWidth: 24 },
        hora: { cellWidth: 14 },
        dni: { cellWidth: 20 },
        prioridad: { cellWidth: 22 },
        estado: { cellWidth: 24 },
      },
      columns: columns.map((c) => ({ header: c.header, dataKey: c.key })),
      body,
      didParseCell(data) {
        if (data.section !== 'body') return;
        if (data.column.dataKey === 'prioridad') {
          const raw = data.row.raw._raw.prioridad;
          data.cell.styles.textColor = prioridadColor[raw] || GRAY_800;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.dataKey === 'estado') {
          const raw = data.row.raw._raw.estado;
          data.cell.styles.textColor = estadoColor[raw] || GRAY_800;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage() {
        // Repetimos el encabezado institucional arriba de cada página nueva
        // que la tabla haya generado (pero solo una vez por página: esta
        // callback corre también para la primera página de cada sección,
        // que puede ser una página ya encabezada por una sección anterior).
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
        if (!headeredPages.has(pageNum)) {
          addHeader(doc, headerParams);
          headeredPages.add(pageNum);
        }
      },
    });

    y = doc.lastAutoTable.finalY + 9;
  }

  addFooters(doc);

  const nombre = `reporte-turnos-${agruparPor}_${desde}_a_${hasta}.pdf`;
  doc.save(nombre);
}

export function generarListadoProfesionalesPDF({ profesionales, filtroDescripcion, generadoPor }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const grupos = new Map();
  for (const p of profesionales) {
    const key = p.especialidad || 'Sin especialidad';
    if (!grupos.has(key)) grupos.set(key, { titulo: key, items: [] });
    grupos.get(key).items.push(p);
  }
  const gruposOrdenados = [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));

  const headerParams = {
    titulo: 'Listado de profesionales',
    subtitulo: filtroDescripcion || 'Todos los profesionales',
    generadoPor,
  };
  let y = addHeader(doc, headerParams);
  const headeredPages = new Set([1]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_600);
  doc.text(
    `Total: ${profesionales.length} profesional${profesionales.length === 1 ? '' : 'es'} en ${gruposOrdenados.length} especialidad(es)`,
    MARGIN, y
  );
  y += 6;

  if (gruposOrdenados.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...GRAY_500);
    doc.text('No hay profesionales que coincidan con los filtros seleccionados.', MARGIN, y + 4);
  }

  for (const grupo of gruposOrdenados) {
    y = ensureSpace(doc, y, 22, headerParams, headeredPages);
    y = drawSectionTitle(doc, y, grupo.titulo, null, grupo.items.length, 'profesional', 'profesionales');

    const body = grupo.items.map((p) => ({
      apellidos: p.apellidos,
      nombres: p.nombres,
      matricula: p.matricula,
      domicilio: p.domicilio || '—',
      celular: p.celular || '—',
      estado: Number(p.activo) ? 'Activo' : 'Inactivo',
      _raw: p,
    }));

    autoTable(doc, {
      startY: y,
      margin: { top: 42, left: MARGIN, right: MARGIN, bottom: 22 },
      theme: 'striped',
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: GRAY_800, lineColor: GRAY_200, lineWidth: 0.1 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8.3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        matricula: { cellWidth: 24 },
        celular: { cellWidth: 34 },
        estado: { cellWidth: 24 },
      },
      columns: [
        { header: 'Apellidos', dataKey: 'apellidos' },
        { header: 'Nombres', dataKey: 'nombres' },
        { header: 'Matrícula', dataKey: 'matricula' },
        { header: 'Domicilio', dataKey: 'domicilio' },
        { header: 'Celular', dataKey: 'celular' },
        { header: 'Estado', dataKey: 'estado' },
      ],
      body,
      didParseCell(data) {
        if (data.section !== 'body' || data.column.dataKey !== 'estado') return;
        const activo = Number(data.row.raw._raw.activo);
        data.cell.styles.textColor = activo ? [22, 163, 74] : DANGER;
        data.cell.styles.fontStyle = 'bold';
      },
      didDrawPage() {
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
        if (!headeredPages.has(pageNum)) {
          addHeader(doc, headerParams);
          headeredPages.add(pageNum);
        }
      },
    });

    y = doc.lastAutoTable.finalY + 9;
  }

  addFooters(doc);

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`listado-profesionales_${fecha}.pdf`);
}
