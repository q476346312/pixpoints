import OSS from 'ali-oss'
import { Readable } from 'stream'

// ⚠️ 替换成你自己的阿里云 OSS 配置
const client = new OSS({
  region: process.env.OSS_REGION!,          // 例如: 'oss-cn-hangzhou'
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  bucket: process.env.OSS_BUCKET!,         // Bucket 名称
})

// 上传文件，返回公开访问 URL
export async function uploadFile(
  fileBuffer: Buffer,
  destPath: string,
  contentType?: string
) {
  const result = await client.put(destPath, fileBuffer, {
    contentType,
  })
  return result.url // 公开访问 URL
}

// 删除文件
export async function deleteFile(path: string) {
  await client.delete(path)
}

// 获取公开 URL
export function getPublicUrl(path: string) {
  return `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${path}`
}

// 获取文件 Buffer（用于服务端流式转发，返回完整的二进制数据）
// path 可能是 double-encoded（%25E6 需解码为 %E6 再查 OSS）
export async function getFileBuffer(path: string): Promise<Buffer> {
  // decodeURIComponent 还原 double-encoded 路径
  const decodedPath = decodeURIComponent(path)
  const result = await client.get(decodedPath)
  const data = result.content
  if (Buffer.isBuffer(data)) return data
  // 如果是 Readable stream，转成 Buffer
  if (data && typeof data.on === 'function') {
    const chunks: Buffer[] = []
    for await (const chunk of data as Readable) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  return Buffer.from(data as any)
}

// 获取文件大小（head 请求）
export async function getFileSize(path: string): Promise<number> {
  const res = await client.head(path)
  return parseInt(res.contentLength as any) || 0
}

export { client as ossClient }
