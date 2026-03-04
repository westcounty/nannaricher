# 部署指南 - Nannaricher

本文档说明如何将"菜根人生"游戏部署到生产环境 (richer.nju.top)。

## 系统要求

- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **Node.js**: v18.x 或更高版本
- **npm**: v9.x 或更高版本
- **内存**: 至少 1GB RAM
- **存储**: 至少 2GB 可用空间

## 方式一：快速部署 (推荐)

### 1. 安装依赖

```bash
# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 Nginx
sudo apt-get install -y nginx
```

### 2. 上传代码

将项目代码上传到服务器 `/var/www/nannaricher`：

```bash
# 使用 git
sudo mkdir -p /var/www/nannaricher
sudo chown $USER:$USER /var/www/nannaricher
cd /var/www/nannaricher
git clone <your-repo-url> .
```

或使用 rsync/scp 上传本地代码。

### 3. 安装依赖并构建

```bash
cd /var/www/nannaricher
npm ci
npm run build
```

### 4. 配置 PM2

```bash
# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.cjs --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照输出的提示执行命令
```

### 5. 配置 Nginx

```bash
# 复制 nginx 配置
sudo cp nginx.conf /etc/nginx/sites-available/nannaricher
sudo ln -sf /etc/nginx/sites-available/nannaricher /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 6. 配置 SSL (使用 Let's Encrypt)

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d richer.nju.top

# 自动续期
sudo systemctl enable certbot.timer
```

## 方式二：Docker 部署

### 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. 构建并运行

```bash
cd /var/www/nannaricher

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 环境变量

创建 `.env` 文件在项目根目录：

```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
```

## 常用命令

### PM2 命令

```bash
pm2 list                      # 查看所有进程
pm2 logs nannaricher-server   # 查看日志
pm2 restart nannaricher-server # 重启应用
pm2 stop nannaricher-server   # 停止应用
pm2 monit                     # 监控资源
pm2 reload nannaricher-server # 零停机重载
```

### Docker 命令

```bash
docker-compose up -d          # 启动
docker-compose down           # 停止
docker-compose logs -f        # 查看日志
docker-compose restart        # 重启
docker-compose ps             # 查看状态
```

## 更新部署

### 使用部署脚本

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

### 手动更新

```bash
cd /var/www/nannaricher
git pull origin main
npm ci
npm run build
pm2 restart nannaricher-server
```

## 故障排查

### 检查应用状态

```bash
pm2 status
pm2 logs nannaricher-server --lines 100
```

### 检查端口

```bash
netstat -tlnp | grep 3001
```

### 检查 Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### 防火墙设置

```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## 性能优化

### PM2 集群模式 (多核 CPU)

修改 `ecosystem.config.cjs`:

```javascript
instances: 'max', // 使用所有 CPU 核心
exec_mode: 'cluster'
```

### Nginx 缓存

已在 `nginx.conf` 中配置静态文件缓存。

### 启用 Gzip

Nginx 配置中已包含 Gzip 压缩。

## 备份策略

建议定期备份：

```bash
# 创建备份脚本 backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /backup/nannaricher-$DATE.tar.gz /var/www/nannaricher
# 保留最近7天
find /backup -name "nannaricher-*.tar.gz" -mtime +7 -delete
```

## 监控建议

- 使用 PM2 Plus (https://pm2.io/) 进行生产监控
- 配置日志轮转
- 设置服务器监控 (如 Prometheus + Grafana)

---

部署完成后，访问 https://richer.nju.top 即可开始游戏！
