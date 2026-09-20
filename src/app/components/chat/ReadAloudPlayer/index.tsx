'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Gauge,
  User,
  X,
  Loader2,
  Download,
  Search,
} from 'lucide-react';
import { LAST_LANGUAGE_STORAGE_KEY } from '../../../../utils/audioCache';
import { detectSpeechLanguage } from '../../../../utils/chat';

export interface ReadAloudPlayerProps {
  text: string;
  voice: string;
  speed: number;
  onVoiceChange: (voice: string) => void;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
  audioPlaybackRef: React.MutableRefObject<HTMLAudioElement | null>;
  readAloud: (
    text: string,
    options?: { voice?: string; language?: string; speed?: number },
  ) => Promise<{ audio: HTMLAudioElement; url: string }>;
  stopAudioPlayback: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;
const LANGUAGE_OPTIONS = [
  { id: 'pt', label: 'Portuguese' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'French' },
  { id: 'es', label: 'Spanish' },
  { id: 'de', label: 'German' },
  { id: 'it', label: 'Italian' },
  { id: 'ja', label: 'Japanese' },
  { id: 'zh', label: 'Chinese' },
  { id: 'hi', label: 'Hindi' },
] as const;

const VOICE_LANGUAGE_LABELS: Record<string, string> = {
  a: 'English (US)',
  b: 'English (UK)',
  e: 'Spanish',
  f: 'French',
  h: 'Hindi',
  i: 'Italian',
  j: 'Japanese',
  p: 'Portuguese',
  z: 'Chinese',
};

type VoiceOption = { id: string; label: string; language: string };

function getVoiceLanguageId(voiceId: string): string | null {
  const prefix = voiceId[0];
  if (prefix === 'a' || prefix === 'b') return 'en';
  return (
    (
      {
        e: 'es',
        f: 'fr',
        h: 'hi',
        i: 'it',
        j: 'ja',
        p: 'pt',
        z: 'zh',
      } as Record<string, string>
    )[prefix] || null
  );
}

const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  pt: 'pf_dora',
  en: 'af_heart',
  fr: 'ff_siwis',
  es: 'ef_dora',
  de: 'ef_dora',
  it: 'if_sara',
  ja: 'jf_alpha',
  zh: 'zf_xiaobei',
  hi: 'hf_alpha',
};

export const POPULAR_VOICES = [
  { id: 'af_heart', label: 'Heart (US Female)' },
  { id: 'af_bella', label: 'Bella (US Female)' },
  { id: 'af_nicole', label: 'Nicole (US Female)' },
  { id: 'af_sarah', label: 'Sarah (US Female)' },
  { id: 'af_sky', label: 'Sky (US Female)' },
  { id: 'am_adam', label: 'Adam (US Male)' },
  { id: 'am_michael', label: 'Michael (US Male)' },
  { id: 'am_onyx', label: 'Onyx (US Male)' },
  { id: 'am_echo', label: 'Echo (US Male)' },
  { id: 'bf_alice', label: 'Alice (UK Female)' },
  { id: 'bf_emma', label: 'Emma (UK Female)' },
  { id: 'bf_lily', label: 'Lily (UK Female)' },
  { id: 'bm_george', label: 'George (UK Male)' },
  { id: 'bm_daniel', label: 'Daniel (UK Male)' },
  { id: 'bm_lewis', label: 'Lewis (UK Male)' },
  { id: 'pf_dora', label: 'Dora (Portuguese Female)' },
  { id: 'pm_alex', label: 'Alex (Portuguese Male)' },
];

