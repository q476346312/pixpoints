# 积分素材站 (Points Studio)

> AI 创作素材下载平台 · 积分制变现

## 功能概览

- 🔐 **邮箱验证码登录** — 无需密码，6位OTP一步登录
- ⚡ **积分充值** — 1 USD = 1000 积分（派安盈/Payoneer Checkout）
- 📦 **素材下载** — 扣积分 → 下载 → 次数耗尽自动删除文件
- 🔧 **管理后台** — 上传素材、管理用户积分、查看充值记录

## 快速部署

### 1. 配置 Supabase

1. 创建 [Supabase](https://supabase.com) 项目
2. 在 **SQL Editor** 中运行 `supabase/schema.sql`
3. 在 **Settings → API** 获取：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
# 填入所有必填值
```

### 3. 配置 Resend（邮件验证码）

1. 注册 [Resend](https://resend.com)
2. 验证邮箱域名，获取 API Key
3. 填入 `RESEND_API_KEY`

### 4. 配置 Payoneer Checkout（支付）

1. 在 [Payoneer Developer](https://developer.payoneer.com) 注册应用
2. 获取 `client_id` + `client_secret`
3. 配置 Webhook URL: `https://your-domain.com/api/payoneer-webhook`
4. 填入 `.env.local`

> ⚠️ **注意**: Payoneer Checkout 需要商户资质。如果暂时没有，可以用手动加积分模式测试（直接在 admin 后台操作）。

### 5. 部署到 Vercel

```bash
npm install
npm run build
# push to GitHub → import to Vercel → 设置环境变量 → Deploy
```

或本地开发：

```bash
npm run dev
# 访问 http://localhost:3000
```

### 6. 设置管理员

编辑 `.env.local` 中的 `ADMIN_EMAILS`，填入管理员邮箱（逗号分隔）。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS |
| 后端 | Next.js API Routes |
| 数据库 | Supabase PostgreSQL |
| 文件存储 | Supabase Storage |
| 邮件 | Resend |
| 支付 | Payoneer Checkout |

## 项目结构

```
points-studio/
├── app/
│   ├── page.tsx              # 首页：素材列表 + 下载
│   ├── login/page.tsx        # 邮箱验证码登录
│   ├── topup/page.tsx        # 充值页面
│   ├── admin/page.tsx        # 管理后台
│   └── api/
│       ├── send-otp/         # 发送验证码
│       ├── verify-otp/       # 验证登录
│       ├── materials/        # 素材 CRUD
│       ├── topup/initiate/   # 创建充值订单
│       └── payoneer-webhook/ # 支付回调
├── components/
│   └── NavBar.tsx
├── lib/
│   └── supabase.ts
└── supabase/
    └── schema.sql            # 数据库初始化
```
