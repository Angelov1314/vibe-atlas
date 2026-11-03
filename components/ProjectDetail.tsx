'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, Download, Loader2, LogIn, Star } from 'lucide-react';
import type { Item } from '../lib/catalog';
import { ChallengeBox } from './Arena';
import { Modal, RepoImage } from './AtlasUI';

type Props = {
  item: Item; onClose: () => void; saved: boolean; toggleSave: () => void;
  identity: unknown; score: any; communityReady: boolean;
  onVote: (score: any) => void; onDeploy: () => void; ask: () => void; notify: (message: string) => void;
};

const signalLabels: Record<string, string> = {
  github_stars: 'GitHub Stars', github_growth_30d: '30 日增长', maintenance: '维护活跃度',
  contributors_90d: '90 日贡献者', x_unique_authors_30d: 'X 独立作者',
};
const detailTabs = [['overview', '概览'], ['score', '热度'], ['vote', '社区评价']];

export function ProjectDetail({ item, onClose, saved, toggleSave, identity, score, communityReady, onVote, onDeploy, ask, notify }: Props) {
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState('overview');
  const [challenge, setChallenge] = useState<any>(null);
  const [challengeToken, setChallengeToken] = useState('');
  const restricted = /restricted|research|mixed|source-available|code-open/.test(item.licenseClass);
  const needsLicenseReview = item.licenseClass === 'review';

  async function vote() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, rating, challengeToken, website: '' }),
      });
      const data: any = await response.json();
      if (data.error === 'challenge_required' && data.siteKey) {
        setChallenge(data); setError(data.message || '完成验证后再次提交评价。'); return;
      }
      if (!response.ok) throw new Error(data.message || data.error || '提交失败，请稍后重试');
      setChallenge(null); setChallengeToken(''); onVote(data.summary);
      notify(data.status === 'quarantined' ? '评价已保存，等待复核。' : '评价已保存。');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '提交失败，请稍后重试'); }
    finally { setBusy(false); }
  }

  async function appeal() {
    if (note.trim().length < 20) { setError('请用至少 20 个字说明需要复核的问题。'); return; }
    setError('');
    try {
      const response = await fetch('/api/appeals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, explanation: note }),
      });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || '申诉提交失败');
      notify('申诉已记录，等待复核。'); setNote('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '申诉提交失败'); }
  }

  return <Modal title="项目详情" onClose={onClose}>
    <div className="detail-cover"><RepoImage item={item} /></div>
    <div className="detail-body">
      <div className="detail-title">
        <h2>{item.name}</h2>
        <button className={`icon-button ${saved ? 'selected' : ''}`} onClick={toggleSave}
          aria-label={saved ? '取消收藏项目' : '收藏项目'} aria-pressed={saved}>
          <Bookmark size={22} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="detail-description">{item.description}</p>
      <div className="detail-links">
        <button className="button primary" onClick={onDeploy}><Download size={16} />部署任务</button>
        <a href={item.github} target="_blank" rel="noreferrer" className="button outline">GitHub<ArrowUpRight size={16} /></a>
        <a href={item.homepage} target="_blank" rel="noreferrer" className="button outline">官网<ArrowUpRight size={16} /></a>
      </div>
      <div className="detail-tabs" role="tablist" aria-label="项目信息">
        {detailTabs.map(([id, label], index) =>
          <button key={id} id={`detail-tab-${id}`} role="tab" aria-selected={tab === id}
            aria-controls={`detail-panel-${id}`} tabIndex={tab === id ? 0 : -1}
            onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? (index + 1) % detailTabs.length :
                event.key === 'ArrowLeft' ? (index + detailTabs.length - 1) % detailTabs.length :
                event.key === 'Home' ? 0 : event.key === 'End' ? detailTabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const nextId = detailTabs[next][0];
              setTab(nextId);
              document.getElementById(`detail-tab-${nextId}`)?.focus();
            }}
            onClick={() => setTab(id)} className={tab === id ? 'active' : ''}>{label}</button>)}
      </div>

      {tab === 'overview' && <section id="detail-panel-overview" role="tabpanel" aria-labelledby="detail-tab-overview">
        <dl className="spec-list">
          <div><dt>分类</dt><dd>{item.category}</dd></div>
          <div><dt>{item.kind === 'model' ? '权重许可' : '代码许可'}</dt><dd>{item.license}</dd></div>
          {item.kind === 'model' && <div><dt>代码许可</dt><dd>{item.raw.license?.code || '待核验'}</dd></div>}
          <div><dt>GitHub Stars</dt><dd>{item.starsApproximate ? '约 ' : ''}{item.stars?.toLocaleString() ?? '待采集'}</dd></div>
          <div><dt>硬件条件</dt><dd>{item.hardwareNote}</dd></div>
        </dl>
        {(restricted || needsLicenseReview) && <div className="license-notice">{needsLicenseReview ? '许可待核验，请查看项目来源。' : '许可含额外条款，请查看项目说明。'}</div>}
        <div className="detail-resources">
          <a href={`/docs/projects/${item.id}.md`} download className="document-link"><span>项目说明.md</span><Download size={16} /></a>
          <a href={item.raw.imageSource || item.github} target="_blank" rel="noreferrer" className="document-link"><span>图片来源</span><ArrowUpRight size={16} /></a>
          <button className="document-link" onClick={ask}><span>向 Atlas 询问这个项目</span><ArrowRight size={16} /></button>
        </div>
      </section>}

      {tab === 'score' && <section id="detail-panel-score" role="tabpanel" aria-labelledby="detail-tab-score">
        <div className="score-hero">
          <strong>{item.popularity.score?.toFixed(1) ?? '—'}</strong>
          <div>仓库热度 / 100<span>数据覆盖 {Math.round(item.popularity.coverage * 100)}%</span></div>
        </div>
        <table className="score-breakdown">
          <thead><tr><th>信号</th><th>基础权重</th><th>信号分</th></tr></thead>
          <tbody>{item.popularity.components.map(component => <tr key={component.name}>
            <td>{signalLabels[component.name] || component.name}</td>
            <td>{Math.round(component.weight * 100)}%</td>
            <td>{component.value === null ? '待采集' : component.value.toFixed(1)}</td>
          </tr>)}</tbody>
        </table>
        <dl className="spec-list score-metadata">
          <div><dt>采集日期</dt><dd>{item.observedAt ? item.observedAt.slice(0, 10) : '待采集'}</dd></div>
          <div><dt>分组</dt><dd>{item.popularity.cohort}</dd></div>
        </dl>
        <div className="detail-resources">
          <a href="/downloads/RANKING_POLICY.md" download className="document-link"><span>评分与风控.md</span><Download size={16} /></a>
          <a href={`/docs/projects/${item.id}.md`} download className="document-link"><span>数据来源.md</span><Download size={16} /></a>
        </div>
      </section>}

      {tab === 'vote' && <section id="detail-panel-vote" role="tabpanel" aria-labelledby="detail-tab-vote">
        <div className="vote-summary">
          <h3>{!communityReady ? '评价暂不可用' : score.voters ? `${score.stars?.toFixed(2)} / 5` : '暂无评价'}</h3>
          {communityReady && score.voters > 0 && <dl className="vote-evidence">
            <div><dt>评价人数</dt><dd>{score.voters}</dd></div>
            <div><dt>有效证据</dt><dd>{score.informationN?.toFixed(2)}</dd></div>
            <div><dt>95% 区间</dt><dd>{score.lower95}–{score.upper95}</dd></div>
          </dl>}
        </div>
        {communityReady && (identity ? <>
          <span className="field-label" id="rating-label">你的评分</span>
          <div className="rating-buttons" role="group" aria-labelledby="rating-label">
            {[1, 2, 3, 4, 5].map(value => <button key={value} onClick={() => setRating(value)}
              className={value <= rating ? 'selected' : ''} aria-label={`${value} 星`} aria-pressed={rating === value}>
              <Star size={28} fill={value <= rating ? 'currentColor' : 'none'} />
            </button>)}
          </div>
          <p className="rating-caption">{['请选择 1–5 星', '不适合我的任务', '使用阻碍较多', '基本可用', '值得推荐', '体验出色'][rating]}</p>
          {challenge && <ChallengeBox challenge={challenge} onToken={setChallengeToken} />}
          <button className="button primary" disabled={!rating || busy || (!!challenge && !challengeToken)} onClick={() => void vote()}>
            {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}保存评价
          </button>
        </> : <a href="/signin-with-chatgpt?return_to=/" target="_top" className="button primary"><LogIn size={16} />登录后评价</a>)}
        {error && <p className="error" role="alert">{error}</p>}
        <details className="appeal-box">
          <summary>申请复核</summary>
          <textarea value={note} onChange={event => setNote(event.target.value)}
            placeholder="说明需要复核的问题，至少 20 个字" aria-label="申诉原因" maxLength={1500} />
          <button className="button outline" disabled={!identity || !communityReady} onClick={() => void appeal()}>提交申诉</button>
        </details>
        <a href="/downloads/RANKING_POLICY.md" download className="document-link"><span>评价规则.md</span><Download size={16} /></a>
      </section>}
    </div>
  </Modal>;
}
