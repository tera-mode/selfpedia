'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { INTERVIEW_MODES, InterviewModeConfig, COMMON_RULES } from '@/lib/interviewModes';
import { OUTPUT_TYPES, OutputTypeConfig } from '@/lib/outputTypes';
import UserHeader from '@/components/UserHeader';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { Mic, MicOff, Volume2, Loader2, Play, RotateCcw } from 'lucide-react';

type TabType = 'interview' | 'output' | 'user' | 'voice';

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

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [loading, isAdmin, router]);

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
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const interviews = data.interviews || [];
        const stats: InterviewStats = { total: interviews.length, byMode: {}, byDate: {}, byMonth: {} };
        interviews.forEach((interview: { mode?: string; createdAt?: string }) => {
          const mode = interview.mode || 'basic';
          stats.byMode[mode] = (stats.byMode[mode] || 0) + 1;
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
    { id: 'voice', label: '音声テスト', icon: '🎙️' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-warm">
      <div className="gradient-orb gradient-orb-orange absolute -right-40 top-20 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -left-40 bottom-20 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 flex-1 px-4 py-8">
        <main className="mx-auto w-full max-w-6xl">
          <div className="mb-8 text-center">
            <h1 className="mb-3 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Debug Page
            </h1>
            <p className="text-gray-600">システム設定とユーザーデータの確認</p>
          </div>

          <div className="mb-6 flex flex-wrap justify-center gap-2">
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

          <div className="glass-card rounded-3xl p-6">
            {activeTab === 'interview' && (
              <InterviewSettingsTab expandedMode={expandedMode} setExpandedMode={setExpandedMode} />
            )}
            {activeTab === 'output' && (
              <OutputSettingsTab expandedOutput={expandedOutput} setExpandedOutput={setExpandedOutput} />
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
            {activeTab === 'voice' && <VoiceTestTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 音声テストタブ
// ─────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'error' | 'warn';
interface LogEntry { level: LogLevel; msg: string; ts: string }

function VoiceTestTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [browserInfo, setBrowserInfo] = useState<Record<string, string>>({});

  // TTS
  const [ttsText, setTtsText] = useState('こんにちは！今日のインタビューを始めましょう。');
  const [ttsVoice, setTtsVoice] = useState('female_01');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT
  const [isRecording, setIsRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const [sttResult, setSttResult] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [detectedMimeType, setDetectedMimeType] = useState('');

  const log = (level: LogLevel, msg: string) => {
    const ts = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setLogs(prev => [...prev, { level, msg, ts }]);
  };

  useEffect(() => {
    // ブラウザ環境情報を収集
    const info: Record<string, string> = {};
    info['UserAgent'] = navigator.userAgent;
    info['audio/webm;codecs=opus'] = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? '✅ 対応' : '❌ 非対応';
    info['audio/webm'] = MediaRecorder.isTypeSupported('audio/webm') ? '✅ 対応' : '❌ 非対応';
    info['audio/mp4'] = MediaRecorder.isTypeSupported('audio/mp4') ? '✅ 対応' : '❌ 非対応';
    info['audio/ogg'] = MediaRecorder.isTypeSupported('audio/ogg') ? '✅ 対応' : '❌ 非対応';
    info['MediaRecorder'] = typeof MediaRecorder !== 'undefined' ? '✅ 利用可' : '❌ 非対応';

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';
    info['使用するフォーマット'] = mimeType;
    setDetectedMimeType(mimeType);
    setBrowserInfo(info);

    log('info', `ブラウザ情報を収集しました`);
    log('info', `録音フォーマット: ${mimeType}`);
    log('info', `STTエンコーディング: ${mimeType.startsWith('audio/mp4') ? 'MP3（iOS）' : 'WEBM_OPUS'}`);
  }, []);

  // ── TTS テスト ──────────────────────────────
  const handleTtsTest = async () => {
    if (!ttsText.trim() || ttsLoading) return;
    setTtsLoading(true);
    setTtsAudioUrl(null);
    log('info', `TTS開始: voice="${ttsVoice}", テキスト="${ttsText.slice(0, 30)}..."`);

    try {
      log('info', 'POST /api/tts ...');
      const res = await authenticatedFetch('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text: ttsText, interviewerId: ttsVoice }),
      });

      log('info', `レスポンス status: ${res.status}`);

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json();
      log('info', `audioBase64 受信: ${data.audioBase64?.length ?? 0} chars`);

      if (!data.audioBase64) throw new Error('audioBase64 が空です');

      const url = `data:audio/mp3;base64,${data.audioBase64}`;
      setTtsAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => log('success', '音声再生 完了');
      audio.onerror = (e) => log('error', `音声再生エラー: ${JSON.stringify(e)}`);
      await audio.play();
      log('success', 'TTS成功・再生中');
    } catch (e) {
      log('error', `TTSエラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleTtsReplay = () => {
    if (!ttsAudioUrl) return;
    audioRef.current?.pause();
    const audio = new Audio(ttsAudioUrl);
    audioRef.current = audio;
    audio.onended = () => log('info', '再生完了（リプレイ）');
    audio.play();
    log('info', 'リプレイ');
  };

  // ── STT テスト ──────────────────────────────
  const handleStartRecording = async () => {
    if (isRecording) return;
    setSttResult('');
    log('info', 'マイクアクセス要求中...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log('success', 'マイクアクセス許可');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';
      log('info', `録音開始: mimeType="${mimeType}"`);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        log('info', `録音停止: blob size=${blob.size} bytes`);

        if (blob.size < 100) {
          log('warn', '録音データが小さすぎます（マイクが無音？）');
          setSttLoading(false);
          return;
        }

        setSttLoading(true);
        log('info', 'base64変換中...');

        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const audioBase64 = btoa(binary);
        log('info', `base64変換完了: ${audioBase64.length} chars`);

        const encoding = mimeType.startsWith('audio/mp4') ? 'MP3' : 'WEBM_OPUS';
        log('info', `POST /api/stt: encoding="${encoding}"`);

        try {
          const res = await authenticatedFetch('/api/stt', {
            method: 'POST',
            body: JSON.stringify({ audioBase64, encoding }),
          });

          log('info', `STTレスポンス status: ${res.status}`);

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
          }

          const data = await res.json();
          log('success', `STT結果: "${data.transcript || '（空）'}"`);
          setSttResult(data.transcript || '（テキストなし）');
        } catch (e) {
          log('error', `STTエラー: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setSttLoading(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (e) {
      log('error', `マイクエラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    log('info', '録音停止ボタン押下');
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const clearLogs = () => setLogs([]);

  const logColor: Record<LogLevel, string> = {
    info: 'text-blue-300',
    success: 'text-green-400',
    error: 'text-red-400',
    warn: 'text-yellow-300',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">音声機能テスト</h2>

      {/* ブラウザ環境 */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="mb-3 font-bold text-gray-900">ブラウザ環境</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {Object.entries(browserInfo).map(([key, val]) => (
            <div key={key} className="flex items-start justify-between gap-2 rounded-lg bg-orange-50 px-3 py-2">
              <span className="text-xs text-gray-500 shrink-0">{key}</span>
              <span className="text-xs font-semibold text-gray-800 break-all text-right">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TTS テスト */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="mb-3 font-bold text-gray-900">① TTS テスト（テキスト → 音声）</h3>

        <div className="mb-3 flex gap-2">
          {(['female_01', 'male_01', 'self'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTtsVoice(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                ttsVoice === v
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              {v === 'female_01' ? '女性 (female_01)' : v === 'male_01' ? '男性 (male_01)' : '自分AI (self)'}
            </button>
          ))}
        </div>

        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="読み上げるテキストを入力..."
        />

        <div className="flex gap-2">
          <button
            onClick={handleTtsTest}
            disabled={ttsLoading || !ttsText.trim()}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-orange-600"
          >
            {ttsLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
            {ttsLoading ? '生成中...' : 'TTSで読み上げ'}
          </button>
          {ttsAudioUrl && (
            <button
              onClick={handleTtsReplay}
              className="flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50"
            >
              <Play size={16} />
              再生
            </button>
          )}
        </div>
      </div>

      {/* STT テスト */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="mb-3 font-bold text-gray-900">② STT テスト（音声 → テキスト）</h3>
        <p className="mb-4 text-sm text-gray-600">
          ボタンを押している間録音されます。離すとSTT APIに送信されます。
        </p>

        <div className="mb-4 flex items-center gap-4">
          <button
            onMouseDown={handleStartRecording}
            onMouseUp={handleStopRecording}
            onTouchStart={(e) => { e.preventDefault(); handleStartRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); handleStopRecording(); }}
            disabled={sttLoading}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition-all ${
              isRecording
                ? 'animate-pulse bg-red-500 scale-110'
                : sttLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 active:scale-95'
            }`}
          >
            {sttLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : isRecording ? (
              <MicOff size={24} />
            ) : (
              <Mic size={24} />
            )}
          </button>

          <div>
            <p className="text-sm font-semibold text-gray-700">
              {isRecording ? '🔴 録音中...' : sttLoading ? '⏳ 変換中...' : '待機中'}
            </p>
            <p className="text-xs text-gray-500">フォーマット: {detectedMimeType}</p>
          </div>
        </div>

        {sttResult && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-1 text-xs font-semibold text-green-600">STT結果</p>
            <p className="text-gray-800">{sttResult}</p>
          </div>
        )}
      </div>

      {/* ログ */}
      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">ログ</h3>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw size={12} />
            クリア
          </button>
        </div>
        <div className="h-64 overflow-y-auto rounded-xl bg-gray-900 p-4 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-500">ログなし</p>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-gray-500">{entry.ts}</span>
                <span className={logColor[entry.level]}>{entry.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 既存タブ（変更なし）
// ─────────────────────────────────────────────

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
            <span className="text-orange-500">{expandedMode === mode.id ? '▲' : '▼'}</span>
          </button>

          {expandedMode === mode.id && (
            <div className="border-t border-orange-200 p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="モードID" value={mode.id} />
                <InfoCard
                  label="質問数"
                  value={mode.questionCount === 'endless' ? 'エンドレス（無制限）' : `${mode.questionCount}問`}
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">機能</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {mode.features.map((feature, i) => <li key={i}>{feature}</li>)}
                </ul>
              </div>
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

      <div className="mt-8 rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">共通設定</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="固定質問フェーズ" value="2ステップ（呼び名、職業）" />
          <InfoCard label="デフォルト深掘り質問数" value="10問" />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">共通ルール（全モード共通のプロンプト）</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {COMMON_RULES.trim()}
        </pre>
      </div>
    </div>
  );
}

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
                    <span className="rounded-full bg-gray-300 px-2 py-0.5 text-xs text-gray-600">未実装</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{output.description}</p>
              </div>
            </div>
            <span className="text-orange-500">{expandedOutput === output.id ? '▲' : '▼'}</span>
          </button>

          {expandedOutput === output.id && (
            <div className="border-t border-orange-200 p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="タイプID" value={output.id} />
                <InfoCard label="文字数範囲" value={`${output.minLength}〜${output.maxLength}文字`} />
                <InfoCard label="ステータス" value={output.enabled ? '有効' : '無効（後日実装）'} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">推奨インタビューモード</h4>
                <div className="flex gap-2 flex-wrap">
                  {output.recommendedModes.map((mode) => (
                    <span key={mode} className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
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
    return <div className="py-12 text-center"><p className="text-gray-600">ログインしていません</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">ユーザーデータ</h2>

      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">認証情報</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="UID" value={user.uid} />
          <InfoCard label="ステータス" value={user.isAnonymous ? 'ゲスト（匿名）' : '会員'} highlight={!user.isAnonymous} />
          <InfoCard label="メールアドレス" value={user.email || '未設定'} />
          <InfoCard label="表示名" value={user.displayName || '未設定'} />
          <InfoCard label="メール認証" value={user.emailVerified ? '認証済み' : '未認証'} highlight={user.emailVerified} />
          <InfoCard label="アカウント作成日" value={user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleString('ja-JP') : '不明'} />
        </div>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">プロフィール情報（Firestore）</h3>
        {userProfile ? (
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="ニックネーム" value={userProfile.nickname || '未設定'} />
            <InfoCard label="職業" value={userProfile.occupation || '未設定'} />
            <InfoCard label="オンボーディング" value={userProfile.onboardingCompleted ? '完了' : '未完了'} highlight={userProfile.onboardingCompleted} />
          </div>
        ) : (
          <p className="text-gray-600">プロフィールデータなし</p>
        )}
      </div>

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

      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">インタビュー統計</h3>
        {statsLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 spinner-warm"></div>
            <span className="text-gray-600">読み込み中...</span>
          </div>
        ) : interviewStats ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard label="総インタビュー数" value={`${interviewStats.total}回`} highlight />
            </div>
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
            {Object.keys(interviewStats.byMonth).length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">月別</h4>
                <div className="grid gap-2 md:grid-cols-4">
                  {Object.entries(interviewStats.byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, count]) => (
                    <div key={month} className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                      <span className="text-gray-700">{month}</span>
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

      <div className="rounded-2xl border border-orange-200 bg-white/50 p-4">
        <h3 className="font-bold text-gray-900 mb-4">生データ（JSON）</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-96">
          {JSON.stringify({ user: { uid: user.uid, email: user.email, displayName: user.displayName, isAnonymous: user.isAnonymous, emailVerified: user.emailVerified, metadata: user.metadata }, userProfile, userInterviewer, interviewStats }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function InfoCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-orange-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-orange-600' : 'text-gray-900'} break-all`}>{value}</p>
    </div>
  );
}
