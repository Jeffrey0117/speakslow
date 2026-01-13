# 聲聲慢 部署指南

## 本地開發

### 前端開發 (Vite)
```bash
cd web
npm install
npm run dev
```
訪問 http://localhost:5173

### 後端開發 (Python)
```bash
pip install -r requirements-web.txt
python sherpa_web_server.py
```
API 運行於 http://localhost:8765

## Docker 部署

### 開發環境
```bash
# 構建並啟動所有服務
docker-compose up --build

# 背景運行
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

服務端口：
- 前端: http://localhost:3000
- API: http://localhost:8765

### 生產環境

1. **準備 SSL 憑證**
```bash
mkdir -p docker/nginx/ssl
# 將 fullchain.pem 和 privkey.pem 放入此目錄
```

2. **設定環境變數**
```bash
export API_URL=https://api.speakslow.app
export WS_URL=wss://api.speakslow.app
```

3. **啟動服務**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 雲端部署選項

### 選項 A: VPS (推薦)

適合：DigitalOcean, Vultr, Linode, AWS EC2

1. SSH 連接到伺服器
2. 安裝 Docker 和 Docker Compose
3. Clone 專案並下載模型
4. 運行 `docker-compose -f docker-compose.prod.yml up -d`

**最低配置：**
- CPU: 2 核心
- RAM: 4GB
- 存儲: 20GB SSD

### 選項 B: Railway / Render

1. Fork 此專案到你的 GitHub
2. 在 Railway/Render 連接你的 repo
3. 設定環境變數
4. 部署

**注意：** 需要處理模型文件的存儲（使用外部存儲或 Git LFS）

### 選項 C: Kubernetes

使用提供的 Docker 映像部署到 K8s 集群。

## 模型文件

Sherpa-ONNX 模型文件較大，不應包含在 Git 中。

### 下載模型
```bash
# 離線辨識模型 (Paraformer)
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2
tar xf sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2 -C models/

# 串流辨識模型 (Zipformer)
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2
tar xf sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2 -C models/
```

### 模型目錄結構
```
models/
├── sherpa-onnx-paraformer-zh-2023-09-14/
│   ├── model.onnx
│   ├── tokens.txt
│   └── ...
└── sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/
    ├── encoder-epoch-99-avg-1.onnx
    ├── decoder-epoch-99-avg-1.onnx
    ├── joiner-epoch-99-avg-1.onnx
    └── tokens.txt
```

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `HOST` | API 綁定地址 | `0.0.0.0` |
| `PORT` | API 端口 | `8765` |
| `VITE_API_URL` | 前端 API 地址 | `http://localhost:8765` |
| `VITE_WS_URL` | 前端 WebSocket 地址 | `ws://localhost:8765` |

## 健康檢查

- 前端: `GET /health` → `OK`
- 後端: `GET /health` → `{"status": "healthy", "sherpa_ready": true}`

## 故障排除

### 模型載入失敗
確保 `models/` 目錄已正確掛載，並包含所需模型文件。

### WebSocket 連接失敗
1. 檢查 CORS 設置
2. 確認 WebSocket URL 正確
3. 檢查防火牆設置

### 前端無法連接後端
1. 確認 `VITE_API_URL` 設置正確
2. 檢查網絡連通性
3. 確認後端服務正在運行
