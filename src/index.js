const FIELDS = [
  "codigo",
  "nombre",
  "empresa",
  "codigo_gis",
  "nombre_fas",
  "paga_flete",
  "estado",
  "activo",
  "tipo_de_producto",
  "categoria_certificacion",
  "codigo_proveedor",
  "proveedor_fondo",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/origenes") {
      if (request.method !== "GET") {
        return json(
          { error: "Método no permitido." },
          405,
          { Allow: "GET" }
        );
      }

      return getOrigenes(env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function getOrigenes(env) {
  try {
    const sourceUrl = env.ORIGENES_DROPBOX_URL;

    if (!sourceUrl) {
      return json(
        {
          error:
            "Falta configurar el secret ORIGENES_DROPBOX_URL en Cloudflare.",
        },
        500
      );
    }

    const upstream = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    if (!upstream.ok) {
      return json(
        { error: `Dropbox respondió con estado ${upstream.status}.` },
        502
      );
    }

    const payload = await upstream.json();

    // Acepta el formato nuevo { actualizado_en, registros }
    // y también el formato anterior que era una lista directa.
    const rows = Array.isArray(payload)
      ? payload
      : payload?.registros;

    const actualizadoEn = Array.isArray(payload)
      ? null
      : payload?.actualizado_en ?? null;

    if (!Array.isArray(rows)) {
      return json(
        {
          error:
            "El archivo de origen no contiene una lista de registros válida.",
        },
        502
      );
    }

    // Devuelve solamente las columnas que utiliza la tabla.
    const visibleRows = rows.map((row) => {
      const result = {};

      for (const field of FIELDS) {
        result[field] = row?.[field] ?? null;
      }

      return result;
    });

    return json(
      {
        actualizado_en: actualizadoEn,
        registros: visibleRows,
      },
      200
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al consultar el archivo de datos.";

    return json({ error: message }, 502);
  }
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
