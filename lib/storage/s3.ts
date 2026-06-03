import type { StorageProvider, StoredFile, UploadResult, UploadValidationOptions } from './types'
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function inferContentType(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return null
}

export interface S3StorageConfig {
  /** S3 endpoint URL. For R2: https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string
  /** AWS region or R2 region (usually "auto") */
  region: string
  /** Access key ID */
  accessKeyId: string
  /** Secret access key */
  secretAccessKey: string
  /** Bucket name */
  bucket: string
  /** Public URL base for the bucket, e.g. https://cdn.example.com or https://pub-xxx.r2.dev */
  publicUrlBase: string
}

export function createS3Client(config: S3StorageConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  }

  // R2 requires path-style addressing
  if (config.endpoint.includes('r2.cloudflarestorage.com')) {
    clientConfig.forcePathStyle = true
  }

  return new S3Client(clientConfig)
}

export class S3Storage implements StorageProvider {
  readonly name: string

  private client: S3Client
  private bucket: string
  private publicUrlBase: string

  constructor(config: S3StorageConfig, label = 's3') {
    this.name = label
    this.client = createS3Client(config)
    this.bucket = config.bucket
    this.publicUrlBase = config.publicUrlBase.replace(/\/+$/, '')
  }

  validate(file: { type: string; size: number }, options?: UploadValidationOptions): string | null {
    const allowedMimeTypes = options?.allowedMimeTypes ?? ALLOWED_MIME
    const maxSize = options?.maxSizeBytes ?? MAX_SIZE
    if (!allowedMimeTypes.includes(file.type)) return 'File type not allowed'
    if (file.size > maxSize) {
      return `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`
    }
    return null
  }

  async upload(
    file: Buffer,
    filename: string,
    contentType: string,
    folder = 'posts',
  ): Promise<UploadResult> {
    const key = `${folder}/${filename}`

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )

    return {
      url: `${this.publicUrlBase}/${key}`,
      path: key,
    }
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    )
  }

  getPublicUrl(path: string): string {
    return `${this.publicUrlBase}/${path}`
  }

  async getUsage(): Promise<{ usedBytes: number; objectCount: number; source?: string }> {
    let continuationToken: string | undefined
    let usedBytes = 0
    let objectCount = 0

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        }),
      )

      for (const object of response.Contents || []) {
        usedBytes += object.Size || 0
        objectCount += 1
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return { usedBytes, objectCount, source: 's3-list-objects' }
  }

  async listFiles(): Promise<StoredFile[]> {
    let continuationToken: string | undefined
    const files: StoredFile[] = []

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        }),
      )

      for (const object of response.Contents || []) {
        if (!object.Key || object.Key.endsWith('/')) continue

        files.push({
          path: object.Key,
          url: this.getPublicUrl(object.Key),
          name: object.Key.split('/').pop() || object.Key,
          size: object.Size ?? null,
          contentType: inferContentType(object.Key),
          lastModified: object.LastModified?.toISOString() ?? null,
        })
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return files.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
  }
}
