/* キネティック・タイポグラフィ: 文字が下から立ち上がる。
   各文字を inline-block で並べるので、日本語(スペース無し)でも
   コンテナ幅で自然に折り返す。reduced-motion はグローバルCSSで無効化。 */

interface Props {
  text: string;
  className?: string;
  /** 開始遅延(秒) */
  delay?: number;
  /** 文字間の stagger(秒) */
  stagger?: number;
}

export default function KineticHeadline({
  text,
  className,
  delay = 0,
  stagger = 0.035,
}: Props) {
  const chars = Array.from(text);
  return (
    <span
      className={className}
      aria-label={text}
      style={{ display: "inline-block" }}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          className="kchar"
          aria-hidden="true"
          style={{ animationDelay: `${delay + i * stagger}s` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
