export type TopicColor = { bg: string; text: string; border: string };

const TOPIC_COLOR_SLOTS = 12;

/** djb2-style string hash (kept stable so a topic always gets the same colour). */
function hashTopic(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/**
 * The theme colour slot for a topic. Values are CSS variables (--topic-N-*),
 * so every caller follows the active light/dark theme.
 */
export function getTopicColor(topic: string): TopicColor {
  const key = topic.trim().toLowerCase();
  if (!key) {
    return { bg: 'var(--muted)', text: 'var(--muted-foreground)', border: 'var(--border)' };
  }
  const slot = (Math.abs(hashTopic(key)) % TOPIC_COLOR_SLOTS) + 1;
  return {
    bg: `var(--topic-${slot}-bg)`,
    text: `var(--topic-${slot}-text)`,
    border: `var(--topic-${slot}-border)`,
  };
}
