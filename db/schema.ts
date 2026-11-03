import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';

export const identities = sqliteTable('identities', {
  id: text('id').primaryKey(), provider: text('provider').notNull(),
  firstSeenAt: integer('first_seen_at').notNull(),
  verifiedUsageCount: integer('verified_usage_count').notNull().default(0),
  state: text('state').notNull().default('active'),
}, t => [check('identity_usage_nonnegative', sql`${t.verifiedUsageCount} >= 0`),
  check('identity_state_valid', sql`${t.state} IN ('active','review','suspended')`)]);

export const projectVotes = sqliteTable('project_votes', {
  itemId: text('item_id').notNull(), identityId: text('identity_id').notNull().references(() => identities.id),
  rating: integer('rating').notNull(), weight: real('weight').notNull(), risk: real('risk').notNull(),
  status: text('status').notNull(), reasonCodes: text('reason_codes').notNull().default('[]'),
  policyVersion: text('policy_version').notNull(), createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({columns:[t.itemId,t.identityId]}), index('idx_project_votes_summary').on(t.itemId,t.status),
  check('vote_rating_valid',sql`${t.rating} BETWEEN 1 AND 5`), check('vote_weight_valid',sql`${t.weight} BETWEEN 0 AND 1`),
  check('vote_risk_valid',sql`${t.risk} BETWEEN 0 AND 1`), check('vote_status_valid',sql`${t.status} IN ('accepted','quarantined','withdrawn')`)]);

export const voteAudit = sqliteTable('vote_audit', {
  id:text('id').primaryKey(),identityId:text('identity_id').notNull().references(()=>identities.id),
  itemId:text('item_id').notNull(),action:text('action').notNull(),risk:real('risk').notNull(),
  weight:real('weight').notNull(),reasonCodes:text('reason_codes').notNull(),
  policyVersion:text('policy_version').notNull(),createdAt:integer('created_at').notNull(),
}, t=>[index('idx_vote_audit_identity_time').on(t.identityId,t.createdAt)]);

export const rateBuckets = sqliteTable('rate_buckets', {
  bucketKey:text('bucket_key').primaryKey(),hits:integer('hits').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('idx_rate_expiry').on(t.expiresAt)]);

export const riskAppeals = sqliteTable('risk_appeals', {
  id:text('id').primaryKey(),identityId:text('identity_id').notNull().references(()=>identities.id),
  itemId:text('item_id').notNull(),explanation:text('explanation').notNull(),status:text('status').notNull().default('open'),
  resolution:text('resolution'),createdAt:integer('created_at').notNull(),resolvedAt:integer('resolved_at'),
},t=>[uniqueIndex('idx_open_appeal').on(t.identityId,t.itemId).where(sql`${t.status} = 'open'`),
  check('appeal_status_valid',sql`${t.status} IN ('open','resolved','rejected')`)]);

export const arenaProtocols = sqliteTable('arena_protocols', {
  hash:text('hash').primaryKey(),modality:text('modality').notNull(),definitionJson:text('definition_json').notNull(),
  createdAt:integer('created_at').notNull(),
});

export const arenaSamples = sqliteTable('arena_samples', {
  id:text('id').primaryKey(),modelId:text('model_id').notNull(),modelRevision:text('model_revision').notNull(),
  protocolHash:text('protocol_hash').notNull().references(()=>arenaProtocols.hash),promptHash:text('prompt_hash').notNull(),
  outputSha256:text('output_sha256').notNull(),objectKey:text('object_key').notNull(),
  submittedBy:text('submitted_by').notNull().references(()=>identities.id),mediaType:text('media_type').notNull(),
  byteSize:integer('byte_size').notNull(),parametersJson:text('parameters_json').notNull(),
  provenanceStatus:text('provenance_status').notNull(),consentToPublish:integer('consent_to_publish').notNull().default(0),
  createdAt:integer('created_at').notNull(),
},t=>[index('idx_arena_samples_protocol_prompt').on(t.protocolHash,t.promptHash,t.provenanceStatus),
  check('sample_byte_size_positive',sql`${t.byteSize} > 0`),
  check('sample_provenance_valid',sql`${t.provenanceStatus} IN ('pending','verified','rejected')`),
  check('sample_consent_valid',sql`${t.consentToPublish} IN (0,1)`)]);

export const arenaAssignments = sqliteTable('arena_assignments', {
  id:text('id').primaryKey(),identityId:text('identity_id').notNull().references(()=>identities.id),
  sampleA:text('sample_a').notNull().references(()=>arenaSamples.id),sampleB:text('sample_b').notNull().references(()=>arenaSamples.id),
  protocolHash:text('protocol_hash').notNull().references(()=>arenaProtocols.hash),promptHash:text('prompt_hash').notNull(),
  revealedAt:integer('revealed_at'),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('idx_arena_assignments_identity').on(t.identityId),check('assignment_distinct_samples',sql`${t.sampleA} != ${t.sampleB}`)]);

export const arenaVotes = sqliteTable('arena_votes', {
  assignmentId:text('assignment_id').primaryKey().references(()=>arenaAssignments.id),
  identityId:text('identity_id').notNull().references(()=>identities.id),winner:text('winner').notNull(),
  protocolHash:text('protocol_hash').notNull().references(()=>arenaProtocols.hash),promptHash:text('prompt_hash').notNull(),
  modelPairKey:text('model_pair_key').notNull(),weight:real('weight').notNull(),status:text('status').notNull(),
  policyVersion:text('policy_version').notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('idx_arena_vote_unique_evidence').on(t.identityId,t.protocolHash,t.promptHash,t.modelPairKey),
  check('arena_winner_valid',sql`${t.winner} IN ('a','b','tie','both_bad')`),
  check('arena_weight_valid',sql`${t.weight} BETWEEN 0 AND 1`),
  check('arena_vote_status_valid',sql`${t.status} IN ('accepted','quarantined','withdrawn')`)]);

export const metricSnapshots = sqliteTable('metric_snapshots', {
  itemId:text('item_id').notNull(),capturedAt:integer('captured_at').notNull(),source:text('source').notNull(),
  metricsJson:text('metrics_json').notNull(),coverage:real('coverage').notNull(),policyVersion:text('policy_version').notNull(),
},t=>[primaryKey({columns:[t.itemId,t.capturedAt,t.source]})]);
