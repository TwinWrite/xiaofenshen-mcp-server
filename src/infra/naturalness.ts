/**
 * 生成后「绝对禁区」机械校验。
 * 词表对齐小分身 `naturalness-check.ts` / 全局写作标准，只检测不改写。
 */

export const NATURALNESS_TABOO_PHRASES = [
  "说白了",
  "本质上",
  "换句话说",
  "不可否认",
  "这意味着",
  "综上所述",
  "值得注意的是",
  "不难发现",
  "让我们来看看",
  "接下来让我们",
] as const;

export const NATURALNESS_TEXTBOOK_OPENINGS = ["在当今", "随着技术不断进步"] as const;

export const WRITING_STANDARDS = `## 自然表达

目标是写得像真人、像作者本人，把内容做成作品而不是信息流。绝对禁区只约束最终正文，优先级高于学到的风格；只有当前用户明确要求时才可豁免。

【写作手法】
- 节奏感：句子长短交错，段落长短不一。
- 用词具体、有画面，少用空泛套话。
- 叙事驱动，不要时间流水账。
- 背景知识顺手带出，不要「下面科普」。
- 先摆事实再下判断；推测要标明。
- 按现象 → 表面解释 → 再追问一层 → 核心洞察展开。
- 收束时自然升维，不硬凑。
- 前文细节在后文回调。

【绝对禁区】
- 不用「首先/其次/最后」「综上所述」「值得注意的是」「不难发现」「让我们来看看」「接下来让我们」。
- 默认不用 bullet、大量加粗和小标题；条目型内容可用正文数字 1、2、3。
- 正文不用冒号、破折号和双引号（强调用「」）。
- 不用：「说白了」「本质上」「换句话说」「不可否认」「这意味着」。
- 不编造「比如有一次」式假例子。
- 不说「某个工具」，要给具体名字。
- 不用「在当今……时代」「随着技术不断进步」这类教科书开头。
`;

export type NaturalnessViolation = {
  kind:
    | "colon"
    | "dash"
    | "double_quote"
    | "markdown_heading"
    | "bullet_list"
    | "taboo_phrase"
    | "structured_transition"
    | "textbook_opening";
  count: number;
  samples: string[];
};

export type NaturalnessCheckResult = {
  violations: NaturalnessViolation[];
  violationKinds: number;
  taboosHit: string[];
};

const COLON_RE = /(?<!\/):(?!\/\/)|：/g;
const DASH_RE = /——|—/g;
const DOUBLE_QUOTE_RE = /[“”"]/g;
const HEADING_RE = /^#{1,6}\s+\S/gm;
const BULLET_RE = /^\s*[-*•]\s+\S/gm;
const STRUCTURED_TRANSITION_RE = /(首先|其次|最后)[，,]/g;

function collectMatches(text: string, re: RegExp, cap = 3): { count: number; samples: string[] } {
  re.lastIndex = 0;
  const samples: string[] = [];
  let count = 0;
  for (const match of text.matchAll(re)) {
    count++;
    if (samples.length < cap) {
      const idx = match.index ?? 0;
      samples.push(text.slice(Math.max(0, idx - 6), idx + match[0].length + 6));
    }
  }
  return { count, samples };
}

export function checkNaturalnessViolations(text: string): NaturalnessCheckResult {
  const violations: NaturalnessViolation[] = [];
  const push = (
    kind: NaturalnessViolation["kind"],
    found: { count: number; samples: string[] },
  ) => {
    if (found.count > 0) violations.push({ kind, ...found });
  };

  push("colon", collectMatches(text, COLON_RE));
  push("dash", collectMatches(text, DASH_RE));
  push("double_quote", collectMatches(text, DOUBLE_QUOTE_RE));
  push("markdown_heading", collectMatches(text, HEADING_RE));
  push("bullet_list", collectMatches(text, BULLET_RE));
  push("structured_transition", collectMatches(text, STRUCTURED_TRANSITION_RE));

  const taboosHit: string[] = [];
  let tabooCount = 0;
  const tabooSamples: string[] = [];
  for (const phrase of NATURALNESS_TABOO_PHRASES) {
    let idx = text.indexOf(phrase);
    while (idx !== -1) {
      tabooCount++;
      if (!taboosHit.includes(phrase)) taboosHit.push(phrase);
      if (tabooSamples.length < 3) {
        tabooSamples.push(text.slice(Math.max(0, idx - 6), idx + phrase.length + 6));
      }
      idx = text.indexOf(phrase, idx + phrase.length);
    }
  }
  if (tabooCount > 0) {
    violations.push({ kind: "taboo_phrase", count: tabooCount, samples: tabooSamples });
  }

  const openingWindow = text.slice(0, 60);
  const openingHits = NATURALNESS_TEXTBOOK_OPENINGS.filter((phrase) =>
    openingWindow.includes(phrase),
  );
  if (openingHits.length > 0) {
    violations.push({
      kind: "textbook_opening",
      count: openingHits.length,
      samples: [...openingHits],
    });
  }

  return {
    violations,
    violationKinds: violations.length,
    taboosHit,
  };
}
