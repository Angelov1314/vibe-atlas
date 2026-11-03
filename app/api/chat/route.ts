import {readTextLimited} from '../../../lib/bounded';
import {items,searchItems} from '../../../lib/catalog';
import {retrieveWithIntent} from '../../../lib/retrieval-intent';
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'请提交 JSON。'},{status:415});
 if(Number(request.headers.get('content-length'))>10000)return Response.json({error:'问题过长。'},{status:413});
 let body;try{const text=await readTextLimited(request,10000);if(text.length>10000)return Response.json({error:'问题过长。'},{status:413});body=JSON.parse(text);}catch{return Response.json({error:'无法解析问题。'},{status:400});}
 const message=String(body.message||'').slice(0,1800);if(!message.trim())return Response.json({error:'请先描述任务。'},{status:400});
 const {result,constraints,taskTagFallback}=retrieveWithIntent(message,items,searchItems,4);
 const {commercial,taskIntents}=constraints;
 let answer=result.length?`找到 ${result.length} 个候选项目。`:'没有匹配项目，请补充具体任务或调整条件。';
 if(taskIntents.length)answer+=`\n任务：${taskIntents.map(t=>t.label).join(' / ')}。`;
 if(taskTagFallback&&result.length)answer+='\n依据：目录任务标签。';
 if(commercial)answer+='\n已筛选宽松许可候选，目标版本及依赖仍需核对。';
 if(/5090|4090|显存|vram|\d+\s?g[b]?/i.test(message))answer+='\n设备兼容性待本机验证。';
 if(/部署|安装|local|本地/i.test(message))answer+='\n打开项目可下载部署任务。';
 return Response.json({mode:'catalog-retrieval',answer,itemIds:result.map(p=>p.id),sources:result.flatMap(p=>p.sources.slice(0,2)),constraints,generatedByLLM:false},{headers:{'Cache-Control':'no-store'}});
}
