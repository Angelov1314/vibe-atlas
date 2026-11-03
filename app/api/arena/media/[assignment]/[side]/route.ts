import {getArenaMedia} from '../../../../../../lib/community';
import {getCommunityConfig,getStorage} from '../../../../../../lib/server';

const allowedTypes = new Set(['image/png','image/jpeg','image/webp','video/mp4','video/webm','audio/wav','audio/mpeg']);
export async function GET(request: Request,context:{params:Promise<{assignment:string;side:string}> | {assignment:string;side:string}}) {
  try {
    const {assignment,side} = await context.params;
    if (!/^[a-f0-9-]{36}$/.test(assignment) || !['a','b'].includes(side)) return new Response('未找到媒体',{status:404});
    const c = await getCommunityConfig(request);
    if (!c.identity?.verified) return new Response('请先登录',{status:401,headers:{'Cache-Control':'no-store'}});
    const media = await getArenaMedia(c,assignment,side as 'a'|'b');
    if (!media || !allowedTypes.has(media.media_type)) return new Response('任务已过期或媒体不可用',{status:404,headers:{'Cache-Control':'no-store'}});
    const bucket = await getStorage();
    if (!bucket) return new Response('媒体存储暂不可用',{status:503});
    let range: {offset:number;length:number} | undefined;
    const requestedRange = request.headers.get('range');
    if (requestedRange) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(requestedRange);
      if (!match || (!match[1] && !match[2])) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${media.byte_size}`}});
      const start = match[1] ? Number(match[1]) : Math.max(0,media.byte_size-Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]),media.byte_size-1) : media.byte_size-1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= media.byte_size)
        return new Response(null,{status:416,headers:{'Content-Range':`bytes */${media.byte_size}`}});
      range = {offset:start,length:end-start+1};
    }
    const object = await bucket.get(media.object_key,range ? {range} : undefined);
    if (!object || !('body' in object)) return new Response('未找到媒体',{status:404});
    const headers: Record<string,string> = {'Content-Type':media.media_type,'Content-Length':String(range?.length || media.byte_size),
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline',
      'Cross-Origin-Resource-Policy':'same-origin','Accept-Ranges':'bytes','Content-Security-Policy':"default-src 'none'; sandbox"};
    if (range) headers['Content-Range'] = `bytes ${range.offset}-${range.offset+range.length-1}/${media.byte_size}`;
    return new Response(object.body,{status:range?206:200,headers});
  } catch { return new Response('媒体暂时不可用',{status:503,headers:{'Cache-Control':'no-store'}}); }
}
