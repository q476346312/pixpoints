import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicUrl } from '@/lib/oss'

// GET /api/materials - 获取素材列表
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('materials')
    .select('*')
    .or('downloads_left.is.null,downloads_left.gt.0')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/materials - 新建素材（走 /api/upload，这里主要处理纯数据写入）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, file_url, thumbnail_url, cost_points, downloads_left, category } = body
    if (!name || !file_url || !cost_points) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({
        name,
        file_url,
        thumbnail_url: thumbnail_url || null,
        cost_points,
        downloads_left: downloads_left ?? null,
        category: category || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/materials?id=xxx - 删除素材（同时删数据库+OSS文件）
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    // 查文件路径
    const { data: mat, error: fetchErr } = await supabaseAdmin
      .from('materials')
      .select('file_url, thumbnail_url')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error('素材不存在')

    // 删 OSS 文件
    try {
      const { deleteFile } = await import('@/lib/oss')
      // file_url 现在是完整 OSS URL，如 https://xxx.oss-cn-hangzhou.aliyuncs.com/materials/xxx.mp4
      // 提取 OSS 路径部分：materials/xxx.mp4
      const extractOssPath = (url: string) => {
        const idx = url.indexOf('/materials/')
        return idx >= 0 ? url.slice(idx) : null
      }
      const ossPath = extractOssPath(mat.file_url)
      if (ossPath) await deleteFile(ossPath)

      const thumbOssPath = mat.thumbnail_url ? extractOssPath(mat.thumbnail_url) : null
      if (thumbOssPath) await deleteFile(thumbOssPath)
    } catch (_) {
      // OSS 删除失败不影响数据库删除
    }

    // 删数据库记录
    const { error: delErr } = await supabaseAdmin.from('materials').delete().eq('id', id)
    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
