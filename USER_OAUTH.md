# 前台用户 OAuth/OIDC 配置

在后台菜单“前台授权”中分别配置 Google 和自建身份平台。保存后立即生效，无需修改环境变量或重启服务。客户端密钥只提交到服务端，后台页面不会回显明文。

Google OAuth 客户端应选择 Web 应用类型，回调地址填写 `https://你的站点域名/api/auth/user/oauth/google/callback`。Issuer 使用 `https://accounts.google.com`。

自建论坛授权中心需开启 OpenID Connect，并提供 `/.well-known/openid-configuration`、授权端点、令牌端点和 UserInfo 端点。授权范围需要包含 `openid profile email`。回调地址填写 `https://你的站点域名/api/auth/user/oauth/custom/callback`。UserInfo 必须返回已验证邮箱（`email_verified: true`）。

登录成功后，同邮箱的现有普通用户会复用该账号；否则创建普通用户。管理员登录仍只使用原有邮箱密码入口。
