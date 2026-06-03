export interface UploadResult {
  url: string
  path: string
}

export interface UploadValidationOptions {
  maxSizeBytes?: number
  allowedMimeTypes?: string[]
}

export interface StorageUsage {
  usedBytes: number
  objectCount: number
  bucketFileSizeLimitBytes?: number | null
  source?: string
}

export interface StoredFile {
  path: string
  url: string
  name: string
  size: number | null
  contentType: string | null
  lastModified: string | null
}

export interface StorageProvider {
  /** Human-readable provider name for logging */
  readonly name: string

  /** Validate a file before upload. Returns error message or null. */
  validate(file: { type: string; size: number }, options?: UploadValidationOptions): string | null

  /**
   * Upload a file. Returns the public URL and storage path.
   * @param folder - optional subfolder (e.g. "posts")
   */
  upload(
    file: Buffer,
    filename: string,
    contentType: string,
    folder?: string,
  ): Promise<UploadResult>

  /** Delete a file by its storage path */
  delete(path: string): Promise<void>

  /** Get the public URL for a stored file path */
  getPublicUrl(path: string): string

  /** Best-effort usage scan for the backing bucket/prefix. */
  getUsage?(): Promise<StorageUsage>

  /** Best-effort recursive file listing for media management. */
  listFiles?(): Promise<StoredFile[]>
}
