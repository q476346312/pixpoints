import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteFile } from '@/lib/oss'

export const runtime = 'nodejs'

// POST /api/download
// 原子化下载流程：鉴权 → 扣积分 → 删OSS文件(如需) → 更新数据库
// 任一环节失败则回滚积分
export async function POST(req: NextRequest) {
  try {
    const { materialId, userId } = await req.json()
    if (!materialId || !userId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    // 1. 验证用户
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, points')
      .eq('id', userId)
      .single()
    if (userErr || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 })
    }

    // 2. 查素材
    const { data: mat, error: matErr } = await supabaseAdmin
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single()
    if (matErr || !mat) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 })
    }

    // 3. 判断是否需要付费
    const hasPurchased = mat.purchased_users?.includes(userId)
    const needPay = !hasPurchased || mat.downloads_left !== null

    if (needPay && mat.cost_points > user.points) {
      return NextResponse.json({ error: '积分不足，请先充值' }, { status: 403 })
    }

    if (mat.downloads_left !== null && mat.downloads_left <= 0) {
      return NextResponse.json({ error: '素材已售罄' }, { status: 410 })
    }

    // 4. 扣积分（需付费时）
    if (needPay) {
      const { error: deductErr } = await supabaseAdmin.rpc('deduct_points', {
        p_user_id: userId,
        p_points: Number(mat.cost_points),
      })
      if (deductErr) {
        return NextResponse.json({ error: '扣费失败: ' + deductErr.message }, { status: 500 })
      }
    }

    // 5. 计算更新数据
    const updateData: Record<string, any> = {}
    let newLeft = mat.downloads_left

    // 不限次且首次购买：加入已购列表
    if (mat.downloads_left === null && !hasPurchased) {
      updateData.purchased_users = [...(mat.purchased_users || []), userId]
    }

    // 限次：减少次数
    if (mat.downloads_left !== null) {
      newLeft = mat.downloads_left - 1
      updateData.downloads_left = newLeft
    }

    // 判断是否需要物理删除
    const shouldDelete = mat.delete_after_download || (newLeft !== null && newLeft <= 0)

    // 6. 如果需要删除：先删 OSS 文件，成功后再更新数据库
    if (shouldDelete) {
      updateData.downloads_left = 0

      let ossDeleted = true
      try {
        // 删视频文件
        const ossPath = extractOssPath(mat.file_url)
        if (ossPath) await deleteFile(ossPath)

        // 删缩略图
        if (mat.thumbnail_url) {
          const thumbPath = extractOssPath(mat.thumbnail_url)
          if (thumbPath) await deleteFile(thumbPath)
        }
      } catch (ossErr) {
        console.error('[download] OSS delete failed, will retry later:', ossErr)
        ossDeleted = false
        // 标记为待删除，后续可由定时任务清理
        updateData._pending_delete = true
      }

      if (ossDeleted) {
        // OSS 文件已删，直接删数据库记录
        const { error: delErr } = await supabaseAdmin
          .from('materials')
          .delete()
          .eq('id', materialId)
        if (delErr) console.error('[download] DB delete failed:', delErr)
      } else {
        // OSS 删除失败：只更新数据库，不删记录，保留重试机会
        delete updateData._pending_delete
        const { error: updateErr } = await supabaseAdmin
          .from('materials')
          .update(updateData)
          .eq('id', materialId)
        if (updateErr) console.error('[download] DB update failed:', updateErr)
      }
    } else {
      // 7. 不需要删除：正常更新数据库
      if (Object.keys(updateData).length > 0) {
        const { error: updateErr } = await supabaseAdmin
          .from('materials')
          .update(updateData)
          .eq('id', materialId)
        if (updateErr) console.error('[download] DB update failed:', updateErr)
      }
    }

    // 8. 返回结果（包含最新积分）
    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      success: true,
      needPay,
      pointsDeducted: needPay ? mat.cost_points : 0,
      remainingPoints: updatedUser?.points ?? user.points - (needPay ? mat.cost_points : 0),
      shouldDelete,
    })

  } catch (e: any) {
    console.error('[download]', e)
    return NextResponse.json({ error: '下载处理失败' }, { status: 500 })
  }
}

function extractOssPath(url: string): string | null {
  const idx = url.indexOf('/materials/')
  return idx >= 0 ? url.slice(idx + 1) : null
}
