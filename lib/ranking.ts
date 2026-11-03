/**
 * Vibe Atlas ranking policy v1.0.0 — transparent defaults, not a calibrated fraud model.
 * No external dependencies. All dates/observations must come from trusted server sources.
 */

export const POLICY_VERSION = '2026-11-02.v1';
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const rounded = (n: number, places = 2) => Number(n.toFixed(places));

export interface PopularityMetrics {
  stars?: number | null;
  starsGained30d?: number | null;
  daysSincePush?: number | null;
  contributors90d?: number | null;
  xUniqueAuthors30d?: number | null;
  observedAt?: string | null;
  /** True only when collection covered the stated full window. */
  xWindowComplete?: boolean;
}

export interface SeedCohort {
  stars?: number[];
  starsGained30d?: number[];
  contributors90d?: number[];
  xUniqueAuthors30d?: number[];
  label?: string;
}

/** Average-tie percentile; never call a one-item cohort a top percentile. */
export function percentile(value: number, observations: number[]): number | null {
  const xs = observations.filter(valid);
  if (xs.length < 5 || !valid(value)) return null;
  const lower = xs.filter(x => x < value).length;
  const equal = xs.filter(x => x === value).length;
  return clamp((lower + 0.5 * equal) / xs.length) * 100;
}

function metricScore(value: number, cohort: number[] | undefined, anchor: number) {
  const logAnchor = clamp(Math.log1p(value) / Math.log1p(anchor)) * 100;
  const p = percentile(value, cohort ?? []);
  return {score: p === null ? logAnchor : 0.5 * logAnchor + 0.5 * p,
    method: p === null ? 'log-reference' : 'half-log-half-cohort-percentile'};
}

/** Score only observed signals; missing X is never fabricated or silently scored zero. */
export function seedScore(metrics: PopularityMetrics, cohort: SeedCohort = {}, now = new Date()) {
  const components: {name: string; weight: number; value: number | null; method: string}[] = [
    {name: 'github_stars', weight: 0.45,
      ...(valid(metrics.stars) ? {value: metricScore(metrics.stars, cohort.stars, 100000).score,
        method: metricScore(metrics.stars, cohort.stars, 100000).method} : {value: null, method: 'missing'})},
    {name: 'github_growth_30d', weight: 0.20,
      ...(valid(metrics.starsGained30d) ? {value: metricScore(metrics.starsGained30d, cohort.starsGained30d, 10000).score,
        method: metricScore(metrics.starsGained30d, cohort.starsGained30d, 10000).method} : {value: null, method: 'missing'})},
    {name: 'maintenance', weight: 0.15,
      value: valid(metrics.daysSincePush) ? 100 * Math.exp(-metrics.daysSincePush / 180) : null,
      method: valid(metrics.daysSincePush) ? '180-day-exponential-half-life-124.8-days' : 'missing'},
    {name: 'contributors_90d', weight: 0.10,
      ...(valid(metrics.contributors90d) ? {value: metricScore(metrics.contributors90d, cohort.contributors90d, 100).score,
        method: metricScore(metrics.contributors90d, cohort.contributors90d, 100).method} : {value: null, method: 'missing'})},
    {name: 'x_unique_authors_30d', weight: 0.10,
      ...(valid(metrics.xUniqueAuthors30d) && metrics.xWindowComplete ?
        {value: metricScore(metrics.xUniqueAuthors30d, cohort.xUniqueAuthors30d, 1000).score,
          method: metricScore(metrics.xUniqueAuthors30d, cohort.xUniqueAuthors30d, 1000).method} :
        {value: null, method: 'missing-or-incomplete-window'})},
  ];
  const available = components.filter(c => c.value !== null);
  const coverage = available.reduce((s, c) => s + c.weight, 0);
  const score = coverage ? available.reduce((s, c) => s + c.weight * c.value!, 0) / coverage : null;
  const observed = metrics.observedAt ? Date.parse(metrics.observedAt) : NaN;
  const ageDays = Number.isFinite(observed) ? Math.max(0, (now.getTime() - observed) / 86400000) : null;
  const freshness = ageDays === null ? 0.4 : Math.exp(-ageDays / 30);
  return {
    score: score === null ? null : rounded(score),
    label: '可核验热度 / verified popularity',
    coverage: rounded(coverage, 3),
    confidence: rounded(coverage * freshness, 3),
    observedAt: metrics.observedAt ?? null,
    stale: ageDays === null || ageDays > 30,
    cohort: cohort.label ?? 'reference anchors; cohort unavailable',
    components: components.map(c => ({...c, value: c.value === null ? null : rounded(c.value)})),
    policyVersion: POLICY_VERSION,
  };
}

