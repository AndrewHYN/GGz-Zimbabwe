import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { check } from "./platform";
export async function uploadImage(file: File, userId: string) {
  check(
    file.size > 0 && file.size <= 3 * 1024 * 1024,
    "Choose an image smaller than 3 MB.",
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpg"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : null;
  check(extension, "Only PNG, JPEG and WebP images are supported.");
  check(
    process.env.AWS_S3_ENDPOINT_URL &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_STORAGE_BUCKET_NAME &&
      process.env.MEDIA_PUBLIC_URL,
    "Image uploads are temporarily unavailable.",
    503,
  );
  const client = new S3Client({
    endpoint: process.env.AWS_S3_ENDPOINT_URL,
    region: process.env.AWS_S3_REGION_NAME || "eu-west-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const key = `uploads/${userId}/${crypto.randomUUID()}.${extension}`;
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${process.env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}
