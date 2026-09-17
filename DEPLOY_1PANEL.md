# promo-code 1Panel 反向代理部署教程

本文档用于在 1Panel 服务器上部署 `promo-code`。项目采用 Docker Compose 运行：

- `promo-code-postgres`：PostgreSQL 数据库
- `promo-code-backend`：Node.js API，内部端口 `8000`，宿主机仅监听 `127.0.0.1:18518`
- `promo-code-frontend`：Nginx 静态前端，宿主机仅监听 `127.0.0.1:18517`
- 1Panel / OpenResty：对外提供 HTTPS，并反向代理到 `127.0.0.1:18517`

推荐访问链路：

```text
用户
  -> HTTPS 域名
  -> 1Panel / OpenResty
  -> http://127.0.0.1:18517
  -> promo-code-frontend
  -> /api 代理到 promo-code-backend:8000
  -> promo-code-postgres
```

## 1. 准备域名

将域名解析到服务器公网 IP：

```text
A    promo.example.com    服务器公网 IP
```

服务器防火墙建议只开放：

```text
80
443
SSH 端口
1Panel 面板端口
```

不要直接开放以下端口：

```text
5432
8000
18517
18518
```

## 2. 安装 1Panel 依赖

在 1Panel 应用商店安装并启动：

```text
Docker
OpenResty
```

## 3. 拉取项目

在 1Panel 终端执行：

```bash
mkdir -p /opt/promo-code
cd /opt/promo-code

git clone https://github.com/gungun88/promo-code.git .
git checkout main
```

如果目录已存在并且已经克隆过项目：

```bash
cd /opt/promo-code
git pull --ff-only origin main
```

## 4. 创建生产环境变量

```bash
cd /opt/promo-code
cp .env.production.example .env.production
nano .env.production
```

基础配置示例：

```env
NODE_ENV=production
API_PORT=8000

POSTGRES_DB=promo_code
POSTGRES_USER=promo_code
POSTGRES_PASSWORD=replace-with-a-long-random-database-password
DATABASE_URL=postgresql://promo_code:replace-with-a-long-random-database-password@promo-code-postgres:5432/promo_code

ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=replace-with-a-long-random-password

FRONTEND_ORIGINS=https://promo.example.com
EMAIL_VERIFICATION_BASE_URL=https://promo.example.com
```

生成随机密码：

```bash
openssl rand -base64 32
openssl rand -base64 48
```

注意：

- `ADMIN_PASSWORD` 生产环境至少 16 位。
- `POSTGRES_PASSWORD` 和 `DATABASE_URL` 中的数据库密码必须一致。
- 数据库密码建议使用字母和数字，避免 `@`、`#`、`:` 等字符导致连接串解析问题。
- `.env.production` 包含敏感信息，不要提交到 GitHub。

## 5. 邮件配置

项目支持两种邮件配置方式。

### 方式一：后台管理配置

可以先不在 `.env.production` 中填写 `MAIL_*`，部署后进入后台：

```text
/admin -> 邮件配置
```

保存 SMTP 配置并发送测试邮件。

生产环境中，如果后台尚未保存有效 SMTP 配置，用户注册会返回“邮箱服务尚未配置”。

### 方式二：环境变量配置

也可以直接在 `.env.production` 中配置 SMTP：

```env
MAIL_DRIVER=smtp
MAIL_HOST=smtp.your-provider.com
MAIL_PORT=587
MAIL_USERNAME=no-reply@your-domain.com
MAIL_PASSWORD=replace-with-your-smtp-password
MAIL_FROM=no-reply@your-domain.com
MAIL_ENCRYPTION=tls
```

当前后端实际支持的邮件驱动：

```text
smtp
log
null
```

## 6. 启动服务

```bash
cd /opt/promo-code

docker compose --env-file .env.production config
docker compose --env-file .env.production up -d --build
```

查看状态时也要带上 `--env-file`：

```bash
docker compose --env-file .env.production ps
```

如果直接运行 `docker compose ps` 报错：

```text
POSTGRES_PASSWORD is missing a value
```

说明没有加载 `.env.production`，不是服务启动失败。

如需以后省略 `--env-file`，可以创建软链接：

```bash
cd /opt/promo-code
ln -s .env.production .env
```

之后可直接执行：

```bash
docker compose ps
docker compose logs --tail=100 promo-code-backend
```

## 7. 本机健康检查

```bash
curl http://127.0.0.1:18518/api/health
curl -I http://127.0.0.1:18517
```

后端健康检查应返回：

```json
{"ok":true}
```

查看日志：

```bash
docker compose --env-file .env.production logs --tail=100 promo-code-backend
docker compose --env-file .env.production logs --tail=100 promo-code-frontend
docker compose --env-file .env.production logs --tail=100 promo-code-postgres
```

## 8. 1Panel 配置反向代理

进入 1Panel：

```text
网站 -> 创建网站 -> 反向代理
```

配置：

```text
主域名：promo.example.com
代理地址：http://127.0.0.1:18517
```

注意：

- 不要代理到 `8000`
- 不要代理到 `18518`
- 不要单独配置 `/api`
- 前端容器内部已经将 `/api` 转发给后端
- 代理地址不要填写 `/api` 后缀

## 9. 配置 HTTPS

在 1Panel 网站 SSL 设置中：

```text
申请 Let's Encrypt 证书
开启 HTTPS
开启强制 HTTPS
```

申请证书前确认：

```bash
curl -I http://promo.example.com
```

如果无法访问，检查：

- DNS 是否已经生效
- 服务器 80 端口是否开放
- OpenResty 是否正常启动
- 1Panel 反向代理域名是否填写正确

## 10. 上线验证

浏览器访问：

```text
https://promo.example.com
https://promo.example.com/admin
```

命令行验证：

```bash
curl -i https://promo.example.com/api/health
```

需要实际检查：

- 前台优惠码列表是否正常
- 搜索、排序、分页加载是否正常
- 管理员登录是否正常
- 后台邮件配置是否能保存
- 测试邮件是否能发送
- 用户注册邮件是否能收到
- 用户邮箱验证是否能完成
- 用户登录和创建优惠码是否正常
- HTTPS 下 Cookie 是否正常
- 页面刷新后前端路由是否正常

## 11. 后续更新

发布新版本：

```bash
cd /opt/promo-code

git pull --ff-only origin main
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

不要执行：

```bash
docker compose down -v
```

`down -v` 会删除数据库数据卷。

## 12. 数据库备份

手动备份：

```bash
cd /opt/promo-code

docker compose --env-file .env.production exec -T promo-code-postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > backup-$(date +%F-%H%M%S).sql
```

建议在 1Panel 计划任务中配置每日备份，并同步到对象存储或其他服务器。

## 13. 常用命令

```bash
# 查看服务状态
docker compose --env-file .env.production ps

# 查看后端日志
docker compose --env-file .env.production logs -f promo-code-backend

# 查看前端日志
docker compose --env-file .env.production logs -f promo-code-frontend

# 重启全部服务
docker compose --env-file .env.production restart

# 重启后端
docker compose --env-file .env.production restart promo-code-backend

# 停止服务但保留数据卷
docker compose --env-file .env.production down

# 重新构建并启动
docker compose --env-file .env.production up -d --build
```


