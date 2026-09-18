import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'
const MIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations')

export async function boot() {
  const db = new PGlite({ extensions: { pgcrypto } })
  const stubs = [
    `create schema if not exists extensions`,
    `create role anon nologin`,
    `create role authenticated nologin`,
    `create role service_role nologin bypassrls`,
    `grant usage on schema public to anon, authenticated, service_role`,
    `alter default privileges in schema public grant all on tables to anon, authenticated, service_role`,
    `alter default privileges in schema public grant all on functions to anon, authenticated, service_role`,
    `alter default privileges in schema public grant all on sequences to anon, authenticated, service_role`,
    `create schema if not exists auth`,
    `create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), email_confirmed_at timestamptz, last_sign_in_at timestamptz, phone text, deleted_at timestamptz, banned_until timestamptz, confirmation_sent_at timestamptz)`,
    `create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text)`,
    `create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), aal text)`,
    `create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text, factor_type text)`,
    `create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$`,
    `create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$`,
    `create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$`,
    `create schema if not exists storage`,
    `create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[])`,
    `create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now())`,
    `create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$`,
    `create extension if not exists pgcrypto schema extensions`,
  ]
  for (const st of stubs) {
    try {
      await db.exec(st)
    } catch (e) {
      console.log('STUB ERR', e.message.slice(0, 160))
    }
  }
  return db
}

export async function migrate(db, { stopOnError = false, until = null, from = null } = {}) {
  const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()
  const failures = []
  for (const f of files) {
    if (until && f > until) break
    if (from && f <= from) continue
    let sql = fs.readFileSync(path.join(MIG, f), 'utf8')
    sql = sql.replace(/create extension if not exists "?pgcrypto"?[^;]*;/gi, '')
    try {
      await db.exec(sql)
    } catch (e) {
      failures.push([f, e.message.slice(0, 300)])
      if (stopOnError) break
    }
  }
  return failures
}

if (process.argv[1] && process.argv[1].endsWith('harness.mjs')) {
  const db = await boot()
  const failures = await migrate(db, { stopOnError: process.argv[2] === 'stop' })
  if (failures.length === 0) console.log('todas as migrations aplicadas')
  for (const [f, m] of failures) console.log('ERR', f, '::', m)
}
