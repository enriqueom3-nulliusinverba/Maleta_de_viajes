// Vercel serverless function: usa el propio repo de GitHub como base de datos.
// Guarda/lee data/state.json vía la API de contenidos de GitHub, autenticada
// con un token guardado como variable de entorno en Vercel (nunca llega al navegador).

const OWNER = 'enriqueom3-nulliusinverba';
const REPO = 'Maleta_de_viajes';
const FILE_PATH = 'data/state.json';

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'maleta-de-viajes-app',
  };
}

export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    res.status(500).json({ error: 'GITHUB_TOKEN no está configurado en las variables de entorno de Vercel.' });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

  if (req.method === 'GET') {
    try {
      const r = await fetch(apiUrl, { headers: githubHeaders(token) });
      if (r.status === 404) {
        res.status(200).json({ data: null });
        return;
      }
      if (!r.ok) {
        res.status(r.status).json({ error: 'No se pudo leer el estado desde GitHub.' });
        return;
      }
      const json = await r.json();
      const content = Buffer.from(json.content, 'base64').toString('utf-8');
      res.status(200).json({ data: JSON.parse(content) });
    } catch (e) {
      res.status(500).json({ error: 'Fallo al leer el estado.' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      let sha;
      const existing = await fetch(apiUrl, { headers: githubHeaders(token) });
      if (existing.ok) {
        const j = await existing.json();
        sha = j.sha;
      }

      const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const contentStr = JSON.stringify(body, null, 2);
      const contentB64 = Buffer.from(contentStr, 'utf-8').toString('base64');

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Actualiza estado de la maleta',
          content: contentB64,
          ...(sha ? { sha } : {}),
        }),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        res.status(putRes.status).json({ error: 'No se pudo guardar el estado en GitHub.', detail: errText });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Fallo al guardar el estado.' });
    }
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end('Method Not Allowed');
}
