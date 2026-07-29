import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 5 * 60;

export type ObjectStoragePutInput = {
  key: string;
  body: Buffer;
  contentType: string;
  byteSize: number;
  checksumSha256?: string | null;
};

export type ObjectStorageObjectRef = {
  bucket: string;
  key: string;
};

export type ObjectStorageGetResult = ObjectStorageObjectRef & {
  body: Buffer;
  contentType: string | null;
  byteSize: number | null;
};

export type ObjectStorage = {
  putObject(input: ObjectStoragePutInput): Promise<ObjectStorageObjectRef>;
  getObject(input: ObjectStorageObjectRef): Promise<ObjectStorageGetResult>;
  deleteObject(input: ObjectStorageObjectRef): Promise<void>;
  getSignedReadUrl(
    input: ObjectStorageObjectRef & {
      expiresInSeconds?: number;
      responseContentDisposition?: string;
    },
  ): Promise<string>;
};

export class ObjectStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageConfigurationError";
  }
}

type S3ObjectStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

let cachedStorage: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  cachedStorage ??= createS3ObjectStorage(getS3ObjectStorageConfig());
  return cachedStorage;
}

export function createS3ObjectStorage(config: S3ObjectStorageConfig): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentLength: input.byteSize,
          ContentType: input.contentType,
        }),
      );

      return {
        bucket: config.bucket,
        key: input.key,
      };
    },

    async getObject(input) {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );

      return {
        bucket: input.bucket,
        key: input.key,
        body: await bodyToBuffer(object.Body),
        contentType: object.ContentType ?? null,
        byteSize: object.ContentLength ?? null,
      };
    },

    async deleteObject(input) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );
    },

    async getSignedReadUrl(input) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ResponseContentDisposition: input.responseContentDisposition,
        }),
        {
          expiresIn: input.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
        },
      );
    },
  };
}

function getS3ObjectStorageConfig(): S3ObjectStorageConfig {
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || "s3").trim().toLowerCase();

  if (provider !== "s3") {
    throw new ObjectStorageConfigurationError(`Unsupported object storage provider: ${provider}`);
  }

  const endpoint = requireEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION?.trim() || "auto";
  const bucket = requireEnv("S3_BUCKET");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE),
  };
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ObjectStorageConfigurationError(`${name} is required for object storage.`);
  }

  return value;
}

function parseBoolean(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const transformable = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof transformable.transformToByteArray === "function") {
    return Buffer.from(await transformable.transformToByteArray());
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  throw new ObjectStorageConfigurationError("Unsupported object storage response body.");
}
