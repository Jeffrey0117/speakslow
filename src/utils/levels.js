// 字數成就等級（幽默版）。index 越大等級越高。
export const LEVELS = [
  { min: 0,      emoji: '🤫', message: '別害羞，說點什麼吧～', title: '沉默是金' },
  { min: 100,    emoji: '👋', message: '才剛認識你，期待聽更多！', title: '初次見面' },
  { min: 500,    emoji: '🗣️', message: '話匣子慢慢打開了～', title: '話匣初開' },
  { min: 1000,   emoji: '💬', message: '看來你蠻有話說的嘛！', title: '能說會道' },
  { min: 2000,   emoji: '📢', message: '你說的比寫的多，手指感謝你', title: '口若懸河' },
  { min: 5000,   emoji: '🎙️', message: '話很多欸！但我喜歡聽', title: '麥霸登場' },
  { min: 10000,  emoji: '📚', message: '這些字夠寫一篇論文了', title: '著作等身' },
  { min: 30000,  emoji: '🎓', message: '你是不是哲學大師？思想真多', title: '思想家' },
  { min: 50000,  emoji: '✍️', message: '可以出書了，書名就叫《我說的》', title: '出書在即' },
  { min: 100000, emoji: '🏛️', message: '你的語錄比孔子還多', title: '一代宗師' },
  { min: 300000, emoji: '🌟', message: '傳說中的話癆本癆，致敬！', title: '話癆傳說' },
];

// 取得目前字數所在的等級 index
export function getLevelIndex(chars) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if ((chars || 0) >= LEVELS[i].min) idx = i;
  }
  return idx;
}

export function getLevel(chars) {
  return LEVELS[getLevelIndex(chars)];
}
