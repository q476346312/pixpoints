import { NextRequest, NextResponse } from 'next/server'
import { deleteFile } from '@/lib/oss'

// 从完整 OSS URL 中提取路径: https://bucket.reg.aliyuncs.com/materials/xxx.mp4 → materials/xxx.mp4
function extractOssPath(url: string) {
  const idx = url.indexOf('/materials/')
  return idx >= 0 ? url.slice(idx + 1) : null // 去掉 leading /
}

export async function POST(req: NextRequest) {
  try {
    const { file_url } = await req.json()
    if (!file_url) return NextResponse.json({ error: '缺少 file_url' }, { status: 400 })

    const ossPath = extractOssPath(file_url)
    if (!ossPath) return NextResponse.json({ error: '无效的 URL' }, { status: 400 })

    await deleteFile(ossPath)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
