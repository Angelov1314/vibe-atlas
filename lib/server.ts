import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {items} from './catalog';
import type {CommunityConfig,Database} from './community';
export async function getCommunityConfig(request:Request):Promise<CommunityConfig>{
 if(!env.DB)throw new Error('database_unavailable');
 const user=await getChatGPTUser();
 return {db:env.DB as unknown as Database,identity:user?{subject:user.userId,provider:'chatgpt',verified:true}:null,
 origin:env.SITE_ORIGIN||new URL(request.url).origin,identityHmacSecret:env.IDENTITY_HMAC_SECRET||'',
 validItemIds:new Set(items.map(p=>p.id)),turnstileSecret:env.TURNSTILE_SECRET_KEY,
 turnstileSiteKey:env.TURNSTILE_SITE_KEY,challengeMode:'adaptive',adminSubject:env.ADMIN_USER_ID||undefined};
}
export function getStorage(){return env.BUCKET;}
export function apiError(error:unknown){console.error('Atlas API failure:',error instanceof Error?error.message:'unknown');return Response.json({error:'service_unavailable',message:'服务暂时不可用，请稍后重试；目录浏览不受影响。'},{status:503,headers:{'Cache-Control':'no-store'}});}
