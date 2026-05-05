/**
 * 支付宝当面付工具库
 * 支持：二维码支付、订单查询、交易关闭
 *
 * 环境变量：
 *   ALIPAY_APP_ID       - 支付宝 AppID（也叫 Partner）
 *   ALIPAY_PRIVATE_KEY  - 应用私钥（RSA2，PKCS#8 格式，换行符用\n）
 *   ALIPAY_PUBLIC_KEY   - 支付宝公钥
 *   ALIPAY_NOTIFY_URL   - 异步回调地址（可选，http(s)://xxx/api/topup/notify）
 */

import crypto from 'crypto'

interface AlipayConfig {
  appId: string
  privateKey: string
  publicKey: string
  notifyUrl: string
  gateway: string
}

interface AlipayParams {
  [key: string]: string
}

function getConfig(): AlipayConfig {
  return {
    appId:     process.env.ALIPAY_APP_ID     || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey:  process.env.ALIPAY_PUBLIC_KEY  || '',
    notifyUrl:  process.env.ALIPAY_NOTIFY_URL  || '',
    gateway:    process.env.ALIPAY_APP_ID
                  ? 'https://openapi.alipay.com/gateway.do'
                  : 'https://openapi-sandbox.dl.alipaydev.com/growthcode/gateway.do',
  }
}

// ── 签名 ──────────────────────────────────────────────────
function sign(params: AlipayParams, privateKey: string): string {
  const signStr = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')

  const sign = crypto
    .createSign('RSA-SHA256')
    .update(signStr)
    .sign(privateKey, 'base64')

  return sign
}

// ── 验证签名 ──────────────────────────────────────────────
function verifySign(params: Record<string, string>, publicKey: string): boolean {
  const { sign: signature, ...rest } = params
  if (!signature) return false

  const signStr = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&')

  return crypto
    .createVerify('RSA-SHA256')
    .update(signStr)
    .verify(publicKey, signature, 'base64')
}

// ── 发送请求 ───────────────────────────────────────────────
async function alipayRequest(
  method: string,
  bizContent: object,
): Promise<Record<string, any>> {
  const cfg = getConfig()
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '')

  const params: AlipayParams = {
    app_id:      cfg.appId,
    method,
    charset:     'utf-8',
    sign_type:   'RSA2',
    timestamp,
    version:     '1.0',
    biz_content: JSON.stringify(bizContent),
  }

  if (cfg.notifyUrl) params.notify_url = cfg.notifyUrl

  params.sign = sign(params, cfg.privateKey)

  const queryString = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')

  const res = await fetch(`${cfg.gateway}?${queryString}`, {
    method: 'GET',
  })

  const text = await res.text()
  // 支付宝返回格式: JSON with top-level key like "alipay_trade_precreate_response"
  let data: Record<string, any>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`支付宝网关返回非JSON: ${text.slice(0, 200)}`)
  }

  // 找 response 节点
  const key = Object.keys(data).find(k => k.endsWith('_response'))
  if (!key) throw new Error(`支付宝返回格式异常: ${text.slice(0, 200)}`)

  const resp = data[key]
  if (resp.code !== '10000' && resp.code !== 'ACQ.SUCCESS') {
    throw new Error(`支付宝接口错误 [${resp.code}]: ${resp.msg || resp.sub_msg || resp.message}`)
  }

  return resp
}

// ── 生成付款二维码（当面付）───────────────────────────────
/**
 * 生成付款二维码
 * @param outTradeNo  商户订单号（唯一）
 * @param totalAmount 总金额（元），支持小数
 * @param subject     商品标题
 * @param timeout     二维码有效期（分钟），默认5分钟
 */
export async function tradePrecreate(
  outTradeNo: string,
  totalAmount: number | string,
  subject: string,
  timeoutExpress: number = 5,
): Promise<string> {
  const resp = await alipayRequest('alipay.trade.precreate', {
    out_trade_no:   outTradeNo,
    total_amount:   String(totalAmount),
    subject,
    timeout_express: `${timeoutExpress}m`,
  })
  // 返回二维码链接（可能是 https://qr.alipay.com/xxx 或图片 URL）
  return resp.qr_code || resp.qr_url || ''
}

// ── 查询订单状态 ─────────────────────────────────────────
export interface QueryResult {
  status: 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED'
  tradeNo: string        // 支付宝交易号
  buyerLogId: string     // 买家支付宝账号ID
  sendPayDate: string    // 支付时间
  totalAmount: string    // 实付金额
}

export async function tradeQuery(outTradeNo: string): Promise<QueryResult | null> {
  try {
    const resp = await alipayRequest('alipay.trade.query', {
      out_trade_no: outTradeNo,
    })
    return {
      status:       resp.trade_status as QueryResult['status'],
      tradeNo:      resp.trade_no || '',
      buyerLogId:   resp.buyer_logon_id || '',
      sendPayDate:  resp.send_pay_date || '',
      totalAmount:  resp.total_amount || resp.receipt_amount || '0',
    }
  } catch {
    return null
  }
}

// ── 关闭订单 ──────────────────────────────────────────────
export async function tradeClose(outTradeNo: string): Promise<void> {
  await alipayRequest('alipay.trade.close', {
    out_trade_no: outTradeNo,
    operator_id:  'SYSTEM',
  })
}

// ── 验证回调签名 ─────────────────────────────────────────
export function verifyNotify(body: Record<string, string>): boolean {
  const cfg = getConfig()
  if (!cfg.publicKey) return false
  return verifySign(body, cfg.publicKey)
}
