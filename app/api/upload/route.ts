import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { uploadFile, getFileBuffer } from '@/lib/oss'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export const runtime = 'nodejs'

// 通过 ffmpeg 从视频中提取第 1 秒的一帧作为缩略图
async function extractThumbnail(videoBuffer: Buffer, safeName: string, ts: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const inputPath = join(tmpdir(), `ps_in_${ts}.mp4`)
    const outputPath = join(tmpdir(), `ps_thumb_${ts}.jpg`)

    try {
      writeFileSync(inputPath, videoBuffer)

      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-ss', '00:00:01',         // 跳到第 1 秒抽帧
        '-vframes', '1',           // 只抽 1 帧
        '-q:v', '2',               // 质量等级 2
        '-f', 'image2',
        outputPath,
      ])

      ffmpeg.on('close', (code) => {
        try { unlinkSync(inputPath) } catch (_) {}

        if (code === 0) {
          try {
            const { readFileSync } = require('fs')
            const thumbBuffer = readFileSync(outputPath)
            unlinkSync(outputPath)
            resolve(thumbBuffer)
          } catch (_) {
            resolve(null)
          }
        } else {
          try { unlinkSync(outputPath) } catch (_) {}
          resolve(null)
        }
      })

      ffmpeg.on('error', () => {
        try { unlinkSync(inputPath) } catch (_) {}
        try { unlinkSync(outputPath) } catch (_) {}
        resolve(null)
      })
    } catch (_) {
      resolve(null)
    }
  })
}

// 通过 ffmpeg 提取前10秒预览片段
async function extractPreview(videoBuffer: Buffer, safeName: string, ts: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const inputPath = join(tmpdir(), `ps_prev_in_${ts}.mp4`)
    const outputPath = join(tmpdir(), `ps_preview_${ts}.mp4`)

    try {
      writeFileSync(inputPath, videoBuffer)

      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-t', '10',                // 只取前10秒
        '-c:v', 'libx264',         // H.264编码
        '-b:v', '1M',              // 1Mbps码率
        '-s', '1280x720',          // 720p分辨率
        '-preset', 'fast',
        '-movflags', '+faststart', // 优化网络播放
        '-an',                     // 去掉音频（预览不需要声音）
        outputPath,
      ])

      ffmpeg.on('close', (code) => {
        try { unlinkSync(inputPath) } catch (_) {}

        if (code === 0) {
          try {
            const { readFileSync } = require('fs')
            const previewBuffer = readFileSync(outputPath)
            unlinkSync(outputPath)
            resolve(previewBuffer)
          } catch (_) {
            resolve(null)
          }
        } else {
          try { unlinkSync(outputPath) } catch (_) {}
          resolve(null)
        }
      })

      ffmpeg.on('error', () => {
        try { unlinkSync(inputPath) } catch (_) {}
        try { unlinkSync(outputPath) } catch (_) {}
        resolve(null)
      })
    } catch (_) {
      resolve(null)
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string || ''
    const cost_points = parseInt(formData.get('cost_points') as string) || 100
    const downloads_left = formData.get('downloads_left') as string
    const delete_after_download = formData.get('delete_after_download') === 'true'
    const category = formData.get('category') as string || null

    if (!file) {
      return NextResponse.json({ error: '没有文件' }, { status: 400 })
    }

    const ts = Date.now()
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
    const ossPath = `materials/${ts}_${safeName}.${ext}`

    // 视频转 Buffer（500MB 文件会占 ~500MB 内存，服务器注意内存限制）
    const arrayBuffer = await file.arrayBuffer()
    const videoBuffer = Buffer.from(arrayBuffer)

    // 上传到 OSS
    const fileUrl = await uploadFile(videoBuffer, ossPath, file.type || 'video/mp4')

    // 自动抽帧生成缩略图（静默失败，不影响主流程）
    let thumbnailUrl: string | null = null
    const thumbBuffer = await extractThumbnail(videoBuffer, safeName, ts)
    if (thumbBuffer) {
      const thumbPath = `thumbnails/${ts}_${safeName}.jpg`
      try {
        thumbnailUrl = await uploadFile(thumbBuffer, thumbPath, 'image/jpeg')
      } catch (_) {}
    }

    // 自动生成10秒预览片段
    let previewUrl: string | null = null
    const previewBuffer = await extractPreview(videoBuffer, safeName, ts)
    if (previewBuffer) {
      const previewPath = `previews/${ts}_${safeName}.mp4`
      try {
        previewUrl = await uploadFile(previewBuffer, previewPath, 'video/mp4')
      } catch (_) {}
    }

    // 写入数据库
    const { data, error: dbErr } = await supabaseAdmin
      .from('materials')
      .insert({
        name: name || file.name,
        file_url: fileUrl,        // 完整 OSS 公开 URL
        thumbnail_url: thumbnailUrl, // 自动抽帧的缩略图 URL
        preview_url: previewUrl,  // 10秒预览片段 URL
        cost_points,
        downloads_left: downloads_left ? parseInt(downloads_left) : null,
        delete_after_download,
        category,
      })
      .select()
      .single()

    if (dbErr) {
      const { deleteFile } = await import('@/lib/oss')
      await deleteFile(ossPath)
      return NextResponse.json({ error: `写入失败: ${dbErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, material: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
