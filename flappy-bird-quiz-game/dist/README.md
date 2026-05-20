# Flappy Bird Quiz Game

Dự án game web Flappy Bird kết hợp câu hỏi trắc nghiệm.

## 1) Tính năng chính

- Cơ chế Flappy Bird cơ bản:
  - Nhấn `Space` hoặc click chuột để chim bay lên.
  - Chim rơi theo trọng lực.
  - Ống di chuyển từ phải sang trái.
  - Va vào ống/nền đất → game over.
- Mỗi lần vượt 1 chướng ngại vật:
  - Game tạm dừng.
  - Hiện popup câu hỏi từ `questions/questions.md`.
  - Trả lời đúng: +1 điểm, đếm ngược 3 giây rồi chơi tiếp.
  - Trả lời sai: game over.
- Nhập tên người chơi khi bắt đầu (ID cố định, đổi tên không đổi ID).
- Lưu điểm và tên vào `scores/scores.json` (khi chạy qua Node server).
- Bảng xếp hạng chỉ dành cho admin (`scores/leaderboard.html`, cần nhập key).

## 2) Cấu trúc thư mục

```text
flappy-bird-quiz-game/
│
├── game/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── assets/
│   ├── images/
│   │   ├── bird.png
│   │   └── pipe.png
│   │
│   └── sounds/
│       ├── background.mp3
│       └── death.mp3
│
├── questions/
│   └── questions.md
│
├── scores/
│   ├── scores.json
│   └── leaderboard.html
│
├── server.js
└── README.md
```

## 3) Cách chạy game local

### Cách khuyến nghị (có lưu điểm vào JSON)

1. Cài Node.js (bản LTS mới).
2. Mở terminal tại thư mục `flappy-bird-quiz-game`.
3. Chạy:

```bash
node server.js
```

4. Mở trình duyệt:

```text
http://localhost:3000
```

Game sẽ gọi API `POST /api/scores` để cập nhật `scores/scores.json`.

### Bảng xếp hạng (admin)

- Trang: `http://localhost:3000/scores/leaderboard.html`
- Mã admin mặc định: `flappy-admin-2026 || giang`
- Đổi mã khi chạy server:

```bash
set ADMIN_KEY=your-secret-key
node server.js
```

Người chơi **không** xem được bảng xếp hạng trên trang game. Chỉ admin có key mới xem được.

### Chạy file trực tiếp không server

- Bạn vẫn có thể mở `game/index.html`, nhưng việc lưu JSON sẽ không ghi xuống file do giới hạn trình duyệt.
- Hệ thống sẽ fallback sang `localStorage`.

## 4) Cách thêm câu hỏi mới

Sửa file `questions/questions.md` theo đúng format:

```md
## Question 5
Câu hỏi: JavaScript chạy ở đâu?
A. Trong trình duyệt
B. Trong máy giặt
C. Trên máy in
D. Trên micro
Đáp án: A
```

Quy tắc:

- Mục hỏi bắt đầu bằng `## Question N`.
- Dòng câu hỏi bắt đầu bằng `Câu hỏi:`.
- Lựa chọn có dạng `A. ...`, `B. ...`, `C. ...`, `D. ...`.
- Đáp án đúng là `Đáp án: A|B|C|D`.

## 5) Cách thay ảnh và chỉnh kích thước chim / ống

Có **2 cách** thay đổi kích thước hiển thị: đổi file ảnh, hoặc sửa số trong code (khuyến nghị sửa code để va chạm khớp hình).

### 5.1) Thay file ảnh

- Chim: `assets/images/bird.png`
- Ống: `assets/images/pipe.png`
- Nên dùng PNG nền trong suốt.
- Gợi ý pixel gốc của file:
  - `bird.png`: ~128×128
  - `pipe.png`: ~128×512 (ống dọc)

> Ảnh lớn hơn **không** tự làm chim/ống to hơn trong game — game vẽ lại theo kích thước trong `script.js` (xem mục 5.2).

### 5.2) Chỉnh kích thước trong code (quan trọng)

Mở file `game/script.js`, tìm các hằng số sau:

