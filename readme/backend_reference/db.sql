create table if not exists app_config (
  id int primary key default 1,
  schema_version int not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  etag text not null
);

create table if not exists major_arcana_export (
  id int primary key default 1,
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  etag text not null
);

create table if not exists content_manifest (
  id int primary key default 1,
  schema_version int not null,
  revision int not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  etag text not null
);
