import {env} from 'cloudflare:workers';
import {stats} from '../../../lib/catalog';
export const dynamic='force-dynamic';
export async function GET(){let database=false;try{if(env.DB){await env.DB.prepare('SELECT COUNT(*) AS count FROM identities').first();database=true;}}catch{}return Response.json({status:database?'ready':'catalog-ready-community-pending',catalog:stats,database,mediaStorage:Boolean(env.BUCKET),identitySecretConfigured:Boolean(env.IDENTITY_HMAC_SECRET),turnstileConfigured:Boolean(env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_SITE_KEY),adminReviewConfigured:Boolean(env.ADMIN_USER_ID),xConfigured:false,generationMode:'paired-local-ollama-only',version:'2026-11-03.catalog-75'},{headers:{'Cache-Control':'no-store'}});}