#### Chim

```javascript
const bird = {
  x: 110,
  y: gameConfig.height / 2,
  width: 100,       // ← rộng HÌNH chim (pixel)
  height: 78,       // ← cao HÌNH chim (pixel)
  hitboxWidth: 56,  // ← rộng hitbox va chạm (pixel)
  hitboxHeight: 44, // ← cao hitbox va chạm (pixel)
  hitboxInset: 0,   // ← thu đều 4 cạnh nếu không set hitboxWidth/Height
  velocityY: 0,
  rotation: 0,
};
```

| Thuộc tính | Ý nghĩa | Gợi ý |
|------------|---------|--------|
| `width` | Chiều rộng khi vẽ + hitbox ngang | 40–56 |
| `height` | Chiều cao khi vẽ + hitbox dọc | 28–40 |
| `x` | Vị trí chim theo trục ngang | Giữ ~100–120 |

- Tăng `width` / `height` → chim **to hơn**, dễ va chạm hơn.
- Giảm → chim **nhỏ hơn**, dễ luồn qua khe hơn.

#### Ống (chướng ngại vật)

Trong `gameConfig`:

```javascript
const gameConfig = {
  // ...
  pipeWidth: 82,   // ← độ rộng ống (pixel)
  pipeGap: 170,    // ← khoảng trống giữa ống trên và ống dưới
  groundHeight: 96,
};
```

| Thuộc tính | Ý nghĩa | Gợi ý |
|------------|---------|--------|
| `pipeWidth` | Độ rộng mỗi ống | 70–100 |
| `pipeGap` | Chiều cao lỗ để chim bay qua | 150–200 (càng nhỏ càng khó) |

- `pipeGap` nhỏ → game **khó** hơn.
- `pipeWidth` lớn → ống **dày** hơn, dễ chạm hơn.

#### Canvas (toàn màn hình game)

Trong `game/index.html`:

```html
<canvas id="gameCanvas" width="420" height="640"></canvas>
```

Đổi `width` / `height` nếu muốn màn hình game rộng/cao hơn (nhớ chỉnh lại `pipeGap` cho cân đối).

### 5.3) Sau khi sửa

1. Lưu `game/script.js` (và `index.html` nếu đổi canvas).
2. Tải lại trình duyệt: **Ctrl + F5** tại `http://localhost:3000`.
3. Chơi thử vài vòng — nếu chim “chạm” khi chưa chạm hình, giảm `width`/`height` chim hoặc tăng `pipeGap`.

### 5.4) Tóm tắt nhanh

| Muốn | Sửa |
|------|-----|
| Chim to hơn | Tăng `bird.width`, `bird.height` |
| Chim nhỏ hơn | Giảm `bird.width`, `bird.height` |
| Ống rộng hơn | Tăng `pipeWidth` |
| Khe bay rộng hơn (dễ hơn) | Tăng `pipeGap` |
| Khe bay hẹp hơn (khó hơn) | Giảm `pipeGap` |

### 5.5) Xem vùng va chạm (hitbox) trên màn hình

Game dùng **hình chữ nhật** (không phải pixel từng điểm của ảnh PNG).

#### Chim

- Tâm: `bird.x`, `bird.y`
- Hitbox: từ `(x - width/2, y - height/2)` đến `(x + width/2, y + height/2)`
- Code: `bird.width`, `bird.height` trong `game/script.js`

#### Ống

- Mỗi cặp ống có **2 khối đỏ** (trên + dưới) và **1 khe xanh** ở giữa.
- Va chạm khi hitbox chim **chồng lên** khối đỏ, hoặc chim chạm **đường vàng** (mặt đất) / **đỉnh màn hình**.

#### Bật chế độ hiển thị hitbox

1. **Phím `H`** trong lúc chơi — bật/tắt lớp debug.
2. Hoặc mở URL có tham số:
   - `http://localhost:3000/game/index.html?hitbox=1`
   - `http://localhost:3000/game/index.html?debug=1`

Khi bật, bạn sẽ thấy:

