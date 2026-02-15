export interface FavoritesQuestion {
  id: string;
  theme: string;
  question: string;
  icon: string;
  placeholder: string;
  reasonPlaceholder: string;
}

const FAVORITES_QUESTIONS: FavoritesQuestion[] = [
  // エンタメ
  { id: 'f01', theme: '映画', question: '一番好きな映画は？', icon: '🎬', placeholder: '例：千と千尋の神隠し', reasonPlaceholder: 'どこが好き？' },
  { id: 'f02', theme: '本', question: '人生で一番影響を受けた本は？', icon: '📚', placeholder: '例：嫌われる勇気', reasonPlaceholder: 'どんな影響を受けた？' },
  { id: 'f03', theme: '音楽', question: '今一番聴いてる曲やアーティストは？', icon: '🎵', placeholder: '例：YOASOBI', reasonPlaceholder: 'なぜハマってる？' },
  { id: 'f04', theme: 'ドラマ/アニメ', question: '一番好きなドラマかアニメは？', icon: '📺', placeholder: '例：鬼滅の刃', reasonPlaceholder: 'どこに惹かれる？' },
  { id: 'f05', theme: 'ゲーム', question: '一番ハマったゲームは？', icon: '🎮', placeholder: '例：あつまれどうぶつの森', reasonPlaceholder: '何が面白かった？' },
  { id: 'f06', theme: 'YouTube/配信', question: 'よく見るYouTuberや配信者は？', icon: '📱', placeholder: '例：ヒカキン', reasonPlaceholder: 'なぜ見てる？' },

  // 食
  { id: 'f07', theme: '食べ物', question: '一番好きな食べ物は？', icon: '🍕', placeholder: '例：お母さんのカレー', reasonPlaceholder: 'なぜそれが一番？' },
  { id: 'f08', theme: 'レストラン/カフェ', question: 'お気に入りのお店は？', icon: '🍽️', placeholder: '例：近所の喫茶店', reasonPlaceholder: 'どこが好き？' },
  { id: 'f09', theme: 'おやつ', question: '疲れた時に食べたいおやつは？', icon: '🍫', placeholder: '例：チョコレート', reasonPlaceholder: 'なぜそれで回復する？' },

  // 場所・旅
  { id: 'f10', theme: '場所', question: '一番好きな場所は？', icon: '📍', placeholder: '例：祖父母の家', reasonPlaceholder: 'なぜその場所？' },
  { id: 'f11', theme: '旅先', question: '今まで行った中で最高の旅先は？', icon: '✈️', placeholder: '例：北海道', reasonPlaceholder: '何がよかった？' },
  { id: 'f12', theme: '景色', question: '今まで見た中で一番きれいだった景色は？', icon: '🌅', placeholder: '例：屋久島の森', reasonPlaceholder: 'その時どんな気持ちだった？' },

  // 人・コト
  { id: 'f13', theme: '有名人', question: '憧れの人は誰？', icon: '⭐', placeholder: '例：大谷翔平', reasonPlaceholder: 'どこに憧れる？' },
  { id: 'f14', theme: '言葉', question: '好きな言葉や座右の銘は？', icon: '💬', placeholder: '例：なんとかなる', reasonPlaceholder: 'なぜその言葉が好き？' },
  { id: 'f15', theme: '休日の過ごし方', question: '理想の休日の過ごし方は？', icon: '🛋️', placeholder: '例：カフェで読書', reasonPlaceholder: 'なぜそれが理想？' },
  { id: 'f16', theme: '季節のイベント', question: '一年で一番好きなイベントや行事は？', icon: '🎉', placeholder: '例：花火大会', reasonPlaceholder: 'なぜそれが好き？' },

  // モノ
  { id: 'f17', theme: '宝物', question: '一番の宝物は何？', icon: '💎', placeholder: '例：友達からの手紙', reasonPlaceholder: 'なぜ大切？' },
  { id: 'f18', theme: 'アプリ', question: '一番使ってるアプリは？（SNS以外で）', icon: '📲', placeholder: '例：Spotify', reasonPlaceholder: 'なぜよく使う？' },
  { id: 'f19', theme: '匂い', question: '好きな匂いは？', icon: '👃', placeholder: '例：雨上がりの匂い', reasonPlaceholder: 'その匂い、どんな気持ちになる？' },
  { id: 'f20', theme: '色', question: '好きな色は？', icon: '🌈', placeholder: '例：ネイビー', reasonPlaceholder: 'なぜその色？' },
];

export function getRandomFavoritesQuestion(): FavoritesQuestion {
  const lastId = typeof window !== 'undefined' ? localStorage.getItem('lastFavoritesQuestionId') : null;
  const candidates = FAVORITES_QUESTIONS.filter(q => q.id !== lastId);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  if (typeof window !== 'undefined') {
    localStorage.setItem('lastFavoritesQuestionId', selected.id);
  }
  return selected;
}

export { FAVORITES_QUESTIONS };
