'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,CheckCircle2,ChevronRight,Copy,Download,ExternalLink,HardDrive,KeyRound,Loader2,Monitor,Send,Terminal,Unplug} from 'lucide-react';
import {items,searchItems} from '../lib/catalog';
import {retrieveWithIntent} from '../lib/retrieval-intent';
import './local.css';

type LocalHealth={version:string;platform:string;machine:string;gpus:{name:string;memoryMiB:string;driver:string}[];gpuNote:string;docker:{available:boolean;local:boolean;version?:string;message:string};ollama:{available:boolean;models:{name:string;size:number;digest:string}[];message:string}};
type Plan={planId:string;planHash:string;plan:{recipeId:string;name:string;image:string;source:string;license:string;container:string;port:string;volume:string;url:string;notes:string;floatingTagNotice:string;downloadSize:string;existingContainerPolicy:string;secretPolicy:string;commands:string[][];expiresAt:number}};
type Job={id:string;recipeId:string;status:string;message:string;url:string;imageDigest?:string;executedArgs?:string[];healthVerified?:boolean;receiptWarning?:string;existing?:{status:string;running:boolean}};
type ChatMessage={role:'user'|'assistant';text:string;sources?:{id:string;name:string;url:string}[]};
const BASE='http://127.0.0.1:4317';
const recipes=[{id:'open-webui',name:'Open WebUI',detail:'本地模型聊天界面。',port:'3000',mark:'W'}, {id:'n8n',name:'n8n',detail:'可视化自动化工作流。',port:'5678',mark:'n8'}, {id:'qdrant',name:'Qdrant',detail:'本地向量数据库。',port:'6333',mark:'Q'}];
const terminalStates=new Set(['succeeded','degraded','failed','existing']);
const statusNames:Record<string,string>={queued:'等待检查',pulling:'拉取镜像',launching:'启动容器',checking:'验证健康状态',succeeded:'健康检查通过',degraded:'需要本机检查',failed:'部署未完成',existing:'保留已有容器'};