| Màu | Ý nghĩa |
|-----|---------|
| Viền trắng | Hitbox chim |
| Đỏ mờ | Vùng ống gây va chạm |
| Xanh mờ | Khe bay an toàn |
| Vàng (nét đứt) | Mặt đất |
| Xanh dương (nét đứt) | Trần màn hình |

Chỉnh `bird.width` / `bird.height` cho **khớp viền trắng** với hình chim là cách căn va chạm chuẩn nhất.

Logic va chạm nằm trong hàm `updateGame()` — dùng `getBirdHitbox()`.

### 5.6) Cách chỉnh va chạm (từng bước)

**Bước 1 — Bật xem hitbox:** nhấn `H` hoặc `?hitbox=1`.

**Bước 2 — Chỉnh chim** trong `game/script.js`:

```javascript
const bird = {
  width: 100,        // kích thước HÌNH chim (vẽ trên màn hình)
  height: 78,
  hitboxWidth: 56,   // chiều rộng vùng va chạm (riêng)
  hitboxHeight: 44,  // chiều cao vùng va chạm (riêng)
  hitboxInset: 0,    // chỉ dùng nếu không set hitboxWidth/Height
};
```

| Thuộc tính | Ảnh hưởng |
|------------|------------|
| `width` / `height` | Chỉ đổi **hình** chim |
| `hitboxWidth` | Chỉ đổi **rộng** viền trắng / va chạm ngang |
| `hitboxHeight` | Chỉ đổi **cao** viền trắng / va chạm dọc |
| `hitboxInset` | Thu đều 4 cạnh (khi không dùng hitboxWidth/Height) |

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Viền trắng rộng hơn chim | Giảm `hitboxWidth` |
| Viền trắng cao hơn chim | Giảm `hitboxHeight` |
| Chưa chạm hình đã thua | Giảm `hitboxWidth` / `hitboxHeight` |
| Xuyên ống dễ quá | Tăng `hitboxWidth` / `hitboxHeight` |
| Khe quá chật | Tăng `pipeGap` trong `gameConfig` |
| Ống quá dày | Giảm `pipeWidth` |

**Bước 3 — Chỉnh ống** trong `gameConfig`:

```javascript
pipeWidth: 82,   // độ rộng cột ống (va chạm ngang)
pipeGap: 170,    // chiều cao khe xanh giữa hai ống
groundHeight: 96 // vạch vàng mặt đất
```

**Bước 4 — Lưu & Ctrl+F5**, chơi thử với phím `H` bật.

#### Công thức va chạm (tham khảo)

- Hitbox chim = hình chữ nhật tâm `(bird.x, bird.y)`, kích thước `hitboxWidth` × `hitboxHeight`.
- Va ống: hitbox chim **giao** vùng đỏ (ống trên/dưới).
- An toàn: hitbox chim nằm trọn trong vùng xanh (`gapTop` → `gapBottom`).
- Va đất: `box.bottom >= groundY`.

Muốn hitbox **nhỏ hơn hình** mà không thu nhỏ sprite → giảm `hitboxWidth` / `hitboxHeight` (nhấn `H` để xem kích thước trên màn hình).

## 6) Âm thanh

- Đặt file âm thanh:
  - `assets/sounds/background.mp3`
  - `assets/sounds/death.mp3`
- Nếu file mp3 lỗi hoặc chưa thay, game tự động fallback sang âm thanh tổng hợp đơn giản.

## 7) Deploy lên server

Bạn có thể deploy lên VPS, Render, Railway, Fly.io, hoặc bất kỳ nền tảng hỗ trợ Node.js:

1. Upload toàn bộ thư mục `flappy-bird-quiz-game`.
2. Đảm bảo server có Node.js.
3. Chạy:

```bash
node server.js
```

4. Cấu hình reverse proxy (Nginx/Caddy) trỏ vào cổng app (mặc định 3000).
5. Truy cập domain đã mapping vào app.

Lưu ý:

- `scores/scores.json` phải có quyền ghi.
- Nếu deploy trên nền tảng không cho ghi file local (read-only filesystem), cần chuyển sang DB hoặc object storage.
