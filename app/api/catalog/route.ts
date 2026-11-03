import catalog from '../../../data/catalog.json';
import models from '../../../data/models.json';
export async function GET(request:Request){const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'};if(new URL(request.url).searchParams.has('download'))headers['Content-Disposition']='attachment; filename="vibe-atlas-catalog-2026-11-02.json"';return new Response(JSON.stringify({catalog,models,note:'A source-backed starting directory; no claim of exhaustive global or X leadership.'},null,2),{headers});}
