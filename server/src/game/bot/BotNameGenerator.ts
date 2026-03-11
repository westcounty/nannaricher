/**
 * Bot Name Generator for nannaricher
 *
 * Hybrid approach:
 *   1. Try LLM (OpenAI-compatible API) to generate creative names
 *   2. Fall back to a built-in list of 南京大学-themed funny names
 */

// ---------------------------------------------------------------------------
// LLM configuration (from fightinone/.env pattern)
// ---------------------------------------------------------------------------
const LLM_CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.API_KEY || '',
  modelName: process.env.MODEL_NAME || 'gpt-4o',
};

const LLM_TIMEOUT_MS = 3000;
const LLM_BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// In-memory cache of LLM-generated names (refilled in batches)
// ---------------------------------------------------------------------------
const llmNameCache: string[] = [];
let llmFetchInProgress = false;

// ---------------------------------------------------------------------------
// Built-in fallback list  (60+ short, funny 南大 names)
// ---------------------------------------------------------------------------
const BUILTIN_NAMES: string[] = [
  // 校区 & 地标
  '仙林卷王',
  '鼓楼学霸',
  '浦口野人',
  '苏州萌新',
  '杜厦狂人',
  '逸夫楼神',
  '北大楼影',
  '敬文书虫',
  '唐仲英侠',
  '方肇周怪',
  '左涤江客',
  '小百合仙',
  // 学习 & 考试
  '保研大佬',
  '考研战神',
  '挂科达人',
  '补考之王',
  '绩点怪兽',
  '学分猎手',
  '论文摆王',
  '答辩狂魔',
  '选课秒杀',
  '刷绩狂人',
  '预习废物',
  '复习鬼才',
  // 图书馆 & 自习
  '占座大侠',
  '图书馆幽灵',
  '自习室怪',
  '通宵战士',
  '闭馆难民',
  '借书狂人',
  // 食堂 & 生活
  '干饭之王',
  '食堂美食家',
  '六食堂粉',
  '二食堂迷',
  '外卖刺客',
  '奶茶续命',
  '咖啡战神',
  '宿舍躺平',
  '断网暴怒',
  '洗衣排队',
  '快递山王',
  '澡堂歌手',
  // 南大文化 & 精神
  '诚朴之子',
  '雄伟本伟',
  '百年校庆',
  '南大之星',
  '南雍学子',
  '紫金侠客',
  '校歌达人',
  '院士门徒',
  // 校园趣味
  '猫咪观察',
  '仙林夜跑',
  '鼓楼摸鱼',
  '操场散步',
  '社团咸鱼',
  '军训摆烂',
  '早八困兽',
  '晚课逃兵',
  '实验翻车',
  '组会划水',
  '导师已读',
  '论文查重',
  '毕业危机',
  '延毕恐惧',
  '秋招卷怪',
  '春招摆子',
  '南大锦鲤',
  '仙林日落',
];

// ---------------------------------------------------------------------------
// LLM name generation
// ---------------------------------------------------------------------------

async function fetchLLMNames(): Promise<string[]> {
  if (!LLM_CONFIG.apiKey) return [];

  const prompt = `你是南哪大学（南哪）校园文化达人。请生成${LLM_BATCH_SIZE}个搞笑的、简短的中文昵称（2-6个汉字），用于游戏中的机器人玩家名字。
要求：
- 与南哪大学校园生活相关（校区、食堂、图书馆、考试、宿舍、社团等）
- 幽默有趣、脑洞大开
- 每个名字2-6个汉字，不要加emoji或标点
- 返回JSON数组格式，例如：["仙林卷王","鼓楼摸鱼帝","食堂干饭王","图书馆占座侠","保研锦鲤"]

请直接返回JSON数组，不要解释。`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model: LLM_CONFIG.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.0,
      max_tokens: 256,
    };

    const res = await fetch(`${LLM_CONFIG.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';

    // Extract JSON array from response (may be wrapped in markdown fences)
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) return [];

    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (n): n is string =>
          typeof n === 'string' && n.length >= 2 && n.length <= 6
      )
      .map((n) => n.replace(/[^\u4e00-\u9fff\w]/g, '').slice(0, 6));
  } catch {
    // Timeout, network error, or JSON parse error — all silently ignored
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try to refill the LLM cache in background. Non-blocking; errors are
 * swallowed so the caller always falls through to the built-in list.
 */
function tryRefillCache(): void {
  if (llmFetchInProgress) return;
  llmFetchInProgress = true;

  fetchLLMNames()
    .then((names) => {
      if (names.length > 0) {
        llmNameCache.push(...names);
      }
    })
    .catch(() => {
      /* swallow */
    })
    .finally(() => {
      llmFetchInProgress = false;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a unique bot name not present in `usedNames`.
 *
 * Strategy:
 *   1. Pop from LLM cache if available (and kick off a background refill).
 *   2. Otherwise pick a random name from the built-in list.
 *   3. If all built-in names are exhausted, append a numeric suffix.
 *
 * The returned name always ends with the 🤖 emoji suffix.
 */
export async function generateBotName(
  usedNames: Set<string>
): Promise<string> {
  // --- Attempt 1: LLM-cached names ---
  // Kick off a background refill whenever the cache is low
  if (llmNameCache.length <= 2) {
    tryRefillCache();
  }

  // If cache has names ready, try to use one
  while (llmNameCache.length > 0) {
    const candidate = llmNameCache.pop()!;
    const withEmoji = `${candidate}🤖`;
    if (!usedNames.has(withEmoji)) {
      return withEmoji;
    }
  }

  // --- Attempt 2: Synchronous LLM fetch (first call, cache empty) ---
  if (LLM_CONFIG.apiKey && !llmFetchInProgress) {
    try {
      const names = await fetchLLMNames();
      for (const name of names) {
        const withEmoji = `${name}🤖`;
        if (!usedNames.has(withEmoji)) {
          // Stash leftovers
          const idx = names.indexOf(name);
          llmNameCache.push(...names.slice(idx + 1));
          return withEmoji;
        }
      }
    } catch {
      /* fall through to built-in */
    }
  }

  // --- Attempt 3: Built-in list (shuffled) ---
  const shuffled = [...BUILTIN_NAMES].sort(() => Math.random() - 0.5);
  for (const name of shuffled) {
    const withEmoji = `${name}🤖`;
    if (!usedNames.has(withEmoji)) {
      return withEmoji;
    }
  }

  // --- Attempt 4: All names exhausted — add numeric suffix ---
  for (let i = 1; ; i++) {
    const fallback = `南大机器人${i}🤖`;
    if (!usedNames.has(fallback)) {
      return fallback;
    }
  }
}
