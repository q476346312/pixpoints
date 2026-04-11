import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFileBuffer } from '@/lib/oss'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  const isDownload = new URL(req.url).searchParams.get('download') === '1'

  try {
    // 1. 查素材
    const { data: mat, error: matErr } = await supabaseAdmin
      .from('materials')
      .select('*')
      .eq('id', id)
      .single()

    if (matErr || !mat) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 })
    }

    // 2. 从 file_url 提取 OSS 路径（OSS 公开链接格式: https://bucket.region.aliyuncs.com/materials/xxx）
    const fileUrl: string = mat.file_url
    const urlObj = new URL(fileUrl)
    const ossPath = urlObj.pathname.replace(/^\//, '') // 去掉开头的 /

    // 3. 从 OSS 获取文件（服务端代理，防直链）
    const buffer = await getFileBuffer(ossPath)

    // 4. 构造响应
    const ext = ossPath.split('.').pop() || 'mp4'
    const filename = encodeURIComponent(`${mat.name}.${ext}`)

    const headers: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Length': String(buffer.length),
      'Accept-Ranges': 'none',
      // 防缓存，确保每次请求都是实时数据
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    }

    if (isDownload) {
      // 下载模式：触发文件下载
      headers['Content-Disposition'] = `attachment; filename="${filename}"; filename*=UTF-8''${filename}`
    } else {
      // 预览模式：内联播放（blob 场景）
      headers['Content-Disposition'] = `inline; filename="${filename}"`
    }

    return new Response(buffer as unknown as BodyInit, { headers })
  } catch (e: any) {
    console.error('[stream]', e)
    return NextResponse.json({ error: '获取视频失败' }, { status: 500 })
  }
}
