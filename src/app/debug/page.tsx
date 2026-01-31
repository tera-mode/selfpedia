'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { INTERVIEW_MODES, InterviewModeConfig, COMMON_RULES } from '@/lib/interviewModes';
import { OUTPUT_TYPES, OutputTypeConfig } from '@/lib/outputTypes';
import UserHeader from '@/components/UserHeader';

type TabType = 'interview' | 'output' | 'user';

interface InterviewStats {
  total: number;
  byMode: Record<string, number>;
  byDate: Record<string, number>;
  byMonth: Record<string, number>;
}

export default function DebugPage() {
  const router = useRouter();
  const { user, loading, userProfile, userInterviewer, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('interview');
  const [expandedMode, setExpandedMode] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);
  const [interviewStats, setInterviewStats] = useState<InterviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 管理者でない場合はルートにリダイレクト
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [loading, isAdmin, router]);

  // インタビュー統計を取得
  useEffect(() => {
    if (user && activeTab === 'user') {
      fetchInterviewStats();
    }
  }, [user, activeTab]);

  const fetchInterviewStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/get-user-interviews?userId=${user.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const interviews = data.interviews || [];

        // 統計を計算
        const stats: InterviewStats = {
          total: interviews.length,
          byMode: {},
          byDate: {},
          byMonth: {},
        };

        interviews.forEach((interview: { mode?: string; createdAt?: string }) => {
          // モード別
          const mode = interview.mode || 'basic';
          stats.byMode[mode] = (stats.byMode[mode] || 0) + 1;

          // 日付別・月別
          if (interview.createdAt) {
            const date = new Date(interview.createdAt);
            const dateKey = date.toISOString().split('T')[0];
            const monthKey = dateKey.substring(0, 7);

            stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
            stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
          }
        });

        setInterviewStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch interview stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // ローディング中または管理者でない場合
  if (loading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-gray-600">{loading ? '読み込み中...' : 'リダイレクト中...'}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'interview', label: 'インタビュー設定', icon: '💬' },
    { id: 'output', label: 'アウトプット設定', icon: '📝' },
    { id: 'user', label: 'ユーザーデータ', icon: '👤' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-warm">
      <div className="gradient-orb gradient-orb-orange absolute -right-40 top-20 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -left-40 bottom-20 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 flex-1 px-4 py-8">
        <main className="mx-auto w-full max-w-6xl">
          {/* ヘッダー */}
          <div className="mb-8 text-center">
            <h1 className="mb-3 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Debug Page
            </h1>
            <p className="text-gray-600">システム設定とユーザーデータの確認</p>
          </div>

          {/* タブ */}
          <div className="mb-6 flex justify-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-orange-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* タブコンテンツ */}
          <div className="glass-card rounded-3xl p-6">
            {activeTab === 'interview' && (
              <InterviewSettingsTab
                expandedMode={expandedMode}
                setExpandedMode={setExpandedMode}
              />
            )}
            {activeTab === 'output' && (
              <OutputSettingsTab
                expandedOutput={expandedOutput}
                setExpandedOutput={setExpandedOutput}
              />
            )}
            {activeTab === 'user' && (
              <UserDataTab
                user={user}
                userProfile={userProfile}
                userInterviewer={userInterviewer}
                interviewStats={interviewStats}
                statsLoading={statsLoading}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// インタビュー設定タブ
function InterviewSettingsTab({
  expandedMode,
  setExpandedMode,
}: {
  expandedMode: string | null;
  setExpandedMode: (mode: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">インタビューモード設定</h2>

      {INTERVIEW_MODES.map((mode: InterviewModeConfig) => (
        <div key={mode.id} className="rounded-2xl border border-orange-200 bg-white/50 overflow-hidden">
          <button
            onClick={() => setExpandedMode(expandedMode === mode.id ? null : mode.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{mode.icon}</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-900">{mode.name}</h3>
                <p className="text-sm text-gray-600">{mode.description}</p>
              </div>
            </div>
            <span className="text-orange-500">
              {expandedMode === mode.id ? '▲' : '▼'}
            </span>
          </button>

          {expandedMode === mode.id && (
            <div className="border-t border-orange-200 p-4 space-y-4">
              {/* 基本情報 */}
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="モードID" value={mode.id} />
                <InfoCard
                  label="質問数"
                  value={mode.questionCount === 'endless' ? 'エンドレス（無制限）' : `${mode.questionCount}問`}
                />
              </div>

              {/* 機能リスト */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">機能</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {mode.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>

              {/* システムプロンプト */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">システムプロンプト（AIへの指示）</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  {mode.systemPromptFocus.trim()}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 共通設定 */}
      <div className="mt-8 rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">共通設定</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="固定質問フェーズ" value="2ステップ（呼び名、職業）" />
          <InfoCard label="デフォルト深掘り質問数" value="10問" />
        </div>
        <div className="mt-4">
          <h4 className="font-semibold text-gray-700 mb-2">固定質問の流れ</h4>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>呼び名を聞く（ニックネーム抽出）</li>
            <li>職業・活動内容を聞く</li>
          </ol>
        </div>
      </div>

      {/* 共通ルール（全モード共通のプロンプト） */}
      <div className="mt-8 rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">共通ルール（全モード共通のプロンプト）</h3>
        <p className="text-sm text-gray-600 mb-4">
          以下のルールは全てのインタビューモードで適用されます。各モードのsystemPromptFocusに埋め込まれています。
        </p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {COMMON_RULES.trim()}
        </pre>
      </div>
    </div>
  );
}

// アウトプット設定タブ
function OutputSettingsTab({
  expandedOutput,
  setExpandedOutput,
}: {
  expandedOutput: string | null;
  setExpandedOutput: (output: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">アウトプットタイプ設定</h2>

      {OUTPUT_TYPES.map((output: OutputTypeConfig) => (
        <div key={output.id} className="rounded-2xl border border-orange-200 bg-white/50 overflow-hidden">
          <button
            onClick={() => setExpandedOutput(expandedOutput === output.id ? null : output.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{output.icon}</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{output.name}</h3>
                  {!output.enabled && (
                    <span className="rounded-full bg-gray-300 px-2 py-0.5 text-xs text-gray-600">
                      未実装
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{output.description}</p>
              </div>
            </div>
            <span className="text-orange-500">
              {expandedOutput === output.id ? '▲' : '▼'}
            </span>
          </button>

          {expandedOutput === output.id && (
            <div className="border-t border-orange-200 p-4 space-y-4">
              {/* 基本情報 */}
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="タイプID" value={output.id} />
                <InfoCard label="文字数範囲" value={`${output.minLength}〜${output.maxLength}文字`} />
                <InfoCard label="ステータス" value={output.enabled ? '有効' : '無効（後日実装）'} />
              </div>

              {/* 推奨モード */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">推奨インタビューモード</h4>
                <div className="flex gap-2 flex-wrap">
                  {output.recommendedModes.map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>

              {/* システムプロンプト */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">生成用システムプロンプト</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  {output.systemPrompt.trim()}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ユーザーデータタブ
function UserDataTab({
  user,
  userProfile,
  userInterviewer,
  interviewStats,
  statsLoading,
}: {
  user: import('firebase/auth').User | null;
  userProfile: import('@/types').UserProfile | null;
  userInterviewer: import('@/types').UserInterviewer | null;
  interviewStats: InterviewStats | null;
  statsLoading: boolean;
}) {
  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ログインしていません</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">ユーザーデータ</h2>

      {/* 認証情報 */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">認証情報</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="UID" value={user.uid} />
          <InfoCard
            label="ステータス"
            value={user.isAnonymous ? 'ゲスト（匿名）' : '会員'}
            highlight={!user.isAnonymous}
          />
          <InfoCard label="メールアドレス" value={user.email || '未設定'} />
          <InfoCard label="表示名" value={user.displayName || '未設定'} />
          <InfoCard
            label="メール認証"
            value={user.emailVerified ? '認証済み' : '未認証'}
            highlight={user.emailVerified}
          />
          <InfoCard
            label="アカウント作成日"
            value={user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleString('ja-JP') : '不明'}
          />
        </div>
      </div>

      {/* プロフィール情報 */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">プロフィール情報（Firestore）</h3>
        {userProfile ? (
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="ニックネーム" value={userProfile.nickname || '未設定'} />
            <InfoCard label="職業" value={userProfile.occupation || '未設定'} />
            <InfoCard
              label="オンボーディング"
              value={userProfile.onboardingCompleted ? '完了' : '未完了'}
              highlight={userProfile.onboardingCompleted}
            />
          </div>
        ) : (
          <p className="text-gray-600">プロフィールデータなし</p>
        )}
      </div>

      {/* インタビュワー設定 */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">インタビュワー設定</h3>
        {userInterviewer ? (
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="インタビュワーID" value={userInterviewer.id || '未設定'} />
            <InfoCard label="カスタム名" value={userInterviewer.customName || '未設定'} />
          </div>
        ) : (
          <p className="text-gray-600">インタビュワー未設定</p>
        )}
      </div>

      {/* インタビュー統計 */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">インタビュー統計</h3>
        {statsLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 spinner-warm"></div>
            <span className="text-gray-600">読み込み中...</span>
          </div>
        ) : interviewStats ? (
          <div className="space-y-4">
            {/* 総計 */}
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard label="総インタビュー数" value={`${interviewStats.total}回`} highlight />
            </div>

            {/* モード別 */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">モード別</h4>
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(interviewStats.byMode).map(([mode, count]) => (
                  <div key={mode} className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                    <span className="text-gray-700">{mode}</span>
                    <span className="font-bold text-orange-600">{count}回</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 月別 */}
            {Object.keys(interviewStats.byMonth).length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">月別</h4>
                <div className="grid gap-2 md:grid-cols-4">
                  {Object.entries(interviewStats.byMonth)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([month, count]) => (
                      <div key={month} className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700">{month}</span>
                        <span className="font-bold text-orange-600">{count}回</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 日別（最新10日） */}
            {Object.keys(interviewStats.byDate).length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">日別（最新10日）</h4>
                <div className="grid gap-2 md:grid-cols-5">
                  {Object.entries(interviewStats.byDate)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 10)
                    .map(([date, count]) => (
                      <div key={date} className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700 text-sm">{date}</span>
                        <span className="font-bold text-orange-600">{count}回</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600">統計データなし</p>
        )}
      </div>

      {/* 生データ */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">生データ（JSON）</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-96">
          {JSON.stringify(
            {
              user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                isAnonymous: user.isAnonymous,
                emailVerified: user.emailVerified,
                metadata: user.metadata,
              },
              userProfile,
              userInterviewer,
              interviewStats,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

// 情報カードコンポーネント
function InfoCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-orange-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-orange-600' : 'text-gray-900'} break-all`}>
        {value}
      </p>
    </div>
  );
}
