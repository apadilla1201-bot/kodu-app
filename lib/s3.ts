import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";
import { appBaseUrl } from "./app-url";
import {
  buildLocalStoragePath,
  buildLocalUploadUrl,
  isLocalStoragePath,
  isS3Configured,
  localFileExists,
  localFilePath,
  readLocalFile,
  requireUploadStorage,
} from "./storage";

const s3Client = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const mode = requireUploadStorage();
  if (mode === 'local') {
    const cloud_storage_path = buildLocalStoragePath(fileName);
    return {
      uploadUrl: buildLocalUploadUrl(cloud_storage_path),
      cloud_storage_path,
    };
  }

  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

/** Server-side upload — avoids S3 CORS issues on mobile Safari. */
export async function uploadBufferToStorage(
  body: Buffer,
  fileName: string,
  contentType: string,
  isPublic: boolean = false,
): Promise<{ cloud_storage_path: string }> {
  const safeName = (fileName ?? 'file').replace(/[/\\]/g, '_');

  const mode = requireUploadStorage();
  if (mode === 'local') {
    const cloud_storage_path = buildLocalStoragePath(safeName);
    const { saveLocalFile } = await import('./storage');
    await saveLocalFile(cloud_storage_path, body);
    return { cloud_storage_path };
  }

  if (mode === 'blob') {
    const { uploadBufferToBlob } = await import('./blob-storage');
    return uploadBufferToBlob(body, safeName, contentType);
  }

  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${safeName}`
    : `${folderPrefix}uploads/${Date.now()}-${safeName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: cloud_storage_path,
      Body: body,
      ContentType: contentType || 'image/jpeg',
    }),
  );

  return { cloud_storage_path };
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean = false,
  options?: { inline?: boolean },
): Promise<string> {
  const { isBlobStoragePath, blobPublicUrl } = await import('./blob-storage');
  if (isBlobStoragePath(cloud_storage_path)) {
    return blobPublicUrl(cloud_storage_path);
  }

  if (isLocalStoragePath(cloud_storage_path) && await localFileExists(cloud_storage_path)) {
    return `${appBaseUrl()}/api/upload/local?path=${encodeURIComponent(cloud_storage_path)}`;
  }

  const { bucketName } = getBucketConfig();
  if (!bucketName) {
    throw new Error("Almacenamiento no configurado para este archivo");
  }

  if (isPublic) {
    const region = process.env.AWS_REGION?.trim() || "us-east-1";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: options?.inline ? "inline" : "attachment",
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const { isBlobStoragePath, deleteBlobFile } = await import('./blob-storage');
  if (isBlobStoragePath(cloud_storage_path)) {
    await deleteBlobFile(cloud_storage_path);
    return;
  }

  if (isLocalStoragePath(cloud_storage_path)) {
    const fs = await import("fs/promises");
    try {
      await fs.unlink(localFilePath(cloud_storage_path));
    } catch {
      // ignore missing local files
    }
    return;
  }

  const { bucketName } = getBucketConfig();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  await s3Client.send(command);
}

export async function initiateMultipartUpload(
  fileName: string,
  isPublic: boolean = false
): Promise<{ uploadId: string; cloud_storage_path: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });
  const result = await s3Client.send(command);
  return { uploadId: result?.UploadId ?? "", cloud_storage_path };
}

export async function getPresignedUrlForPart(
  cloud_storage_path: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const { bucketName } = getBucketConfig();
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function downloadFileBuffer(cloud_storage_path: string): Promise<Buffer> {
  const { isBlobStoragePath, blobPublicUrl } = await import('./blob-storage');
  if (isBlobStoragePath(cloud_storage_path)) {
    const res = await fetch(blobPublicUrl(cloud_storage_path));
    if (!res.ok) throw new Error(`Blob no encontrado: ${cloud_storage_path}`);
    return Buffer.from(await res.arrayBuffer());
  }

  if (isLocalStoragePath(cloud_storage_path)) {
    if (await localFileExists(cloud_storage_path)) {
      return readLocalFile(cloud_storage_path);
    }
    throw new Error(`Archivo local no encontrado: ${cloud_storage_path}`);
  }

  const { bucketName } = getBucketConfig();
  if (!bucketName) {
    throw new Error(
      "Este archivo está en almacenamiento antiguo (Abacus/AWS) y AWS no está configurado. " +
      "Vuelve a subir el PDF del subcontratista en el COR."
    );
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  const response = await s3Client.send(command);
  const stream = response.Body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function completeMultipartUpload(
  cloud_storage_path: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> {
  const { bucketName } = getBucketConfig();
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  await s3Client.send(command);
}