export interface WeightedRating { rating: number; weight: number; identityId?: string; }

/**
 * A neutral Dirichlet prior over 1–5 ratings. Fractional risk-adjusted evidence is a
 * power-posterior approximation; intervals are approximate, not population guarantees.
 */
export function communityScore(votes: WeightedRating[], priorStrength = 12) {
  if (!Number.isFinite(priorStrength) || priorStrength <= 0) throw new Error('Invalid prior strength');
  const usable = votes.filter(v => Number.isInteger(v.rating) && v.rating >= 1 && v.rating <= 5 && valid(v.weight) && v.weight > 0)
    .map(v => ({...v, weight: clamp(v.weight)}));
  const ids = usable.filter(v => v.identityId).map(v => v.identityId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate identity: deduplicate latest vote per project before scoring');
  const sumW = usable.reduce((s, v) => s + v.weight, 0);
  const sumW2 = usable.reduce((s, v) => s + v.weight * v.weight, 0);
  return communityFromHistogram(Array.from({length: 5}, (_, i) =>
    usable.filter(v => v.rating === i + 1).reduce((s,v) => s + v.weight, 0)),
    sumW2, usable.length, priorStrength);
}

/** Equivalent database aggregate path: rating bins contain SUM(weight), not vote counts. */
export function communityFromHistogram(bins: number[], sumW2: number, voters: number, priorStrength = 12) {
  if (bins.length !== 5 || bins.some(n => !valid(n)) || !valid(sumW2) || !valid(voters)
    || !Number.isFinite(priorStrength) || priorStrength <= 0) throw new Error('Invalid rating histogram');
  const sumW = bins.reduce((s,n) => s+n, 0);
  const kishN = sumW2 ? sumW * sumW / sumW2 : 0;
  const informationN = Math.min(sumW, kishN);
  if (!sumW) return {score: null, stars: null, lower95: null, upper95: null, rankScore: null,
    voters: 0, weightedVotes: 0, kishEffectiveN: 0, informationN: 0, status: 'unrated',
    priorStrength, priorMean: 3, intervalMethod: 'Dirichlet moments, approximate 95% interval', policyVersion: POLICY_VERSION};
  const alpha = Array.from({length: 5}, () => priorStrength / 5);
  for (let i = 0; i < 5; i++) alpha[i] += bins[i] * informationN / sumW;
  const total = alpha.reduce((s, a) => s + a, 0);
  const mean = alpha.reduce((s, a, i) => s + a * (i + 1), 0) / total;
  const second = alpha.reduce((s, a, i) => s + a * (i + 1) ** 2, 0) / total;
  const sd = Math.sqrt(Math.max(0, (second - mean * mean) / (total + 1)));
  const lower = clamp(mean - 1.96 * sd, 1, 5);
  const upper = clamp(mean + 1.96 * sd, 1, 5);
  return {score: rounded((mean - 1) * 25), stars: rounded(mean),
    lower95: rounded(lower), upper95: rounded(upper), rankScore: rounded((lower - 1) * 25),
    voters, weightedVotes: rounded(sumW), kishEffectiveN: rounded(kishN),
    informationN: rounded(informationN), status: informationN < 20 ? 'provisional' : 'rated',
    priorStrength, priorMean: 3, intervalMethod: 'Dirichlet moments, approximate 95% interval', policyVersion: POLICY_VERSION};
}

/** Optional discovery ordering; keep heat, community quality and Arena distinct in UI. */
export function discoveryScore(seed: number | null, community: number | null, informationN: number) {
  if (seed === null && community === null) return {score: null, communityShare: 0};
  if (community === null) return {score: seed, communityShare: 0};
  if (seed === null) return {score: community, communityShare: 1};
  const share = 0.8 * Math.max(0, informationN) / (Math.max(0, informationN) + 50);
  return {score: rounded((1 - share) * seed + share * community), communityShare: rounded(share, 3)};
}

export interface RiskSignals {
  accountAgeDays: number;
  verifiedUsageCount: number;
  requestsLastMinute: number;
  requestsLastDay: number;
  rapidRepeatedSequence?: boolean;
  /** A server-side campaign detector score, never a client-supplied field. */
  campaignCorrelation?: number;
  replayedNonce?: boolean;
  honeypotTriggered?: boolean;
  challengeFailed?: boolean;
  challengePassed?: boolean;
}

/** Explainable heuristic, not a claim to reliably distinguish every bot from a person. */
export function riskWeight(s: RiskSignals) {
  const reasons: string[] = [];
  if (s.replayedNonce || s.honeypotTriggered || s.challengeFailed) {
    if (s.replayedNonce) reasons.push('replayed_nonce');
    if (s.honeypotTriggered) reasons.push('honeypot');
    if (s.challengeFailed) reasons.push('failed_challenge');
    return {weight: 0, risk: 1, decision: 'reject', reasons, policyVersion: POLICY_VERSION};
  }
  let risk = 0;
  if (s.requestsLastMinute > 4) { risk += 0.25; reasons.push('short_burst'); }
  if (s.requestsLastDay > 25) { risk += 0.20; reasons.push('high_daily_velocity'); }
  if (s.rapidRepeatedSequence) { risk += 0.25; reasons.push('repeated_sequence'); }
  if (valid(s.campaignCorrelation) && s.campaignCorrelation! >= 0.8) { risk += 0.45; reasons.push('correlated_campaign'); }
  risk = clamp(risk);
  // New accounts are allowed; the prior provides a modest bounded starting influence.
  const reputation = 0.45 + 0.25 * (1 - Math.exp(-Math.max(0, s.accountAgeDays) / 60))
    + 0.30 * clamp(s.verifiedUsageCount / 10);
  const quarantined = risk >= 0.7 && reasons.length >= 2;
  const needsChallenge = risk >= 0.35 && !s.challengePassed;
  return {weight: quarantined ? 0 : rounded(clamp(reputation * (1 - risk) ** 2), 4),
    risk: rounded(risk, 3), decision: quarantined ? 'quarantine' : needsChallenge ? 'challenge' : 'accept',
    reasons, policyVersion: POLICY_VERSION};
}

export interface ArenaBattle {
  id: string; modelA: string; modelB: string;
  winner: 'a' | 'b' | 'tie'; weight: number;
  modality: string; protocolHash: string;
  outputAHash: string; outputBHash: string;
  blinded: boolean; ratedAt: string;
}

/**
 * Provisional online Elo only. Production publication should use protocol-specific
 * Bradley–Terry + voter/prompt-cluster bootstrap once sample coverage is adequate.
 * No battles => no artificial 1500 rating. Never combine disconnected components.
 */
export function arenaElo(battles: ArenaBattle[], modality: string, protocolHash: string) {
  const selected = battles.filter(b => b.modality === modality && b.protocolHash === protocolHash
    && b.modelA !== b.modelB && b.blinded && b.outputAHash && b.outputBHash
    && valid(b.weight) && b.weight > 0);
  if (new Set(selected.map(b => b.id)).size !== selected.length) throw new Error('Duplicate Arena battle ID');
  selected.sort((a,b) => a.ratedAt.localeCompare(b.ratedAt) || a.id.localeCompare(b.id));
  const rows = new Map<string, {id: string; rating: number; battles: number; weight: number; opponents: Set<string>}>();
  const get = (id: string) => {
    if (!rows.has(id)) rows.set(id, {id, rating: 1500, battles: 0, weight: 0, opponents: new Set()});
    return rows.get(id)!;
  };
  for (const b of selected) {
    const a = get(b.modelA), c = get(b.modelB), weight = clamp(b.weight);
    const expected = 1 / (1 + 10 ** ((c.rating - a.rating) / 400));
    const actual = b.winner === 'a' ? 1 : b.winner === 'b' ? 0 : 0.5;
    const delta = 16 * weight * (actual - expected);
    a.rating += delta; c.rating -= delta;
    a.battles++; c.battles++; a.weight += weight; c.weight += weight;
    a.opponents.add(c.id); c.opponents.add(a.id);
  }
  const component = new Map<string, number>();
  let nextComponent = 0;
  for (const id of rows.keys()) {
    if (component.has(id)) continue;
    const pending = [id]; component.set(id, ++nextComponent);
    while (pending.length) for (const opponent of rows.get(pending.pop()!)!.opponents) {
      if (!component.has(opponent)) { component.set(opponent, nextComponent); pending.push(opponent); }
    }
  }
  return {modality, protocolHash, method: 'provisional chronological Elo; K=16',
    status: selected.length ? 'provisional' : 'awaiting-real-blind-comparisons',
    totalBattles: selected.length, connectedComponents: nextComponent,
    crossComponentRankingAllowed: nextComponent <= 1,
    models: [...rows.values()].map(r => ({id: r.id, rating: rounded(r.rating), battles: r.battles,
      weightedBattles: rounded(r.weight), opponents: r.opponents.size, component: component.get(r.id),
      confidenceInterval: null, status: 'provisional'}))
      .sort((a,b) => a.component! - b.component! || b.rating - a.rating),
    policyVersion: POLICY_VERSION};
}