function downloadPlan(plan: Plan) {
  const p = plan.plan;
  const content = [
    `# ${p.name} 本地部署计划`,
    '',
    `- 官方来源：${p.source}`,
    `- 许可：${p.license}`,
    `- 镜像：${p.image}`,
    `- 容器：${p.container}`,
    `- 端口：${p.port}`,
    `- 数据卷：${p.volume}`,
    `- 服务地址：${p.url}`,
    `- 有效期：${new Date(p.expiresAt * (p.expiresAt < 1e12 ? 1000 : 1)).toISOString()}`,
    '',
    '## 运行条件',
    '',
    p.downloadSize,
    '',
    p.floatingTagNotice,
    '',
    p.existingContainerPolicy,
    '',
    p.secretPolicy,
    '',
    p.notes,
    '',
    '## 完整执行参数',
    '',
    '程序使用参数数组执行，不经 shell。',
    '',
    '```json',
    JSON.stringify(p.commands, null, 2),
    '```',
    '',
    '## 计划校验',
    '',
    `SHA-256：${plan.planHash}`,
    '',
    '请先核对这份计划，再在页面确认部署；过期后重新生成。',
    '关闭页面或 companion 不会停止已有 Docker 容器。',
    ''
  ].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${p.recipeId}-deployment-plan.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LocalStudio({initialRecipe,notify}:{initialRecipe:string|null;notify:(s:string)=>void}){
 const[origin,setOrigin]=useState(''),[os,setOs]=useState<'unix'|'windows'>('unix'),[token,setToken]=useState(''),[connected,setConnected]=useState(false),[health,setHealth]=useState<LocalHealth|null>(null),[recipe,setRecipe]=useState(initialRecipe&&recipes.some(r=>r.id===initialRecipe)?initialRecipe:'open-webui'),[plan,setPlan]=useState<Plan|null>(null),[reviewed,setReviewed]=useState(false),[job,setJob]=useState<Job|null>(null),[jobId,setJobId]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[model,setModel]=useState(''),[question,setQuestion]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]),[chatBusy,setChatBusy]=useState(false),[chatError,setChatError]=useState('');
 const chatEnd=useRef<HTMLDivElement>(null);
 useEffect(()=>{setOrigin(window.location.origin);setOs(/Win/i.test(navigator.platform)?'windows':'unix');},[]);
 useEffect(()=>{if(initialRecipe&&recipes.some(r=>r.id===initialRecipe)){setRecipe(initialRecipe);setPlan(null);setReviewed(false);}},[initialRecipe]);
 useEffect(()=>{if(messages.length||chatBusy)chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages,chatBusy]);
 const command=`${os==='windows'?'py -3':'python3'} atlas_companion.py --origin "${origin||'https://你的站点'}"`;
 async function api<T>(path:string,body?:unknown,timeout=30000):Promise<T>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const r=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token.trim()}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});const data:any=await r.json();if(!r.ok)throw new Error(data.error||`本机服务返回 ${r.status}`);return data as T;}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw new Error('本机请求超时。请检查 companion 终端及 Docker / Ollama 状态。');if(e instanceof TypeError)throw new Error('无法连接本机。请确认 companion 已运行、Origin 与当前页面一致，并允许浏览器访问本地网络。');throw e;}
  finally{clearTimeout(timer);}
 }
 async function copy(text:string){try{await navigator.clipboard.writeText(text);notify('已复制。');}catch{notify('浏览器未允许复制，请手动选中文本。');}}
 async function connect(){setBusy('connect');setError('');try{const h=await api<LocalHealth>('/v1/health');setHealth(h);setConnected(true);setModel(previous=>h.ollama.models.some(m=>m.name===previous)?previous:h.ollama.models[0]?.name||'');notify('已连接本机。');}catch(e){setConnected(false);setHealth(null);setError(e instanceof Error?e.message:'连接失败。');}finally{setBusy('');}}
 async function makePlan(){setBusy('plan');setError('');setReviewed(false);try{setPlan(await api<Plan>('/v1/plan',{recipeId:recipe}));setJob(null);setJobId('');}catch(e){setError(e instanceof Error?e.message:'计划生成失败。');}finally{setBusy('');}}
 async function deploy(){if(!plan||!reviewed)return;setBusy('deploy');setError('');try{const result=await api<{jobId:string}>('/v1/deploy',{planId:plan.planId,planHash:plan.planHash,confirmation:'deploy-local'});setJobId(result.jobId);setJob({id:result.jobId,recipeId:recipe,status:'queued',message:'正在本机检查已确认的计划。',url:plan.plan.url});setReviewed(false);}catch(e){setError(e instanceof Error?e.message:'提交失败。');}finally{setBusy('');}}
 useEffect(()=>{if(!jobId||!connected)return;let alive=true;let timer:ReturnType<typeof setTimeout>;const poll=async()=>{try{const j=await api<Job>(`/v1/jobs/${jobId}`);if(!alive)return;setJob(j);if(!terminalStates.has(j.status))timer=setTimeout(poll,2000);}catch(e){if(alive){setError(e instanceof Error?e.message:'任务状态读取失败。');timer=setTimeout(poll,6000);}}};poll();return()=>{alive=false;clearTimeout(timer);};},[jobId,connected,token]);
 async function send(){const text=question.trim();if(!text||!model||!connected||chatBusy)return;const{result:found,constraints}=retrieveWithIntent(text,items,searchItems,6);const scope=[constraints.taskIntents.length?constraints.taskIntents.map(t=>t.label).join(' / '):'目录关键词匹配',...(constraints.commercial?['明确宽松许可候选']:[])].join('；');if(!found.length){setChatError(`当前目录没有满足「${scope}」的已核验候选。未扩大到其他任务，也未向模型发送无来源问题；可以调整任务或许可条件。`);return;}setQuestion('');setChatError('');setMessages(m=>[...m,{role:'user',text}]);setChatBusy(true);try{const result=await api<{answer:string;sources:{id:string;name:string;url:string}[]}>('/v1/chat',{model,message:text,contexts:found.map(p=>({id:p.id,name:p.name,description:p.description.slice(0,1500),license:p.licenseNote.slice(0,1500),source:p.sources.find(s=>s.startsWith('https://'))||p.github,installHint:p.installHint.slice(0,1500)}))},200000);setMessages(m=>[...m,{role:'assistant',text:`${result.answer}\n\n目录筛选范围：${scope}。${constraints.commercial?'宽松许可筛选不是商业使用保证，仍需核对权重、数据与第三方依赖。':''}`,sources:result.sources}]);}catch(e){setChatError(e instanceof Error?e.message:'本地模型请求失败。');}finally{setChatBusy(false);}}
 const activeJob=job&&!terminalStates.has(job.status);
 return <div className="local-studio page-width">
  <div className="page-intro local-intro"><h1>本地部署</h1><a className="text-link" href="/docs/ARENA_LOCAL_GUIDE.md" download>使用说明.md<ArrowUpRight size={15}/></a></div>
  <div className="local-grid">
   <section className="local-connect-panel" aria-labelledby="local-connect-title">
    <div className="local-section-heading"><h2 id="local-connect-title">连接电脑</h2>{connected&&<span className="local-connected"><span/>已连接</span>}</div>
    <ol className="local-steps">
     <li><div><strong>下载连接程序</strong><div className="local-actions"><a href="/downloads/atlas_companion.py" download className="button outline small"><Download size={15}/>下载 companion</a><a href="/downloads/LOCAL_SETUP.md" target="_blank" rel="noreferrer" className="text-link">安装说明.md<ArrowUpRight size={14}/></a></div></div></li>
     <li><div><strong>在下载目录运行</strong><div className="local-os-tabs" aria-label="操作系统"><button className={os==='unix'?'active':''} onClick={()=>setOs('unix')}>macOS / Linux</button><button className={os==='windows'?'active':''} onClick={()=>setOs('windows')}>Windows</button></div><div className="local-command"><code>{command}</code><button className="icon-button" onClick={()=>copy(command)} aria-label="复制启动命令"><Copy size={16}/></button></div></div></li>
     <li><div><label className="field-label" htmlFor="local-pairing-token">配对令牌</label><div className="local-token-field"><KeyRound size={17}/><input id="local-pairing-token" type="password" value={token} onChange={e=>{setToken(e.target.value);setConnected(false);setHealth(null);setPlan(null);}} placeholder="粘贴终端中的随机令牌" autoComplete="off" spellCheck={false}/></div><div className="local-actions"><button className="button primary" disabled={!token.trim()||!!busy} onClick={connect}>{busy==='connect'?<Loader2 size={16} className="local-spin"/>:<Monitor size={16}/>} {connected?'重新探测':'连接并探测'}</button>{connected&&<button className="button outline" onClick={()=>{setConnected(false);setToken('');setHealth(null);setPlan(null);setModel('');notify('已清除页面令牌；本机后台任务与容器保持运行。');}}><Unplug size={15}/>断开</button>}</div></div></li>
    </ol>
    {error&&<p className="error" role="alert">{error}</p>}
    {health&&<div className="local-health"><div><CheckCircle2 size={16}/><strong>{health.platform} · {health.machine}</strong><small>companion {health.version}</small></div><dl><div><dt>GPU</dt><dd>{health.gpus.length?health.gpus.map(g=><span key={g.name}>{g.name} · {(Number(g.memoryMiB)/1024).toFixed(1)} GiB · 驱动 {g.driver}</span>):health.gpuNote}</dd></div><div><dt>Docker</dt><dd>{health.docker.message}{health.docker.version&&` · ${health.docker.version}`}</dd></div><div><dt>Ollama</dt><dd>{health.ollama.message}</dd></div></dl></div>}

   </section>
   <section className="local-deploy-panel" aria-labelledby="local-deploy-title">
    <div className="local-section-heading"><h2 id="local-deploy-title">部署应用</h2></div>
    <div className="local-recipes">{recipes.map(r=><button key={r.id} className={`local-recipe ${recipe===r.id?'selected':''}`} onClick={()=>{setRecipe(r.id);setPlan(null);setReviewed(false);}} disabled={!!activeJob} aria-pressed={recipe===r.id}><span className={`local-recipe-mark ${r.id}`}>{r.mark}</span><div><strong>{r.name}</strong><p>{r.detail}</p><small>端口 {r.port}</small></div>{recipe===r.id?<Check size={18}/>:<ChevronRight size={18}/>}</button>)}</div>
    <button className="button dark" disabled={!connected||!!busy||!!activeJob} onClick={makePlan}>{busy==='plan'?<Loader2 className="local-spin" size={16}/>:<Terminal size={16}/>}生成部署计划</button>
    {!connected&&<p className="muted local-fine">连接电脑后可生成计划</p>}
    {plan&&<div className="local-plan"><div className="local-plan-title"><h3>{plan.plan.name} 部署计划</h3><span>10 分钟内有效</span></div><dl className="spec-list"><div><dt>镜像</dt><dd>{plan.plan.image}</dd></div><div><dt>容器</dt><dd>{plan.plan.container}</dd></div><div><dt>端口</dt><dd>{plan.plan.port}</dd></div><div><dt>数据卷</dt><dd>{plan.plan.volume}</dd></div><div><dt>许可</dt><dd>{plan.plan.license}</dd></div><div><dt>下载量</dt><dd>未知，确认后拉取官方镜像</dd></div></dl><a className="source-row" href={plan.plan.source} target="_blank" rel="noreferrer"><ExternalLink size={14}/><span>核对官方安装来源</span><ArrowUpRight size={14}/></a><div className="local-actions"><button type="button" className="button outline small" onClick={()=>downloadPlan(plan)}><Download size={15}/>完整计划.md</button></div><details className="local-plan-commands"><summary>查看执行参数</summary><pre>{JSON.stringify(plan.plan.commands,null,2)}</pre></details><label className="local-review"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={!!activeJob}/><span>我已检查完整计划中的镜像、许可、端口、下载与命令，同意在这台电脑拉取并启动。</span></label><button className="button primary" onClick={deploy} disabled={!reviewed||!!busy||!!activeJob||!health?.docker.local||!health?.docker.available}>{busy==='deploy'?<Loader2 className="local-spin" size={16}/>:<Download size={16}/>}确认并在本机部署</button>{!health?.docker.local&&<p className="muted local-fine">本机 Docker 不可用</p>}</div>}
    {job&&<div className={`local-job ${job.status==='succeeded'?'success':''}`} aria-live="polite"><div>{activeJob?<Loader2 className="local-spin" size={18}/>:<HardDrive size={18}/>}<strong>{statusNames[job.status]||job.status}</strong></div><p>{job.message}</p>{job.existing&&<p>已有容器状态：{job.existing.status}。请自行检查是否适合继续使用。</p>}{job.imageDigest&&<code className="local-digest">{job.imageDigest}</code>}{job.receiptWarning&&<p className="error">{job.receiptWarning}</p>}{terminalStates.has(job.status)&&<div className="local-actions">{(job.status==='succeeded'||job.status==='existing'||job.status==='degraded')&&<a className="button outline small" href={job.url} target="_blank" rel="noreferrer">打开本机服务<ArrowUpRight size={14}/></a>}<button className="button outline small" onClick={()=>copy(JSON.stringify(job,null,2))}><Copy size={14}/>复制无密钥回执</button></div>}</div>}
   </section>
  </div>
  <section className="local-chat-section" aria-labelledby="local-chat-title"><div className="local-section-heading"><h2 id="local-chat-title">本地问答</h2></div><div className="local-chat-layout"><div className="local-chat-settings"><label htmlFor="local-model" className="field-label">已安装的本地模型</label><select id="local-model" value={model} disabled={!connected||!health?.ollama.models.length||chatBusy} onChange={e=>setModel(e.target.value)}><option value="">{connected?'没有可用的本地权重':'连接本机后选择'}</option>{health?.ollama.models.map(m=><option key={m.name} value={m.name}>{m.name} · {(m.size/1e9).toFixed(1)} GB 文件</option>)}</select><a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-link">获取官方 Ollama<ArrowUpRight size={14}/></a></div><div className="local-chat-box"><div className="local-chat-history">{!messages.length&&<div className="local-chat-empty"><p>{connected&&model?'输入任务、设备和许可要求':'连接电脑并选择已安装的模型'}</p></div>}{messages.map((m,i)=><div key={i} className={`local-chat-message ${m.role}`}><span>{m.role==='user'?'你':model}</span><p>{m.text}</p>{m.sources&&<div className="local-chat-sources">{m.sources.map(s=><a href={s.url} key={s.id} target="_blank" rel="noreferrer">{s.name}<ArrowUpRight size={12}/></a>)}</div>}</div>)}{chatBusy&&<div className="local-chat-thinking"><Loader2 size={15} className="local-spin"/>正在生成回答…</div>}<div ref={chatEnd}/></div><form className="local-chat-form" onSubmit={e=>{e.preventDefault();send();}}><textarea rows={2} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={model?'描述你要完成的任务…':'请先选择本地模型'} maxLength={2000} disabled={!connected||!model} aria-label="向本地模型提问"/><button className="button primary" aria-label="发送本地问题" disabled={!connected||!model||!question.trim()||chatBusy}>{chatBusy?<Loader2 className="local-spin" size={17}/>:<Send size={17}/>}</button></form>{chatError&&<p className="error" role="alert">{chatError}</p>}<p className="local-fine local-chat-disclosure">{connected&&model?`Ollama · ${model}`:'本地模型未连接'}</p></div></div></section>
 </div>;
}
