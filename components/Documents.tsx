'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { communityScore, discoveryScore, riskWeight } from '../lib/ranking';

const groups = [
  { title: '使用指南', links: [
    ['项目使用指南', '/docs/USER_GUIDE.md'],
    ['Arena 与本地工作台', '/docs/ARENA_LOCAL_GUIDE.md'],
    ['本地部署', '/downloads/LOCAL_SETUP.md'],
    ['网站访问排查', '/docs/ACCESS_TROUBLESHOOTING.md'],
  ] },
  { title: '数据与评分', links: [
    ['评分与风控', '/downloads/RANKING_POLICY.md'],
    ['工具来源', '/docs/catalog-sources.md'],
    ['模型来源', '/docs/model-sources.md'],
    ['数据更新', '/docs/data-refresh.md'],
  ] },
  { title: '开发交接', links: [
    ['Codex 接续任务', '/docs/CODEX_HANDOFF.md'],
    ['设计规范', '/docs/DESIGN.md'],
    ['UI 迭代记录', '/docs/UNSLOP_REVIEW.md'],
    ['验证记录', '/docs/verification.md'],
  ] },
];

export function Documents() {
  return <div className="documents-page page-width">
    <div className="page-intro"><h1>文档</h1><a href="/api/catalog?download=1" className="button outline"><Download size={16} />目录 JSON</a></div>
    <div className="document-groups">
      {groups.map(group => <section key={group.title}>
        <h2>{group.title}</h2>
        {group.links.map(([label, href]) => <a className="document-link" key={href} href={href} download>
          <span>{label}<span className="document-extension">.md</span></span><Download size={16} />
        </a>)}
      </section>)}
    </div>
    <details className="calculator-disclosure"><summary>权重计算器</summary><WeightCalculator /></details>
  </div>;
}

function WeightCalculator() {
  const [votes, setVotes] = useState(12);
  const [mean, setMean] = useState(4);
  const [age, setAge] = useState(30);
  const [burst, setBurst] = useState(false);
  const risk = riskWeight({ accountAgeDays: age, verifiedUsageCount: 0, requestsLastMinute: burst ? 8 : 1,
    requestsLastDay: burst ? 32 : 5, rapidRepeatedSequence: burst });
  const score = communityScore(Array.from({ length: votes }, (_, index) => ({
    rating: mean, weight: risk.decision === 'accept' ? risk.weight : 0, identityId: String(index),
  })));
  const discovery = discoveryScore(70, score.score, score.informationN);
  return <div className="weight-calculator">
    <div className="calculator-inputs">
      <p className="muted">模拟数据 · 不写入榜单</p>
      <label>评价人数<output>{votes}</output><input type="range" min="0" max="100" value={votes} onChange={event => setVotes(+event.target.value)} /></label>
      <label>每人的评分<output>{mean} / 5</output><input type="range" min="1" max="5" value={mean} onChange={event => setMean(+event.target.value)} /></label>
      <label>站内账号年龄<output>{age} 天</output><input type="range" min="0" max="180" value={age} onChange={event => setAge(+event.target.value)} /></label>
      <label className="check-line"><input type="checkbox" checked={burst} onChange={event => setBurst(event.target.checked)} />密集重复行为</label>
    </div>
    <dl className="calculator-results">
      <div><dt>单票权重</dt><dd>{risk.weight.toFixed(3)}</dd></div>
      <div><dt>有效证据</dt><dd>{score.informationN.toFixed(2)}</dd></div>
      <div><dt>社区后验</dt><dd>{score.stars === null ? '暂无评价' : `${score.stars.toFixed(2)} / 5`}</dd></div>
      <div><dt>社区分占比</dt><dd>{(discovery.communityShare * 100).toFixed(1)}%</dd></div>
      <div><dt>处理结果</dt><dd>{{ accept: '接纳', challenge: '需要验证', quarantine: '隔离待复核', reject: '拒绝' }[risk.decision]}</dd></div>
    </dl>
  </div>;
}
