import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectTaskIntents,retrieveWithIntent} from '../lib/retrieval-intent.ts';

const models=JSON.parse(readFileSync(new URL('../data/models.json',import.meta.url),'utf8')).models.map(m=>({id:m.id,kind:'model',modalities:m.modalities,tags:m.tags,license:m.license.weights,licenseClass:m.license.classification}));
const tools=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8')).projects.map(p=>({id:p.id,kind:'tool',modalities:[],tags:p.tags,license:p.license,licenseClass:p.openSourceStatus==='source-available'?'source-available':'open-source'}));
const all=[...tools,...models];
// Intentionally unhelpful ranking: task filtering must work even when a lexical
// matcher strongly prefers Qwen image products or unrelated library names.
const poorLexicalRanking=(_q,pool)=>[...pool].sort((a,b)=>Number(b.id.includes('qwen'))-Number(a.id.includes('qwen')));
const retrieve=q=>retrieveWithIntent(q,all,poorLexicalRanking,40);

test('Chinese photo-to-3D request excludes image models and keeps commercial hard filter',()=>{
 const r=retrieve('把一张图片变成 3D 模型，许可允许商业使用');
 assert.ok(r.result.length>=2);
 assert.ok(r.result.some(p=>p.id==='triposr'));
 assert.ok(r.result.some(p=>p.id==='trellis2'));
 assert.ok(r.result.every(p=>p.modalities.includes('image-to-3d')));
 assert.ok(r.result.every(p=>p.licenseClass==='permissive-open-weights'));
 assert.ok(!r.result.some(p=>p.id.startsWith('qwen-image')||p.id==='hunyuan3d2'||p.id==='stable-fast-3d'));
 assert.deepEqual(r.constraints.taskIntents.map(t=>t.id),['image-to-3d']);
});

test('English conversion and explicit image-video modes constrain actual modalities',()=>{
 const mesh=retrieve('Convert a photo into a 3D model for commercial use');
 assert.ok(mesh.result.length>0);
 assert.ok(mesh.result.every(p=>p.modalities.includes('image-to-3d')));
 const video=retrieve('找本地图生视频模型');
 assert.ok(video.result.length>0);
 assert.ok(video.result.every(p=>p.modalities.includes('image-to-video')));
 assert.ok(!video.result.some(p=>p.id==='cogvideox2b'));
});

test('music and SFX generation are distinct tasks; multi-task queries use explicit union',()=>{
 const music=retrieve('生成背景音乐的本地模型');
 assert.ok(music.result.length>0);
 assert.ok(music.result.every(p=>p.modalities.some(m=>['text-to-music','lyrics-to-song'].includes(m))));
 const sfx=retrieve('我要生成游戏音效 SFX，允许商用');
 assert.ok(sfx.result.every(p=>p.modalities.includes('text-to-sfx')));
 assert.ok(sfx.result.every(p=>p.licenseClass==='permissive-open-weights'));
 const both=retrieve('音乐生成和音效生成模型');
 assert.equal(both.constraints.taskIntents.length,2);
 assert.ok(both.result.some(p=>p.modalities.includes('text-to-sfx')));
 assert.ok(both.result.some(p=>p.modalities.includes('lyrics-to-song')));
});

test('TTS and ASR do not return each other or general audio/image models',()=>{
 for(const[q,modality]of [['语音转文字模型 ASR','speech-recognition'],['语音合成 TTS 模型','text-to-speech']]){
  const r=retrieve(q);assert.ok(r.result.length>0);
  assert.ok(r.result.every(p=>p.modalities.includes(modality)));
 }
});

test('ordinary tools and music visualizations remain broad searches',()=>{
 for(const q of ['我想用 Three.js 做一个 3D 作品集','用 Three.js 做音乐可视化网站','游戏开发和自动化测试工具']){
  const r=retrieve(q);
  assert.deepEqual(detectTaskIntents(q),[]);
  assert.equal(r.constraints.modelOnly,false);
  assert.ok(r.result.some(p=>p.kind==='tool'));
 }
});

test('no matching permissive SFX model never falls back to unrelated commercial tools',()=>{
 const r=retrieve('音效生成模型，商业使用');
 assert.equal(r.result.length,0);
 assert.equal(r.constraints.commercial,true);
 assert.equal(r.constraints.taskIntents[0].id,'sfx-generation');
});

test('task metadata remains valid evidence with no lexical hits, without escaping constraints',()=>{
 const r=retrieveWithIntent('image-to-3d',all,()=>[],40);
 assert.equal(r.taskTagFallback,true);
 assert.ok(r.result.length>0);
 assert.ok(r.result.every(p=>p.modalities.includes('image-to-3d')));
});
