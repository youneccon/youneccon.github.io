// =============================================================================
// サイト全体のコンテンツと設定を一元管理。
// ★ で始まる箇所は本人情報。確定したら差し替える。
// =============================================================================

export const profile = {
  // 表示名（ローマ字）
  name: "KON.Y",
  nameEn: "KON.Y",
  role: "ソフトウェアエンジニア",
  // Hero の一言キャッチ（自己アピール。短く・ノイズ演出が映える）
  tagline: "つくる。語る。直す。",
  // Hero サブ（何者かを補足）
  subline: "要件定義から実装・運用まで、ひとりで完結するエンジニア。",
  // 連絡先
  email: "kon.y@aol.com",
  github: "https://github.com/youneccon",
  // 任意: X / Zenn / note など。不要なら空文字
  x: "",
};

export const about = {
  heading: "About",
  lead: "業務の現場から、設計でものづくりへ。",
  body: [
    "会社員として現場の業務に向き合う中で、" +
      "「数字が1つズレると現場が止まる」在庫管理の難しさに直面しました。",
    "はじめは Excel と VBA で多モジュールの在庫システムを作り、" +
      "そこから Python / FastAPI / PostgreSQL / React による" +
      "三層構成のWebアプリへと作り替えてきました。",
    "得意なのは、要件定義から設計判断・実装・デバッグまでを一気通貫で進めること。" +
      "そして、その判断の理由を言葉にすること。" +
      "「引き算の美学」——既定の状態に飾りを足さず、例外だけを際立たせる——を大切にしています。",
  ],
};

// 強み / スキル
export const skills = [
  {
    title: "設計と言語化",
    desc: "要件定義・データモデリング・トレードオフの判断を、理由ごと言葉にする。",
  },
  {
    title: "フルスタック実装",
    desc: "FastAPI(async) + PostgreSQL + React/TypeScript。オンプレ完結の三層構成。",
  },
  {
    title: "正しさを仕組みで守る",
    desc: "制約・トリガー・型で、アプリのバグでもデータが壊れない設計。",
  },
  {
    title: "美意識のあるUI",
    desc: "引き算のUX。迷わせない、間違えさせない、だから速い。",
  },
];

export const skillTags = [
  "Python", "FastAPI", "PostgreSQL", "SQL",
  "TypeScript", "React", "Vite", "three.js",
  "Astro", "Docker", "Git", "WeasyPrint/PDF", "Excel/openpyxl",
];

// =============================================================================
// 作品（ケーススタディ）
// =============================================================================
export type Work = {
  slug: string;
  title: string;
  subtitle: string;
  year: string;
  role: string;
  stack: string[];
  status: "live" | "wip" | "planned";
  liveUrl?: string;
  repoUrl?: string;
  summary: string;
  // スクロール連動ケーススタディ用の章立て
  chapters?: { kicker: string; heading: string; body: string; tier?: "presentation" | "application" | "data" }[];
};

export const works: Work[] = [
  {
    slug: "produce-inventory",
    title: "農産物 在庫管理システム",
    subtitle: "オンプレ完結・三層構成の業務在庫アプリ",
    year: "2026",
    role: "要件定義・設計・実装（フルスタック）",
    stack: ["FastAPI", "PostgreSQL", "React", "three.js"],
    status: "live",
    liveUrl: "https://produce-inventory-demo.onrender.com/",
    repoUrl: "https://github.com/youneccon/produce-inventory-system",
    summary:
      "入荷ロット・FIFO出庫・選別/歩留・資材レシピ・棚卸・倉庫レイアウト(3D)・" +
      "帳票出力までを一気通貫で扱う、農産物加工現場向けの在庫管理アプリ。",
    chapters: [
      {
        kicker: "課題",
        heading: "数字が1つズレると、現場が止まる",
        body:
          "在庫は正しさが命。アプリのバグでデータが壊れる構造では、現場は安心して使えない。" +
          "正しさを「アプリ任せ」にしない設計が要件でした。",
      },
      {
        kicker: "設計判断 01",
        tier: "data",
        heading: "正しさはデータベース層で守る",
        body:
          "PostgreSQL の制約・トリガー・ビューで整合性を DB 自身に担保。" +
          "「入荷より前の出庫」「在庫を超える出庫」はトリガーが物理的に拒否する。",
      },
      {
        kicker: "設計判断 02",
        tier: "application",
        heading: "オフラインファースト＝オンプレ完結",
        body:
          "加工現場はネットワークが不安定でも止められない。" +
          "Docker 不要・クラウド非依存で、PC 1台で完結して動くことを最優先にした。",
      },
      {
        kicker: "設計判断 03",
        tier: "presentation",
        heading: "帳票はブラウザ印刷で“紙の見た目”を再現",
        body:
          "現場が長年使ってきた Excel 帳票の見た目をピクセル単位で再現するため、" +
          "印刷専用ページ（CSS @page を内容に合わせ自動算出）＋ window.print() を採用。",
      },
      {
        kicker: "結果",
        heading: "設計の理由まで語れるプロダクトに",
        body:
          "47テーブル・トリガー・FIFO・選別歩留・3D倉庫レイアウトまで。" +
          "公開版は実データを完全排除し、合成データ生成スクリプトで誰でも動かせる。",
      },
    ],
  },
  {
    slug: "work-2",
    title: "（準備中）表現重視のWebアプリ",
    subtitle: "最先端のWeb技術 × 引き算のデザイン",
    year: "2026",
    role: "デザイン・実装",
    stack: ["Astro", "WebGL", "TypeScript"],
    status: "wip",
    summary: "このポートフォリオサイト自体が、その第一歩。",
  },
  {
    slug: "work-3",
    title: "（構想中）AI × コンテンツ設計",
    subtitle: "プロンプト設計と解説台本の融合",
    year: "2026",
    role: "企画・プロンプト設計・実装",
    stack: ["Claude API", "React"],
    status: "planned",
    summary: "解説動画の台本設計メソッドを、LLM で構造化するツール。",
  },
];

export const nav = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];
