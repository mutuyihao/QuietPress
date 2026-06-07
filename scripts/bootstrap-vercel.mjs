import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const INITIAL_ADMIN_PASSWORD = 'QuietPress@2026!'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, '..')
const migrationsDir = path.join(
  rootDir,
  'supabase',
  'migrations',
)
const MIGRATION_LOCK_ID = 2026060706
const MIGRATION_STATEMENT_TIMEOUT = '120s'
const MIGRATION_LOCK_TIMEOUT = '15s'

function env(key) {
  const value = process.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

function requireEnv(key) {
  const value = env(key)
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getSupabaseSecretKey() {
  const value = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
  if (!value) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return value
}

function getSupabaseUrl() {
  return env('SUPABASE_URL') || requireEnv('NEXT_PUBLIC_SUPABASE_URL')
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function isExistingUserError(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('already registered')
    || message.includes('already exists')
    || message.includes('user already')
  )
}

function checksum(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatDuration(startedAt) {
  return `${Date.now() - startedAt}ms`
}

async function findUserByEmail(supabase, email) {
  const target = normalizeEmail(email)

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) {
      throw error
    }

    const user = data.users.find(
      (candidate) => normalizeEmail(candidate.email || '') === target,
    )

    if (user) {
      return user
    }

    if (data.users.length < 100) {
      return null
    }
  }

  throw new Error('Could not find existing ADMIN_EMAIL user within the first 2000 Supabase Auth users.')
}

async function runMigration(databaseUrl) {
  const { default: postgres } = await import('postgres')
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()

  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDir}.`)
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 20,
    onnotice: () => {},
  })

  try {
    await sql`select set_config('lock_timeout', ${MIGRATION_LOCK_TIMEOUT}, false)`
    await sql`select set_config('statement_timeout', ${MIGRATION_STATEMENT_TIMEOUT}, false)`

    const [{ locked }] = await sql`select pg_try_advisory_lock(${MIGRATION_LOCK_ID}) as locked`
    if (!locked) {
      throw new Error('Another QuietPress bootstrap migration is already running. Retry after that deployment finishes.')
    }

    await sql`
      create table if not exists public.quietpress_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `

    for (const fileName of migrationFiles) {
      const migrationPath = path.join(migrationsDir, fileName)
      const migrationSql = await readFile(migrationPath, 'utf8')
      const migrationChecksum = checksum(migrationSql)
      const existing = await sql`
        select checksum
        from public.quietpress_migrations
        where name = ${fileName}
      `

      if (existing[0]?.checksum === migrationChecksum) {
        console.log(`[bootstrap] Skipping migration ${fileName}; already applied.`)
        continue
      }

      if (existing[0]) {
        throw new Error(`Migration ${fileName} was already applied with a different checksum.`)
      }

      const startedAt = Date.now()
      console.log(`[bootstrap] Applying migration ${fileName}.`)
      await sql.unsafe(migrationSql)
      await sql`
        insert into public.quietpress_migrations (name, checksum)
        values (${fileName}, ${migrationChecksum})
      `
      console.log(`[bootstrap] Applied migration ${fileName} in ${formatDuration(startedAt)}.`)
    }

    await sql`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function ensureInitialAdmin() {
  const { createClient } = await import('@supabase/supabase-js')
  const adminEmail = normalizeEmail(requireEnv('ADMIN_EMAIL'))
  const supabase = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: existingAdmins, error: adminLookupError } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .limit(1)

  if (adminLookupError) {
    throw adminLookupError
  }

  if (existingAdmins.length > 0) {
    console.log('[bootstrap] Admin profile already exists; password will not be reset.')
    return
  }

  const metadata = {
    must_change_password: true,
    provisioned_by: 'vercel-bootstrap',
  }

  let user = null
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: INITIAL_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (createUserError) {
    if (!isExistingUserError(createUserError)) {
      throw createUserError
    }

    user = await findUserByEmail(supabase, adminEmail)
    if (!user) {
      throw createUserError
    }

    const nextMetadata = {
      ...(user.user_metadata || {}),
      ...metadata,
    }
    const { data: updatedUser, error: updateUserError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: INITIAL_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: nextMetadata,
      },
    )

    if (updateUserError) {
      throw updateUserError
    }

    user = updatedUser.user
  } else {
    user = createdUser.user
  }

  if (!user?.id) {
    throw new Error('Supabase Auth did not return a user for ADMIN_EMAIL.')
  }

  const { error: insertAdminError } = await supabase
    .from('admin_profiles')
    .insert({
      user_id: user.id,
      email: adminEmail,
      role: 'admin',
    })

  if (insertAdminError) {
    throw insertAdminError
  }

  console.log(`[bootstrap] Initial admin created for ${adminEmail}.`)
}

async function main() {
  if (env('SKIP_SUPABASE_BOOTSTRAP') === '1') {
    console.log('[bootstrap] Skipped because SKIP_SUPABASE_BOOTSTRAP=1.')
    return
  }

  if (env('VERCEL') !== '1') {
    console.log('[bootstrap] Skipped outside Vercel.')
    return
  }

  const databaseUrl = requireEnv('POSTGRES_URL_NON_POOLING')
  requireEnv('ADMIN_EMAIL')
  getSupabaseUrl()
  getSupabaseSecretKey()

  console.log('[bootstrap] Applying Supabase migration.')
  await runMigration(databaseUrl)
  console.log('[bootstrap] Supabase migration applied.')

  console.log('[bootstrap] Ensuring initial admin.')
  await ensureInitialAdmin()
}

main().catch((error) => {
  console.error('[bootstrap] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
