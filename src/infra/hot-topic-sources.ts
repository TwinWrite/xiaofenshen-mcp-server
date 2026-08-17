export const HOT_TOPIC_SOURCES = [
  { id: "baidu", name: "百度" },
  { id: "bilibili-hot-search", name: "Bilibili 热搜" },
  { id: "cls-hot", name: "财联社" },
  { id: "douban", name: "豆瓣热门" },
  { id: "douyin", name: "抖音" },
  { id: "tencent-hot", name: "腾讯新闻" },
  { id: "thepaper", name: "澎湃新闻" },
  { id: "tieba", name: "百度贴吧" },
  { id: "toutiao", name: "今日头条" },
  { id: "wallstreetcn-hot", name: "华尔街见闻" },
  { id: "weibo", name: "新浪微博" },
  { id: "zhihu", name: "知乎" },
] as const;

export type HotTopicSourceId = (typeof HOT_TOPIC_SOURCES)[number]["id"];

export const HOT_TOPIC_SOURCE_IDS = HOT_TOPIC_SOURCES.map((s) => s.id) as [
  HotTopicSourceId,
  ...HotTopicSourceId[],
];

export function isHotTopicSourceId(id: string): id is HotTopicSourceId {
  return (HOT_TOPIC_SOURCE_IDS as readonly string[]).includes(id);
}

export function hotTopicSourceName(id: HotTopicSourceId): string {
  const found = HOT_TOPIC_SOURCES.find((s) => s.id === id);
  return found?.name ?? id;
}

export type HotTopicItem = {
  id: string;
  rank: number;
  title: string;
  url: string;
  mobileUrl?: string;
  heat?: string;
  extraHover?: string;
};
