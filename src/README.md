# GitHub App TypeScript Structure

โครงสร้างไฟล์ที่ปรับปรุงใหม่สำหรับ GitHub App ด้วย TypeScript

## 📁 โครงสร้างไฟล์

```
src/
├── app.ts                 # จุดเริ่มต้นของแอปพลิเคชัน (Entry point)
├── types/
│   └── index.ts           # Type definitions และ interfaces
├── config/
│   └── index.ts           # การจัดการ configuration และ environment variables
├── services/
│   ├── github.ts          # GitHub App service และ authentication
│   └── server.ts          # HTTP server สำหรับ webhook
├── handlers/
│   └── webhooks.ts        # Webhook event handlers
└── utils/
    └── index.ts           # Utility functions และ Logger
```

## 🚀 วิธีการใช้งาน

### Development

```bash
npm run dev      # รัน TypeScript โดยตรงด้วย ts-node
```

### Production

```bash
npm run build    # Compile TypeScript เป็น JavaScript
npm start        # รัน compiled JavaScript
```

### Other Commands

```bash
npm run lint     # ตรวจสอบ code style
```

## 📝 คำอธิบายแต่ละไฟล์

### `src/app.ts`

- จุดเริ่มต้นของแอปพลิเคชัน
- จัดการการเริ่มต้นระบบทั้งหมด
- Error handling แบบ global

### `src/types/index.ts`

- ประกาศ TypeScript interfaces
- Type definitions สำหรับ configuration
- Type safety สำหรับทั้งระบบ

### `src/config/index.ts`

- โหลดและตรวจสอบ environment variables
- จัดการการอ่านไฟล์ configuration
- Validation ของ config values

### `src/services/github.ts`

- สร้างและจัดการ GitHub App instance
- Authentication กับ GitHub
- GitHub API interactions

### `src/services/server.ts`

- สร้างและจัดการ HTTP server
- Webhook middleware setup
- Request/Response logging

### `src/handlers/webhooks.ts`

- จัดการ webhook events ต่างๆ
- Pull request event handlers
- Error handling สำหรับ webhooks

### `src/utils/index.ts`

- Logger utility ที่มี emoji และ formatting
- Helper functions สำหรับการทำงานทั่วไป
- JSON parsing และ utility functions

## ✨ คุณสมบัติ

- **Type Safety**: ใช้ TypeScript เต็มรูปแบบ
- **Modular Design**: แบ่งไฟล์ตามหน้าที่
- **Better Logging**: Logger ที่มี emoji และ formatting ที่ดี
- **Error Handling**: จัดการ error แบบ centralized
- **Configuration Management**: จัดการ config อย่างเป็นระบบ
- **Hot Reload**: รองรับ development mode ด้วย ts-node

## 🔧 การ Configuration

Environment variables ที่จำเป็น:

- `APP_ID`: GitHub App ID
- `PRIVATE_KEY_PATH`: Path ไปยัง private key file
- `WEBHOOK_SECRET`: Webhook secret
- `ENTERPRISE_HOSTNAME`: (Optional) GitHub Enterprise hostname
- `PORT`: (Optional) Port สำหรับ server (default: 3000)

## 📊 การ Monitor

ระบบจะแสดง log ด้วย emoji เพื่อให้ดูง่าย:

- 🚀 การเริ่มต้นแอป
- 📋 การโหลด configuration
- 🔐 การสร้าง GitHub App
- 🔑 การ authenticate
- 🎣 การตั้งค่า webhook handlers
- 🌐 การเริ่ม server
- 📩 Webhook events
- ✅ การทำงานสำเร็จ
- ❌ Error messages
