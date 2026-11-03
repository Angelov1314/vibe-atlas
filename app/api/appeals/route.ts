import {getCommunityConfig,apiError} from '../../../lib/server';
import {submitAppeal,resolveAppeal} from '../../../lib/community';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const c=await getCommunityConfig(request);return new URL(request.url).searchParams.get('action')==='resolve'?await resolveAppeal(request,c):await submitAppeal(request,c);}catch(e){return apiError(e);}}