export default function ReadAloudPlayer({
  text,
  voice,
  speed,
  onVoiceChange,
  onSpeedChange,
  onClose,
  audioPlaybackRef,
  readAloud,
  stopAudioPlayback,
}: ReadAloudPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>(
    POPULAR_VOICES.map((voiceOption) => ({
      ...voiceOption,
      language: VOICE_LANGUAGE_LABELS[voiceOption.id[0]] || 'Other',
    })),
  );
  const detectedLanguage = detectSpeechLanguage(text);
  const [selectedVoice, setSelectedVoice] = useState(() =>
    detectedLanguage && getVoiceLanguageId(voice) === detectedLanguage
      ? voice
      : (detectedLanguage && DEFAULT_VOICE_BY_LANGUAGE[detectedLanguage]) ||
        voice,
  );
  const [voiceSearch, setVoiceSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return detectedLanguage || 'en';
  });
  const [error, setError] = useState<string | null>(null);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  const languageOptions = [
    LANGUAGE_OPTIONS.find((option) => option.id === detectedLanguage) ||
      LANGUAGE_OPTIONS[1],
    ...LANGUAGE_OPTIONS.filter((option) => option.id !== detectedLanguage),
  ];

  // Fetch available voices from backend if possible
  useEffect(() => {
    let active = true;
    fetch('/api/tts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.voices && Array.isArray(data.voices)) {
          const list: string[] = data.voices;
          const mapped = list.map((v) => {
            const found = POPULAR_VOICES.find((p) => p.id === v);
            if (found) {
              return {
                ...found,
                language: VOICE_LANGUAGE_LABELS[v[0]] || 'Other',
              };
            }
            const prefix = v.slice(0, 2);
            const name = v.slice(3);
            const capName = name.charAt(0).toUpperCase() + name.slice(1);
            const region =
              prefix[0] === 'a'
                ? 'US'
                : prefix[0] === 'b'
                  ? 'UK'
                  : prefix[0] === 'e'
                    ? 'ES'
                    : prefix[0] === 'j'
                      ? 'JA'
                      : prefix[0] === 'z'
                        ? 'ZH'
                        : prefix[0].toUpperCase();
            const gender = prefix[1] === 'f' ? 'Female' : 'Male';
            return {
              id: v,
              label: `${capName} (${region} ${gender})`,
              language: VOICE_LANGUAGE_LABELS[v[0]] || 'Other',
            };
          });
          setVoices(mapped);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const detectedVoices = voices.filter(
    (voiceOption) =>
      Boolean(detectedLanguage) &&
      getVoiceLanguageId(voiceOption.id) === detectedLanguage,
  );
  const lastUsedVoice = voices.find((voiceOption) => voiceOption.id === voice);
  const normalizedVoiceSearch = voiceSearch.trim().toLowerCase();
  const matchesVoiceSearch = (voiceOption: VoiceOption) =>
    !normalizedVoiceSearch ||
    `${voiceOption.label} ${voiceOption.id} ${voiceOption.language}`
      .toLowerCase()
      .includes(normalizedVoiceSearch);
  const filteredDetectedVoices = detectedVoices.filter(matchesVoiceSearch);
  const filteredAllVoices = voices.filter(matchesVoiceSearch);

  const cleanupAudio = useCallback(() => {
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.src = '';
      localAudioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  const handleSaveAudio = useCallback(() => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `read-aloud-${selectedVoice}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [audioUrl, selectedVoice]);

  const loadAndPlay = useCallback(
    async (
      targetVoice = selectedVoice,
      targetSpeed = speed,
      targetLanguage = selectedLanguage,
    ) => {
      cleanupAudio();
      stopAudioPlayback();
      setIsSynthesizing(true);
      setError(null);
      setCurrentTime(0);
      setDuration(0);

      try {
        const { audio, url } = await readAloud(text, {
          voice: targetVoice,
          language: targetLanguage,
          speed: targetSpeed,
        });
        localAudioRef.current = audio;
        setAudioUrl(url);

        const onTimeUpdate = () => {
          setCurrentTime(audio.currentTime);
        };
        const onLoadedMetadata = () => {
          if (
            audio.duration &&
            !isNaN(audio.duration) &&
            isFinite(audio.duration)
          ) {
            setDuration(audio.duration);
          }
        };
        const onEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };
        const onError = () => {
          setIsPlaying(false);
          setIsSynthesizing(false);
          setError('Failed to play audio.');
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        audio.playbackRate = targetSpeed;
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        // If aborted due to another request or voice change, ignore quietly
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (
          typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          (err as { name?: string }).name === 'AbortError'
        ) {
          return;
        }
        console.error('TTS error:', err);
        setError(
          err instanceof Error ? err.message : 'Speech synthesis failed.',
        );
      } finally {
        setIsSynthesizing(false);
      }
    },
    [
      cleanupAudio,
      readAloud,
      selectedLanguage,
      selectedVoice,
      speed,
      stopAudioPlayback,
      text,
    ],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      stopAudioPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePlay = () => {
    const audio = localAudioRef.current || audioPlaybackRef.current;
    if (!audio) {
      void loadAndPlay();
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleStop = () => {
    const audio = localAudioRef.current || audioPlaybackRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    const audio = localAudioRef.current || audioPlaybackRef.current;
    if (audio) {
      audio.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    onSpeedChange(newSpeed);
    try {
      localStorage.setItem('last_tts_speed', newSpeed.toString());
    } catch {
      // Ignore storage errors
    }
    const audio = localAudioRef.current || audioPlaybackRef.current;
    if (audio) {
      audio.playbackRate = newSpeed;
    }
  };

  const handleVoiceChange = (newVoice: string) => {
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.currentTime = 0;
    }
    stopAudioPlayback();
    setIsPlaying(false);
    setSelectedVoice(newVoice);
    const newLanguage = getVoiceLanguageId(newVoice) || 'en';
    setSelectedLanguage(newLanguage);
    try {
      localStorage.setItem('last_tts_voice', newVoice);
      localStorage.setItem(LAST_LANGUAGE_STORAGE_KEY, newLanguage);
    } catch {
      // Ignore storage errors
    }
    onVoiceChange(newVoice);
  };

  const handleLanguageChange = (newLanguage: string) => {
    if (!LANGUAGE_OPTIONS.some((option) => option.id === newLanguage)) return;
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.currentTime = 0;
    }
    stopAudioPlayback();
    setIsPlaying(false);
    setSelectedLanguage(newLanguage);
    try {
      localStorage.setItem(LAST_LANGUAGE_STORAGE_KEY, newLanguage);
    } catch {
      // Ignore storage errors
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="mt-3 p-3 rounded-xl bg-neutral-900/90 border border-sky-500/30 shadow-lg text-neutral-200 flex flex-col gap-2.5 transition-all">
      {/* Top row: Status, Voice selector & Close */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-sky-400">
          {isSynthesizing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing speech...</span>
            </>
          ) : error ? (
            <span className="text-red-400 flex items-center gap-1">
              <VolumeX className="w-3.5 h-3.5" />
              {error}
            </span>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              <span>Read Aloud</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-800/90 border border-neutral-700/80 rounded-md px-1.5 py-0.5">
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isSynthesizing}
              className="bg-transparent text-[11px] text-neutral-200 focus:outline-none cursor-pointer pr-1"
              title="Select language"
            >
              {languageOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  className="bg-neutral-900 text-neutral-200"
                >
                  {option.label}
                  {option.id === detectedLanguage ? ' (detected)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selector */}
          <div className="relative flex items-center gap-1 bg-neutral-800/90 border border-neutral-700/80 rounded-md px-1.5 py-0.5">
            <User className="w-3 h-3 text-neutral-400" />
            <details className="group">
              <summary className="max-w-[150px] list-none cursor-pointer truncate text-[11px] text-neutral-200 pr-1">
                {voices.find((voiceOption) => voiceOption.id === selectedVoice)
                  ?.label || selectedVoice}
              </summary>
              <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
                <div className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <input
                    value={voiceSearch}
                    onChange={(event) => setVoiceSearch(event.target.value)}
                    placeholder="Search voices or languages"
                    className="w-full bg-transparent py-1.5 text-[11px] text-neutral-100 outline-none placeholder:text-neutral-500"
                    autoComplete="off"
                  />
                </div>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {lastUsedVoice && matchesVoiceSearch(lastUsedVoice) && (
                    <div>
                      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Last used
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVoiceChange(lastUsedVoice.id)}
                        className="w-full rounded px-2 py-1.5 text-left text-[11px] text-neutral-200 hover:bg-neutral-800"
                      >
                        {lastUsedVoice.label}
                      </button>
                    </div>
                  )}
                  {filteredDetectedVoices.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                        {LANGUAGE_OPTIONS.find(
                          (option) => option.id === detectedLanguage,
                        )?.label || detectedLanguage}{' '}
                        voices (detected)
                      </div>
                      {filteredDetectedVoices.map((voiceOption) => (
                        <button
                          key={`detected-${voiceOption.id}`}
                          type="button"
                          onClick={() => handleVoiceChange(voiceOption.id)}
                          className={`w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-neutral-800 ${
                            selectedVoice === voiceOption.id
                              ? 'bg-sky-950/60 text-sky-300'
                              : 'text-neutral-200'
                          }`}
                        >
                          {voiceOption.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div>
                    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      All voices
                    </div>
                    {filteredAllVoices.map((voiceOption) => (
                      <button
                        key={voiceOption.id}
                        type="button"
                        onClick={() => handleVoiceChange(voiceOption.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-neutral-800 ${
                          selectedVoice === voiceOption.id
                            ? 'bg-sky-950/60 text-sky-300'
                            : 'text-neutral-200'
                        }`}
                      >
                        <span className="block">{voiceOption.label}</span>
                        <span className="block text-[10px] text-neutral-500">
                          {voiceOption.language}
                        </span>
                      </button>
                    ))}
                    {filteredAllVoices.length === 0 && (
                      <div className="px-2 py-2 text-[11px] text-neutral-500">
                        No voices found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Save / Download Audio */}
          <button
            type="button"
            onClick={handleSaveAudio}
            disabled={!audioUrl || isSynthesizing}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-sky-300 transition cursor-pointer disabled:opacity-30 disabled:hover:text-neutral-400"
            title={audioUrl ? 'Save audio file (.wav)' : 'Generating audio...'}
            aria-label="Save audio"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Close Player */}
          <button
            type="button"
            onClick={() => {
              handleStop();
              onClose();
            }}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
            title="Close player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main player controls: Play/Pause, Stop, Scrubber, Time, Speed */}
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isSynthesizing}
          className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-neutral-950 flex items-center justify-center transition shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={handleStop}
          disabled={isSynthesizing}
          className="w-7 h-7 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition shrink-0 cursor-pointer border border-neutral-700/60"
          title="Stop audio"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>

        {/* Scrubber and Times */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={isSynthesizing || duration === 0}
            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            title="Seek"
          />
          <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Speed cycler / dropdown */}
        <div className="flex items-center gap-1 shrink-0 bg-neutral-800/90 border border-neutral-700/80 rounded-md px-1.5 py-1">
          <Gauge className="w-3 h-3 text-neutral-400" />
          <select
            value={speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="bg-transparent text-[11px] font-semibold text-sky-400 focus:outline-none cursor-pointer"
            title="Playback Speed (faster or slower)"
          >
            {SPEED_OPTIONS.map((rate) => (
              <option
                key={rate}
                value={rate}
                className="bg-neutral-900 text-neutral-200"
              >
                {rate}x
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
