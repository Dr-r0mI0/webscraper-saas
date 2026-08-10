# WebScraper SaaS - NiceOne Scraper Dashboard

تطبيق سكرابر ويب احترافي مبني كـ SaaS مع واجهة React ومحرك Puppeteer.
يُستخدم بشكل أساسي لسحب بيانات المنتجات من موقع [NiceOne](https://niceonesa.com).

## هيكل المشروع (Project Structure)

```
webscraper-saas/
|-- Dockerfile                  # صورة Docker (Node 20 + Chromium)
|-- docker-compose.yml          # تشغيل الحاوية على شبكة NPM الداخلية
|-- backend/
|   |-- server.js               # نقطة البداية - Express + Socket.IO server
|   |-- .env                    # متغيرات البيئة (PORT, JWT_SECRET)
|   |-- data.db                 # قاعدة بيانات SQLite
|   |-- db/
|   |   |-- init.js             # تهيئة الجداول (users, sitemaps, jobs, scraped_data)
|   |-- middleware/
|   |   |-- auth.js             # JWT authentication middleware
|   |-- routes/
|   |   |-- auth.js             # تسجيل الدخول والتسجيل وإدارة الملف الشخصي
|   |   |-- sitemaps.js         # إدارة خرائط المواقع (CRUD + تحليل)
|   |   |-- jobs.js             # إدارة عمليات السكرابينق (إنشاء/إيقاف/تصدير)
|   |-- services/
|   |   |-- scraper.js          # محرك السكرابر الرئيسي (Puppeteer + Stealth)
|   |   |-- jobQueue.js         # نظام الطابور (in-memory queue)
|-- frontend/
|   |-- dist/                   # ملفات الفرونت اند المبنية (production build)
|   |-- src/
|   |   |-- App.jsx             # التطبيق الرئيسي مع React Router
|   |   |-- main.jsx            # نقطة الدخول
|   |   |-- index.css           # الستايل الكامل للتطبيق
|   |   |-- context/
|   |   |   |-- AuthContext.jsx # إدارة حالة المستخدم (login/register/logout)
|   |   |-- components/
|   |   |   |-- Layout.jsx      # الهيكل العام (sidebar + header)
|   |   |-- pages/
|   |       |-- Login.jsx       # صفحة تسجيل الدخول
|   |       |-- Register.jsx    # صفحة التسجيل
|   |       |-- Dashboard.jsx   # لوحة التحكم الرئيسية
|   |       |-- Sitemaps.jsx    # إدارة خرائط المواقع
|   |       |-- Jobs.jsx        # قائمة عمليات السكرابينق
|   |       |-- JobDetail.jsx   # تفاصيل عملية واحدة + لوقات حية
|   |       |-- Profile.jsx     # الملف الشخصي
|   |-- vite.config.js          # إعدادات Vite (proxy /api -> backend)
```

---

## التقنيات المستخدمة (Tech Stack)

| الطبقة | التقنية | الوصف |
|---|---|---|
| **Backend** | Node.js 20 + Express | REST API server |
| **Scraper Engine** | Puppeteer + Stealth Plugin | متصفح headless مع حماية من الكشف |
| **Real-time** | Socket.IO | لوقات حية أثناء عمليات السكرابينق |
| **Database** | SQLite (better-sqlite3) | تخزين خفيف بدون سيرفر منفصل |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | تسجيل دخول بتوكن صالح 7 أيام |
| **Frontend** | React 18 + React Router 6 | SPA مع واجهة احترافية |
| **Build** | Vite 5 | بناء سريع للفرونت اند |
| **Container** | Docker (node:20-slim + Chromium) | حاوية جاهزة للإنتاج |

---

## قاعدة البيانات (Database Schema)

4 جداول رئيسية في SQLite:

| الجدول | الوصف | الحقول الرئيسية |
|---|---|---|
| `users` | المستخدمين | `id`, `username`, `email`, `password` (hashed) |
| `sitemaps` | خرائط المواقع (إعدادات السكرابينق) | `id`, `user_id`, `name`, `config` (JSON) |
| `jobs` | عمليات السكرابينق | `id`, `user_id`, `sitemap_id`, `status`, `progress`, `total_pages`, `scraped_pages` |
| `scraped_data` | البيانات المسحوبة | `id`, `job_id`, `url`, `data` (JSON) |

**حالات الـ Job:** `pending` -> `queued` -> `running` -> `completed` / `failed` / `stopped` / `paused`

---

## الـ API Endpoints

### المصادقة (Auth) - `/api/auth`
| Method | Endpoint | الوصف | Auth |
|---|---|---|---|
| `POST` | `/register` | تسجيل مستخدم جديد | لا |
| `POST` | `/login` | تسجيل الدخول (يرجع JWT token) | لا |
| `GET` | `/me` | بيانات المستخدم الحالي | نعم |
| `PUT` | `/profile` | تحديث الملف الشخصي / كلمة المرور | نعم |

### خرائط المواقع (Sitemaps) - `/api/sitemaps`
| Method | Endpoint | الوصف | Auth |
|---|---|---|---|
| `GET` | `/` | جميع خرائط المواقع للمستخدم | نعم |
| `GET` | `/:id` | خريطة موقع واحدة | نعم |
| `POST` | `/` | إنشاء/استيراد خريطة موقع | نعم |
| `PUT` | `/:id` | تحديث خريطة موقع | نعم |
| `DELETE` | `/:id` | حذف خريطة موقع | نعم |
| `POST` | `/:id/analyze` | تحليل وتقدير عدد الصفحات | نعم |

### العمليات (Jobs) - `/api/jobs`
| Method | Endpoint | الوصف | Auth |
|---|---|---|---|
| `GET` | `/` | جميع العمليات (مع فلترة بالحالة) | نعم |
| `GET` | `/:id` | تفاصيل عملية واحدة | نعم |
| `POST` | `/` | إنشاء عملية سكرابينق جديدة | نعم |
| `POST` | `/:id/pause` | إيقاف مؤقت | نعم |
| `POST` | `/:id/resume` | استئناف | نعم |
| `POST` | `/:id/stop` | إيقاف نهائي | نعم |
| `GET` | `/:id/data` | البيانات المسحوبة (مع pagination) | نعم |
| `GET` | `/:id/export/json` | تصدير كـ JSON | نعم |
| `GET` | `/:id/export/csv` | تصدير كـ CSV | نعم |

---

## محرك السكرابر (Scraper Engine)

### الميزات الرئيسية:
- **Stealth Mode:** يستخدم `puppeteer-extra-plugin-stealth` لتجاوز كشف البوتات
- **User Agent Rotation:** 4 متصفحات مختلفة يتم التبديل بينها عشوائياً
- **Viewport Rotation:** 5 أحجام شاشة مختلفة
- **Ban Detection:** كشف تلقائي للحظر (Cloudflare, CAPTCHA, Rate Limit)
- **Auto Retry:** إعادة المحاولة 3 مرات مع تأخير تصاعدي عند الحظر
- **Infinite Scroll:** دعم التمرير اللانهائي (50 scroll كحد أقصى)
- **Batch Processing:** معالجة متعددة المسارات (concurrency: 3 افتراضياً)
- **URL Ranges:** دعم أنماط النطاق `[1-100]` في الروابط

### أنواع الـ Selectors المدعومة:
| النوع | الوصف |
|---|---|
| `SelectorText` | استخراج نص العنصر |
| `SelectorLink` | استخراج الرابط والنص |
| `SelectorImage` | استخراج مصدر الصورة |
| `SelectorHTML` | استخراج HTML الداخلي |
| `SelectorElement` | حاوية لتجميع العناصر |
| `SelectorElementScroll` | حاوية مع تمرير لانهائي |

### خيارات التشغيل (Job Options):
```json
{
  "maxPages": 1000,
  "concurrency": 3,
  "delay": 1000,
  "timeout": 30000,
  "maxRetries": 3,
  "proxyRotation": false
}
```

---

## النشر والتشغيل (Deployment)

### البيئة الحالية:
- **اسم الحاوية:** `webscraper-saas`
- **البورت الداخلي:** `5000` (لا يوجد بورتات مفتوحة خارجياً)
- **الشبكة:** `nginx-proxy-manager_default` (اتصال داخلي فقط)
- **النطاقات:**
  - `https://api.brandaty.net` (الواجهة + API)
  - `https://scraper-api.brandaty.net` (نفس التطبيق)

### أوامر التشغيل:
```bash
# تشغيل الحاوية
cd /opt/webscraper-saas
docker compose up -d --build

# مراقبة اللوقات
docker logs -f webscraper-saas

# إعادة التشغيل
docker compose restart

# إيقاف
docker compose down
```

### متغيرات البيئة:
| المتغير | الوصف | القيمة الافتراضية |
|---|---|---|
| `PORT` | بورت السيرفر | `5000` |
| `JWT_SECRET` | مفتاح تشفير التوكنات | (يُعيّن في docker-compose.yml) |
| `NODE_ENV` | بيئة التشغيل | `production` |

---

## صفحات الواجهة (Frontend Pages)

| الصفحة | المسار | الوصف |
|---|---|---|
| Login | `/login` | تسجيل الدخول بالإيميل وكلمة المرور |
| Register | `/register` | تسجيل حساب جديد |
| Dashboard | `/dashboard` | لوحة تحكم مع إحصائيات عامة |
| Sitemaps | `/sitemaps` | إنشاء واستيراد خرائط المواقع (Web Scraper format) |
| Jobs | `/jobs` | عرض جميع عمليات السكرابينق مع حالتها |
| Job Detail | `/jobs/:id` | تفاصيل عملية + لوقات حية عبر Socket.IO |
| Profile | `/profile` | تعديل بيانات الحساب وكلمة المرور |

---

## ملاحظات فنية

- الفرونت اند يستخدم relative API paths (`/api/...`) فلا يحتاج إعداد URL منفصل
- السيرفر يقدم الفرونت اند كملفات ثابتة (static files) ويتعامل مع SPA routing
- Socket.IO يُستخدم لبث لوقات السكرابينق بشكل حي (real-time)
- الطابور حالياً in-memory (يُفقد عند إعادة التشغيل) - مستقبلاً يُنقل لـ BullMQ + Redis
- قاعدة البيانات (SQLite) محفوظة في volume (`./data:/app/data`) فلا تُفقد عند إعادة بناء الحاوية
