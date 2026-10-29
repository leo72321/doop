import { store } from './store.ts'

/** Create a demo canvas on first run so the app isn't empty. */
export function seed() {
  if (store.canvases.size > 0) return

  const canvas = store.createCanvas('歡迎畫布')

  store.createFrame(
    canvas.id,
    {
      name: 'Hero 主視覺 — 生態植栽缸',
      x: 120,
      y: 120,
      width: 720,
      height: 520,
      demo: true,
      html: `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box}
  body{font-family:Georgia,serif;background:#0F1E17;color:#F2EFE6;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:56px;overflow:hidden}
  .eyebrow{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8FBF9F;margin-bottom:20px}
  h1{font-size:52px;line-height:1.05;font-weight:400;max-width:9em}
  h1 em{font-style:italic;color:#C9E4A5}
  p{margin-top:20px;max-width:34em;line-height:1.6;color:#B9C4B2;font-size:15px}
  .cta{margin-top:32px;display:flex;gap:12px;align-items:center}
  .btn{background:#C9E4A5;color:#0F1E17;border:none;padding:13px 26px;font-size:14px;font-family:inherit;border-radius:999px;cursor:pointer}
  .link{color:#8FBF9F;font-size:14px;text-decoration:underline;text-underline-offset:4px}
  .orb{position:absolute;right:-80px;top:-80px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#2E4A38,#13291E);filter:blur(2px)}
</style></head><body>
  <div class="orb"></div>
  <div class="eyebrow">生態植栽缸 · 田野筆記</div>
  <h1>培育一座會自主<em>思考</em>的植物花園。</h1>
  <p>生態植栽缸將慢節奏的園藝與敏捷感測器完美結合。每小時監測水分、光照與根系健康，並以平易近人的語言即時解讀。</p>
  <div class="cta"><button class="btn">開始培育</button><a class="link" href="#">閱讀田野筆記</a></div>
</body></html>`,
    },
    'seed',
  )

  store.createFrame(
    canvas.id,
    {
      name: '定價方案卡片',
      x: 920,
      y: 120,
      width: 420,
      height: 520,
      demo: true,
      html: `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F5F3EE;height:100vh;display:grid;place-items:center}
  .card{background:#fff;border:1px solid #E2DDD2;border-radius:18px;padding:36px;width:320px;box-shadow:0 24px 48px -32px rgba(30,25,15,.25)}
  .tag{display:inline-block;background:#0F1E17;color:#C9E4A5;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:5px 10px;border-radius:999px}
  .price{margin-top:22px;font-size:44px;font-weight:600;letter-spacing:-.02em}
  .price span{font-size:15px;font-weight:400;color:#8A8578}
  ul{margin:24px 0;padding:0;list-style:none}
  li{padding:9px 0;border-top:1px solid #EFECE4;font-size:14px;color:#4A463C;display:flex;gap:10px}
  li::before{content:'✓';color:#5F9E6E;font-weight:700}
  button{width:100%;padding:14px;border:none;border-radius:12px;background:#0F1E17;color:#F2EFE6;font-size:14px;cursor:pointer}
</style></head><body>
  <div class="card">
    <span class="tag">溫室方案</span>
    <div class="price">$24<span> / 月</span></div>
    <ul>
      <li>無上限植物檔案</li>
      <li>每小時感測器數據紀錄</li>
      <li>每週養護摘要報告</li>
      <li>霜害與乾旱即時預警</li>
    </ul>
    <button>選擇溫室方案</button>
  </div>
</body></html>`,
    },
    'seed',
  )

  console.log(`⟡ seeded demo canvas ${canvas.id}`)
}
