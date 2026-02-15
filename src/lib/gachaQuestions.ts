export interface GachaQuestion {
  id: string;
  question: string;
  category: string;
  placeholder: string;
}

const GACHA_QUESTIONS: GachaQuestion[] = [
  // 価値観・哲学
  { id: 'g01', question: '人生で一番大切にしていることは？', category: '価値観', placeholder: '例：家族との時間、自由...' },
  { id: 'g02', question: '「これだけは譲れない」ってことある？', category: '価値観', placeholder: '例：睡眠時間、自分の時間...' },
  { id: 'g03', question: '10年後の自分に一言伝えるとしたら？', category: '未来', placeholder: '自由に書いてね' },
  { id: 'g04', question: '子供の頃、将来の夢は何だった？', category: '過去', placeholder: '例：パイロット、ケーキ屋...' },
  { id: 'g05', question: '最近「これやってよかった！」と思ったことは？', category: '体験', placeholder: '例：朝のランニング、資格勉強...' },

  // 日常・ライフスタイル
  { id: 'g06', question: '今の自分を充電するために何する？', category: 'リフレッシュ', placeholder: '例：散歩、音楽を聴く...' },
  { id: 'g07', question: '朝起きて一番にすることは？', category: '習慣', placeholder: '例：コーヒーを淹れる...' },
  { id: 'g08', question: '今、無限にお金があったら何する？', category: '妄想', placeholder: '自由に書いてね' },
  { id: 'g09', question: 'つい時間を忘れて没頭しちゃうことは？', category: '没頭', placeholder: '例：ゲーム、読書、DIY...' },
  { id: 'g10', question: '最後の晩餐、何食べる？', category: '食', placeholder: '例：おばあちゃんの肉じゃが...' },

  // 対人・コミュニケーション
  { id: 'g11', question: '友達からどんな人だと思われてると思う？', category: '他者視点', placeholder: '例：聞き上手、面白い...' },
  { id: 'g12', question: '初対面の人と話すとき、最初に何を聞く？', category: 'コミュニケーション', placeholder: '例：出身地、仕事...' },
  { id: 'g13', question: '「ありがとう」って最近誰に言った？何で？', category: '感謝', placeholder: '例：同僚に、助けてもらって...' },
  { id: 'g14', question: '一番影響を受けた人は誰？', category: '人間関係', placeholder: '例：母親、恩師...' },
  { id: 'g15', question: 'チームで任されることが多い役割は？', category: '役割', placeholder: '例：まとめ役、アイデア出し...' },

  // 仕事・キャリア
  { id: 'g16', question: '仕事でテンションが上がる瞬間は？', category: '仕事', placeholder: '例：企画が通った時...' },
  { id: 'g17', question: '「これは得意かも」と密かに思ってることは？', category: 'スキル', placeholder: '例：段取り、プレゼン...' },
  { id: 'g18', question: '仕事で「これだけは嫌」ってことある？', category: '仕事', placeholder: '例：単調な作業、嘘をつくこと...' },

  // 感性・趣味
  { id: 'g19', question: '最近グッときた言葉やフレーズは？', category: '感性', placeholder: '例：歌の歌詞、名言...' },
  { id: 'g20', question: '旅行するなら都会派？自然派？', category: '旅', placeholder: '理由も教えて！' },
  { id: 'g21', question: 'もし1日だけ別の職業を体験できるとしたら？', category: '妄想', placeholder: '例：宇宙飛行士、パティシエ...' },
  { id: 'g22', question: '今の気分を天気で表すと？', category: '感情', placeholder: '例：晴れ、くもり時々晴れ...' },
  { id: 'g23', question: '人生のテーマソングがあるとしたら何？', category: '感性', placeholder: '曲名でも雰囲気でもOK' },
  { id: 'g24', question: '生まれ変わったらなりたいものは？', category: '妄想', placeholder: '人でも動物でも何でもOK' },
  { id: 'g25', question: '密かに自慢できることを一つ教えて！', category: '自慢', placeholder: '些細なことでもOK！' },

  // ちょっと深い系
  { id: 'g26', question: '最近の「小さな幸せ」は何だった？', category: '幸せ', placeholder: '例：猫が膝に乗ってきた...' },
  { id: 'g27', question: '自分の性格で一番好きなところは？', category: '自己肯定', placeholder: '例：切り替えが早い...' },
  { id: 'g28', question: '5年前の自分に「大丈夫」と言えること何？', category: '成長', placeholder: '自由に書いてね' },
  { id: 'g29', question: '誰かに教えたい、自分だけの豆知識は？', category: '知識', placeholder: '例：美味しいコーヒーの淹れ方...' },
  { id: 'g30', question: '休日の朝、理想の過ごし方は？', category: 'ライフスタイル', placeholder: '例：カフェでのんびり...' },
];

export function getRandomGachaQuestion(): GachaQuestion {
  const lastId = typeof window !== 'undefined' ? localStorage.getItem('lastGachaQuestionId') : null;
  const candidates = GACHA_QUESTIONS.filter(q => q.id !== lastId);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  if (typeof window !== 'undefined') {
    localStorage.setItem('lastGachaQuestionId', selected.id);
  }
  return selected;
}

export { GACHA_QUESTIONS };
